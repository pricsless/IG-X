// X/Twitter gallery-dl command builder

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function buildTwitterCommand(options) {
  const {
    galleryDlPath,
    cookiesFile,
    username,
    sleepRequest = '3-6',
    retries = 5,
    timeout = 60,
  } = options;

  const userAgent = getRandomUserAgent();
  const dirFlag = '-d "./downloads"';
  const url = `https://x.com/${username}/media`;

  const cmd = `"${galleryDlPath}" --cookies="${cookiesFile}" --user-agent "${userAgent}" ${dirFlag} -o extractor.twitter.size='["orig", "4096x4096"]' -o extractor.twitter.videos=dash -o extractor.twitter.text-tweets=false -o extractor.twitter.conversations=false -o extractor.twitter.expand=false -o extractor.twitter.logout=false -o extractor.twitter.pinned=false -o extractor.twitter.quoted=false -o extractor.twitter.replies=false -o extractor.twitter.retweets=false -o extractor.twitter.twitpic=true -o extractor.twitter.syndication=false -o extractor.twitter.timeline.strategy=tweets -o extractor.twitter.sleep-request=${sleepRequest} -o downloader.retries=${retries} -o downloader.timeout=${timeout} -o downloader.http.adjust-extensions=false -o downloader.http.headers='{"Accept": "image/webp,image/avif,image/apng,image/svg+xml,image/*,*/*;q=0.8"}' -o downloader.http.verify=true -o output.mode=terminal -o output.log.level=info -o output.log.format='{name}: {message}' "${url}"`;

  return cmd;
}

module.exports = { buildTwitterCommand, getRandomUserAgent, USER_AGENTS };
