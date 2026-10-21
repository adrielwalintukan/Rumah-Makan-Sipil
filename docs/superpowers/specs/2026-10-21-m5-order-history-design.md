# Desain Teknis: Riwayat Pesanan dengan Filter Tanggal & Detail (Issue #20)

**Tanggal:** 21 Oktober 2026  
**Milestone:** M5 — Riwayat, Laporan, Keuangan  
**Issue Terkait:** #20 (Riwayat pesanan dengan filter tanggal + detail)  
**Dokumen Acuan:** `docs/PRD.md §5 (US-14)` · `docs/user-flows.md §5` · `docs/architecture.md §4` · `docs/design-system.md`  

---

## 1. Tujuan & Lingkup

Memberikan antarmuka dan kemampuan bagi pemilik warung untuk menginspeksi seluruh arsip riwayat pesanan pelanggan secara fleksibel, cepat, dan akurat berdasarkan tanggal di zona waktu WITA (`Asia/Makassar`).

### Lingkup Fitur (In-Scope)
1. **Filter Tanggal & Preset Cepat**:
   - Preset: **Hari Ini** (default), **Kemarin**, **7 Hari Terakhir**, **30 Hari Terakhir**, dan **Kustom Rentang Tanggal** (tanggal mulai & tanggal selesai dalam format `YYYY-MM-DD`).
   - Perhitungan tanggal selalu menggunakan waktu resmi toko: **WITA (Asia/Makassar)**.
2. **Filter Status**:
   - Pilihan: **Semua** (default), **Selesai**, dan **Batal**.
3. **Pencarian Cepat (Search Box)**:
   - Pencarian teks terhadap `customer_name` (nama pemesan, case-insensitive) dan nomor antrean harian (`daily_number`, misal "1", "001", "#001").
4. **Ringkasan Metrik Terpilih**:
   - Kartu ringkas di bagian atas daftar yang menampilkan:
     - **Total Pesanan**: jumlah pesanan yang cocok dengan filter.
     - **Total Omzet Lunas**: akumulasi nominal `total` untuk pesanan yang berstatus `lunas` dan tidak `batal`.
5. **Daftar Pesanan & Paginasi**:
   - Kartu pesanan terurut dari yang paling baru (`created_at desc`).
   - Setiap kartu menampilkan: nomor antrean harian (`#001`), waktu pesan (WITA), jenis pesanan (`Dine In` / `Bungkus`), nama pelanggan, total Rupiah, badge status masak, dan badge status bayar.
   - Paginasi 50 pesanan per halaman dengan tombol **Sebelumnya** dan **Selanjutnya** yang berbasis URL query parameter (`?page=1`).
6. **Detail Pesanan Lengkap (Sheet/Dialog)**:
   - Dibuka saat kartu pesanan diketuk/diklik:
     - **Bottom Sheet** pada layar mobile (< 768px).
     - **Dialog Modal** pada layar tablet/desktop (>= 768px).
   - Menampilkan detail lengkap: identitas pesanan, nomor telepon pelanggan (jika diisi), daftar item pesanan beserta opsi pilihan dan catatan kustom, rincian harga/subtotal, total akhir, metode pembayaran (QRIS/Cash), status masak, status bayar, dan alasan pembatalan (jika batal).
   - **Aksi Koreksi**: Tombol **"Tandai Lunas"** jika pesanan selesai namun status bayarnya masih `belum_bayar` atau `menunggu_verifikasi`, memanggil endpoint yang sudah ada `PATCH /api/admin/orders/[id]`.

