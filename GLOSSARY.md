# GLOSSARY

## provider
Blok di `models.json` di bawah `providers.<providerId>`: berisi `baseUrl`, `api`, `apiKey`, `models[]`. Contoh: `sabah-ai`.

## endpoint / baseUrl
URL dasar OpenAI-compatible, contoh `https://vibing.softyan.net/v1`. Fetch dilakukan ke `GET {baseUrl}/models` dengan `Authorization: Bearer <token>`.

## token / apiKey
Kredensial Bearer untuk endpoint. Disimpan plain sebagai `apiKey` di `models.json` (keputusan ronde 3: tetap plain, bukan `$VAR`).

## slash command
Perintah `/` di Pi yang diregister via `pi.registerCommand()`. Extension ini menyediakan `/add-model` (tambah provider) + `/reload-models` (buatan baru, bukan perintah bawaan Pi).

## reload-models
Command baru yang dibuat extension ini. Latar: perintah bawaan `reload-models` **tidak ada** di docs Pi; refresh `models.json` yang terbukti hanya **buka `/model`**. Maka extension membuat `/reload-models` sendiri sebagai pemicu/instruksi refresh setelah simpan.

## merge per-model
Aturan tulis `models.json`: entri `models` tambah/ganti per ID model yang sama pada provider itu (mengikuti perilaku bawaan Pi), bukan timpa seluruh blok provider. Dilengkapi rolling backup `.bak-<timestamp>` + redact log.

## batalkan-jika-ada
Jika `providerId` sudah ada di `models.json`, command batal + tampilkan pesan, tanpa menimpa. Tanpa flag `--force`.

## provider profile
Data provider yang disimpan tool sendiri — di luar file config Pi/OpenCode — untuk dipakai ulang tanpa mengetik ulang baseUrl/apiKey. Tersimpan di `~/.config/config-models-parser/profiles.json` urut nama. Di-seed otomatis dari config Pi/OpenCode (hanya menambah, existing menang), dipilih per nama case-sensitive lewat `--use <nama>` di CLI atau dropdown **profile** di Web UI, dan di-upsert bernama sesuai `providerId` setiap save yang berhasil.
_Avoid_: config, saved provider, file target.

## rolling backup
Salinan cadangan yang dijaga beberapa yang terakhir (bukan satu `.bak` yang ditimpa), dibuat tool setiap menulis file config. Nama file: `<file>.bak-<timestamp>` (tabrakan timestamp diakhiri suffix `-1`, `-2` bergantian); sibling backup lebih tua dipangkas sampai tersisa 5 backup terbaru. Legacy `<file>.bak` tidak pernah dicocokkan, disentuh, atau dihitung.
_Avoid_: backup tunggal.
