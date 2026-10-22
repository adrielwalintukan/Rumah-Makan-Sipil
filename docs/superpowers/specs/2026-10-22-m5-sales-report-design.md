# Desain Teknis: Laporan Penjualan, Menu Terlaris, & Cash vs QRIS (Issue #21)

**Tanggal:** 22 Oktober 2026  
**Milestone:** M5 - Riwayat, Laporan, Keuangan  
**Issue Terkait:** #21 (Laporan: omzet, jumlah pesanan, menu terlaris, Cash vs QRIS)  
**Dokumen Acuan:** `docs/PRD.md §5 (US-14) & §6` · `docs/user-flows.md §5` · `docs/architecture.md §5.3` · `docs/design-system.md §6.8`  

---

## 1. Tujuan & Lingkup

Memberikan visualisasi kinerja penjualan yang akurat dan komprehensif bagi pemilik warung untuk periode **Hari Ini** dan **Bulan Ini** (zona waktu WITA / `Asia/Makassar`), mencakup total omzet lunas, jumlah pesanan, perbandingan metode pembayaran tunai (Cash) vs digital (QRIS), serta peringkat 5 menu terlaris.

### Lingkup Fitur (In-Scope)
1. **Fungsi Database SQL (`security definer`, hanya akun pemilik `is_owner()`)**:
   - `public.report_summary(p_from date, p_to date)`:
     - Mengagregasi `total_orders`, `total_revenue`, `total_cash`, dan `total_qris`.
     - Aturan PRD §6: Hanya menghitung pesanan yang berstatus `payment_status = 'lunas'` dan `status <> 'batal'`.
   - `public.top_items(p_from date, p_to date, p_limit int default 5)`:
     - Mengagregasi item pesanan dari `order_items` yang terhubung ke pesanan lunas non-batal dalam rentang tanggal tersebut.
     - Menghitung `name`, `total_quantity` (jumlah porsi), dan `total_revenue` (akumulasi subtotal).
     - Mengurutkan berdasarkan `total_quantity desc, total_revenue desc` dengan limit `p_limit`.
2. **Pengujian Database pgTAP**:
   - Memvalidasi bahwa pemanggilan fungsi oleh non-pemilik ditolak (`42501`).
   - Memvalidasi perhitungan omzet lunas dan pengecualian pesanan batal / belum lunas.
   - Memvalidasi akumulasi terpisah antara pembayaran Cash dan QRIS.
   - Memvalidasi peringkat dan jumlah porsi 5 menu terlaris.
3. **Pilihan Periode Laporan**:
   - Preset: **Hari Ini** (default) dan **Bulan Ini** (dari tanggal 1 bulan berjalan hingga hari ini dalam zona waktu WITA).
   - Opsi kustom rentang tanggal (`from` dan `to` berformat `YYYY-MM-DD`).
4. **Antarmuka Halaman `/admin/laporan` (Mobile-First)**:
   - **Period Selector**: Tab/chips pilihan periode interaktif berbasis query parameter (`?preset=today` / `?preset=this_month` / `?preset=custom`).
   - **Kartu Metrik Utama** (Desain System §6.8):
     - Total Omzet Lunas (font angka besar tabular `text-2xl font-bold`).
     - Total Pesanan Lunas.
     - Rata-rata Nilai Pesanan (*average basket size*: omzet dibagi jumlah pesanan).
   - **Komparasi Metode Pembayaran (Cash vs QRIS)**:
     - Rincian nominal Rupiah, jumlah pesanan, dan persentase kontribusi masing-masing metode pembayaran.
     - Visual bar proporsional horizontal yang mudah dibaca.
   - **Daftar 5 Menu Terlaris**:
     - Peringkat 1 s.d. 5 menampilkan nama menu, jumlah porsi terjual, dan total nominal Rupiah yang dihasilkan.
   - **Empty State**: Tampilan ramah jika belum ada data penjualan pada periode yang dipilih.
5. **Keamanan & Otorisasi**:
   - Halaman dan endpoint dibatasi hanya untuk sesi admin terotentikasi (`getAdminUser()`).

