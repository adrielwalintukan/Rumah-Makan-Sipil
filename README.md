# Rumah Makan Sipil 🍛

*Makan Enak, Setiap Hari.*

Web pemesanan makanan mobile-first untuk Rumah Makan Sipil. Pelanggan scan QR atau membuka link, memesan dari HP, lalu membayar dengan **QRIS (DANA Bisnis)** atau **cash**. Pesanan langsung masuk ke dashboard penjual secara realtime.

> Status: **M0 (fondasi)**. Kerangka aplikasi, skema database, dan CI sudah ada. Fitur pemesanan mulai dibangun di M1.

## Fitur v1

**Pelanggan**
- Menu per kategori dengan foto, pilihan (mis. Mie Kuah/Goreng + Telur), dan catatan
- Makan di sini / Bungkus, cukup isi nama (tanpa daftar akun)
- Bayar QRIS (tampil QRIS + total) atau cash
- Nomor antrean harian dan lacak status pesanan secara langsung
- Pesan Paket Dos via WhatsApp

**Penjual (dashboard)**
- Pesanan masuk realtime + bunyi notifikasi, status Baru → Dimasak → Siap → Selesai
- Tandai Lunas, toggle Buka/Tutup toko
- Kelola menu, harga, foto, pilihan, dan stok Habis
- Riwayat pesanan, laporan penjualan, catatan keuangan (pemasukan, pengeluaran, laba kotor)
- Poster QR siap cetak

## Tech stack

Next.js (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Supabase (Postgres, Auth, Realtime, Storage) · Vercel

## Dokumentasi

| Dokumen | Isi |
|---|---|
| [PRD](docs/PRD.md) | Tujuan, pengguna, fitur, user stories, aturan bisnis, risiko |
| [Design System](docs/design-system.md) | Warna, tipografi, komponen, layout responsif |
| [User Flows](docs/user-flows.md) | Alur pelanggan & penjual, status pesanan, daftar layar |
| [Arsitektur](docs/architecture.md) | Stack, struktur folder, skema database, keamanan, realtime |
| [Roadmap](docs/roadmap.md) | Milestone pengerjaan v1 & fase berikutnya |
| [Data Menu Awal](docs/menu-seed.md) | Menu & harga dari banner |

## Alur kerja

`main` = production, `development` = tempat kerja. Setiap task dikerjakan di branch baru dari `development`, lalu dibuka PR ke `development` dengan body lengkap dan CI hijau. Panduan lengkap untuk manusia maupun AI agent ada di [AGENTS.md](AGENTS.md).

## Menjalankan secara lokal

Butuh Node.js 22+.

```bash
npm install
```

```bash
cp .env.example .env.local
```

Isi `.env.local` dengan kredensial Supabase (lihat [Arsitektur §9](docs/architecture.md)), lalu:

```bash
npm run dev
```

| Perintah | Fungsi |
|---|---|
| `npm run lint` | ESLint |
| `npm run typecheck` | Cek tipe TypeScript |
| `npm test` | Unit test (Vitest) |
| `npm run build` | Build produksi |
| `npm run test:e2e` | E2E Playwright di viewport HP (butuh `npm run build` dulu dan `npx playwright install chromium`) |

Tes database (pgTAP) butuh Docker: `npx supabase db start` lalu `npx supabase test db`. Tanpa Docker, tes ini tetap berjalan otomatis di CI.

Migrasi ke project Supabase hosted:

```bash
npx supabase link --project-ref <ref-project>
```

```bash
npx supabase db push --include-seed
```

## Kontak

WhatsApp: [+62 895-8065-67230](https://wa.me/62895806567230)
