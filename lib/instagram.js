// Instagram gallery-dl command builder

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function buildInstagramCommand(options) {
  const {
    galleryDlPath,
    cookiesFile,
    username,
    contentType = 'posts,reels',
    sleepRequest = '2-4',
    retries = 3,
    timeout = 45,
  } = options;

  const userAgent = getRandomUserAgent();
  let url;
  let dirFlag = '';

  switch (contentType) {
    case 'posts':
      url = `https://www.instagram.com/${username}`;
      dirFlag = `-d "./downloads"`;
      break;
    case 'reels':
      url = `https://www.instagram.com/${username}/reels/`;
      dirFlag = `-d "./downloads"`;
      break;
    case 'stories':
      url = `https://www.instagram.com/stories/${username}/`;
      dirFlag = `-D "./downloads/stories/${username}"`;
      break;
    case 'highlights':
      url = `https://www.instagram.com/${username}/highlights/`;
      dirFlag = `-D "./downloads/highlights/${username}"`;
      break;
    default: // posts,reels
      url = `https://www.instagram.com/${username}`;
      dirFlag = `-d "./downloads"`;
      break;
  }

  const includeType = contentType === 'reels' ? 'reels' : contentType === 'posts' ? 'posts' : 'posts,reels';

  const cmd = `"${galleryDlPath}" --cookies="${cookiesFile}" --user-agent "${userAgent}" ${dirFlag} -o extractor.instagram.api=rest -o extractor.instagram.graphql=true -o extractor.instagram.web-api=true -o extractor.instagram.previews=false -o extractor.instagram.videos=dash -o extractor.instagram.include="${includeType}" -o extractor.instagram.video-format="best" -o extractor.instagram.image="original" -o extractor.instagram.image-filter="" -o extractor.instagram.sleep-request=${sleepRequest} -o extractor.instagram.youtubedl=false -o downloader.retries=${retries} -o downloader.timeout=${timeout} -o downloader.http.adjust-extensions=false "${url}"`;

  return cmd;
}

function buildSingleUrlCommand(options) {
  const {
    galleryDlPath,
    cookiesFile,
    url,
    sleepRequest = '1-2',
    retries = 3,
    timeout = 30,
  } = options;

  const userAgent = getRandomUserAgent();
  const dirFlag = '-D "./downloads/single-urls"';

  const cmd = `"${galleryDlPath}" --cookies="${cookiesFile}" --user-agent "${userAgent}" ${dirFlag} -o extractor.instagram.api=rest -o extractor.instagram.graphql=true -o extractor.instagram.previews=false -o extractor.instagram.videos=dash -o extractor.instagram.video-format="best" -o extractor.instagram.image="original" -o extractor.instagram.sleep-request=${sleepRequest} -o downloader.http.adjust-extensions=false -o downloader.retries=${retries} -o downloader.timeout=${timeout} "${url}"`;

  return cmd;
}

module.exports = { buildInstagramCommand, buildSingleUrlCommand, getRandomUserAgent, USER_AGENTS };
