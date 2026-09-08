# Scraper Y2Mate (YouTube & YouTube Music)

Scraper dan client extractor/downloader untuk media YouTube dan YouTube Music berbasis analisis workflow target [Y2Mate](https://y2mate.gs/).

---

## 🚀 Single File JavaScript / Node.js: `y2mate.js`

File tunggal **[`y2mate.js`](file:///root/Scrape/y2mate.js)** tanpa dependensi eksternal (menggunakan native `fetch` dan `stream` bawaan Node.js 18+).

### Fitur Utama:
- **Normalisasi URL Otomatis**: Mendukung berbagai format link (`music.youtube.com`, `youtube.com/watch`, `youtu.be`, `shorts`, `embed`, `live`, atau raw 11-char Video ID).
- **Direct Download Link**: Mengambil direct link download file audio/video siap simpan.
- **Metadata Lengkap**: Judul (title), thumbnail resolusi tinggi (`maxresdefault`), format, kualitas (bitrate), durasi, dan ukuran file (filesize).
- **Auto Downloader**: Opsi `--download` untuk langsung streaming dan menyimpan file ke direktori lokal dengan visual progress bar.
- **Output JSON Standar**:
  ```json
  {
    "creator": "Dwi-Merajah",
    "status": true,
    "data": {
      "title": "Ride",
      "thumbnail": "https://i.ytimg.com/vi/w1Smzzw_w7Q/maxresdefault.jpg",
      "format": "mp3",
      "quality": "192 kbps",
      "filesize": "3.31 MB",
      "filesize_bytes": 3473362,
      "duration": 214.49,
      "url": "https://omicron.123tokyo.xyz/get.php/6/ad/w1Smzzw_w7Q.mp3?n=Ride&uT=R&uN=Y29kZWJ1c3RlcnM%3D&h=..."
    }
  }
  ```

### Cara Menjalankan via CLI:

```bash
# 1. Ekstraksi Info & Direct Link MP3 (Default):
node y2mate.js https://music.youtube.com/watch?v=w1Smzzw_w7Q

# 2. Ekstraksi Menggunakan Video ID Mentah:
node y2mate.js w1Smzzw_w7Q

# 3. Ekstraksi Format MP4:
node y2mate.js https://music.youtube.com/watch?v=w1Smzzw_w7Q mp4

# 4. Download Langsung File ke Folder Lokal:
node y2mate.js https://music.youtube.com/watch?v=w1Smzzw_w7Q --download ./downloads

# 5. Output Pure JSON & Simpan ke File:
node y2mate.js https://music.youtube.com/watch?v=w1Smzzw_w7Q --save hasil.json
```

### Penggunaan sebagai Module di Proyek JavaScript / Express / Backend:

```javascript
const { extractMedia, downloadMedia, normalizeYouTubeUrl } = require('./y2mate.js');

async function main() {
  const url = 'https://music.youtube.com/watch?v=w1Smzzw_w7Q';

  // 1. Ekstraksi metadata dan direct download link
  const res = await extractMedia(url, 'mp3');
  console.log('Hasil Ekstraksi:', res);

  // 2. Download file jika sukses
  if (res.status && res.data.url) {
    const filename = `${res.data.title}.${res.data.format}`;
    await downloadMedia(res.data.url, filename, './downloads');
  }
}

main();
```
