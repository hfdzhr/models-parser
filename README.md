# Config Models Parser (Pi, OpenCode & Custom LLM Providers)

Alat untuk melakukan fetching daftar model dari API provider (OpenAI-compatible endpoints seperti vLLM, Ollama, OpenRouter, Sabah-AI, dll.) dan secara otomatis mem-parsing serta memformatnya menjadi konfigurasi yang siap pakai untuk **Pi Coding Agent** (`~/.pi/agent/models.json`) dan **OpenCode** (`~/.config/opencode/opencode.json`).

---

## Fitur Utama

1. **Auto Fetching & Discovery**:
   - Cukup masukkan nama provider, base URL, API key, dan jenis API.
   - Endpoint `/models` langsung di-fetch dengan autentikasi Bearer token.
   - Tersedia juga mode **Paste Raw JSON** atau **Load from File** (jika offline atau di balik proxy khusus).

2. **Smart Model Name & Attribute Formatter**:
   - Mengubah ID mentah seperti `gs/ag/gemini-3.8-flash-high` menjadi `Ag/Gemini 3.8 Flash High`.
   - Mengubah `9dak/cc/claude-haiku-4-5-20251001` menjadi `Cc/Claude Haiku 4.5`.
   - Mendeteksi modalitas input (`text`, `image`) dari `capabilities.vision` atau `input_modalities`.
   - Mendeteksi `contextWindow` dari `context_length`, `max_context_length`, atau `limit.context`.
   - Mendeteksi flag `reasoning` dari model capabilities.

3. **Dukungan Format Pi & OpenCode**:
   - **Pi Format** (`models.json`):
     ```json
     {
       "providers": {
         "sabah-ai": {
           "baseUrl": "https://vibing.softyan.net/v1",
           "api": "openai-completions",
           "apiKey": "sk-...",
           "models": [
             {
               "id": "gs/ag/gemini-3-flash",
               "name": "Ag/Gemini 3 Flash",
               "api": "openai-completions",
               "input": ["text", "image"],
               "contextWindow": 1048576,
               "reasoning": true
             }
           ]
         }
       }
     }
     ```
   - **OpenCode Format** (`opencode.json`):
     ```json
     {
       "provider": {
         "sabah-ai": {
           "name": "Sabah AI",
           "options": {
             "baseURL": "https://vibing.softyan.net/v1",
             "apiKey": "sk-..."
           },
           "models": {
             "gs/ag/gemini-3-flash": {
               "name": "Ag/Gemini 3 Flash",
               "limit": { "context": 1048576, "output": 65536 },
               "modalities": { "input": ["text", "image"], "output": ["text"] },
               "reasoning": true,
               "tool_call": true
             }
           }
         }
       }
     }
     ```

4. **Safe Auto-Merge & Backup**:
   - Jika disimpan langsung ke file konfigurasi sistem, tool ini akan menggabungkan (*merge*) provider baru tanpa menimpa (*overwrite*) provider lain yang sudah ada.
   - Otomatis membuat salinan backup `.bak` sebelum perubahan ditulis.

5. **2 Antarmuka: Interactive CLI & Modern Web Dashboard**:
   - Terminal wizard yang interaktif dengan keyboard navigation.
   - Web UI modern dengan fitur pencarian, checklist model, live preview JSON, copy ke clipboard, dan one-click save.

---

## Cara Menjalankan

### 1. Mode Web Dashboard (Paling Mudah & Visual)

Jalankan perintah berikut:
```bash
pnpm web
```
Lalu buka browser di: **[http://localhost:3000](http://localhost:3000)**

Fitur di Web UI:
- Isi Provider ID, Base URL, API Key.
- Klik **"Fetch Models"** atau klik **"Load Example"** untuk mencoba data demo Sabah-AI.
- Filter model dengan search box, pilih atau batalkan pilihan model.
- Preview tab Pi / OpenCode / Combined.
- Tombol **"Save to Pi config"** atau **"Save to OpenCode config"** untuk langsung memperbarui file konfigurasi!

---

### 2. Mode Interactive CLI

Jalankan:
```bash
pnpm start
# atau
pnpm cli
```

Wizard terminal akan memandu Anda langkah demi langkah:
1. Input nama/ID provider (contoh: `sabah-ai`)
2. Pilih jenis API (`openai-completions`, dll.)
3. Input Base URL (contoh: `https://vibing.softyan.net/v1`)
4. Input API Key
5. Pilih sumber: Fetch langsung dari endpoint, load file, atau paste JSON
6. Pilih model (Semua, checklist interaktif, atau filter keyword)
7. Pilih format target (Pi, OpenCode, atau keduanya)
8. Pilih aksi: Simpan langsung ke `~/.pi/agent/models.json` / `~/.config/opencode/opencode.json`, export file, atau cetak ke terminal.

---

### 3. Mode Command Line Arguments (Untuk Scripting / Automation)

Anda juga bisa menjalankan tool secara non-interaktif dengan flag:

```bash
# Fetch dari URL dan cetak Pi config
node bin/cli.js \
  --provider sabah-ai \
  --url https://vibing.softyan.net/v1 \
  --key sk-6b8d16c81d863312-d37acc-47f9ce40 \
  --api openai-completions \
  --target pi

# Filter hanya model gemini-3.8 dan simpan langsung ke config Pi
node bin/cli.js \
  --provider sabah-ai \
  --url https://vibing.softyan.net/v1 \
  --key sk-6b8d16c81d863312-d37acc-47f9ce40 \
  --filter "gemini-3.8" \
  --target pi \
  --save

# Menggunakan file JSON lokal yang sudah disimpan
node bin/cli.js \
  --file sample-response.json \
  --provider sabah-ai \
  --url https://vibing.softyan.net/v1 \
  --key sk-6b8d16c81d863312-d37acc-47f9ce40 \
  --target opencode \
  --out opencode-sabah.json
```

---

## Menjalankan Pengujian (Unit Tests)

Proyek ini telah dilengkapi dengan unit test lengkap (100% lulus):
```bash
pnpm test
```
Menguji:
- Formatting model name & provider name
- Ekstraksi respon dari berbagai bentuk endpoint `/models`
- Transformasi struktur Pi `models.json` & OpenCode `opencode.json`
- Penggabungan (*merging*) aman tanpa merusak provider lain
- Penulisan ke file dengan backup otomatis
