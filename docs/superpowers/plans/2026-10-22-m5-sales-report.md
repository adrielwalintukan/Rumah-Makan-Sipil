# Rencana Implementasi: Laporan Penjualan, Menu Terlaris, & Cash vs QRIS (Issue #21)

**Milestone:** M5 - Riwayat, Laporan, Keuangan  
**Issue Terkait:** #21 (Laporan: omzet, jumlah pesanan, menu terlaris, Cash vs QRIS)  
**Dokumen Acuan:** `docs/superpowers/specs/2026-10-22-m5-sales-report-design.md` · `docs/PRD.md §5 (US-14) & §6` · `docs/architecture.md §5.3` · `docs/design-system.md §6.8`  
**Branch Kerja:** `feat/m5-sales-report`  

---

## Gambaran Umum

Rencana ini memecah implementasi fitur Laporan Penjualan menjadi 6 task independen, teruji, dan bertahap:
1. **Task 1: Migrasi Database & Tes pgTAP**: Pembuatan fungsi SQL `report_summary` dan `top_items` berproteksi `is_owner()`, serta suite tes pgTAP.
2. **Task 2: Modul Server Helper & Vitest Unit Tests**: Skema Zod `reportQuerySchema`, utilitas rentang tanggal WITA (`getWitaTodayDateString`, `getWitaMonthRange`), helper `getSalesReport`, dan unit tests.
3. **Task 3: API Route Handler & API Unit Tests**: Endpoint terproteksi `GET /api/admin/reports` dengan validasi query Zod.
4. **Task 4: Komponen UI Responsif & Component Tests**: Pemilih periode, kartu statistik metrik utama, visualisasi perbandingan Cash vs QRIS, dan daftar 5 menu terlaris.
5. **Task 5: Integrasi Halaman Server `/admin/laporan/page.tsx`**: Server component Next.js 16 (`await searchParams`, `connection()`, `<Suspense>` skeleton).
6. **Task 6: Pengujian End-to-End Playwright & Sinkronisasi Roadmap**: Pengujian alur laporan otomatis dan pembaruan checklist `docs/roadmap.md`.

---

## Task 1: Migrasi Database & Tes pgTAP (`report_summary` & `top_items`)

### File yang Dikerjakan
- `supabase/migrations/20261022000000_reports_functions.sql` (buat baru)
- `supabase/tests/reports_functions.test.sql` (buat baru)

### Langkah Pengerjaan
1. Tulis tes pgTAP `supabase/tests/reports_functions.test.sql` (TDD):
   - Validasi hak akses: pemanggilan oleh non-pemilik ditolak dengan error `42501`.
   - Setup data sintetis pemilik:
     - Pesanan lunas cash (masuk omzet & cash).
     - Pesanan lunas qris (masuk omzet & qris).
     - Pesanan belum bayar (tidak masuk omzet).
     - Pesanan batal (tidak masuk omzet).
     - Pesanan bulan lalu (tidak masuk rentang bulan ini).
     - Order items dengan berbagai kuantitas untuk verifikasi menu terlaris.
   - Uji `report_summary`: memvalidasi `totalOrders`, `totalRevenue`, `totalCash`, dan `totalQris`.
   - Uji `top_items`: memvalidasi urutan menu berdasarkan `total_quantity desc`, akumulasi subtotal `total_revenue`, dan limit 5.
2. Buat file migrasi `supabase/migrations/20261022000000_reports_functions.sql`:
   - Implementasikan fungsi `public.report_summary(p_from_date date, p_to_date date)`.
   - Implementasikan fungsi `public.top_items(p_from_date date, p_to_date date, p_limit int default 5)`.
   - Berikan `security definer`, `set search_path = ''`, validasi `if not public.is_owner() then raise exception ... using errcode = '42501'`, serta `revoke execute` dari public/anon dan `grant execute` ke authenticated.
3. Verifikasi lokal dan lint/typecheck.
4. Commit: `feat(db): fungsi SQL report_summary dan top_items beserta suite tes pgTAP`.

