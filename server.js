const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const { detectGalleryDl, getVersion } = require('./lib/detectGalleryDl');
const DownloadManager = require('./lib/DownloadManager');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const COOKIES_DIR = path.join(DATA_DIR, 'cookies');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const ARCHIVE_FILE = path.join(DATA_DIR, 'archive.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(COOKIES_DIR)) fs.mkdirSync(COOKIES_DIR, { recursive: true });

// Ensure downloads dir exists
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');
if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// --- Config helpers ---
function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  }
  return {
    galleryDlPath: detectGalleryDl() || '',
    batchSize: 5,
    maxAlreadyExists: 10,
    batchDelay: 3000,
    sleepRequest: '2-4',
    retries: 3,
    timeout: 45,
  };
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

if (!fs.existsSync(CONFIG_FILE)) {
  saveConfig(loadConfig());
}

// --- API Routes ---

app.get('/api/status', (req, res) => {
  const config = loadConfig();
  const galleryDlPath = config.galleryDlPath || detectGalleryDl();
  const version = galleryDlPath ? getVersion(galleryDlPath) : null;

  // Check which cookies exist
  const igCookie = fs.existsSync(path.join(COOKIES_DIR, 'instagram.txt'));
  const xCookie = fs.existsSync(path.join(COOKIES_DIR, 'twitter.txt'));

  res.json({
    galleryDlInstalled: !!galleryDlPath,
    galleryDlPath: galleryDlPath || null,
    galleryDlVersion: version,
    config,
    cookies: { instagram: igCookie, twitter: xCookie },
  });
});

// Settings
app.get('/api/settings', (req, res) => {
  res.json(loadConfig());
});

app.post('/api/settings', (req, res) => {
  const config = loadConfig();
  const updated = { ...config, ...req.body };
  saveConfig(updated);
  res.json({ success: true, config: updated });
});

// Cookie management — two fixed slots: instagram.txt and twitter.txt
app.get('/api/cookies', (req, res) => {
  const igPath = path.join(COOKIES_DIR, 'instagram.txt');
  const xPath = path.join(COOKIES_DIR, 'twitter.txt');
  res.json({
    instagram: fs.existsSync(igPath),
    twitter: fs.existsSync(xPath),
  });
});

app.post('/api/cookies/:platform', (req, res) => {
  const { platform } = req.params;
  if (platform !== 'instagram' && platform !== 'twitter') {
    return res.status(400).json({ error: 'Platform must be instagram or twitter' });
  }
  const { content } = req.body;
  if (!content) {
    return res.status(400).json({ error: 'Cookie content is required' });
  }
  const filepath = path.join(COOKIES_DIR, `${platform}.txt`);
  fs.writeFileSync(filepath, content);
  res.json({ success: true });
});

app.delete('/api/cookies/:platform', (req, res) => {
  const { platform } = req.params;
  if (platform !== 'instagram' && platform !== 'twitter') {
    return res.status(400).json({ error: 'Platform must be instagram or twitter' });
  }
  const filepath = path.join(COOKIES_DIR, `${platform}.txt`);
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'No cookie file found' });
  }
});

// Archive — recently downloaded usernames
function loadArchive() {
  if (fs.existsSync(ARCHIVE_FILE)) return JSON.parse(fs.readFileSync(ARCHIVE_FILE, 'utf8'));
  return { instagram: [], twitter: [] };
}

function saveArchive(archive) {
  fs.writeFileSync(ARCHIVE_FILE, JSON.stringify(archive, null, 2));
}

app.get('/api/archive', (req, res) => {
  res.json(loadArchive());
});

app.post('/api/archive', (req, res) => {
  const { platform, usernames } = req.body;
  if (!platform || !usernames || !Array.isArray(usernames)) {
    return res.status(400).json({ error: 'platform and usernames[] required' });
  }
  const archive = loadArchive();
  const key = platform === 'twitter' ? 'twitter' : 'instagram';
  for (const u of usernames) {
    if (u && !archive[key].includes(u)) archive[key].push(u);
  }
  saveArchive(archive);
  res.json({ success: true });
});