### Di Luar Lingkup (Out-of-Scope)
- Ekspor laporan ke format Excel/PDF (fase berikutnya).
- Pencatatan pengeluaran dan perhitungan laba kotor / buku kas (Issue #22: Catatan Keuangan).

---

## 2. Karakter Desain & Panduan Antislop

- **Antislop Mode**: Mode 1 (DURING) - aturan antislop diterapkan secara aktif dari awal desain hingga rilis.
- **Design Dials**:
  - **ENERGY: 1 (Calm)**: Tampilan fungsional yang bersih, kontras tinggi, dan nyaman dibaca pemilik warung di dapur/kasir.
  - **RHYTHM: 2 (Structured)**: Hirarki kartu vertikal teratur: Pemilih Periode -> Ringkasan Metrik -> Komposisi Pembayaran -> Menu Terlaris.
  - **MOTION: 1 (Minimal)**: Tidak ada animasi berlebihan; transisi tab cepat (150ms).
- **Standar Aksesibilitas**:
  - Semua target sentuh interaktif >= 44px (`min-h-[44px] min-w-[44px]`).
  - Lolos uji kontras WCAG AA (`text-ink-900`, `text-ink-700`, `text-ink-600` di atas `bg-card` dan `bg-cream-50`).
  - Nol karakter em dash (`—`) di seluruh teks UI, label, dan pesan error.
  - Responsif penuh di viewport 360px tanpa scroll horizontal.

---

## 3. Arsitektur Data & Alur Server

```text
[Browser / Klien]
   │
   ├── Navigasi URL: /admin/laporan?preset=today (atau this_month / custom)
   │     │
   │     ▼
[Server Component: /admin/laporan/page.tsx]
   │  ├── Validasi otentikasi via getAdminUser()
   │  ├── Parsing searchParams via reportQuerySchema
   │  └── Panggil getSalesReport(supabase, query)
   │        │
   │        ├── Hitung rentang tanggal WITA (Asia/Makassar)
   │        │     - today: from = to = today
   │        │     - this_month: from = 1st of month, to = today
   │        │
   │        ├── RPC 1: report_summary(from, to) -> { total_orders, total_revenue, total_cash, total_qris, cash_orders, qris_orders }
   │        └── RPC 2: top_items(from, to, 5) -> [ { name, total_quantity, total_revenue }, ... ]
   │
   └── Render Komponen Responsif (PPR / Suspense)
```

---

## 4. Spesifikasi Kontrak SQL & API

### 4.1. Fungsi SQL `report_summary`
```sql
create or replace function public.report_summary(
  p_from_date date,
  p_to_date date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total_orders bigint := 0;
  v_total_revenue bigint := 0;
  v_total_cash bigint := 0;
  v_total_qris bigint := 0;
  v_cash_orders bigint := 0;
  v_qris_orders bigint := 0;
begin
  if not public.is_owner() then
    raise exception 'FORBIDDEN: Hanya akun pemilik yang memiliki hak akses'
      using errcode = '42501';
  end if;

  select
    count(*)::bigint,
    coalesce(sum(total), 0)::bigint,
    coalesce(sum(case when payment_method = 'cash' then total else 0 end), 0)::bigint,
    coalesce(sum(case when payment_method = 'qris' then total else 0 end), 0)::bigint,
    count(case when payment_method = 'cash' then 1 end)::bigint,
    count(case when payment_method = 'qris' then 1 end)::bigint
  into
    v_total_orders,
    v_total_revenue,
    v_total_cash,
    v_total_qris,
    v_cash_orders,
    v_qris_orders
  from public.orders
  where order_date >= p_from_date
    and order_date <= p_to_date
    and payment_status = 'lunas'
    and status <> 'batal';

  return jsonb_build_object(
    'totalOrders', v_total_orders,
    'totalRevenue', v_total_revenue,
    'totalCash', v_total_cash,
    'totalQris', v_total_qris,
    'cashOrders', v_cash_orders,
    'qrisOrders', v_qris_orders
  );
end;
$$;
```

### 4.2. Fungsi SQL `top_items`
```sql
create or replace function public.top_items(
  p_from_date date,
  p_to_date date,
  p_limit int default 5
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_safe_limit int;
begin
  if not public.is_owner() then
    raise exception 'FORBIDDEN: Hanya akun pemilik yang memiliki hak akses'
      using errcode = '42501';
  end if;

  v_safe_limit := greatest(1, least(coalesce(p_limit, 5), 50));

  select coalesce(jsonb_agg(item_row), '[]'::jsonb)
  into v_result
  from (
    select
      oi.name,
      sum(oi.quantity)::int as total_quantity,
      sum(oi.subtotal)::bigint as total_revenue
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where o.order_date >= p_from_date
      and o.order_date <= p_to_date
      and o.payment_status = 'lunas'
      and o.status <> 'batal'
    group by oi.name
    order by total_quantity desc, total_revenue desc, oi.name asc
    limit v_safe_limit
  ) item_row;

  return v_result;
end;
$$;
```
