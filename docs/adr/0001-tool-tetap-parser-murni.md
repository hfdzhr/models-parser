# Tool tetap parser/generator murni — tidak ada manajemen file config target

Status: accepted (2026-10-19)

Tool ini mengambil daftar model dari endpoint `/models`, mem-parse, dan menulisnya ke file config Pi/OpenCode via merge per-model + backup. Survei fitur (`.scratch/feature-ideas.md`) mengusulkan beberapa pemicu kemudahan — dan dua di antaranya (`remove <providerId>`, `restore backup`) berarti mengubah/mengelola file config target di luar perilaku merge yang terdokumentasi. Pengguna menyatakan frustrasi "merapikan config" tetapi menegaskan scope tetap **murni parser**.

## Keputusan

Batas scope (sesi grilling 19 Okt 2026): tool boleh **membaca** file target untuk verifikasi (diff preview sebelum save, ringkasan provider dengan API key tersamar) dan boleh **menulis file miliknya sendiri** (`~/.config/config-models-parser/profiles.json`, snapshot hasil fetch, `.bak` bergantian saat save). Tool **tidak** punya perintah yang mengubah file target di luar merge per-model yang sudah terdokumentasi: tidak ada `remove provider`, tidak ada `restore`.

## Considered Options

- **Parser strict** (bahkan diff ke file target dibuang) — ditolak: menghambat kepastian sebelum save tanpa alasan kuat, karena verifikasi read-only tetap "parser".
- **Boleh remove/restore ringan** — ditolak (untuk sekarang): "merapikan" tetap dilakukan manual; konsekuensi diterima dan tercatat di bawah.

## Consequences

- Pengulangan input diselesaikan lewat *provider profile*; kepercayaan sebelum save lewat *diff/preview* + *rolling backup* yang nyata saat save.
- Merapikan provider usang tetap manual — pembaca baru tidak boleh "menambahkan remove command"; naikkan dulu ADR baru bahwa batas ini berubah.
- Pemicu peninjauan ulang: jika salah merge terasa sering atau kebutuhan agregasi config naik.