app.delete('/api/archive/:platform', (req, res) => {
  const { platform } = req.params;
  const archive = loadArchive();
  const key = platform === 'twitter' ? 'twitter' : 'instagram';
  archive[key] = [];
  saveArchive(archive);
  res.json({ success: true });
});

// Download status
const downloadManager = new DownloadManager();

app.get('/api/download/status', (req, res) => {
  res.json(downloadManager.getStatus());
});

app.post('/api/download/stop', (req, res) => {
  downloadManager.stop();
  res.json({ success: true });
});

// --- Socket.IO ---
io.on('connection', (socket) => {
  console.log('Client connected');

  socket.on('download:start', async (data) => {
    const config = loadConfig();
    const galleryDlPath = data.galleryDlPath || config.galleryDlPath || detectGalleryDl();

    if (!galleryDlPath) {
      socket.emit('download:error', { message: 'gallery-dl not found. Install it: pip install gallery-dl' });
      return;
    }

    const platform = data.platform || 'instagram';
    const cookiesFile = path.join(COOKIES_DIR, platform === 'twitter' ? 'twitter.txt' : 'instagram.txt');

    if (!fs.existsSync(cookiesFile)) {
      socket.emit('download:error', { message: `No ${platform} cookie found. Add one in the Cookies tab.` });
      return;
    }

    const usernames = (data.usernames || '')
      .split(/[\n,]/)
      .map(u => u.trim().replace(/^@/, ''))
      .filter(Boolean);

    if (usernames.length === 0) {
      socket.emit('download:error', { message: 'No usernames provided.' });
      return;
    }

    await downloadManager.startSession({
      platform,
      usernames,
      galleryDlPath,
      cookiesFile,
      contentType: data.contentType || 'posts,reels',
      batchSize: parseInt(data.batchSize) || config.batchSize || 5,
      maxAlreadyExists: parseInt(data.maxAlreadyExists) || config.maxAlreadyExists || 10,
      batchDelay: parseInt(data.batchDelay) || config.batchDelay || 3000,
      sleepRequest: data.sleepRequest || config.sleepRequest || '2-4',
      retries: parseInt(data.retries) || config.retries || 3,
      timeout: parseInt(data.timeout) || config.timeout || 45,
    }, socket);
  });

  socket.on('download:single', async (data) => {
    const config = loadConfig();
    const galleryDlPath = data.galleryDlPath || config.galleryDlPath || detectGalleryDl();

    if (!galleryDlPath) {
      socket.emit('download:error', { message: 'gallery-dl not found. Install it: pip install gallery-dl' });
      return;
    }

    // Auto-detect platform from URL
    const isTwitter = data.url && (data.url.includes('x.com') || data.url.includes('twitter.com'));
    const cookiePlatform = isTwitter ? 'twitter' : 'instagram';
    const cookiesFile = path.join(COOKIES_DIR, `${cookiePlatform}.txt`);

    if (!fs.existsSync(cookiesFile)) {
      socket.emit('download:error', { message: `No ${cookiePlatform} cookie found. Add one in the Cookies tab.` });
      return;
    }

    if (!data.url) {
      socket.emit('download:error', { message: 'No URL provided.' });
      return;
    }

    await downloadManager.downloadSingleUrl({
      galleryDlPath,
      cookiesFile,
      url: data.url,
      sleepRequest: data.sleepRequest || '1-2',
      retries: parseInt(data.retries) || 3,
      timeout: parseInt(data.timeout) || 30,
    }, socket);
  });

  socket.on('download:stop', () => {
    downloadManager.stop();
    socket.emit('download:log', { message: 'Download stopped by user.', type: 'info' });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

server.listen(PORT, () => {
  const detected = detectGalleryDl();
  console.log('');
  console.log('  IG-X Downloader');
  console.log('  ──────────────────────');
  console.log(`  http://localhost:${PORT}`);
  console.log(`  gallery-dl: ${detected || 'NOT FOUND - run: pip install gallery-dl'}`);
  if (detected) {
    const ver = getVersion(detected);
    if (ver) console.log(`  Version:    ${ver}`);
  }
  console.log('');
});
