const fs = require('fs');
const path = require('path');

const CREATOR = 'Dwi-Merajah';
const BASE_URL = 'https://bacakomik.my';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'id,en-US;q=0.9,en;q=0.8',
  'Referer': `${BASE_URL}/`,
};

async function fetchHtml(url) {
  const targetUrl = url.startsWith('http') ? url : `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  const resp = await fetch(targetUrl, { headers: HEADERS });
  if (!resp.ok) {
    throw new Error(`Gagal fetch ${targetUrl} - HTTP status ${resp.status}`);
  }
  return await resp.text();
}

function cleanText(str) {
  if (!str) return '';
  return str.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
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

async function getRekomendasi(limit = 20) {
  try {
    const html = await fetchHtml(`${BASE_URL}/komik-populer/`);
    const cards = html.split(/class=["']animepost["']/i).slice(1);
    const results = [];

    for (const block of cards) {
      const urlMatch = block.match(/href=["'](https:\/\/bacakomik\.my\/komik\/[^"']+)["']/i);
      const titleMatch = block.match(/<h4>([^<]+)<\/h4>/i) || block.match(/title=["']([^"']+)["']/i);
      const typeMatch = block.match(/class=["']typeflag\s*([^"']+)["']/i);
      const ratingMatch = block.match(/<i>\s*([0-9.]+)\s*<\/i>/i) || block.match(/class=["']fas fa-star["']><\/i>\s*([0-9.]+)/i);
      const thumbMatch = block.match(/data-lazy-src=["']([^"']+)["']/i) || block.match(/src=["'](https:\/\/[^"']+)["']/i);

      if (urlMatch && titleMatch) {
        let title = cleanText(titleMatch[1]);
        if (title.toLowerCase().startsWith('komik ')) {
          title = title.substring(6).trim();
        }

        results.push({
          title,
          type: typeMatch ? typeMatch[1].trim() : 'Unknown',
          rating: ratingMatch ? ratingMatch[1].trim() : null,
          url: urlMatch[1].trim(),
          thumbnail: thumbMatch ? thumbMatch[1].trim() : null,
        });

        if (results.length >= limit) break;
      }
    }

    return successResponse(results);
  } catch (err) {
    return errorResponse(err.message);
  }
}

async function searchComic(query) {
  try {
    if (!query || !query.trim()) {
      throw new Error('Query pencarian tidak boleh kosong');
    }
    const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(query.trim())}`;
    const html = await fetchHtml(searchUrl);
    const cards = html.split(/class=["']animepost["']/i).slice(1);
    const results = [];

    for (const block of cards) {
      const urlMatch = block.match(/href=["'](https:\/\/bacakomik\.my\/komik\/[^"']+)["']/i);
      const titleMatch = block.match(/<h4>([^<]+)<\/h4>/i) || block.match(/title=["']([^"']+)["']/i);
      const typeMatch = block.match(/class=["']typeflag\s*([^"']+)["']/i);
      const ratingMatch = block.match(/<i>\s*([0-9.]+)\s*<\/i>/i) || block.match(/class=["']fas fa-star["']><\/i>\s*([0-9.]+)/i);
      const latestChMatch = block.match(/class=["']lsch["'][\s\S]*?<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
      const thumbMatch = block.match(/data-lazy-src=["']([^"']+)["']/i) || block.match(/src=["'](https:\/\/[^"']+)["']/i);

      if (urlMatch && titleMatch) {
        let title = cleanText(titleMatch[1]);
        if (title.toLowerCase().startsWith('komik ')) {
          title = title.substring(6).trim();
        }

        results.push({
          title,
          type: typeMatch ? typeMatch[1].trim() : 'Unknown',
          rating: ratingMatch ? ratingMatch[1].trim() : null,
          latest_chapter: latestChMatch ? cleanText(latestChMatch[2]) : null,
          latest_chapter_url: latestChMatch ? latestChMatch[1].trim() : null,
          url: urlMatch[1].trim(),
          thumbnail: thumbMatch ? thumbMatch[1].trim() : null,
        });
      }
    }

    return successResponse(results);
  } catch (err) {
    return errorResponse(err.message);
  }
}

async function getAllChapters(comicUrlOrQuery) {
  try {
    let comicUrl = comicUrlOrQuery.trim();

    if (!comicUrl.startsWith('http')) {
      const searchRes = await searchComic(comicUrl);
      if (!searchRes.status || !searchRes.data || searchRes.data.length === 0) {
        throw new Error(`Komik dengan judul "${comicUrl}" tidak ditemukan.`);
      }
      comicUrl = searchRes.data[0].url;
    }

    const html = await fetchHtml(comicUrl);

    const titleMatch = html.match(/<h1[^>]*class=["'][^"']*entry-title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)
      || html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    let title = titleMatch ? cleanText(titleMatch[1]) : '';
    if (title.toLowerCase().startsWith('komik ')) {
      title = title.substring(6).trim();
    }

    const containerMatch = html.match(/id=["']chapter_list["'][\s\S]*?<\/div>/i)
      || html.match(/class=["'][^"']*bxcl[^"']*["'][\s\S]*?<\/div>/i);
    const targetHtml = containerMatch ? containerMatch[0] : html;

    const liMatches = [...targetHtml.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)];
    const chapters = [];
    const seenUrls = new Set();

    for (const li of liMatches) {
      const content = li[1];
      const aMatch = content.match(/<span class=["']lchx["']><a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a><\/span>/i)
        || content.match(/<a[^>]*href=["'](https:\/\/bacakomik\.my\/[^"']+-chapter-[^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);

      if (aMatch) {
        const chUrl = aMatch[1].trim();
        if (!seenUrls.has(chUrl)) {
          seenUrls.add(chUrl);
          const rawTitle = cleanText(aMatch[2]);
          const dtMatch = content.match(/<span class=["']dt["'][^>]*>([\s\S]*?)<\/span>/i);
          const releaseDate = dtMatch ? cleanText(dtMatch[1]) : '';

          const numMatch = rawTitle.match(/chapter\s*([0-9.]+)/i) || chUrl.match(/chapter-([0-9.]+)/i);
          const chapterNumber = numMatch ? parseFloat(numMatch[1]) : null;

          chapters.push({
            chapter_title: rawTitle,
            chapter_number: chapterNumber,
            chapter_url: chUrl,
            release_date: releaseDate,
          });
        }
      }
    }

    return successResponse({
      title,
      url: comicUrl,
      total_chapters: chapters.length,
      chapters,
    });
  } catch (err) {
    return errorResponse(err.message);
  }
}

async function getChapterImages(chapterUrlOrQuery, chapterNum = null) {
  try {
    let targetUrl = '';
    let comicName = '';

    if (chapterUrlOrQuery.startsWith('http') && !chapterNum) {
      targetUrl = chapterUrlOrQuery.trim();
    } else {
      const comicRes = await getAllChapters(chapterUrlOrQuery);
      if (!comicRes.status || !comicRes.data || !comicRes.data.chapters || comicRes.data.chapters.length === 0) {
        throw new Error(`Tidak ada chapter ditemukan untuk: ${chapterUrlOrQuery}`);
      }

      comicName = comicRes.data.title;
      const chapters = comicRes.data.chapters;

      if (chapterNum !== null && chapterNum !== undefined) {
        const searchNum = parseFloat(chapterNum);
        const found = chapters.find(c => c.chapter_number === searchNum)
          || chapters.find(c => {
            const reg = new RegExp(`chapter[- ]${chapterNum}(?:-|\\/|$)`, 'i');
            return reg.test(c.chapter_url) || reg.test(c.chapter_title);
          });

        if (!found) {
          throw new Error(`Chapter ${chapterNum} tidak ditemukan pada komik ${comicName}`);
        }
        targetUrl = found.chapter_url;
      } else {
        targetUrl = chapters[0].chapter_url;
      }
    }

    const html = await fetchHtml(targetUrl);

    const rawH1Match = html.match(/<h1[^>]*class=["'][^"']*entry-title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)
      || html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
      || html.match(/<title>([\s\S]*?)<\/title>/i);
    const rawH1 = rawH1Match ? cleanText(rawH1Match[1]) : '';
    const cleanedH1 = rawH1.replace(/^Komik\s+/i, '').trim();

    let chapterName = '';
    const chMatch = cleanedH1.match(/(Chapter\s*[0-9.]+.*)$/i);
    if (chMatch) {
      chapterName = chMatch[1].trim();
      if (!comicName) {
        comicName = cleanedH1.substring(0, chMatch.index).trim();
      }
    } else {
      chapterName = cleanedH1;
      if (!comicName) {
        const comicLinkMatch = html.match(/<a[^>]*href=["'](https:\/\/bacakomik\.my\/komik\/[^"']+)["']/i);
        if (comicLinkMatch) {
          comicName = comicLinkMatch[1].split('/komik/')[1].replace(/\//g, '').replace(/-/g, ' ');
        }
      }
    }

    const readerMatch = html.match(/id=["']anjay_ini_id_kh["'][\s\S]*?<\/div>/i)
      || html.match(/id=["']readerarea["'][\s\S]*?<\/div>/i);
    const readerHtml = readerMatch ? readerMatch[0] : html;

    const imgMatches = [...readerHtml.matchAll(/<img[^>]*>/gi)];
    const imageUrls = [];
    const seenUrls = new Set();

    for (const match of imgMatches) {
      const tag = match[0];
      let src = '';
      const lazyMatch = tag.match(/data-lazy-src=["']([^"']+)["']/i)
        || tag.match(/data-src=["']([^"']+)["']/i)
        || tag.match(/data-original=["']([^"']+)["']/i);

      if (lazyMatch) {
        src = lazyMatch[1].trim();
      } else {
        const srcMatch = tag.match(/src=["']([^"']+)["']/i);
        if (srcMatch) src = srcMatch[1].trim();
      }

      if (!src || src.startsWith('data:')) {
        const errMatch = tag.match(/this\.src=['"]([^'"]+)['"]/i);
        if (errMatch) src = errMatch[1].trim();
      }

      if (src && !src.startsWith('data:') && !seenUrls.has(src)) {
        const isSiteAsset = /logo|icon|ikon-hd|banner|avatar|wp-content\/uploads\/202/i.test(src);
        if (!isSiteAsset || src.includes('/data/')) {
          seenUrls.add(src);
          imageUrls.push(src);
        }
      }
    }

    return {
      creator: CREATOR,
      status: true,
      data: {
        title: comicName,
        chapter: chapterName,
        url: targetUrl,
        image_url: imageUrls,
      },
    };
  } catch (err) {
    return errorResponse(err.message);
  }
}

async function downloadImages(imageUrls, destDir) {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  console.log(`\nMendownload ${imageUrls.length} gambar ke folder: ${destDir}`);
  const downloadedPaths = [];

  for (let i = 0; i < imageUrls.length; i++) {
    const imgUrl = imageUrls[i];
    const pageNum = String(i + 1).padStart(3, '0');
    const extMatch = imgUrl.match(/\.(jpe?g|png|webp)/i);
    const ext = extMatch ? extMatch[0].toLowerCase() : '.jpg';
    const filePath = path.join(destDir, `page_${pageNum}${ext}`);

    try {
      const res = await fetch(imgUrl, { headers: HEADERS });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();
      fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
      downloadedPaths.push(filePath);
      process.stdout.write(`\r  [${i + 1}/${imageUrls.length}] Terdownload: page_${pageNum}${ext}`);
    } catch (err) {
      console.error(`\n  Gagal download halaman ${i + 1} (${imgUrl}): ${err.message}`);
    }
  }

  console.log(`\nSelesai! ${downloadedPaths.length}/${imageUrls.length} gambar tersimpan.\n`);
  return downloadedPaths;
}

async function runCli() {
  const args = process.argv.slice(2);
  const command = args[0]?.toLowerCase();

  const printHelp = () => {
    console.log(`
BACAKOMIK.JS - CLI Komik Scraper & Direct Image Link Extractor
Website: https://bacakomik.my/

PENGGUNAAN:
  node bacakomik.js <perintah> [argumen] [opsi]

PERINTAH:
  rekomendasi [limit]
      Menampilkan daftar komik terpopuler / rekomendasi hari ini.
      Contoh: node bacakomik.js rekomendasi 10

  cari <judul>
      Mencari komik berdasarkan nama atau kata kunci.
      Contoh: node bacakomik.js cari "solo leveling"

  chapters <judul_atau_url>
      Mengambil seluruh daftar chapter dari komik.
      Contoh: node bacakomik.js chapters "solo leveling"
              node bacakomik.js chapters https://bacakomik.my/komik/solo-leveling/

  chapter <url_chapter>
  chapter <judul_atau_url> <nomor_chapter>
      MENGAMBIL DIRECT LINK SEMUA GAMBAR 1 CHAPTER BERURUTAN!
      Contoh:
        node bacakomik.js chapter https://bacakomik.my/the-retired-killer-wants-a-quiet-life-chapter-18/
        node bacakomik.js chapter "solo leveling" 1
        node bacakomik.js chapter "the retired killer" 18

OPSI:
  --json             Hanya cetak output dalam format JSON murni
  --download [dir]   Download seluruh gambar ke folder lokal
  --save <file.json> Simpan hasil ke file JSON
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
  const shouldDownload = dlIdx !== -1;
  const customDir = shouldDownload && args[dlIdx + 1] && !args[dlIdx + 1].startsWith('--') ? args[dlIdx + 1] : null;

  try {
    if (command === 'rekomendasi' || command === 'populer') {
      const limit = parseInt(args[1], 10) || 15;
      const res = await getRekomendasi(limit);

      if (saveFile) fs.writeFileSync(saveFile, JSON.stringify(res, null, 2));

      if (isJson) {
        console.log(JSON.stringify(res, null, 2));
      } else {
        console.log(JSON.stringify(res, null, 2));
      }
    } else if (command === 'cari' || command === 'search') {
      const query = args[1];
      if (!query) {
        console.error('Silakan masukkan judul komik yang ingin dicari.');
        return;
      }
      const res = await searchComic(query);

      if (saveFile) fs.writeFileSync(saveFile, JSON.stringify(res, null, 2));

      if (isJson) {
        console.log(JSON.stringify(res, null, 2));
      } else {
        console.log(JSON.stringify(res, null, 2));
      }
    } else if (command === 'chapters') {
      const target = args[1];
      if (!target) {
        console.error('Silakan masukkan judul atau URL komik.');
        return;
      }
      const res = await getAllChapters(target);

      if (saveFile) fs.writeFileSync(saveFile, JSON.stringify(res, null, 2));

      if (isJson) {
        console.log(JSON.stringify(res, null, 2));
      } else {
        console.log(JSON.stringify(res, null, 2));
      }
    } else if (command === 'chapter') {
      const param1 = args[1];
      const param2 = args[2] && !args[2].startsWith('--') ? args[2] : null;

      if (!param1) {
        console.error('Silakan masukkan URL chapter atau nama komik dan nomor chapter.');
        return;
      }

      const res = await getChapterImages(param1, param2);

      if (saveFile) fs.writeFileSync(saveFile, JSON.stringify(res, null, 2));

      console.log(JSON.stringify(res, null, 2));

      if (shouldDownload && res.status && res.data && res.data.image_url) {
        const safeTitle = `${res.data.title || 'comic'}_${res.data.chapter || 'chapter'}`.replace(/[\\/*?:"<>|]/g, '_');
        const defaultDir = path.join('downloads', safeTitle);
        const targetDir = customDir || defaultDir;
        await downloadImages(res.data.image_url, targetDir);
      }
    } else {
      console.error(`Perintah "${command}" tidak dikenali.`);
      printHelp();
    }
  } catch (err) {
    console.log(JSON.stringify(errorResponse(err.message), null, 2));
    process.exit(1);
  }
}

module.exports = {
  getRekomendasi,
  searchComic,
  getAllChapters,
  getChapterImages,
  downloadImages,
};

if (require.main === module) {
  runCli();
}
