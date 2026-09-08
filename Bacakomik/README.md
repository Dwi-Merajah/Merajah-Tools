# Scraper BacaKomik

Kumpulan scraper dan client API untuk website [BacaKomik](https://bacakomik.my/).

---

## 🚀 1. Single File JavaScript / Node.js: `bacakomik.js`

File tunggal **[`bacakomik.js`](file:///home/merajah/scrape/bacakomik.js)** tanpa dependensi eksternal (menggunakan native `fetch` bawaan Node.js 18+).

### Fitur Utama:
- **Rekomendasi**: Menampilkan komik terpopuler / rekomendasi hari ini.
- **Pencarian**: Mencari komik berdasarkan judul.
- **Daftar Chapter**: Mengambil semua chapter komik.
- **Cari Per Chapter & Ambil Gambar**: Mengembalikan output dengan format:
  ```json
  {
    "status": "success",
    "chapter_title": "Komik The Retired Killer Wants a Quiet Life Chapter 18",
    "chapter_url": "https://bacakomik.my/the-retired-killer-wants-a-quiet-life-chapter-18/",
    "total_images": 19,
    "data": [
      "https://imageainewgeneration.lol/data/.../01.jpeg",
      "https://himmga.lat/data/.../02.jpeg",
      "https://gaimgame.pics/data/.../03.jpeg"
    ]
  }
  ```

### Cara Menjalankan via CLI:

```bash
# 1. Rekomendasi Komik
node bacakomik.js rekomendasi 10

# 2. Cari Komik
node bacakomik.js cari "solo leveling"

# 3. Ambil Daftar Semua Chapter Komik
node bacakomik.js chapters "solo leveling"

# 4. Ambil Direct Link Semua Gambar 1 Chapter Berurutan
# Lewat Judul Komik + Nomor Chapter:
node bacakomik.js chapter "the retired killer" 18

# Lewat URL Chapter Langsung:
node bacakomik.js chapter https://bacakomik.my/the-retired-killer-wants-a-quiet-life-chapter-18/

# 5. Output Pure JSON:
node bacakomik.js chapter "the retired killer" 18 --json

# 6. Download Otomatis Semua Gambar ke Folder Lokal:
node bacakomik.js chapter "the retired killer" 18 --download
```

### Penggunaan sebagai Module di Proyek JavaScript / Express / Backend:

```javascript
const { getRekomendasi, searchComic, getAllChapters, getChapterImages } = require('./bacakomik.js');

async function main() {
  // 1. Ambil Rekomendasi
  const rekomendasi = await getRekomendasi(5);
  console.log('Rekomendasi:', rekomendasi);

  // 2. Cari Per Chapter & Ambil Direct Links Gambar
  const chapterData = await getChapterImages('the retired killer', 18);
  
  // Format return:
  // chapterData.data -> Array direct URL gambar full 1 chapter berurutan
  console.log('Total gambar:', chapterData.total_images);
  console.log('Semua URL download:', chapterData.data);
}

main();
```

---
