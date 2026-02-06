const socket = io();

// --- State ---
let currentView = 'download';
let platform = 'instagram';
let contentType = 'posts,reels';
let isDownloading = false;
let totalFilesCount = 0;
let totalPostsCount = 0;
let accountsDoneCount = 0;
let totalAccountsCount = 0;
const accountStatuses = new Map();
const accountPosts = new Map();

// =============================================
//  TOAST
// =============================================
const TOAST_ICONS = { success: '\u2705', error: '\u274C', warning: '\u26A0\uFE0F', info: '\u2139\uFE0F' };

function toast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = `
    <span class="toast-icon">${TOAST_ICONS[type] || TOAST_ICONS.info}</span>
    <span class="toast-msg">${esc(message)}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
  `;
  container.appendChild(el);
  setTimeout(() => { el.classList.add('removing'); setTimeout(() => el.remove(), 200); }, duration);
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// =============================================
//  CONFIRM MODAL
// =============================================
function confirmDialog(title, message) {
  return new Promise((resolve) => {
    const root = document.getElementById('modalRoot');
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box">
        <h3>${esc(title)}</h3>
        <p>${esc(message)}</p>
        <div class="modal-actions">
          <button class="modal-btn-cancel" id="modalCancel">Cancel</button>
          <button class="modal-btn-danger" id="modalConfirm">Delete</button>
        </div>
      </div>
    `;
    root.appendChild(overlay);
    const cleanup = (r) => { overlay.remove(); resolve(r); };
    overlay.querySelector('#modalCancel').onclick = () => cleanup(false);
    overlay.querySelector('#modalConfirm').onclick = () => cleanup(true);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(false); });
  });
}

// =============================================
//  VIEW SWITCHING
// =============================================
function showView(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.getElementById('view-' + view).classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.nav-btn[data-view="${view}"]`).classList.add('active');
  currentView = view;
  if (view === 'cookies') loadCookieStatus();
  if (view === 'settings') loadSettings();
}

// =============================================
//  PLATFORM / CONTENT
// =============================================
function setPlatform(p) {
  platform = p;
  document.getElementById('btn-instagram').classList.toggle('active', p === 'instagram');
  document.getElementById('btn-twitter').classList.toggle('active', p === 'twitter');
  document.getElementById('contentTypeGroup').style.display = p === 'twitter' ? 'none' : '';
  loadArchive();
}

function setContentType(type) {
  contentType = type;
  document.querySelectorAll('[data-content]').forEach(b => {
    b.classList.toggle('active', b.dataset.content === type);
  });
}

// =============================================
//  ARCHIVE LIST
// =============================================
async function loadArchive() {
  try {
    const res = await fetch('/api/archive');
    const data = await res.json();
    const key = platform === 'twitter' ? 'twitter' : 'instagram';
    const list = data[key] || [];
    const section = document.getElementById('archiveSection');
    const container = document.getElementById('archiveList');

    if (list.length === 0) {
      section.classList.add('hidden');
      return;
    }

    section.classList.remove('hidden');
    container.innerHTML = list.map(u =>
      `<button onclick="addToInput('${esc(u)}')" class="text-xs px-2 py-0.5 rounded bg-dark-700 text-gray-400 hover:text-gray-200 hover:bg-dark-600 transition cursor-pointer border-none">@${esc(u)}</button>`
    ).join('');
  } catch (e) {
    console.error('Failed to load archive:', e);
  }
}

function addToInput(username) {
  const textarea = document.getElementById('usernames');
  const current = textarea.value.trim();
  const names = current ? current.split('\n').map(n => n.trim()).filter(Boolean) : [];
  if (!names.includes(username)) {
    names.push(username);
    textarea.value = names.join('\n');
  }
}

async function clearArchive() {
  const key = platform === 'twitter' ? 'twitter' : 'instagram';
  await fetch(`/api/archive/${key}`, { method: 'DELETE' });
  document.getElementById('archiveSection').classList.add('hidden');
  document.getElementById('archiveList').innerHTML = '';
  toast('Archive cleared.', 'info');
}

async function saveToArchive(usernames) {
  try {
    await fetch('/api/archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, usernames }),
    });
  } catch (e) {
    // silent
  }
}

// =============================================
//  COOKIE DROP ZONES
// =============================================
function initDropZones() {
  ['igDropZone', 'xDropZone'].forEach(id => {
    const zone = document.getElementById(id);
    if (!zone) return;
    const input = zone.querySelector('.cookie-file-input');
    const plat = zone.dataset.platform;

    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', (e) => { e.preventDefault(); zone.classList.remove('drag-over'); });
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) uploadCookie(file, plat, zone);
    });
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) uploadCookie(file, plat, zone);
    });
  });
}

