# GIZICAM — AI Food Scanner, Voice Assistant & Personal Nutrition Platform

**GIZICAM** adalah aplikasi web modern berbasis HTML5, CSS3, JavaScript Vanilla, dan **Netlify Functions (`.mjs`)** yang membantu pengguna mengenali makanan melalui kamera atau galeri, mendengarkan hasil analisis gizi secara langsung melalui asisten suara (Text-to-Speech & Speech-to-Text), berkonsultasi dengan **Dr. GiziAI**, serta memantau program kesehatan harian.

---

## Fitur Utama

1. **Dual Input AI Food Scanner (Kamera Langsung & Galeri)**:
   - Mendukung upload gambar JPEG, PNG, dan WebP (maksimal 5 MB) serta pengambilan foto langsung menggunakan kamera belakang/depan smartphone (`getUserMedia` + Canvas).
   - **Kamera Bisa Berbicara (Voice AI)**: Hasil analisis otomatis dibacakan dalam Bahasa Indonesia dengan visual gelombang suara, dilengkapi fitur **Tanya Kamera via Suara (Mikrofon)**.
2. **Bebas Memilih Penyedia API Key AI (Multi-Provider)**:
   - Tidak terkunci pada satu penyedia atau Gemini saja. Mendukung **OpenRouter (Gratis tanpa kartu kredit)**, **Groq Cloud**, **Mistral AI**, **OpenAI**, **Together AI**, dan endpoint OpenAI-compatible kustom.
3. **Chat Konsultasi Gizi & Kesehatan AI**:
   - Terhubung langsung dengan API Key AI serta konteks biodata dan hasil scan makanan terakhir pengguna.
4. **Program Kesehatan & Kebugaran Terpadu**:
   - **Tracker Hidrasi Harian** (target otomatis `30 ml × Berat Badan`).
   - **Kalkulator BMI, BMR, TDEE & Kebutuhan Makro Harian**.
   - **Tantangan Kebiasaan Sehat 7 Hari**.
   - **Panduan Visual Porsi "Isi Piringku"**.
5. **Desain Responsif Mobile & Desktop**:
   - Sidebar elegan untuk desktop serta **Mobile Bottom Navigation Bar** yang nyaman dioperasikan satu tangan di smartphone.

---

## Struktur Folder

```text
GIZICAM/
├── index.html              # Halaman utama / landing page
├── biodata.html            # Pengisian biodata kesehatan wajib
├── register.html           # Pendaftaran akun demonstrasi (hash SHA-256)
├── login.html              # Login akun demonstrasi
├── dashboard.html          # Ringkasan kesehatan, nutrisi terakhir, hidrasi & riwayat
├── scanner.html          # AI Food Scanner (Galeri + Kamera + Suara AI)
├── chat.html               # Chat Konsultasi Gizi dengan Dr. GiziAI
├── programs.html           # Program Kesehatan (Hidrasi, Kalkulator BMI/TDEE, Tantangan 7 Hari)
├── history.html            # Riwayat pemindaian makanan
├── recommendations.html    # Rekomendasi menu personal & filter alergi
├── profile.html            # Edit biodata, pengaturan suara & konfigurasi API Key AI
├── assets/
│   ├── css/
│   │   ├── style.css
│   │   ├── auth.css
│   │   └── dashboard.css
│   ├── js/
│   │   ├── app.js
│   │   ├── auth.js
│   │   ├── dashboard.js
│   │   ├── scanner.js
│   │   ├── chat.js
│   │   ├── programs.js
│   │   ├── history.js
│   │   └── profile.js
│   └── images/
│       └── logo.svg
├── netlify/
│   └── functions/
│       ├── scan.mjs        # Backend Vision AI Multi-Provider
│       └── chat.mjs        # Backend Konsultasi Chat AI & Uji Koneksi
├── netlify.toml
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

---

## 1. Cara Mendapatkan API Key AI (Gratis & Mudah)

GIZICAM menggunakan standar OpenAI-compatible sehingga Anda bisa memilih penyedia mana pun:

### Opsi A: OpenRouter (Gratis Tanpa Kartu Kredit — Sangat Direkomendasikan)
1. Buka [https://openrouter.ai](https://openrouter.ai) dan daftar menggunakan akun Google/Email.
2. Masuk ke menu **Keys** → klik **Create Key**, lalu salin API Key (berawalan `sk-or-v1-...`).
3. Gunakan model default `openrouter/free` yang otomatis memilih model Vision & Chat gratis yang aktif.

### Opsi B: Groq Cloud (Respon Super Cepat)
1. Buka [https://console.groq.com](https://console.groq.com) dan buat akun gratis.
2. Masuk ke menu **API Keys** → klik **Create API Key**, lalu salin key (berawalan `gsk_...`).
3. Backend otomatis memakai model vision `qwen/qwen3.8-27b` dan model chat `openai/gpt-oss-20b`.

### Opsi C: Mistral AI / OpenAI / Together AI
- Anda juga dapat memakai API Key dari **Mistral AI** (`pixtral-12b-2409`), **OpenAI** (`gpt-4o-mini`), atau **Together AI**.

---

## 2. Cara Menyimpan API Key dengan Aman di Netlify

1. Unggah folder project `GIZICAM` ke repository **GitHub** Anda.
2. Login ke [https://app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an existing project** → pilih repository GitHub Anda.
3. Setelah site terbuat, buka **Site configuration** → **Environment variables** → **Add a variable**:
   - **Key:** `AI_API_KEY` (atau `GROQ_API_KEY`)
   - **Value:** masukkan API Key Anda (contoh: `sk-or-v1-...` atau `gsk_...`)
   - *(Opsional)* Tambahkan `AI_VISION_MODEL` dan `AI_CHAT_MODEL` jika ingin menentukan model tertentu.
4. Klik **Deploys** → **Trigger deploy** → **Deploy site** agar environment variable aktif.

> **Tips Pengujian Cepat:** Pengguna juga dapat menempelkan API Key sementara langsung di halaman **Profil & API Key** (`profile.html`) untuk menguji koneksi tanpa harus redeploy.

---

## 3. Cara Menjalankan Secara Lokal

1. Pastikan **Node.js (v18+)** terpasang di komputer Anda.
2. Salin `.env.example` menjadi `.env` dan isi `AI_API_KEY`:
   ```bash
   cp .env.example .env
   ```
3. Jalankan server pengembangan Netlify lokal:
   ```bash
   npx netlify-cli dev
   ```
4. Buka browser ke `http://localhost:8888`.

---

## 4. Catatan Keamanan & Batasan Penyimpanan Lokal

- **LocalStorage & Autentikasi Demonstrasi:** Data biodata, riwayat scan, progres program kesehatan, dan akun demonstrasi disimpan di `LocalStorage` browser perangkat Anda. Password di-hash menggunakan **SHA-256 (Web Crypto API)** sebelum disimpan, namun autentikasi berbasis `LocalStorage` ditujukan untuk demonstrasi/penggunaan personal pada perangkat yang sama, bukan sistem autentikasi multi-user publik skala besar.
- **Privasi API Key:** API Key server dibaca hanya di dalam `netlify/functions/scan.mjs` dan `netlify/functions/chat.mjs` dan tidak pernah diekspos di kode sumber frontend.
- **Disclaimer Kesehatan:** Seluruh hasil estimasi kalori dan nutrisi dihasilkan oleh AI secara visual dan bersifat edukatif, bukan hasil uji laboratorium maupun diagnosis medis.
