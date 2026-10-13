<!-- Isi SEMUA bagian. Bagian yang tidak relevan: tulis "Tidak ada" + alasannya. Lihat AGENTS.md §13. -->

## Ringkasan

<!-- Apa yang berubah dan mengapa (2–4 kalimat). -->

## Konteks

- Milestone:
- User Story / fitur (US-*, P*, D*):
- ADR:
- Dokumen acuan:

## Perubahan

<!-- Per area, sertakan path file kunci. -->

- **UI:**
- **Server/API:**
- **Database:**
- **CI:**
- **Dokumen:**

## Keputusan & trade-off

<!-- Pilihan yang diambil, alternatif, dan alasannya. -->

## Di luar scope / ditunda

<!-- Apa yang sengaja tidak dikerjakan dan kapan dikerjakan. -->

## Cara uji

<!-- Perintah yang dijalankan + hasilnya (jumlah tes, build), lalu langkah uji manual. -->

## Bukti

<!-- Status CI pada HEAD. Screenshot desktop + mobile (360 px) untuk perubahan UI. -->

## Database & env

- Migrasi baru:
- Sudah dijalankan di hosted:
- Env var baru:
- Langkah setup untuk pengguna:

## Risiko & rollback

<!-- Apa yang bisa rusak dan cara membatalkannya. -->

## Checklist DoD

- [ ] Branch kerja dibuat dari `development` terbaru; HEAD diverifikasi
- [ ] Milestone / User Story / fitur terkait diidentifikasi
- [ ] Dokumen relevan dibaca; aturan domain (AGENTS.md §8) dipatuhi
- [ ] Validasi & hitung harga di server; RLS untuk tabel baru + tes pgTAP
- [ ] lint, typecheck, test, build lulus secara lokal
- [ ] UI dicek 360 px + tablet + desktop + keyboard + reduced-motion (bila ada UI)
- [ ] Tidak ada secret / `.env.local` / artefak QA di diff
- [ ] Seluruh diff dibaca ulang; tidak ada perubahan yang tidak terkait
- [ ] Dokumen terdampak disinkronkan
- [ ] CI hijau pada HEAD PR
- [ ] Langkah manual pengguna (migrasi, env, Vercel) dilaporkan
