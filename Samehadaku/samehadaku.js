#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { finished } = require('stream/promises');

const CREATOR = 'Dwi-Merajah';
const BASE_URL = 'https://v2.samehadaku.how';

async function fetchHtml(url) {
  const targetUrl = url.startsWith('http') ? url : `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;

  try {
    const directResp = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*' + '/' + '*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      signal: AbortSignal.timeout(4000)
    });

    if (directResp.status === 200) {
      const text = await directResp.text();
      if (!text.includes('challenges.cloudflare.com') && !text.includes('Just a moment...')) {
        return text;
      }
    }
  } catch (err) {}

  try {
    const botResp = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*' + '/' + '*;q=0.8'
      },
      signal: AbortSignal.timeout(4000)
    });

    if (botResp.status === 200) {
      const text = await botResp.text();
      if (!text.includes('challenges.cloudflare.com') && !text.includes('Just a moment...')) {
        return text;
      }
    }
  } catch (err) {}

  const proxyUrl = `https://r.jina.ai/${targetUrl}`;
  try {
    const proxyResp = await fetch(proxyUrl, {
      headers: {
        'X-Return-Format': 'html'
      },
      signal: AbortSignal.timeout(25000)
    });

    if (proxyResp.status === 200) {
      const text = await proxyResp.text();
      if (text && !text.includes('challenges.cloudflare.com') && !text.includes('Just a moment...')) {
        return text;
      }
    }
  } catch (err) {}

  throw new Error(`Gagal fetch ${targetUrl} (Bypass Cloudflare tidak berhasil)`);
}

