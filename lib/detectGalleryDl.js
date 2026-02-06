const { execSync } = require('child_process');
const fs = require('fs');

const COMMON_PATHS = [
  // pip-installed paths (macOS/Linux)
  '/Library/Frameworks/Python.framework/Versions/3.14/bin/gallery-dl',
  '/Library/Frameworks/Python.framework/Versions/3.13/bin/gallery-dl',
  '/Library/Frameworks/Python.framework/Versions/3.12/bin/gallery-dl',
  '/Library/Frameworks/Python.framework/Versions/3.11/bin/gallery-dl',
  '/usr/local/bin/gallery-dl',
  '/usr/bin/gallery-dl',
  // pip-installed paths (Windows)
  'C:\\Python314\\Scripts\\gallery-dl.exe',
  'C:\\Python313\\Scripts\\gallery-dl.exe',
  'C:\\Python312\\Scripts\\gallery-dl.exe',
  'C:\\Python311\\Scripts\\gallery-dl.exe',
];

function detectGalleryDl() {
  // 1. Try 'which' / 'where' command
  try {
    const cmd = process.platform === 'win32' ? 'where gallery-dl' : 'which gallery-dl';
    const result = execSync(cmd, { encoding: 'utf8', timeout: 5000 }).trim();
    if (result && fs.existsSync(result.split('\n')[0])) {
      return result.split('\n')[0];
    }
  } catch (e) {
    // Not in PATH
  }

  // 2. Try pip show to find install location
  try {
    const pipResult = execSync('pip3 show gallery-dl 2>/dev/null || pip show gallery-dl 2>/dev/null', {
      encoding: 'utf8',
      timeout: 5000,
    }).trim();
    const locationMatch = pipResult.match(/Location:\s*(.+)/);
    if (locationMatch) {
      const binDir = locationMatch[1].replace(/\/lib\/python[\d.]+\/site-packages/, '/bin');
      const candidate = `${binDir}/gallery-dl`;
      if (fs.existsSync(candidate)) return candidate;
    }
  } catch (e) {
    // pip not available or gallery-dl not installed via pip
  }

  // 3. Check common paths
  for (const p of COMMON_PATHS) {
    if (fs.existsSync(p)) return p;
  }

  return null;
}

function getVersion(galleryDlPath) {
  if (!galleryDlPath) return null;
  try {
    return execSync(`"${galleryDlPath}" --version`, { encoding: 'utf8', timeout: 5000 }).trim();
  } catch (e) {
    return null;
  }
}

module.exports = { detectGalleryDl, getVersion };