---

## Task 2: Modul Server Helper `lib/admin-reports.ts` & Unit Tests

### File yang Dikerjakan
- `lib/admin-reports.ts` (buat baru)
- `lib/admin-reports.test.ts` (buat baru)

### Langkah Pengerjaan
1. Tulis failing unit test di `lib/admin-reports.test.ts`:
   - Uji utilitas rentang tanggal WITA: `getWitaTodayDateString`, `getWitaMonthRange(now)` (awal bulan s.d. hari ini).
   - Uji skema Zod `reportQuerySchema` (default preset `today`, dukungan preset `this_month` dan `custom` dengan tanggal YYYY-MM-DD).
   - Uji fungsi `getSalesReport(supabase, query)` dengan mock Supabase RPC:
     - Memanggil `report_summary` dan `top_items` secara paralel.
     - Menghitung nilai turunan `averageOrderValue` (`totalRevenue / totalOrders` atau 0 jika 0 pesanan).
     - Menghitung persentase kontribusi Cash dan QRIS.
     - Mengembalikan struktur `SalesReportResult`.
2. Implementasikan di `lib/admin-reports.ts`:
   - Tipe data: `ReportPeriod`, `ReportSummary`, `TopItem`, `PaymentMethodStats`, `SalesReportResult`.
   - Utilitas tanggal WITA dan skema Zod.
   - Fungsi `getSalesReport`.
3. Verifikasi dengan `npm test lib/admin-reports.test.ts`, `npm run lint`, dan `npm run typecheck`.
4. Commit: `feat(reports): helper kalkulasi laporan penjualan dan skema periode WITA`.

---

## Task 3: API Route Handler `app/api/admin/reports/route.ts` & Unit Tests

### File yang Dikerjakan
- `app/api/admin/reports/route.ts` (buat baru)
- `app/api/admin/reports/reports-api.test.ts` (buat baru)

### Langkah Pengerjaan
1. Tulis failing API test di `app/api/admin/reports/reports-api.test.ts`:
   - Memastikan request tanpa sesi admin (`getAdminUser()` null) ditolak dengan HTTP 401.
   - Memastikan query parameter yang tidak valid ditolak dengan HTTP 400 Zod validation error.
   - Memastikan request valid mengembalikan HTTP 200 dengan payload JSON laporan lengkap.
2. Implementasikan `GET` handler di `app/api/admin/reports/route.ts`:
   - Validasi sesi pemilik via `getAdminUser()`.
   - Parsing query parameters via `reportQuerySchema`.
   - Panggil `getSalesReport(supabase, query)`.
   - Kembalikan `NextResponse.json(report)`.
3. Verifikasi dengan `npm test app/api/admin/reports/reports-api.test.ts`, `npm run lint`, dan `npm run typecheck`.
4. Commit: `feat(api): endpoint GET laporan penjualan terproteksi otentikasi admin`.

---

## Task 4: Komponen UI Laporan di `components/admin/reports/` & Unit Tests

### File yang Dikerjakan
- `components/admin/reports/report-period-selector.tsx` (buat baru)
- `components/admin/reports/report-metric-cards.tsx` (buat baru)
- `components/admin/reports/report-payment-methods.tsx` (buat baru)
- `components/admin/reports/report-top-items.tsx` (buat baru)
- `components/admin/reports/reports-components.test.tsx` (buat baru)

### Langkah Pengerjaan
1. Tulis unit test di `components/admin/reports/reports-components.test.tsx`:
   - `ReportPeriodSelector`: navigasi tab Hari Ini / Bulan Ini / Kustom, update URL via `useRouter`.
   - `ReportMetricCards`: format Rupiah omzet lunas, jumlah pesanan, dan rata-rata nilai pesanan.
   - `ReportPaymentMethods`: nominal dan persentase Cash vs QRIS, progress bar visual proporsional.
   - `ReportTopItems`: daftar 5 menu terlaris, kuantitas porsi, dan total nominal per menu, serta empty state jika belum ada data.