function cleanText(str) {
  if (!str) return '';
  return str
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#8211;/g, '-')
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#038;/g, '&')
    .replace(/&#8217;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
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

async function search(query) {
  try {
    if (!query || !query.trim()) {
      throw new Error('Query pencarian tidak boleh kosong.');
    }

    const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(query.trim())}`;
    const searchHtml = await fetchHtml(searchUrl);

    const articleRegex = /<article[^>]*class="[^"]*animpost[^"]*"[\s\S]*?<\/article>/gi;
    const list = [];
    let artMatch;

    while ((artMatch = articleRegex.exec(searchHtml)) !== null) {
      const art = artMatch[0];
      const urlMatch = art.match(/<div class="animposx">\s*<a\s+[^>]*href="([^"]+)"[^>]*title="([^"]*)"/i)
        || art.match(/<a\s+[^>]*href="([^"]+)"[^>]*title="([^"]*)"/i);
      const titleMatch = art.match(/<div class="title">\s*<h2>([^<]+)<\/h2>/i);
      const title = titleMatch ? cleanText(titleMatch[1]) : (urlMatch ? cleanText(urlMatch[2]) : null);
      const url = urlMatch ? urlMatch[1] : null;
      const thumbMatch = art.match(/<img[^>]+(?:src|data-src)="([^"]+)"/i);
      const scoreMatch = art.match(/<div class="score">(?:<i[^>]*><\/i>)?\s*([^<]+)<\/div>/i);
      const typeMatch = art.match(/<div class="type\s*([^"]*)">([^<]+)<\/div>/i);
      const synopsisMatch = art.match(/<div class="ttls">([\s\S]*?)<\/div>/i);
      const genres = [...art.matchAll(/<a[^>]*rel="tag"[^>]*>([^<]+)<\/a>/g)].map(m => cleanText(m[1]));

      if (title && url) {
        list.push({
          title,
          score: scoreMatch ? cleanText(scoreMatch[1]) : null,
          type: typeMatch ? cleanText(typeMatch[2]) : null,
          url,
          thumbnail: thumbMatch ? thumbMatch[1] : null,
          synopsis: synopsisMatch ? cleanText(synopsisMatch[1]) : null,
          genres
        });
      }
    }

    return successResponse(list);
  } catch (err) {
    return errorResponse(err.message);
  }
}

async function info(animeUrlOrQuery) {
  try {
    let targetUrl = animeUrlOrQuery.trim();

    if (!targetUrl.startsWith('http')) {
      const searchRes = await search(targetUrl);
      if (!searchRes.status || !searchRes.data || searchRes.data.length === 0) {
        throw new Error(`Anime dengan judul "${targetUrl}" tidak ditemukan.`);
      }

      const exactMatch = searchRes.data.find(a => a.title.toLowerCase() === targetUrl.toLowerCase());
      targetUrl = exactMatch ? exactMatch.url : searchRes.data[0].url;
    }

    const html = await fetchHtml(targetUrl);

    const rawTitleMatch = html.match(/<h1 class="entry-title"[^>]*>([\s\S]*?)<\/h1>/i)
      || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = rawTitleMatch
      ? cleanText(rawTitleMatch[1])
          .replace(/\s*&#8211;\s*Samehadaku$/i, '')
          .replace(/\s*-\s*Samehadaku$/i, '')
          .replace(/\s*Sub Indo$/i, '')
          .trim()
      : '';

    const thumbMatch = html.match(/<div class="thumb"[^>]*>[\s\S]*?<img[^>]+(?:src|data-src)="([^"]+)"/i);
    const scoreMatch = html.match(/<span[^>]*itemprop="ratingValue"[^>]*>([^<]+)<\/span>/i)
      || html.match(/<div class="rating"[^>]*>[\s\S]*?<strong>([^<]+)<\/strong>/i);
    const synMatch = html.match(/<div class="(?:desc|entry-content-single|sinopsis)"[^>]*>([\s\S]*?)<\/div>/i);

    const metadata = {};
    const metaSpans = html.match(/<div class="spe"[^>]*>([\s\S]*?)<\/div>/i);
    if (metaSpans) {
      const spans = metaSpans[1].match(/<span>[\s\S]*?<\/span>/gi) || [];
      for (const sp of spans) {
        const bMatch = sp.match(/<b>([^<]+)<\/b>/i);
        if (bMatch) {
          const key = cleanText(bMatch[1]).toLowerCase().replace(/[:]/g, '').trim().replace(/\s+/g, '_');
          const val = cleanText(sp.replace(/<b[^>]*>[\s\S]*?<\/b>/i, ''));
          if (key && val) metadata[key] = val;
        }
      }
    }

    const genreBlock = html.match(/<div class="genre-info"[^>]*>([\s\S]*?)<\/div>/i)
      || html.match(/<div class="genres"[^>]*>([\s\S]*?)<\/div>/i);
    const genres = genreBlock
      ? [...genreBlock[1].matchAll(/<a[^>]*>([^<]+)<\/a>/g)].map(m => cleanText(m[1]))
      : [];

    const epRegex = /<span class="lchx"><a href="([^"]+)">([^<]+)<\/a><\/span>(?:\s*<span class="date">([^<]+)<\/span>)?/g;
    const episodes = [];
    let epMatch;
    while ((epMatch = epRegex.exec(html)) !== null) {
      const epUrl = epMatch[1];
      const epTitle = cleanText(epMatch[2]);
      const date = epMatch[3] ? cleanText(epMatch[3]) : null;
      const numMatch = epUrl.match(/episode-([0-9.]+)/i) || epTitle.match(/episode\s*([0-9.]+)/i);
      episodes.push({
        episode_number: numMatch ? parseFloat(numMatch[1]) : null,
        episode_title: epTitle,
        episode_url: epUrl,
        release_date: date
      });
    }

    return successResponse({
      title,
      url: targetUrl,
      thumbnail: thumbMatch ? thumbMatch[1] : null,
      score: scoreMatch ? cleanText(scoreMatch[1]) : null,
      synopsis: synMatch ? cleanText(synMatch[1]) : null,
      genres,
      metadata,
      total_episodes: episodes.length,
      episodes
    });
  } catch (err) {
    return errorResponse(err.message);
  }
}

async function get(episodeUrlOrQuery, episodeNum = null) {
  try {
    let targetUrl = '';

    if (episodeUrlOrQuery.startsWith('http') && !episodeNum) {
      targetUrl = episodeUrlOrQuery.trim();
    } else {
      const animeRes = await info(episodeUrlOrQuery);
      if (!animeRes.status || !animeRes.data || !animeRes.data.episodes || animeRes.data.episodes.length === 0) {
        throw new Error(`Episode untuk anime "${episodeUrlOrQuery}" tidak ditemukan.`);
      }

      const episodes = animeRes.data.episodes;
      if (episodeNum !== null && episodeNum !== undefined) {
        const searchNum = parseFloat(episodeNum);
        const found = episodes.find(e => e.episode_number === searchNum)
          || episodes.find(e => e.episode_title.toLowerCase().includes(`episode ${episodeNum}`) || e.episode_url.includes(`episode-${episodeNum}`));
        if (!found) {
          throw new Error(`Episode ${episodeNum} tidak ditemukan pada anime ${animeRes.data.title}`);
        }
        targetUrl = found.episode_url;
      } else {
        targetUrl = episodes[0].episode_url;
      }
    }

    const html = await fetchHtml(targetUrl);

    const rawTitleMatch = html.match(/<h1 class="entry-title"[^>]*>([\s\S]*?)<\/h1>/i)
      || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = rawTitleMatch
      ? cleanText(rawTitleMatch[1])
          .replace(/\s*&#8211;\s*Samehadaku$/i, '')
          .replace(/\s*-\s*Samehadaku$/i, '')
          .replace(/\s*Sub Indo$/i, '')
          .trim()
      : '';

    const numMatch = targetUrl.match(/episode-([0-9.]+)/i) || title.match(/episode\s*([0-9.]+)/i);
    const episode = numMatch ? parseFloat(numMatch[1]) : null;

    let animeTitle = title;
    const epMatch = title.match(/^(.*?)(?:\s+Episode\s+[0-9.]+)/i);
    if (epMatch) animeTitle = epMatch[1].trim();

    const blockRegex = /<div class="download-eps"[^>]*>([\s\S]*?)<\/ul>\s*<\/div>/gi;
    const downloads = [];
    let bMatch;

    while ((bMatch = blockRegex.exec(html)) !== null) {
      const blockContent = bMatch[1];
      const fmtMatch = blockContent.match(/<p><b>([\s\S]*?)<\/b><\/p>/i) || blockContent.match(/<b>([\s\S]*?)<\/b>/i);
      let format = fmtMatch ? cleanText(fmtMatch[1]) : 'Unknown';
      if (format.toLowerCase().startsWith('link download')) {
        format = format.replace(new RegExp('^Link Download\\s*', 'i'), '').trim();
      }
      if (format.includes('[')) {
        format = format.split('[')[0].trim();
      }

      const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      const qualities = [];
      let liMatch;

      while ((liMatch = liRegex.exec(blockContent)) !== null) {
        const liContent = liMatch[1];
        const qMatch = liContent.match(/<strong>([\s\S]*?)<\/strong>/i);
        const quality = qMatch ? cleanText(qMatch[1]) : 'Unknown';

        const aRegex = /<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
        const servers = [];
        let directUrl = null;
        let aMatch;

        while ((aMatch = aRegex.exec(liContent)) !== null) {
          const sUrl = aMatch[1];
          const sName = cleanText(aMatch[2]);
          let dUrl = null;

          const pdMatch = sUrl.match(/pixeldrain\.com\/u\/([a-zA-Z0-9_-]+)/i);
          if (pdMatch) {
            dUrl = `https://pixeldrain.com/api/file/${pdMatch[1]}`;
            if (!directUrl) directUrl = dUrl;
          }

          servers.push({
            server: sName,
            url: sUrl,
            direct_url: dUrl
          });
        }

        qualities.push({
          quality,
          direct_url: directUrl,
          servers
        });
      }

      downloads.push({
        format,
        qualities
      });
    }

    return successResponse({
      title,
      anime_title: animeTitle,
      episode,
      url: targetUrl,
      downloads
    });
  } catch (err) {
    return errorResponse(err.message);
  }
}

