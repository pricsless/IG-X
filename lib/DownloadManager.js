const { exec } = require('child_process');
const { buildInstagramCommand, buildSingleUrlCommand } = require('./instagram');
const { buildTwitterCommand } = require('./twitter');

class DownloadManager {
  constructor() {
    this.activeProcesses = new Map();
    this.isRunning = false;
    this.shouldStop = false;
    this.sessionStats = { totalFiles: 0, totalPosts: 0, accountsDone: 0, totalAccounts: 0 };
  }

  stop() {
    this.shouldStop = true;
    for (const [pid, proc] of this.activeProcesses) {
      try { proc.kill('SIGTERM'); } catch (e) {}
    }
    this.activeProcesses.clear();
    this.isRunning = false;
  }

  downloadAccount(options, socket) {
    const { platform, username, galleryDlPath, cookiesFile, contentType, maxAlreadyExists, sleepRequest, retries, timeout, index, total, batchNum } = options;

    return new Promise((resolve) => {
      let command;

      if (platform === 'instagram') {
        command = buildInstagramCommand({ galleryDlPath, cookiesFile, username, contentType, sleepRequest, retries, timeout });
      } else {
        command = buildTwitterCommand({ galleryDlPath, cookiesFile, username, sleepRequest, retries, timeout });
      }

      socket.emit('download:log', { message: `Starting @${username} [${index}/${total}]`, type: 'info' });

      const childProcess = exec(command, { maxBuffer: 50 * 1024 * 1024 });
      this.activeProcesses.set(childProcess.pid, childProcess);

      let alreadyExistsCount = 0;
      let newDownloadsCount = 0;
      const seenPosts = new Set();
      let hasStartedSkipDetection = false;

      const extractPostId = (filename) => {
        const match = filename.match(/^(\d+)(?:_|\.|$)/);
        return match ? match[1] : filename.replace(/\.[^.]+$/, '');
      };

      childProcess.stdout.on('data', (data) => {
        if (this.shouldStop) return;
        const lines = data.toString().split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          // New file downloaded
          if (!trimmed.startsWith('#') && (trimmed.includes('/downloads/') || trimmed.includes('/gallery-dl/') || trimmed.startsWith('downloads/') || trimmed.startsWith('gallery-dl/'))) {
            alreadyExistsCount = 0;
            hasStartedSkipDetection = false;
            newDownloadsCount++;

            const filename = trimmed.split('/').pop();
            const extension = filename.split('.').pop().toUpperCase();
            const postId = extractPostId(filename);
            if (postId) seenPosts.add(postId);

            socket.emit('download:file', {
              username,
              filename: filename.substring(0, 40),
              extension,
              count: newDownloadsCount,
              posts: seenPosts.size,
            });

            socket.emit('download:log', {
              message: `[${newDownloadsCount}] ${extension} - ${filename.substring(0, 35)}... (@${username})`,
              type: 'download',
            });
          }
          // Already exists
          else if (trimmed.startsWith('#') && (trimmed.includes('/downloads/') || trimmed.includes('/gallery-dl/') || trimmed.includes('downloads/') || trimmed.includes('gallery-dl/'))) {
            alreadyExistsCount++;

            if (!hasStartedSkipDetection) {
              socket.emit('download:log', { message: `Old content detected for @${username}...`, type: 'skip' });
              hasStartedSkipDetection = true;
            }

            if (alreadyExistsCount % 10 === 0) {
              socket.emit('download:skip', { username, skipCount: alreadyExistsCount, threshold: maxAlreadyExists });
            }

            if (alreadyExistsCount >= maxAlreadyExists) {
              socket.emit('download:log', { message: `@${username} up to date (${maxAlreadyExists} old files found)`, type: 'skip' });
              childProcess.kill('SIGTERM');
              return;
            }
          }
        }
      });

      childProcess.stderr.on('data', (data) => {
        const errorText = data.toString().trim();
        if (errorText.includes('youtube_dl') || errorText.includes('Trying fallback URL') || errorText.includes('[download][info]') || errorText.includes('Initializing client transaction')) {
          return;
        }
        // Detect expired / invalid cookies
        if (errorText.includes('unauthorized') || errorText.includes('Unauthorized') || errorText.includes('401') || errorText.includes('login_required') || errorText.includes('LoginRequired') || errorText.includes('checkpoint_required') || errorText.includes('Please wait a few minutes')) {
          socket.emit('download:cookie-expired', { username, message: errorText });
          socket.emit('download:log', { message: `COOKIE EXPIRED — @${username}: ${errorText}`, type: 'error' });
          return;
        }
        if (errorText && !errorText.includes('cookies')) {
          socket.emit('download:log', { message: `Error: ${errorText} (@${username})`, type: 'error' });
        }
      });

      const onDone = (code) => {
        this.activeProcesses.delete(childProcess.pid);
        const status = (code === 0) ? 'completed' : (code === null || code === 143) ? 'skipped' : 'error';
        socket.emit('download:account', { username, newFiles: newDownloadsCount, newPosts: seenPosts.size, status });
        resolve({ username, newFiles: newDownloadsCount, newPosts: seenPosts.size, status });
      };

      let resolved = false;
      childProcess.on('close', (code) => { if (!resolved) { resolved = true; onDone(code); } });
      childProcess.on('exit', (code) => { if (!resolved) { resolved = true; onDone(code); } });
    });
  }

  async processBatch(accounts, batchNum, totalBatches, options, socket) {
    if (this.shouldStop) return { files: 0, posts: 0 };

    socket.emit('download:batch', {
      type: 'start',
      batchNum,
      totalBatches,
      accounts: accounts.map(a => a.username),
    });

    socket.emit('download:log', {
      message: `--- Batch ${batchNum}/${totalBatches}: ${accounts.map(a => '@' + a.username).join(', ')} ---`,
      type: 'batch',
    });

    const promises = accounts.map(account =>
      this.downloadAccount({
        ...options,
        username: account.username,
        index: account.globalIndex,
        total: options.totalAccounts,
        batchNum,
      }, socket)
    );

    const results = await Promise.all(promises);
    const batchFiles = results.reduce((s, r) => s + (r.newFiles || 0), 0);
    const batchPosts = results.reduce((s, r) => s + (r.newPosts || 0), 0);

    socket.emit('download:batch', { type: 'done', batchNum, totalBatches, files: batchFiles, posts: batchPosts });
    return { files: batchFiles, posts: batchPosts };
  }

  async startSession(options, socket) {
    if (this.isRunning) {
      socket.emit('download:error', { message: 'A download session is already running.' });
      return;
    }

    this.isRunning = true;
    this.shouldStop = false;
    this.activeProcesses.clear();

    const {
      platform, usernames, galleryDlPath, cookiesFile, contentType,
      batchSize = 5, maxAlreadyExists = 10, batchDelay = 3000,
      sleepRequest, retries, timeout,
    } = options;

    const shuffled = [...usernames].sort(() => Math.random() - 0.5);
    const totalAccounts = shuffled.length;
    this.sessionStats = { totalFiles: 0, totalPosts: 0, accountsDone: 0, totalAccounts };

    socket.emit('download:log', {
      message: `Starting ${platform} session: ${totalAccounts} accounts, batch size ${batchSize}`,
      type: 'info',
    });

    const batches = [];
    for (let i = 0; i < shuffled.length; i += batchSize) {
      const batch = shuffled.slice(i, i + batchSize).map((username, localIndex) => ({
        username,
        globalIndex: i + localIndex + 1,
      }));
      batches.push(batch);
    }

    const startTime = Date.now();

    for (let i = 0; i < batches.length; i++) {
      if (this.shouldStop) break;

      const result = await this.processBatch(batches[i], i + 1, batches.length, {
        platform, galleryDlPath, cookiesFile, contentType, maxAlreadyExists, sleepRequest, retries, timeout, totalAccounts,
      }, socket);

      this.sessionStats.totalFiles += result.files;
      this.sessionStats.totalPosts += result.posts;
      this.sessionStats.accountsDone += batches[i].length;

      if (i < batches.length - 1 && !this.shouldStop) {
        socket.emit('download:log', { message: `Waiting ${batchDelay / 1000}s before next batch...`, type: 'info' });
        await new Promise(resolve => setTimeout(resolve, batchDelay));
      }
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    socket.emit('download:done', {
      totalFiles: this.sessionStats.totalFiles,
      totalPosts: this.sessionStats.totalPosts,
      totalAccounts,
      elapsed,
      stopped: this.shouldStop,
    });

    this.isRunning = false;
    this.shouldStop = false;
  }

  async downloadSingleUrl(options, socket) {
    if (this.isRunning) {
      socket.emit('download:error', { message: 'A download session is already running.' });
      return;
    }

    this.isRunning = true;
    this.shouldStop = false;

    const { galleryDlPath, cookiesFile, url, sleepRequest, retries, timeout } = options;
    const command = buildSingleUrlCommand({ galleryDlPath, cookiesFile, url, sleepRequest, retries, timeout });

    socket.emit('download:log', { message: `Downloading: ${url}`, type: 'info' });

    const childProcess = exec(command, { maxBuffer: 50 * 1024 * 1024 });
    this.activeProcesses.set(childProcess.pid, childProcess);

    let downloadCount = 0;

    childProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          downloadCount++;
          const filename = trimmed.split('/').pop();
          socket.emit('download:file', { username: 'single-url', filename, count: downloadCount, posts: downloadCount });
          socket.emit('download:log', { message: `Downloaded: ${filename}`, type: 'download' });
        }
      }
    });

    childProcess.stderr.on('data', (data) => {
      const errorText = data.toString().trim();
      if (!errorText.includes('youtube_dl') && !errorText.includes('cookies')) {
        socket.emit('download:log', { message: `Warning: ${errorText}`, type: 'error' });
      }
    });

    return new Promise((resolve) => {
      let resolved = false;
      const onDone = (code) => {
        if (resolved) return;
        resolved = true;
        this.activeProcesses.delete(childProcess.pid);
        this.isRunning = false;
        socket.emit('download:done', { totalFiles: downloadCount, totalPosts: downloadCount, totalAccounts: 1, elapsed: 0, stopped: false });
        resolve({ files: downloadCount });
      };
      childProcess.on('close', onDone);
      childProcess.on('exit', onDone);
    });
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      activeProcesses: this.activeProcesses.size,
      stats: this.sessionStats,
    };
  }
}

module.exports = DownloadManager;
