# Roadmap — Rumah Makan Sipil

Setiap milestone menghasilkan sesuatu yang **bisa dicoba**, dideploy ke Vercel Preview, lalu dicek di HP sungguhan.

Dokumen terkait: [PRD](PRD.md) · [Arsitektur](architecture.md)

---

## v1 (MVP)

### M0 — Fondasi
- [x] Init Next.js + TypeScript + Tailwind + shadcn/ui, token warna & font dari [Design System](design-system.md)
- [x] Migrasi skema, RLS, `seed.sql` dari [Data Menu Awal](menu-seed.md) (diuji pgTAP di CI)
- [x] Buat project Supabase hosted (`bvpeysmhfsqliapebivp`), lalu jalankan migrasi + seed di sana
- [x] Hubungkan repo GitHub ke Vercel (project `rumah-makan-sipil`, production = `main`, branch lain = Preview)
- [x] Isi env var rahasia (`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `IP_HASH_SALT`, `NEXT_PUBLIC_SITE_URL`) di `.env.local` dan Vercel
- [x] Setup Vitest, Playwright, dan pgTAP + job CI `App Quality Gate & Build` dan `Database pgTAP & RLS Tests`

**Selesai jika**: halaman kosong bermerek tampil di URL Vercel dan `supabase test db` berjalan.

### M1 — Menu pelanggan + keranjang (P1–P4, P9, P10)
- [x] Halaman menu: header, tab kategori sticky, kartu menu (dengan/tanpa foto), badge Habis, banner Tutup
- [x] Bottom sheet pilihan + catatan + jumlah
- [x] Keranjang di `localStorage` + bar keranjang sticky + halaman keranjang
- [x] Kartu Paket Dos → WhatsApp

**Selesai jika**: pelanggan bisa memilih Cotto Ayam (Mie) dan Mie Goreng + Telur, lalu total keranjang benar.

### M2 — Checkout, pembayaran, lacak (P5–P8)
- [x] Fungsi SQL `create_order` (validasi, harga server, nomor harian, rate limit, idempotensi) + tes pgTAP
- [x] `POST /api/orders`, `GET /api/orders/[token]`, `POST …/claim-paid`
- [x] Halaman checkout, layar QRIS (total besar), instruksi cash
- [x] Halaman lacak dengan polling 5 detik, getar saat Siap, banner "Pesanan aktif"

**Selesai jika**: pesanan tersimpan dengan nomor #001, dan pesanan kedua mendapat #002.

### M3 — Dashboard pesanan live (D1–D5)
- [x] Login pemilik, layout `/admin`, navigasi bottom-tab/sidebar
- [x] Daftar/kanban pesanan + Realtime + bunyi + Wake Lock
- [x] Tombol status (Mulai masak → Siap → Selesai), Lunas, Batal, "Pembayaran belum masuk"
- [x] Toggle Buka/Tutup toko

**Selesai jika**: alur E2E lengkap (pesan di HP A → bunyi di HP B → Lunas → Siap → HP A menampilkan "Siap") lulus di Playwright dan di HP sungguhan.

### M4 — Kelola menu & pengaturan (D6, D11)
- [x] CRUD kategori & menu, urutan, toggle Habis
- [x] Upload foto (crop 4:3 + kompres di browser)
- [x] Editor grup pilihan & opsi
- [x] Pengaturan: QRIS, WhatsApp, nama/tagline, harga Dos, ganti password

**Selesai jika**: pemilik bisa menambah jenis kopi baru dan langsung muncul di HP pelanggan.

### M5 — Riwayat, laporan, keuangan (D7–D9)
- [x] Riwayat dengan filter tanggal + detail
- [x] Fungsi SQL laporan + halaman Laporan (hari ini / bulan ini, terlaris, Cash vs QRIS)
- [x] Catatan keuangan: CRUD pengeluaran, buku kas per tanggal, ringkasan bulan (laba kotor)

**Selesai jika**: angka laporan cocok dengan hitungan manual dari data uji.

### M6 — Poster QR, polish, rilis (D10)
- [ ] Halaman Poster QR: cetak (A4/A5) + unduh PNG
- [ ] Empty state, skeleton, toast, cek aksesibilitas & kontras, uji di HP Android murah + iPhone
- [ ] Deploy produksi, buat akun pemilik, upload QRIS asli, cetak poster
- [ ] Uji coba 1 hari di warung, lalu catat masukan

## Fase berikutnya (urut perkiraan prioritas)

1. Payment gateway (QRIS dinamis, Lunas otomatis)
2. Print struk printer thermal (Bluetooth)
3. Ekspor laporan & keuangan ke Excel
4. Jam buka otomatis per hari
5. Promo/diskon
6. Pre-order Paket Dos di aplikasi
7. Ulasan/rating
8. Domain sendiri (cetak ulang poster QR)
9. Akun staf & peran
10. Delivery