function uploadCookie(file, plat, zone) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    const content = e.target.result;
    try {
      const res = await fetch(`/api/cookies/${plat}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (data.success) {
        toast(`${plat === 'instagram' ? 'Instagram' : 'X/Twitter'} cookie saved!`, 'success');
        showFileInZone(zone, file.name, file.size);
        loadCookieStatus();
      } else {
        toast(data.error || 'Failed to save cookie', 'error');
      }
    } catch (err) {
      toast('Failed to save cookie: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
}

function showFileInZone(zone, name, size) {
  const preview = zone.querySelector('.drop-preview');
  const content = zone.querySelector('.drop-content');
  const sizeStr = size > 1024 ? (size / 1024).toFixed(1) + ' KB' : size + ' B';
  preview.innerHTML = `
    <span style="font-size:1rem">&#128196;</span>
    <div>
      <div class="file-name">${esc(name)}</div>
      <div class="file-size">${sizeStr}</div>
    </div>
  `;
  preview.classList.remove('hidden');
  content.classList.add('hidden');
}

async function loadCookieStatus() {
  try {
    const res = await fetch('/api/cookies');
    const data = await res.json();

    const igStatus = document.getElementById('igCookieStatus');
    const xStatus = document.getElementById('xCookieStatus');
    const igDel = document.getElementById('igDeleteBtn');
    const xDel = document.getElementById('xDeleteBtn');

    if (data.instagram) {
      igStatus.textContent = 'Active';
      igStatus.className = 'text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400';
      igDel.classList.remove('hidden');
    } else {
      igStatus.textContent = 'No cookie';
      igStatus.className = 'text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400';
      igDel.classList.add('hidden');
      resetZone(document.getElementById('igDropZone'));
    }

    if (data.twitter) {
      xStatus.textContent = 'Active';
      xStatus.className = 'text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400';
      xDel.classList.remove('hidden');
    } else {
      xStatus.textContent = 'No cookie';
      xStatus.className = 'text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400';
      xDel.classList.add('hidden');
      resetZone(document.getElementById('xDropZone'));
    }
  } catch (e) {
    console.error('Failed to load cookie status:', e);
  }
}

function resetZone(zone) {
  if (!zone) return;
  const preview = zone.querySelector('.drop-preview');
  const content = zone.querySelector('.drop-content');
  if (preview) { preview.classList.add('hidden'); preview.innerHTML = ''; }
  if (content) content.classList.remove('hidden');
  const input = zone.querySelector('.cookie-file-input');
  if (input) input.value = '';
}

async function deleteCookie(plat) {
  const confirmed = await confirmDialog('Delete Cookie', `Remove the ${plat} cookie file?`);
  if (!confirmed) return;
  try {
    await fetch(`/api/cookies/${plat}`, { method: 'DELETE' });
    loadCookieStatus();
    toast('Cookie removed.', 'info');
  } catch (e) {
    toast('Failed to delete: ' + e.message, 'error');
  }
}

// =============================================
//  SETTINGS
// =============================================
async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    const c = await res.json();
    document.getElementById('settingsGalleryDlPath').value = c.galleryDlPath || '';
    document.getElementById('settingsBatchSize').value = c.batchSize || 5;
    document.getElementById('settingsMaxAlreadyExists').value = c.maxAlreadyExists || 10;
    document.getElementById('settingsBatchDelay').value = (c.batchDelay || 3000) / 1000;
    document.getElementById('settingsSleepRequest').value = c.sleepRequest || '2-4';
    document.getElementById('settingsRetries').value = c.retries || 3;
    document.getElementById('settingsTimeout').value = c.timeout || 45;
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
}

async function saveSettings() {
  const config = {
    galleryDlPath: document.getElementById('settingsGalleryDlPath').value.trim(),
    batchSize: parseInt(document.getElementById('settingsBatchSize').value) || 5,
    maxAlreadyExists: parseInt(document.getElementById('settingsMaxAlreadyExists').value) || 10,
    batchDelay: (parseInt(document.getElementById('settingsBatchDelay').value) || 3) * 1000,
    sleepRequest: document.getElementById('settingsSleepRequest').value.trim() || '2-4',
    retries: parseInt(document.getElementById('settingsRetries').value) || 3,
    timeout: parseInt(document.getElementById('settingsTimeout').value) || 45,
  };
  try {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    toast('Settings saved.', 'success');
  } catch (e) {
    toast('Failed to save: ' + e.message, 'error');
  }
}

async function detectPath() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    if (data.galleryDlPath) {
      document.getElementById('settingsGalleryDlPath').value = data.galleryDlPath;
      document.getElementById('galleryDlVersion').textContent = data.galleryDlVersion ? `Version: ${data.galleryDlVersion}` : '';
      toast('gallery-dl found: ' + data.galleryDlPath, 'success');
    } else {
      toast('gallery-dl not found. Install: pip install gallery-dl', 'error', 5000);
    }
  } catch (e) {
    toast('Detection failed: ' + e.message, 'error');
  }
}

// =============================================
//  DOWNLOAD
// =============================================
function addLog(message, type = 'info') {
  const container = document.getElementById('logOutput');
  const div = document.createElement('div');
  div.className = 'log-line ' + type;
  div.textContent = message;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function resetStats() {
  totalFilesCount = 0;
  totalPostsCount = 0;
  accountsDoneCount = 0;
  totalAccountsCount = 0;
  accountStatuses.clear();
  accountPosts.clear();
  document.getElementById('statFiles').textContent = '0';
  document.getElementById('statPosts').textContent = '0';
  document.getElementById('statAccounts').textContent = '0/0';
  document.getElementById('logOutput').innerHTML = '';
  document.getElementById('accountProgress').innerHTML = '';
}

function setDownloading(active) {
  isDownloading = active;
  document.getElementById('startBtn').classList.toggle('hidden', active);
  document.getElementById('singleBtn').classList.toggle('hidden', active);
  document.getElementById('stopBtn').classList.toggle('hidden', !active);
}

function startDownload() {
  const usernames = document.getElementById('usernames').value.trim();
  if (!usernames) return toast('Enter at least one username.', 'warning');

  resetStats();
  setDownloading(true);

  // Parse usernames for archive + total count
  const parsed = usernames.split(/[\n,]/).map(u => u.trim().replace(/^@/, '')).filter(Boolean);
  totalAccountsCount = parsed.length;
  document.getElementById('statAccounts').textContent = `0/${totalAccountsCount}`;

  // Save to archive
  saveToArchive(parsed);

  socket.emit('download:start', {
    platform,
    usernames,
    contentType: platform === 'twitter' ? 'media' : contentType,
  });
}

function stopDownload() {
  socket.emit('download:stop');
  setDownloading(false);
  toast('Download stopped.', 'warning');
}

function startSingleDownload() {
  const url = document.getElementById('singleUrl').value.trim();
  if (!url) return toast('Enter a URL to download.', 'warning');

  resetStats();
  totalAccountsCount = 1;
  document.getElementById('statAccounts').textContent = '0/1';
  setDownloading(true);

  socket.emit('download:single', { url });
}

// =============================================
//  SOCKET EVENTS
// =============================================
socket.on('download:log', (data) => { addLog(data.message, data.type); });

socket.on('download:file', (data) => {
  totalFilesCount++;
  document.getElementById('statFiles').textContent = totalFilesCount;
  if (data.posts && data.username) {
    accountPosts.set(data.username, data.posts);
    let total = 0;
    for (const v of accountPosts.values()) total += v;
    document.getElementById('statPosts').textContent = total;
  }
});

socket.on('download:skip', () => {});

socket.on('download:account', (data) => {
  accountsDoneCount++;
  document.getElementById('statAccounts').textContent = `${accountsDoneCount}/${totalAccountsCount}`;
  accountStatuses.set(data.username, data.status);
  updateAccountChips();
});

socket.on('download:batch', (data) => {
  if (data.type === 'start') {
    for (const u of data.accounts) {
      if (!accountStatuses.has(u)) accountStatuses.set(u, 'active');
    }
    updateAccountChips();
  }
});

socket.on('download:done', (data) => {
  const mins = Math.floor(data.elapsed / 60);
  const secs = data.elapsed % 60;
  addLog(`--- Done: ${data.totalFiles} files, ${data.totalPosts} posts, ${mins}m ${secs}s ---`, 'batch');
  setDownloading(false);
  // Refresh archive after download
  loadArchive();
  if (data.totalFiles > 0) {
    toast(`Done! ${data.totalFiles} files in ${mins}m ${secs}s`, 'success', 5000);
  } else {
    toast('Done. No new files found.', 'info');
  }
});

socket.on('download:error', (data) => {
  toast(data.message, 'error', 5000);
  setDownloading(false);
});

// Cookie expired alert
socket.on('download:cookie-expired', (data) => {
  toast(`Cookie expired! Refresh your ${platform} cookies in the Cookies tab.`, 'error', 10000);
});

// =============================================
//  ACCOUNT CHIPS
// =============================================
function updateAccountChips() {
  const container = document.getElementById('accountProgress');
  container.innerHTML = '';
  for (const [username, status] of accountStatuses) {
    const chip = document.createElement('span');
    chip.className = 'account-chip ' + (status === 'completed' ? 'done' : status === 'skipped' ? 'skipped' : status === 'error' ? 'error' : 'active');
    chip.textContent = '@' + username;
    container.appendChild(chip);
  }
}

// =============================================
//  STATUS CHECK
// =============================================
async function checkStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    const badge = document.getElementById('statusBadge');
    if (data.galleryDlInstalled) {
      badge.textContent = 'Ready';
      badge.className = 'text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400';
    } else {
      badge.textContent = 'gallery-dl missing';
      badge.className = 'text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400';
    }
  } catch (e) {
    const badge = document.getElementById('statusBadge');
    badge.textContent = 'Error';
    badge.className = 'text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400';
  }
}

// =============================================
//  INIT
// =============================================
checkStatus();
initDropZones();
loadArchive();
