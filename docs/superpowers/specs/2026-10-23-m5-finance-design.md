# Desain Teknis: Catatan Keuangan, Buku Kas, & Laba Kotor (Issue #22)

**Tanggal:** 23 Oktober 2026  
**Milestone:** M5 - Riwayat, Laporan, Keuangan  
**Issue Terkait:** #22 ([M5] Catatan keuangan: pengeluaran + buku kas + laba kotor)  
**Dokumen Acuan:** `docs/PRD.md §4.2 (D9), §5 (US-15) & §6` · `docs/user-flows.md §5` · `docs/architecture.md §4, §5.3 & §6` · `docs/design-system.md §6.8`  

---

## 1. Tujuan & Lingkup

Menyediakan pencatatan keuangan yang terintegrasi dan akurat bagi pemilik warung untuk melacak pemasukan otomatis dari pesanan lunas, mengelola pengeluaran operasional secara manual, serta memantau buku kas harian dan akumulasi laba kotor dalam zona waktu WITA (Asia/Makassar).

### Lingkup Fitur (In-Scope)

1. **Fungsi Database SQL (`security definer`, khusus akun pemilik `is_owner()`)**:
   - `public.cashbook(p_from_date date, p_to_date date)`:
     - Mengagregasi total pemasukan dari pesanan (`orders`) berstatus `payment_status = 'lunas'` dan `status <> 'batal'`.
     - Mengagregasi total pengeluaran dari tabel `expenses` beserta rincian per kategori (`bahan`, `operasional`, `lainnya`).
     - Menghitung laba kotor total (`pemasukan - pengeluaran`).
     - Menyusun rekapitulasi harian (`dailyBreakdown`) per tanggal transaksi (pemasukan, pengeluaran, laba kotor harian) terurut dari tanggal terbaru.
2. **Pengujian Database pgTAP (`supabase/tests/cashbook_function.test.sql`)**:
   - Memvalidasi penolakan akses untuk pengguna publik anonim dan pengguna non-pemilik (error `42501`).
   - Memvalidasi perhitungan pemasukan hanya dari pesanan lunas non-batal.
   - Memvalidasi agregasi pengeluaran per kategori.
   - Memvalidasi perhitungan laba kotor positif (surplus), nol (impas), dan negatif (defisit).
   - Memvalidasi penggabungan tanggal harian dari kedua sumber data (orders dan expenses).
   - Memvalidasi operasi RLS tabel `expenses` untuk operasi SELECT, INSERT, UPDATE, dan DELETE oleh pemilik.
3. **Modul Server & Validasi Zod (`lib/admin-finance.ts`)**:
   - Definisi tipe data: `ExpenseCategory`, `Expense`, `CashbookSummary`, `DailyCashbookItem`, `CashbookResult`.
   - Skema Zod `expensePayloadSchema` untuk validasi create/update pengeluaran:
     - `expense_date`: tanggal kalender valid YYYY-MM-DD, tidak boleh melebihi tanggal hari ini (WITA).
     - `description`: teks 1 s.d. 100 karakter (setelah di-trim).
     - `amount`: bilangan bulat Rupiah positif (`> 0`).
     - `category`: salah satu dari `'bahan'`, `'operasional'`, `'lainnya'`.
   - Skema Zod `financeQuerySchema`: validasi parameter query periode (`preset`, `from`, `to`) dengan penolakan tanggal masa depan dan validasi `from <= to`.
   - Helper fungsi kalkulasi dan pengambilan data server.
4. **Route Handlers Terproteksi**:
   - `GET /api/admin/cashbook`: Memanggil RPC `cashbook` untuk periode yang diminta.
   - `GET /api/admin/expenses`: Mengambil daftar transaksi pengeluaran dalam rentang tanggal.
   - `POST /api/admin/expenses`: Menambahkan pengeluaran baru.
   - `PATCH /api/admin/expenses/[id]`: Memperbarui data pengeluaran yang sudah ada.
   - `DELETE /api/admin/expenses/[id]`: Menghapus catatan pengeluaran.