async function downloadVideo(downloadUrl, filename, destDir = './downloads') {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const safeFilename = filename.replace(new RegExp('[\\\\/\\*\\?\\:\\"\\<\\>\\|]', 'g'), '_');
  const filePath = path.join(destDir, safeFilename);

  console.log(`\nMemulai download ke: ${filePath}`);

  const resp = await fetch(downloadUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': ['*', '*'].join('/')
    },
    redirect: 'follow'
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
    }
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
SAMEHADAKU.JS - CLI Samehadaku Anime Scraper & Direct Download Extractor
Website: https://v2.samehadaku.how/

3 FITUR UTAMA:
  1. search <judul>
      Mencari data series anime spesifik (contoh: "one piece").
      Menampilkan daftar hasil series, thumbnail, rating, status, sinopsis singkat, dll.
      Contoh: node samehadaku.js search "one piece"

  2. info <judul_atau_url>
      Mendapatkan informasi detail anime, jumlah episode, metadata, dan URL setiap episodenya.
      Contoh: node samehadaku.js info "one piece"
              node samehadaku.js info https://v2.samehadaku.how/anime/one-piece/

  3. get <url_episode>
  3. get <judul_anime> <nomor_episode>
      Mendapatkan direct download link video per episode untuk seluruh format (MP4, MKV, x265) dan resolusi.
      Contoh: node samehadaku.js get https://v2.samehadaku.how/one-piece-episode-1177/
              node samehadaku.js get "one piece" 1177
              node samehadaku.js get "naruto" 1

