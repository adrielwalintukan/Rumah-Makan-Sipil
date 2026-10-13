# Roadmap — Rumah Makan Sipil

Setiap milestone menghasilkan sesuatu yang **bisa dicoba**, dideploy ke Vercel Preview, lalu dicek di HP sungguhan.

Dokumen terkait: [PRD](PRD.md) · [Arsitektur](architecture.md)

---

## v1 (MVP)

### M0 — Fondasi
- [ ] Init Next.js + TypeScript + Tailwind + shadcn/ui, token warna & font dari [Design System](design-system.md)
- [ ] Proyek Supabase: migrasi skema, RLS, `seed.sql` dari [Data Menu Awal](menu-seed.md)
- [ ] Hubungkan repo GitHub ke Vercel, isi environment variables
- [ ] Setup Vitest, Playwright, dan pgTAP

**Selesai jika**: halaman kosong bermerek tampil di URL Vercel dan `supabase test db` berjalan.

### M1 — Menu pelanggan + keranjang (P1–P4, P9, P10)
- [ ] Halaman menu: header, tab kategori sticky, kartu menu (dengan/tanpa foto), badge Habis, banner Tutup
- [ ] Bottom sheet pilihan + catatan + jumlah
- [ ] Keranjang di `localStorage` + bar keranjang sticky + halaman keranjang
- [ ] Kartu Paket Dos → WhatsApp

**Selesai jika**: pelanggan bisa memilih Cotto Ayam (Mie) dan Mie Goreng + Telur, lalu total keranjang benar.

### M2 — Checkout, pembayaran, lacak (P5–P8)
- [ ] Fungsi SQL `create_order` (validasi, harga server, nomor harian, rate limit, idempotensi) + tes pgTAP
- [ ] `POST /api/orders`, `GET /api/orders/[token]`, `POST …/claim-paid`
- [ ] Halaman checkout, layar QRIS (total besar), instruksi cash
- [ ] Halaman lacak dengan polling 5 detik, getar saat Siap, banner "Pesanan aktif"

**Selesai jika**: pesanan tersimpan dengan nomor #001, dan pesanan kedua mendapat #002.

### M3 — Dashboard pesanan live (D1–D5)
- [ ] Login pemilik, layout `/admin`, navigasi bottom-tab/sidebar
- [ ] Daftar/kanban pesanan + Realtime + bunyi + Wake Lock
- [ ] Tombol status (Mulai masak → Siap → Selesai), Lunas, Batal, "Pembayaran belum masuk"
- [ ] Toggle Buka/Tutup toko

**Selesai jika**: alur E2E lengkap (pesan di HP A → bunyi di HP B → Lunas → Siap → HP A menampilkan "Siap") lulus di Playwright dan di HP sungguhan.

### M4 — Kelola menu & pengaturan (D6, D11)
- [ ] CRUD kategori & menu, urutan, toggle Habis
- [ ] Upload foto (crop 4:3 + kompres di browser)
- [ ] Editor grup pilihan & opsi
- [ ] Pengaturan: QRIS, WhatsApp, nama/tagline, harga Dos, ganti password

**Selesai jika**: pemilik bisa menambah jenis kopi baru dan langsung muncul di HP pelanggan.

### M5 — Riwayat, laporan, keuangan (D7–D9)
- [ ] Riwayat dengan filter tanggal + detail
- [ ] Fungsi SQL laporan + halaman Laporan (hari ini / bulan ini, terlaris, Cash vs QRIS)
- [ ] Catatan keuangan: CRUD pengeluaran, buku kas per tanggal, ringkasan bulan (laba kotor)

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