5. **Antarmuka Halaman `/admin/keuangan` (Mobile-First)**:
   - **Pemilih Periode**: Pilihan preset Hari Ini, Bulan Ini, dan Kustom (WITA).
   - **Tiga Kartu Metrik Ringkasan**:
     - Total Pemasukan (Omzet pesanan lunas).
     - Total Pengeluaran (dilengkapi badge rincian kategori: Bahan, Operasional, Lainnya).
     - Laba Kotor (warna hijau saat surplus, merah saat defisit).
   - **Rekap Buku Kas Harian**:
     - Tampilan kartu per tanggal pada mobile (< 640px) dan tabel ringkas pada desktop (>= 640px).
   - **Daftar Pengeluaran Operasional**:
     - Tabel daftar transaksi pengeluaran dengan tombol aksi Edit dan Hapus.
     - Tombol "Tambah Pengeluaran" yang mudah dijangkau.
   - **Modal Form Pengeluaran (Dialog / Sheet)**:
     - Form tambah dan ubah pengeluaran yang responsif dengan validasi instan.
   - **Dialog Konfirmasi Hapus**:
     - Konfirmasi eksplisit sebelum menghapus baris pengeluaran.
   - **Resilience States**:
     - Loading skeleton berlatar `cream-100`, empty state ramah saat belum ada data, dan error state dengan tombol coba lagi.
6. **Keamanan & Otorisasi**:
   - Semua halaman dan endpoint dibatasi hanya untuk sesi admin terotentikasi (`getAdminUser()`).

### Di Luar Lingkup (Out-of-Scope)