OPSI TAMBAHAN:
  --save <file.json> Simpan hasil output ke file JSON
  --download [dir]   Download video langsung ke folder lokal via direct link (Pixeldrain)
  --quality <res>    Pilih kualitas unduhan (360p, 480p, 720p, 1080p). Default: 720p
`);
  };

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  const saveIdx = args.indexOf('--save');
  const saveFile = saveIdx !== -1 ? args[saveIdx + 1] : null;
  const dlIdx = args.indexOf('--download');
  const shouldDownload = dlIdx !== -1;
  const customDir = dlIdx !== -1 && args[dlIdx + 1] && !args[dlIdx + 1].startsWith('--') ? args[dlIdx + 1] : null;
  const qIdx = args.indexOf('--quality');
  const preferredQuality = qIdx !== -1 && args[qIdx + 1] ? args[qIdx + 1].toLowerCase() : '720p';

  try {
    if (command === 'search' || command === 'cari') {
      const query = args[1];
      if (!query) {
        console.error('Silakan masukkan judul anime yang ingin dicari.');
        return;
      }
      const res = await search(query);

      if (saveFile) fs.writeFileSync(saveFile, JSON.stringify(res, null, 2));
      console.log(JSON.stringify(res, null, 2));

    } else if (command === 'info' || command === 'detail') {
      const target = args[1];
      if (!target) {
        console.error('Silakan masukkan judul atau URL anime.');
        return;
      }
      const res = await info(target);

      if (saveFile) fs.writeFileSync(saveFile, JSON.stringify(res, null, 2));
      console.log(JSON.stringify(res, null, 2));

    } else if (command === 'get' || command === 'download' || command === 'episode' || command === 'eps') {
      const param1 = args[1];
      const param2 = args[2] && !args[2].startsWith('--') ? args[2] : null;

      if (!param1) {
        console.error('Silakan masukkan URL episode atau nama anime dan nomor episode.');
        return;
      }

      const res = await get(param1, param2);

      if (saveFile) fs.writeFileSync(saveFile, JSON.stringify(res, null, 2));
      console.log(JSON.stringify(res, null, 2));

      if (shouldDownload && res.status && res.data && res.data.downloads) {
        let chosenDirectUrl = null;
        let chosenFormat = 'MP4';
        let chosenQuality = preferredQuality;

        for (const block of res.data.downloads) {
          for (const q of block.qualities) {
            if (q.direct_url && (q.quality.toLowerCase().includes(preferredQuality) || preferredQuality === 'any')) {
              chosenDirectUrl = q.direct_url;
              chosenFormat = block.format;
              chosenQuality = q.quality;
              break;
            }
          }
          if (chosenDirectUrl) break;
        }

        if (!chosenDirectUrl) {
          for (const block of res.data.downloads) {
            for (const q of block.qualities) {
              if (q.direct_url) {
                chosenDirectUrl = q.direct_url;
                chosenFormat = block.format;
                chosenQuality = q.quality;
                break;
              }
            }
            if (chosenDirectUrl) break;
          }
        }

        if (chosenDirectUrl) {
          const ext = chosenFormat.toLowerCase().includes('mkv') ? 'mkv' : 'mp4';
          const safeTitle = `${res.data.title}_${chosenQuality}.${ext}`;
          const destDir = customDir || './downloads';
          await downloadVideo(chosenDirectUrl, safeTitle, destDir);
        } else {
          console.log('\nTidak ditemukan direct URL otomatis untuk episode ini. Silakan gunakan link server mirror di atas.');
        }
      }
    } else {
      console.error(`Perintah "${command}" tidak dikenali.`);
      printHelp();
    }
  } catch (err) {
    console.log(JSON.stringify(errorResponse(err.message), null, 2));
  }
}

module.exports = {
  search,
  info,
  get,
  downloadVideo,
  successResponse,
  errorResponse,
};

if (require.main === module) {
  runCli();
}
