# Scraper Samehadaku

Scraper dan client extractor/downloader anime untuk website [Samehadaku](https://v2.samehadaku.how/).

---

## 🚀 Single File JavaScript / Node.js: `samehadaku.js`

File tunggal **[`samehadaku.js`](file:///root/Scrape/samehadaku.js)** tanpa komentar kode, dilengkapi bypass otomatis proteksi Cloudflare Turnstile menggunakan engine browser Playwright.

### 3 Fitur Utama:
1. **`search`**: Mencari series anime spesifik (contoh: `"one piece"` menghasilkan daftar series: *One Piece*, *One Piece: Heroines*, *One Piece Film: Red*, dll beserta skor, thumbnail, genre, dan sinopsis singkat).
2. **`info`**: Mengambil metadata detail series anime, status, studio, total episode, dan **daftar lengkap seluruh URL episode**.
3. **`get`**: Mengambil **direct download URL video** per episode untuk semua format (`MP4`, `MKV`, `x265`) dan resolusi (`360p`, `480p`, `720p/MP4HD`, `1080p/FULLHD`, `4K`).

---

### Output JSON Standar:

```json
{
  "creator": "Dwi-Merajah",
  "status": true,
  "data": {
    "title": "One Piece Episode 1177",
    "anime_title": "One Piece",
    "episode": 1177,
    "url": "https://v2.samehadaku.how/one-piece-episode-1177/",
    "downloads": [
      {
        "format": "MP4",
        "qualities": [
          {
            "quality": "360p",
            "direct_url": "https://pixeldrain.com/api/file/buEjXLkj",
            "servers": [
              {
                "server": "Pixeldrain",
                "url": "https://pixeldrain.com/u/buEjXLkj",
                "direct_url": "https://pixeldrain.com/api/file/buEjXLkj"
              },
              {
                "server": "Gofile",
                "url": "https://gofile.io/d/NDnHaZsG",
                "direct_url": null
              },
              {
                "server": "Filedon",
                "url": "https://filedon.co/view/9Ma20z0XHp",
                "direct_url": null
              }
            ]
          },
          {
            "quality": "MP4HD",
            "direct_url": "https://pixeldrain.com/api/file/...",
            "servers": []
          }
        ]
      },
      {
        "format": "MKV",
        "qualities": []
      },
      {
        "format": "x265",
        "qualities": []
      }
    ]
  }
}
```

> **Direct URL**: Properti `direct_url` (seperti `https://pixeldrain.com/api/file/{id}`) adalah link streaming binary file langsung tanpa melewati shortlink ataupun pop-up iklan.

---

### Cara Menjalankan via CLI:

```bash
# 1. Search Anime (Pencarian Series):
node samehadaku.js search "one piece"
node samehadaku.js search "buchigire"

# 2. Info Anime (Detail & Seluruh Daftar Episode):
node samehadaku.js info "one piece"
node samehadaku.js info https://v2.samehadaku.how/anime/one-piece/

# 3. Get Episode (Mengambil Direct Download Link Video):
# Lewat Judul Anime & Nomor Episode:
node samehadaku.js get "one piece" 1177
node samehadaku.js get "buchigire" 10

# Lewat URL Episode Langsung:
node samehadaku.js get https://v2.samehadaku.how/one-piece-episode-1177/

# 4. Cetak Output Pure JSON & Simpan ke File:
node samehadaku.js get "one piece" 1177 --save hasil_ep1177.json

# 5. Download Video Otomatis ke Folder Lokal:
node samehadaku.js get "one piece" 1177 --download ./downloads --quality 720p
```

---

### Penggunaan sebagai Module di Proyek JavaScript / Express / Backend:

```javascript
const { search, info, get, downloadVideo } = require('./samehadaku.js');

async function main() {
  // 1. Search Anime
  const searchResult = await search('one piece');
  console.log('Daftar Series:', searchResult.data);

  // 2. Ambil Info & Daftar Semua Episode
  const animeInfo = await info('one piece');
  console.log('Total Episode:', animeInfo.data.total_episodes);

  // 3. Ambil Direct Download URL Episode
  const latestEp = animeInfo.data.episodes[0];
  const downloadData = await get(latestEp.episode_url);
  console.log('Download Links:', downloadData.data.downloads);

  // 4. Download Video Langsung via Direct Link
  const directMp4 = downloadData.data.downloads[0].qualities[0].direct_url;
  if (directMp4) {
    await downloadVideo(directMp4, 'one_piece_latest.mp4', './downloads');
  }
}

main();
```