- Ekspor buku kas ke format file Excel / PDF (Roadmap Fase Berikutnya, Issue #29).
- Manajemen stok bahan baku dan inventaris otomatis.
- Pencatatan utang, piutang, dan kasbon.
- Sistem akuntansi pembukuan ganda (double-entry bookkeeping) atau neraca keuangan komprehensif.
- Multi-user / kasir tambahan (tetap single owner).

---

## 2. Karakter Desain & Panduan Antislop

- **Antislop Mode**: Mode 1 (DURING) - aturan antislop diterapkan secara aktif dari awal desain hingga rilis.
- **Design Dials**:
  - **ENERGY: 1 (Calm)**: Visual bersih, kontras tinggi, fokus pada keterbacaan angka transaksi warung.
  - **RHYTHM: 2 (Structured)**: Hirarki vertikal teratur: Pemilih Periode -> Tiga Kartu Metrik -> Buku Kas Harian -> Daftar Pengeluaran.
  - **MOTION: 1 (Minimal)**: Transisi halus (150ms), tanpa loop atau animasi berlebihan.
- **Standar Aksesibilitas**:
  - Target sentuh interaktif minimal 44x44 px (`min-h-[44px] min-w-[44px]`).
  - Lolos uji kontras WCAG AA (>= 4.5:1 untuk teks normal).
  - Nol karakter em dash (`—`) di seluruh teks antarmuka, pesan validasi, dan log error.
  - Tampilan responsif penuh di viewport 360 px tanpa scroll horizontal.
  - Status surplus dan defisit diperjelas dengan tanda plus/minus (`+`/`-`) dan label semantik, bukan hanya bergantung pada warna.

---

## 3. Arsitektur Data & Alur Server

```text
[Browser / Klien Pemilik]
   │
   ├── Navigasi: /admin/keuangan?preset=today (atau this_month / custom)
   │     │
   │     ▼
[Server Component: /admin/keuangan/page.tsx]
   │  ├── Validasi otentikasi via getAdminUser()
   │  ├── Parsing searchParams via financeQuerySchema
   │  └── Panggil getFinanceData(supabase, query)
   │        │
   │        ├── Hitung rentang tanggal WITA:
   │        │     - today: from = to = todayStr
   │        │     - this_month: from = YYYY-MM-01, to = todayStr
   │        │     - custom: from = customFrom, to = customTo
   │        │
   │        ├── RPC: public.cashbook(from, to) -> { period, summary, dailyBreakdown }
   │        └── Query: select * from expenses where expense_date between from and to order by expense_date desc, created_at desc
   │
   └── Render UI Responsif (PPR / Suspense)
         ├── FinancePeriodSelector (Client Component)
         ├── FinanceSummaryCards (Rupiah tabular)
         ├── CashbookDailyTable (Rekap harian)
         └── ExpenseSection (Daftar pengeluaran + Modal Tambah/Edit/Hapus)
```

---

## 4. Spesifikasi Kontrak Database & SQL

### 4.1. Tabel `public.expenses` (Sudah Ada)
Struktur tabel yang didefinisikan pada `supabase/migrations/20261014000000_skema_awal.sql`:
```sql
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null,
  description text not null check (length(trim(description)) between 1 and 100),
  amount integer not null check (amount > 0),
  category text not null check (category in ('bahan', 'operasional', 'lainnya')),
  created_at timestamptz not null default now()
);

create index expenses_expense_date_idx on public.expenses (expense_date);

alter table public.expenses enable row level security;
revoke all on public.expenses from anon;
create policy "pemilik kelola pengeluaran" on public.expenses
  for all to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
```

### 4.2. Fungsi SQL `public.cashbook` (Migrasi Baru)
File: `supabase/migrations/20261023000000_cashbook_function.sql`
```sql
create or replace function public.cashbook(
  p_from_date date,
  p_to_date date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_income bigint;
  v_expense bigint;
  v_profit bigint;
  v_expense_bahan bigint;
  v_expense_operasional bigint;
  v_expense_lainnya bigint;
  v_daily jsonb;
begin
  -- 1. Penegakan Keamanan: Hanya pemilik yang berhak
  if not public.is_owner() then
    raise exception 'FORBIDDEN: Hanya akun pemilik yang memiliki hak akses' using errcode = '42501';
  end if;

  -- 2. Validasi parameter tanggal
  if p_from_date is null or p_to_date is null then
    raise exception 'INVALID_PARAMETER: Tanggal awal dan akhir harus diisi' using errcode = '22023';
  end if;

  if p_from_date > p_to_date then
    raise exception 'INVALID_PARAMETER: Tanggal awal tidak boleh lebih besar dari tanggal akhir' using errcode = '22023';
  end if;

  -- 3. Hitung total pemasukan dari pesanan lunas non-batal
  select coalesce(sum(o.total), 0)
    into v_income
    from public.orders o
   where o.order_date between p_from_date and p_to_date
     and o.payment_status = 'lunas'
     and o.status <> 'batal';

  -- 4. Hitung total pengeluaran dan rincian per kategori
  select coalesce(sum(e.amount), 0),
         coalesce(sum(case when e.category = 'bahan' then e.amount else 0 end), 0),
         coalesce(sum(case when e.category = 'operasional' then e.amount else 0 end), 0),
         coalesce(sum(case when e.category = 'lainnya' then e.amount else 0 end), 0)
    into v_expense,
         v_expense_bahan,
         v_expense_operasional,
         v_expense_lainnya
    from public.expenses e
   where e.expense_date between p_from_date and p_to_date;

  -- 5. Hitung laba kotor total
  v_profit := v_income - v_expense;

  -- 6. Agregasi rincian buku kas harian
  with dates as (
    select distinct o.order_date as dt
      from public.orders o
     where o.order_date between p_from_date and p_to_date
       and o.payment_status = 'lunas'
       and o.status <> 'batal'
    union
    select distinct e.expense_date as dt
      from public.expenses e
     where e.expense_date between p_from_date and p_to_date
  ),
  daily_income as (
    select o.order_date as dt,
           coalesce(sum(o.total), 0) as income
      from public.orders o
     where o.order_date between p_from_date and p_to_date
       and o.payment_status = 'lunas'
       and o.status <> 'batal'
     group by o.order_date
  ),
  daily_expense as (
    select e.expense_date as dt,
           coalesce(sum(e.amount), 0) as expense
      from public.expenses e
     where e.expense_date between p_from_date and p_to_date
     group by e.expense_date
  )
  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'date', to_char(d.dt, 'YYYY-MM-DD'),
               'income', coalesce(di.income, 0),
               'expense', coalesce(de.expense, 0),
               'grossProfit', coalesce(di.income, 0) - coalesce(de.expense, 0)
             )
             order by d.dt desc
           ),
           '[]'::jsonb
         )
    into v_daily
    from dates d
    left join daily_income di on di.dt = d.dt
    left join daily_expense de on de.dt = d.dt;

  -- 7. Bentuk hasil akhir jsonb
  return jsonb_build_object(
    'period', jsonb_build_object(
      'from', to_char(p_from_date, 'YYYY-MM-DD'),
      'to', to_char(p_to_date, 'YYYY-MM-DD')
    ),
    'summary', jsonb_build_object(
      'totalIncome', v_income,
      'totalExpense', v_expense,
      'grossProfit', v_profit,
      'expenseByCategory', jsonb_build_object(
        'bahan', v_expense_bahan,
        'operasional', v_expense_operasional,
        'lainnya', v_expense_lainnya
      )
    ),
    'dailyBreakdown', v_daily
  );
end;
$$;

revoke all on function public.cashbook(date, date) from public, anon;
grant execute on function public.cashbook(date, date) to authenticated;
```

---

## 5. Skema Validasi Server & Type Definitions

File: `lib/admin-finance.ts`

### 5.1. Kategori & Payload Pengeluaran
```typescript
import { z } from "zod";
import { getWitaTodayDateString, isValidCalendarDate } from "./admin-reports";

export const expenseCategoryEnum = z.enum(["bahan", "operasional", "lainnya"]);
export type ExpenseCategory = z.infer<typeof expenseCategoryEnum>;

export const expensePayloadSchema = z.object({
  expense_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD.")
    .refine(isValidCalendarDate, "Tanggal kalender tidak valid.")
    .refine(
      (date) => date <= getWitaTodayDateString(),
      "Tanggal pengeluaran tidak boleh melebihi tanggal hari ini (WITA)."
    ),
  description: z
    .string()
    .trim()
    .min(1, "Keterangan pengeluaran wajib diisi.")
    .max(100, "Keterangan pengeluaran maksimal 100 karakter."),
  amount: z.coerce
    .number()
    .int("Nominal pengeluaran harus berupa bilangan bulat Rupiah.")
    .positive("Nominal pengeluaran harus lebih besar dari 0."),
  category: expenseCategoryEnum,
});

export type ExpensePayload = z.infer<typeof expensePayloadSchema>;
```

### 5.2. Skema Query Periode Keuangan
```typescript
export const financePresetEnum = z.enum(["today", "this_month", "custom"]);
export type FinancePreset = z.infer<typeof financePresetEnum>;

export function createFinanceQuerySchema(now: Date = new Date()) {
  const todayStr = getWitaTodayDateString(now);

  return z
    .object({
      preset: financePresetEnum.default("today"),
      from: z.string().optional(),
      to: z.string().optional(),
    })
    .refine(
      (data) => !data.from || (isValidCalendarDate(data.from) && data.from <= todayStr),
      {
        message: "Tanggal awal (from) tidak valid atau melebihi hari ini (WITA).",
        path: ["from"],
      }
    )
    .refine(
      (data) => !data.to || (isValidCalendarDate(data.to) && data.to <= todayStr),
      {
        message: "Tanggal akhir (to) tidak valid atau melebihi hari ini (WITA).",
        path: ["to"],
      }
    )
    .refine(
      (data) => {
        if (data.from && data.to) return data.from <= data.to;
        return true;
      },
      {
        message: "Tanggal awal (from) tidak boleh lebih besar dari tanggal akhir (to).",
        path: ["from"],
      }
    );
}

export const financeQuerySchema = createFinanceQuerySchema();
export type FinanceQuery = z.infer<typeof financeQuerySchema>;
```

### 5.3. Interface Data
```typescript
export interface Expense {
  id: string;
  expense_date: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  created_at: string;
}

export interface CashbookExpenseByCategory {
  bahan: number;
  operasional: number;
  lainnya: number;
}

export interface CashbookSummary {
  totalIncome: number;
  totalExpense: number;
  grossProfit: number;
  expenseByCategory: CashbookExpenseByCategory;
}

export interface DailyCashbookItem {
  date: string;
  income: number;
  expense: number;
  grossProfit: number;
}

export interface CashbookResult {
  period: { from: string; to: string };
  summary: CashbookSummary;
  dailyBreakdown: DailyCashbookItem[];
}
```

---

## 6. Spesifikasi Kontrak API Route Handlers

### 6.1. `GET /api/admin/cashbook`
- **Tujuan:** Mendapatkan ringkasan buku kas dan rekap harian dari RPC `public.cashbook`.
- **Query Params:** `preset`, `from`, `to`.
- **Otentikasi:** Wajib sesi admin via `getAdminUser()`.
- **Status Respons:**
  - `200 OK`: Mengembalikan objek `CashbookResult`.
  - `400 Bad Request`: Format tanggal salah / rentang terbalik / tanggal masa depan.
  - `401 Unauthorized`: Sesi admin tidak sah.
  - `500 Internal Server Error`: Kegagalan teknis basis data.

### 6.2. `GET /api/admin/expenses`
- **Tujuan:** Mendapatkan daftar item pengeluaran dalam rentang tanggal.
- **Query Params:** `from`, `to`, `category` (opsional).
- **Otentikasi:** Wajib sesi admin via `getAdminUser()`.
- **Status Respons:**
  - `200 OK`: `{ expenses: Expense[] }`.

### 6.3. `POST /api/admin/expenses`
- **Tujuan:** Menambahkan catatan pengeluaran baru.
- **Request Body (JSON):** `{ expense_date, description, amount, category }`.
- **Validasi:** `expensePayloadSchema`.
- **Otentikasi:** Wajib sesi admin via `getAdminUser()`.
- **Status Respons:**
  - `201 Created`: `{ expense: Expense }`.
  - `400 Bad Request`: Validasi payload gagal.
  - `401 Unauthorized`: Sesi admin tidak sah.

### 6.4. `PATCH /api/admin/expenses/[id]`
- **Tujuan:** Memperbarui catatan pengeluaran yang ada.
- **Request Body (JSON):** Bagian dari `expensePayloadSchema`.
- **Status Respons:**
  - `200 OK`: `{ expense: Expense }`.
  - `400 Bad Request`: Validasi payload gagal.
  - `404 Not Found`: Catatan pengeluaran tidak ditemukan.

### 6.5. `DELETE /api/admin/expenses/[id]`
- **Tujuan:** Menghapus catatan pengeluaran.
- **Status Respons:**
  - `200 OK`: `{ success: true }`.
  - `404 Not Found`: Catatan tidak ditemukan.

---

## 7. Desain Komponen Antarmuka di `/admin/keuangan`

Semua komponen disimpan di direktori `components/admin/finance/`:

1. `finance-period-selector.tsx`:
   - Tab chip: "Hari Ini", "Bulan Ini", "Kustom".
   - Input kalender native `type="date"` berukuran tinggi 48 px dengan `max={todayStr}`.
   - Target sentuh chip tombol minimal 44x44 px.
2. `finance-summary-cards.tsx`:
   - **Kartu Total Pemasukan:** Nominal Rupiah berfont tabular `text-2xl font-bold text-green-800`, latar `bg-green-50`.
   - **Kartu Total Pengeluaran:** Nominal Rupiah `text-red-800`, latar `bg-red-50`, disertai breakdown badge nominal Bahan, Operasional, Lainnya di bawahnya.
   - **Kartu Laba Kotor:** Nominal Rupiah berlatar `bg-card`, warna teks hijau (`text-green-700`) jika surplus, merah (`text-red-700`) jika defisit, dilengkapi indikator tanda `+` atau `-`.
3. `cashbook-daily-table.tsx`:
   - Menampilkan agregat per tanggal (Tanggal, Pemasukan, Pengeluaran, Laba Kotor).
   - Layout adaptif: Kartu ringkas per tanggal di layar mobile (< 640px) dan tabel berbaris rapi di layar desktop (>= 640px).
   - Format tanggal WITA yang mudah dibaca (misal: "Kamis, 23 Okt 2026").
4. `expense-list-section.tsx`:
   - Header daftar dengan tombol utama "Tambah Pengeluaran" (`min-h-[44px]`).
   - Filter cepat kategori (`semua`, `bahan`, `operasional`, `lainnya`).
   - Tabel / kartu pengeluaran: Tanggal, Keterangan, Kategori (badge), Nominal, dan tombol aksi Edit / Hapus.
5. `expense-form-dialog.tsx`:
   - Modal form untuk aksi Tambah dan Edit pengeluaran.
   - Menggunakan komponen `Dialog` pada desktop (>= 768px) dan `Sheet` (bottom-sheet) pada mobile (< 768px).
   - Validasi klien instan sebelum submit, status loading tombol saat memproses, dan error alert jika gagal.
6. `delete-expense-dialog.tsx`:
   - Dialog konfirmasi sebelum menghapus pengeluaran agar terhindar dari ketidaksengajaan.

---

## 8. Strategi Pengujian (Verification Strategy)

1. **pgTAP Database Tests (`supabase/tests/cashbook_function.test.sql`)**:
   - Rencana pengujian: 12 asersi pgTAP.
   - Test 1-2: Verifikasi fungsi `cashbook` menolak anon dan authenticated non-pemilik (error `42501`).
   - Test 3: Verifikasi parameter tanggal null dan rentang terbalik (error `22023`).
   - Test 4: Verifikasi pemasukan hanya mencakup pesanan `lunas` dan `status <> 'batal'`.
   - Test 5: Verifikasi pesanan `belum_bayar` dan `batal` tidak dihitung ke pemasukan.
   - Test 6: Verifikasi pengeluaran teragregasi dengan benar sesuai rentang tanggal.
   - Test 7: Verifikasi pengeluaran per kategori (`bahan`, `operasional`, `lainnya`).
   - Test 8: Verifikasi perhitungan laba kotor total (`income - expense`).
   - Test 9: Verifikasi skenario defisit (pengeluaran > pemasukan menghasilkan laba kotor negatif).
   - Test 10: Verifikasi rincian harian `dailyBreakdown` memuat data tanggal yang tepat terurut menurun.
   - Test 11-12: Verifikasi RLS tabel `expenses` untuk INSERT dan SELECT oleh pemilik.
2. **Vitest Unit & Helper Tests (`lib/admin-finance.test.ts`)**:
   - Uji validasi skema `expensePayloadSchema`: nominal negatif, nominal 0, deskripsi kosong, deskripsi > 100 karakter, tanggal masa depan, kategori tidak valid.
   - Uji validasi skema `financeQuerySchema`: rentang terbalik, tanggal masa depan, preset today dan this_month.
   - Uji helper `getFinanceDateRange`.
3. **Vitest API Route Tests**:
   - `app/api/admin/cashbook/cashbook-api.test.ts`: Penolakan 401 saat sesi tidak ada, respons 400 saat query salah, respons 200 saat sukses memanggil RPC.
   - `app/api/admin/expenses/expenses-api.test.ts`: Uji endpoint GET, POST, PATCH, DELETE untuk admin, penanganan validasi 400, dan otentikasi 401.
4. **Vitest Component Tests (`components/admin/finance/finance-components.test.tsx`)**:
   - Uji rendering kartu metrik pemasukan, pengeluaran, dan laba kotor.
   - Uji rendering indikator surplus vs defisit.
   - Uji interaksi form pengeluaran (tambah/edit).
5. **Playwright E2E Tests (`e2e/admin-finance.spec.ts`)**:
   - Uji alur lengkap pemilik di viewport HP (375x667):
     - Login admin dan navigasi ke `/admin/keuangan`.
     - Verifikasi kartu ringkasan dan tabel buku kas harian.
     - Tambah pengeluaran baru (misal: "Beli Telur 1 Rak", Rp60.000, Bahan).
     - Verifikasi item masuk ke daftar dan laba kotor berkurang Rp60.000.
     - Edit pengeluaran (ubah nominal ke Rp65.000) dan verifikasi saldo terhitung ulang.
     - Hapus pengeluaran dan verifikasi saldo kembali ke semula.
     - Teardown tuntas di `afterAll`.
