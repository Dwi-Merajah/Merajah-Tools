#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { finished } = require('stream/promises');

const CREATOR = 'Dwi-Merajah';
const BASE_URL = 'https://y2mate.gs';
const WORKER_URL = 'https://hidden-sun-3c87.holy-breeze-fec5.workers.dev';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'id,en-US;q=0.9,en;q=0.8',
  'Referer': `${BASE_URL}/`,
};

function cleanText(str) {
  if (!str) return '';
  return str.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatFilesize(sizeBytes) {
  if (!sizeBytes || sizeBytes <= 0) return 'Unknown';
  const units = ['B', 'KB', 'MB', 'GB'];
  let bytes = sizeBytes;
  let unitIndex = 0;
  while (bytes >= 1024 && unitIndex < units.length - 1) {
    bytes /= 1024;
    unitIndex++;
  }
  return `${bytes.toFixed(2)} ${units[unitIndex]}`;
}

function successResponse(data) {
  return {
    creator: CREATOR,
    status: true,
    data,
  };
}

function errorResponse(message) {
  return {
    creator: CREATOR,
    status: false,
    message: String(message),
    data: null,
  };
}

function normalizeYouTubeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('URL atau Video ID tidak boleh kosong.');
  }

  const cleanUrl = rawUrl.trim();

  if (/^[a-zA-Z0-9_-]{11}$/.test(cleanUrl)) {
    const videoId = cleanUrl;
    return {
      videoId,
      canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
      thumbnail: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
      thumbnailHq: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    };
  }

  const match = cleanUrl.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|live\/|shorts\/|watch\?v=)|music\.youtube\.com\/watch\?v=|[?&]v=)([a-zA-Z0-9_-]{11})/i
  );

  if (match && match[1]) {
    const videoId = match[1];
    return {
      videoId,
      canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
      thumbnail: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
      thumbnailHq: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    };
  }

  throw new Error(`URL YouTube / YouTube Music tidak valid: ${rawUrl}`);
}

async function extractMedia(youtubeUrl, formatChoice = 'mp3') {
  try {
    const norm = normalizeYouTubeUrl(youtubeUrl);
    const format = String(formatChoice).toLowerCase().trim() === 'mp4' ? 'mp4' : 'mp3';

    const timestamp = Date.now();
    const apiUrl = `${WORKER_URL}/?e=i&v=${norm.videoId}&f=${format}&_=${timestamp}`;

    const resp = await fetch(apiUrl, {
      headers: HEADERS,
    });

    if (!resp.ok) {
      throw new Error(`Gagal fetch conversion worker - HTTP ${resp.status}`);
    }

    const json = await resp.json();

    if (!json || json.status !== 'ok' || !json.link) {
      throw new Error(json?.msg || 'Gagal mengekstrak media: Video tidak tersedia atau format tidak didukung.');
    }

    const filesizeBytes = json.filesize || 0;
    const filesizeFormatted = formatFilesize(filesizeBytes);
    const durationSeconds = typeof json.duration === 'number' ? Math.round(json.duration * 100) / 100 : 0;

    return successResponse({
      title: cleanText(json.title || 'Unknown Title'),
      thumbnail: norm.thumbnail,
      format: format,
      quality: format === 'mp3' ? '192 kbps' : '720p',
      filesize: filesizeFormatted,
      filesize_bytes: filesizeBytes,
      duration: durationSeconds,
      url: json.link,
    });
  } catch (err) {
    return errorResponse(err.message);
  }
}