### Di Luar Lingkup (Out-of-Scope)
- Ekspor data ke Excel/CSV (fase berikutnya).
- Laporan agregasi omzet bulanan, analisis 5 menu terlaris, dan rasio Cash vs QRIS komprehensif (dikerjakan pada Issue #21: Laporan).
- Catatan pengeluaran buku kas dan laba kotor (dikerjakan pada Issue #22: Catatan Keuangan).

---

## 2. Karakter Desain & Panduan Antislop

- **Antislop Mode**: Mode 1 (DURING) — aturan antislop diterapkan secara aktif dari awal desain hingga rilis.
- **Design Dials**:
  - **ENERGY: 1 (Calm)**: Antarmuka utilitas fungsional yang bersih, kontras tinggi, dan nyaman untuk mata koki/kasir warung.
  - **RHYTHM: 2 (Structured)**: Struktur vertikal teratur (Filter Bar -> Kartu Ringkasan Metrik -> Daftar Kartu Pesanan -> Paginasi).
  - **MOTION: 1 (Minimal)**: Animasi hanya untuk transisi buka/tutup Drawer dan Dialog (200-300ms), tanpa efek loop, glow, atau floating.
- **Batasan Kualitas**:
  - Semua target sentuh interaktif >= 44px (`min-h-[44px] min-w-[44px]`).
  - Lolos uji kontras WCAG AA (teks gelap `text-ink-900`, `text-ink-700`, `text-ink-600` di atas latar terang `bg-card`, `bg-cream-50`).
  - Tidak menggunakan karakter em dash (`—`) di teks UI atau pesan error (menggunakan strip biasa `-`, koma, atau titik dua `:`).
  - Tampilan mobile-first yang kokoh pada viewport 360px tanpa horizontal scroll.

---

## 3. Arsitektur Data & Alur Server

```text
[Browser / Klien]
   │
   ├── Navigasi Filter URL (?preset=today&status=all&page=1)
   │     │
   │     ▼
[Server Component: /admin/riwayat/page.tsx]
   │  ├── Validasi otentikasi via getAdminUser()
   │  ├── Parsing searchParams via orderHistoryQuerySchema
   │  └── Panggil getOrderHistory(supabase, query)
   │        │
   │        ├── Hitung rentang tanggal WITA (Asia/Makassar)
   │        ├── SELECT orders WHERE order_date BETWEEN ...
   │        ├── Filter status & customer_name / daily_number
   │        └── Kembalikan { orders, totalCount, summary, page, totalPages }
   │
   └── Aksi "Tandai Lunas" (jika pesanan belum lunas)
         │
         ▼
     PATCH /api/admin/orders/[id] { action: "tandai_lunas" }
         │
         ▼
     router.refresh() (Data riwayat & omzet langsung ter-update)
```

---

## 4. Rincian Modul & Implementasi

### 4.1. Helper & Skema Validasi (`lib/admin-orders.ts`)
1. **Utilitas Tanggal WITA**:
   - `getWitaTodayDateString()`: Mengembalikan tanggal hari ini `YYYY-MM-DD` dalam zona waktu `Asia/Makassar`.
   - `getWitaDateRange(preset)`: Mengembalikan `{ from: string, to: string }` untuk preset `today`, `yesterday`, `last7days`, `last30days`.
2. **Skema Zod `orderHistoryQuerySchema`**:
   - `preset`: enum `["today", "yesterday", "last7days", "last30days", "custom"]` (default: `"today"`).
   - `from`: string regex `^\d{4}-\d{2}-\d{2}$` opsional.
   - `to`: string regex `^\d{4}-\d{2}-\d{2}$` opsional.
   - `status`: enum `["all", "selesai", "batal"]` (default: `"all"`).
   - `search`: string opsional (maks 50 karakter).
   - `page`: integer >= 1 (default: 1).
   - `limit`: integer (default: 50, maks: 100).
3. **Fungsi Query `getOrderHistory(supabase, query)`**:
   - Mengambil data pesanan dari tabel `orders` yang di-join dengan `order_items`.
   - Menghitung metrik ringkasan (Total Pesanan & Total Omzet Lunas) untuk seluruh dataset yang cocok dengan filter tanggal/status (bukan hanya yang ada di halaman saat ini).
   - Mengaplikasikan pagination `.range((page - 1) * limit, page * limit - 1)`.

### 4.2. Endpoint API (`app/api/admin/orders/history/route.ts`)
- Menerima request `GET /api/admin/orders/history?preset=...&status=...&page=...`.
- Memverifikasi sesi pemilik dengan `getAdminUser()`. Jika tidak valid, mengembalikan 401 Unauthorized.
- Memvalidasi query params dengan `orderHistoryQuerySchema`. Jika tidak valid, mengembalikan 400 Bad Request.
- Memanggil `getOrderHistory(supabase, params)` dan mengembalikan JSON 200 dengan data pesanan dan metadata ringkasan.

### 4.3. Komponen Antarmuka (`components/admin/history/`)
1. `history-filter-bar.tsx`:
   - Tombol-tombol preset cepat: "Hari Ini", "Kemarin", "7 Hari", "30 Hari", "Kustom".
   - Input datepicker / tanggal mulai dan selesai saat tab "Kustom" aktif.
   - Filter dropdown status: "Semua Status", "Selesai", "Batal".
   - Input pencarian cepat dengan icon kaca pembesar dan debounce untuk nama pelanggan / nomor pesanan.
   - Tombol "Reset" jika filter sedang aktif di luar default.
2. `history-summary-cards.tsx`:
   - 2 kartu ringkas di bagian atas:
     - Kartu 1: **Total Pesanan** (jumlah pesanan).
     - Kartu 2: **Total Omzet Lunas** (nominal Rupiah pesanan berstatus lunas).
3. `history-order-list.tsx`:
   - Menampilkan daftar kartu pesanan dalam tata letak responsif.
   - Empty state jika tidak ada pesanan dengan tombol cepat untuk kembali ke "Hari Ini".
4. `order-detail-sheet.tsx`:
   - Komponen Drawer / Modal detail pesanan responsif.
   - Menampilkan rincian pesanan lengkap, opsi item, catatan, status bayar & status masak.
   - Tombol "Tandai Lunas" dengan status loading dan penanganan error.
5. `history-pagination.tsx`:
   - Tombol navigasi Sebelumnya dan Selanjutnya dengan indikator teks "Halaman X dari Y".

---

## 5. Rencana Pengujian

1. **Unit Tests (`lib/admin-orders.test.ts`)**:
   - Pengujian parsing skema `orderHistoryQuerySchema`.
   - Pengujian pembentukan tanggal WITA untuk preset `today`, `yesterday`, `last7days`, `last30days`.
   - Pengujian logika kalkulasi ringkasan omzet dan filter status.
2. **API Tests (`app/api/admin/orders/history/history-api.test.ts`)**:
   - Penolakan akses tanpa sesi admin (401).
   - Pengujian filter query params valid dan invalid (400 vs 200).
   - Pengujian struktur response JSON yang tepat.
3. **End-to-End Tests (`e2e/admin-history.spec.ts`)**:
   - Login admin -> navigasi ke `/admin/riwayat`.
   - Verifikasi kartu pesanan hari ini tampil.
   - Pengujian interaksi preset filter tanggal dan pencarian teks.
   - Pengujian klik kartu untuk membuka detail Sheet/Dialog dan verifikasi kelengkapan datanya.
   - Pengujian aksi "Tandai Lunas" pada pesanan selesai yang belum lunas.

---

## 6. Checklist Kepatuhan & Non-Functional Requirements

- [x] Sesuai AC PRD US-14 dan Issue #20.
- [x] Format mata uang Rupiah bulat via `formatRupiah`.
- [x] Zona waktu konsisten WITA (`Asia/Makassar`).
- [x] Zero-slop antislop guidelines dipatuhi (dials, no em dashes, no emoji).
- [x] Target sentuh mobile >= 44px dan viewport 360px bebas overflow horizontal.
- [x] Menggunakan subagent mandiri per task saat implementasi.