2. Implementasikan masing-masing komponen di `components/admin/reports/`:
   - Mengikuti token `docs/design-system.md` (warna `green-900`, `green-700`, `cream-50`, `line`, font tabular).
   - Target sentuh interaktif $\ge 44\text{px}$.
   - Kontras WCAG AA.
   - Nol karakter em dash (`—`).
3. Verifikasi dengan `npm test components/admin/reports/reports-components.test.tsx`, `npm run lint`, dan `npm run typecheck`.
4. Commit: `feat(admin): komponen UI metrik laporan, komparasi pembayaran, dan menu terlaris`.

---

## Task 5: Integrasi Halaman Server `/admin/laporan/page.tsx`

### File yang Dikerjakan
- `app/admin/(dashboard)/laporan/page.tsx` (modifikasi dari placeholder)

### Langkah Pengerjaan
1. Ubah `app/admin/(dashboard)/laporan/page.tsx`:
   - Gunakan `await searchParams` (Next.js 16).
   - Validasi otentikasi admin via `getAdminUser()` (redirect ke `/admin/login` jika tidak ada).
   - Bungkus komponen dengan `connection()` dan `<Suspense fallback={<ReportsLoadingSkeleton />}>`.
   - Panggil `getSalesReport(supabase, validQuery)`.
   - Susun tata letak responsif: Header -> `ReportPeriodSelector` -> `ReportMetricCards` -> Grid 2 kolom (Desktop) atau 1 kolom (Mobile) untuk `ReportPaymentMethods` dan `ReportTopItems`.
2. Verifikasi dengan `npm run lint`, `npm run typecheck`, `npm test`, dan `npm run build`.
3. Commit: `feat(admin): implementasi halaman laporan penjualan lengkap dengan PPR dan Suspense`.

---

## Task 6: Pengujian End-to-End Playwright & Sinkronisasi Roadmap

### File yang Dikerjakan
- `e2e/admin-reports.spec.ts` (buat baru)
- `docs/roadmap.md` (modifikasi checklist M5)

### Langkah Pengerjaan
1. Buat suite E2E di `e2e/admin-reports.spec.ts`:
   - Mengikuti pola repositori (`isLocal`, `serviceKey`).
   - Buat pesanan uji sintetis dengan status bayar lunas, belum bayar, dan batal, serta item pesanan beragam.
   - Buka `/admin/laporan`.
   - Verifikasi kartu metrik omzet hari ini hanya menghitung pesanan lunas non-batal.
   - Ganti periode ke Bulan Ini dan verifikasi datanya.
   - Verifikasi rincian pembayaran Cash vs QRIS.
   - Verifikasi daftar menu terlaris menampilkan kuantitas yang sesuai.
   - Teardown data sintetis di `afterAll`.
2. Update `docs/roadmap.md`:
   - Tandai `- [x] Fungsi SQL laporan + halaman Laporan (hari ini / bulan ini, terlaris, Cash vs QRIS)`.
3. Jalankan pengujian menyeluruh:
   - `npm run lint`
   - `npm run typecheck`
   - `npm test`
   - `npm run build`
4. Commit: `test(e2e): tambah pengujian alur laporan penjualan dan sinkronkan roadmap`.

---

## Definisi Selesai (DoD)
- [ ] Branch kerja `feat/m5-sales-report` dibuat dari `development` terbaru.
- [ ] Validasi dan kalkulasi omzet/menu terlaris dilakukan di database SQL via RPC berproteksi `is_owner()`.
- [ ] pgTAP tests untuk fungsi SQL lulus di CI.
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, dan `npm run build` lulus 100% lokal.
- [ ] UI terverifikasi responsif pada mobile 360px tanpa scroll horizontal.
- [ ] Target sentuh $\ge 44\text{px}$, kontras teks WCAG AA, dan nol em dash (`—`).
- [ ] Roadmap `docs/roadmap.md` tersinkronisasi.
- [ ] PR ke `development` dengan body lengkap dan CI hijau.