async function downloadMedia(downloadUrl, filename, destDir = './downloads') {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const safeFilename = filename.replace(/[\\/*?:"<>|]/g, '_');
  const filePath = path.join(destDir, safeFilename);

  console.log(`\nMemulai download ke: ${filePath}`);

  const resp = await fetch(downloadUrl, {
    headers: {
      ...HEADERS,
      'Accept': '*/*',
    },
    redirect: 'follow',
  });

  if (!resp.ok) {
    throw new Error(`Gagal download file - HTTP ${resp.status}`);
  }

  const totalBytes = parseInt(resp.headers.get('content-length') || '0', 10);
  let downloadedBytes = 0;

  const fileStream = fs.createWriteStream(filePath);
  const reader = resp.body.getReader();

  const nodeStream = new Readable({
    async read() {
      try {
        const { done, value } = await reader.read();
        if (done) {
          this.push(null);
        } else {
          downloadedBytes += value.length;
          if (totalBytes > 0) {
            const pct = ((downloadedBytes / totalBytes) * 100).toFixed(1);
            process.stdout.write(`\r  Progress: ${pct}% (${formatFilesize(downloadedBytes)} / ${formatFilesize(totalBytes)})`);
          } else {
            process.stdout.write(`\r  Downloaded: ${formatFilesize(downloadedBytes)}`);
          }
          this.push(Buffer.from(value));
        }
      } catch (err) {
        this.destroy(err);
      }
    },
  });

  await finished(nodeStream.pipe(fileStream));
  console.log(`\nSelesai! File tersimpan di: ${filePath}\n`);
  return filePath;
}

async function runCli() {
  const args = process.argv.slice(2);
  const command = args[0]?.toLowerCase();

  const printHelp = () => {
    console.log(`
Y2MATE.JS - CLI YouTube & YouTube Music Scraper / Downloader
Target: https://y2mate.gs/

PENGGUNAAN:
  node y2mate.js <url_atau_id> [format] [opsi]
  node y2mate.js extract <url_atau_id> [format] [opsi]
  node y2mate.js download <url_atau_id> [format] [opsi]

CONTOH:
  node y2mate.js https://music.youtube.com/watch?v=w1Smzzw_w7Q
  node y2mate.js https://www.youtube.com/watch?v=w1Smzzw_w7Q mp3 --download
  node y2mate.js w1Smzzw_w7Q mp3 --save hasil.json

OPSI:
  --json             Hanya cetak output dalam format JSON murni
  --download [dir]   Download langsung file audio/video ke folder lokal
  --save <file.json> Simpan output JSON ke file
`);
  };

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  const isJson = args.includes('--json');
  const saveIdx = args.indexOf('--save');
  const saveFile = saveIdx !== -1 ? args[saveIdx + 1] : null;
  const dlIdx = args.indexOf('--download');
  const shouldDownload = dlIdx !== -1 || command === 'download';
  const customDir = dlIdx !== -1 && args[dlIdx + 1] && !args[dlIdx + 1].startsWith('--') ? args[dlIdx + 1] : null;

  let targetUrl = '';
  let formatChoice = 'mp3';

  if (command === 'extract' || command === 'download') {
    targetUrl = args[1];
    if (args[2] && !args[2].startsWith('--')) {
      formatChoice = args[2];
    }
  } else {
    targetUrl = args[0];
    if (args[1] && !args[1].startsWith('--')) {
      formatChoice = args[1];
    }
  }

  if (!targetUrl) {
    console.error('Silakan masukkan URL YouTube atau YouTube Music.');
    printHelp();
    return;
  }

  try {
    const res = await extractMedia(targetUrl, formatChoice);

    if (saveFile) {
      fs.writeFileSync(saveFile, JSON.stringify(res, null, 2));
    }

    console.log(JSON.stringify(res, null, 2));

    if (shouldDownload && res.status && res.data && res.data.url) {
      const ext = res.data.format || 'mp3';
      const safeTitle = `${res.data.title || 'audio'}.${ext}`;
      const destDir = customDir || './downloads';
      await downloadMedia(res.data.url, safeTitle, destDir);
    }
  } catch (err) {
    console.log(JSON.stringify(errorResponse(err.message), null, 2));
    process.exit(1);
  }
}

module.exports = {
  extractMedia,
  downloadMedia,
  normalizeYouTubeUrl,
  successResponse,
  errorResponse,
};

if (require.main === module) {
  runCli();
}
