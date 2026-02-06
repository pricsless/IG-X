# IG-X Downloader

Self-hosted web app for downloading Instagram & X/Twitter media. Runs locally on your computer — no cloud, no database, files download straight to your machine.

![Node.js](https://img.shields.io/badge/Node.js-18%2B-green) ![Python](https://img.shields.io/badge/Python-3.8%2B-blue) ![gallery--dl](https://img.shields.io/badge/gallery--dl-required-orange)

---

## Why This Downloader

Most Instagram/Twitter downloaders give you compressed, medium-resolution media. IG-X downloads the **original full-quality** files — videos in DASH format (highest bitrate), images at original resolution with no recompression. What you get is exactly what was uploaded, not a downscaled copy.

---

## What You Need

| Requirement | Why | Install |
|---|---|---|
| **Node.js** (v18+) | Runs the web server | [nodejs.org](https://nodejs.org) — download the LTS version |
| **Python** (3.8+) | Required by gallery-dl | [python.org](https://python.org) — check "Add to PATH" during install |
| **gallery-dl** | Does the actual downloading | `pip install gallery-dl` (after Python is installed) |

You do **NOT** need VS Code or any code editor. This is a web app that runs in your browser.

---

## Install & Run

### Option 1: One-line setup

**macOS / Linux:**
```bash
git clone https://github.com/pricsless/IG-X.git
cd ig-x-downloader
./setup.sh
```

**Windows:**
```bash
git clone https://github.com/pricsless/IG-X.git
cd ig-x-downloader
setup.bat
```

### Option 2: Manual

```bash
git clone https://github.com/pricsless/IG-X.git
cd ig-x-downloader
pip install gallery-dl
npm install
```

### Start the app

```bash
npm start
```

Open **http://localhost:3000** in your browser. That's it.

---

## How to Use

### 1. Get Cookies (required)

The app needs your Instagram/X login cookies to download media. **Use a throwaway account — your main account can get banned.**

1. Create a **temp account** on Instagram or X (don't use your real one)
2. Install the **[Get cookies.txt LOCALLY](https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)** browser extension
3. Log in to Instagram/X with your temp account
4. Click the extension icon and click **Export** — it downloads a `.txt` file
5. In the app, go to the **Cookies** tab and drop that file into the Instagram or X slot

Cookies expire after a while. If downloads start failing, go back to step 4 and drop a fresh cookie file.

### 2. Download Media

Go to the **Download** tab:

1. Pick a platform — **Instagram** or **X/Twitter**
2. Pick what to download:
   - **Posts + Reels** — everything from the profile
   - **Posts Only** — photos and carousel posts, no video reels
   - **Reels Only** — just reels
   - **Stories** — current stories (disappear after 24h)
   - **Highlights** — saved story highlights
3. Type usernames in the text box, one per line (no @ symbol)
4. Click **Start Download**

Or paste a direct post URL in the **Single URL** field and click **Download URL**.

### 3. Watch Progress

The right panel shows live progress:
- **Files** — total files downloaded
- **Posts** — unique posts processed
- **Accounts** — done/total (e.g. 2/5)
- Color-coded account chips: purple = active, green = done, yellow = skipped, red = error
- Scrolling log with every file

### 4. Find Your Files

Downloaded files go to the `downloads/` folder inside the project:

```
downloads/
├── instagram/       # Posts & reels by username
├── stories/         # Stories by username
├── highlights/      # Highlights by username
├── twitter/         # X/Twitter media by username
└── single-urls/     # Single URL downloads
```

---

## Features

- **Instagram** — Posts, Reels, Stories, Highlights, Single URL
- **X/Twitter** — Media timeline
- **Batch download** — Multiple accounts at once
- **Smart skip** — Stops when an account is already up to date
- **Live progress** — Real-time updates via WebSocket
- **Cookie expiry alert** — Warns you when cookies need refreshing
- **Archive** — Remembers recently downloaded usernames
- **No database** — Everything is local files
- **No build step** — Clone, install, run

## Settings

Go to the **Settings** tab to configure:

| Option | Default | What it does |
|---|---|---|
| Batch Size | 5 | How many accounts download at the same time |
| Skip Threshold | 10 | How many already-downloaded files before skipping to next account |
| Batch Delay | 3s | Pause between batches to avoid rate limits |
| Sleep Between Requests | 2-4s | Random delay between API requests |
| Retries | 3 | How many times to retry a failed download |
| Timeout | 45s | How long to wait before giving up on a file |

---

## Troubleshooting

**"gallery-dl missing" badge shows in the app**
- Run `pip install gallery-dl` in your terminal, then restart the app

**Downloads fail immediately**
- Your cookies probably expired. Export fresh ones and drop them in the Cookies tab

**"Cookie expired" error in the log**
- Same as above — re-export your cookies

**App won't start / port already in use**
- Another instance might be running. Kill it: `lsof -ti:3000 | xargs kill -9` (mac/linux) or restart your terminal

**No files downloading but no errors**
- The account might be private. Your temp account needs to follow it first
- gallery-dl might need updating: `pip install --upgrade gallery-dl`

---

## Project Structure

```
ig-x-downloader/
├── server.js              # Express + Socket.IO server
├── lib/
│   ├── DownloadManager.js # Core download logic
│   ├── instagram.js       # Instagram gallery-dl commands
│   ├── twitter.js         # X/Twitter gallery-dl commands
│   └── detectGalleryDl.js # Auto-finds gallery-dl binary
├── public/
│   ├── index.html         # UI
│   ├── css/style.css      # Styles
│   └── js/app.js          # Frontend logic
├── data/
│   ├── cookies/           # Your cookie files (instagram.txt, twitter.txt)
│   ├── config.json        # Settings
│   └── archive.json       # Recently downloaded usernames
├── downloads/             # All downloaded media goes here
├── setup.sh               # macOS/Linux setup script
├── setup.bat              # Windows setup script
└── package.json
```

---

## Important

- **Always use a temp/throwaway account** for cookies. Instagram and X can ban accounts that scrape too aggressively. Never use your personal account.
- This app runs **locally only** on your machine. Nothing is uploaded anywhere.
- Downloaded files are regular image/video files saved to your `downloads/` folder.
- gallery-dl is a third-party Python tool that does the actual downloading. This app is a UI wrapper around it.
