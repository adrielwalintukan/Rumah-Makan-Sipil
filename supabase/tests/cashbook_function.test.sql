-- Tes fungsi SQL cashbook dan RLS expenses (Milestone M5: Issue #22)
begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

-- ------------------------------------------------------------
-- Fixture Data: Akun Pemilik & User Non-Pemilik
-- ------------------------------------------------------------
insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'owner-cashbook@warung.local'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'stranger-cashbook@warung.local');

insert into public.admins (user_id)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid);

-- ------------------------------------------------------------
-- 1. Uji Keamanan: User Non-Pemilik Ditolak (42501)
-- ------------------------------------------------------------
set local role authenticated;
set local "request.jwt.claims" = '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "authenticated"}';

select throws_ok(
  $$select public.cashbook(current_date, current_date)$$,
  '42501',
  null,
  'user non-pemilik ditolak saat memanggil cashbook'
);

-- ------------------------------------------------------------
-- 2. Setup Sesi Sebagai Pemilik
-- ------------------------------------------------------------
set local "request.jwt.claims" = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

-- Uji Validasi Parameter Tanggal Null dan Terbalik (22023)
select throws_ok(
  $$select public.cashbook(null, current_date)$$,
  '22023',
  null,
  'cashbook menolak parameter tanggal awal null'
);

select throws_ok(
  $$select public.cashbook((current_date + interval '1 day')::date, current_date)$$,
  '22023',
  null,
  'cashbook menolak tanggal awal yang lebih besar dari tanggal akhir'
);

-- ------------------------------------------------------------
-- 3. Setup Data Sintetis Orders & Expenses
-- ------------------------------------------------------------
-- Pesanan 1 (Hari ini, selesai, cash, lunas, total 40.000)
insert into public.orders (
  id, public_token, order_date, daily_number, customer_name,
  order_type, payment_method, payment_status, status, total,
  device_id, ip_hash, idempotency_key, paid_at
) values (
  '11111111-1111-1111-1111-111111111111'::uuid,
  'tokencash0000000000000001',
  current_date, 1, 'Budi Santoso',
  'dine_in', 'cash', 'lunas', 'selesai', 40000,
  'dev-c1', 'hash-c1', 'idem-cash-1', now()
);

-- Pesanan 2 (Hari ini, belum lunas: cash, belum_bayar, total 30.000 -> TIDAK dihitung)
insert into public.orders (
  id, public_token, order_date, daily_number, customer_name,
  order_type, payment_method, payment_status, status, total,
  device_id, ip_hash, idempotency_key
) values (
  '22222222-2222-2222-2222-222222222222'::uuid,
  'tokencash0000000000000002',
  current_date, 2, 'Siti Belum Lunas',
  'dine_in', 'cash', 'belum_bayar', 'baru', 30000,
  'dev-c2', 'hash-c2', 'idem-cash-2'
);

-- Pesanan 3 (Hari ini, batal: cash, batal, total 25.000 -> TIDAK dihitung)
insert into public.orders (
  id, public_token, order_date, daily_number, customer_name,
  order_type, payment_method, payment_status, status, total,
  device_id, ip_hash, idempotency_key
) values (
  '33333333-3333-3333-3333-333333333333'::uuid,
  'tokencash0000000000000003',
  current_date, 3, 'Doni Batal',
  'takeaway', 'cash', 'lunas', 'batal', 25000,
  'dev-c3', 'hash-c3', 'idem-cash-3'
);

-- Pengeluaran 1 (Hari ini, bahan, 15.000)
insert into public.expenses (
  id, expense_date, description, amount, category
) values (
  '44444444-4444-4444-4444-444444444444'::uuid,
  current_date,
  'Beli Minyak Goreng',
  15000,
  'bahan'
);

-- Pengeluaran 2 (Hari ini, operasional, 10.000)
insert into public.expenses (
  id, expense_date, description, amount, category
) values (
  '55555555-5555-5555-5555-555555555555'::uuid,
  current_date,
  'Beli Sabun Cuci Piring',
  10000,
  'operasional'
);

-- Pengeluaran 3 (Hari ini, lainnya, 5.000)
insert into public.expenses (
  id, expense_date, description, amount, category
) values (
  '66666666-6666-6666-6666-666666666666'::uuid,
  current_date,
  'Parkir Pasar',
  5000,
  'lainnya'
);

-- ------------------------------------------------------------
-- 4. Uji Agregasi Buku Kas Hari Ini (Surplus: 40.000 - 30.000 = 10.000)
-- ------------------------------------------------------------
select is(
  public.cashbook(current_date, current_date),
  jsonb_build_object(
    'period', jsonb_build_object(
      'from', to_char(current_date, 'YYYY-MM-DD'),
      'to', to_char(current_date, 'YYYY-MM-DD')
    ),
    'summary', jsonb_build_object(
      'totalIncome', 40000,
      'totalExpense', 30000,
      'grossProfit', 10000,
      'expenseByCategory', jsonb_build_object(
        'bahan', 15000,
        'operasional', 10000,
        'lainnya', 5000
      )
    ),
    'dailyBreakdown', jsonb_build_array(
      jsonb_build_object(
        'date', to_char(current_date, 'YYYY-MM-DD'),
        'income', 40000,
        'expense', 30000,
        'grossProfit', 10000
      )
    )
  ),
  'cashbook hari ini menghitung pemasukan lunas, pengeluaran kategori, dan laba kotor surplus'
);

-- ------------------------------------------------------------
-- 5. Uji Skenario Defisit (Kemarin: 0 pemasukan, 50.000 pengeluaran -> laba kotor -50.000)
-- ------------------------------------------------------------
insert into public.expenses (
  id, expense_date, description, amount, category
) values (
  '77777777-7777-7777-7777-777777777777'::uuid,
  (current_date - interval '1 day')::date,
  'Beli Gas LPG 3kg',
  50000,
  'operasional'
);

select is(
  public.cashbook((current_date - interval '1 day')::date, (current_date - interval '1 day')::date),
  jsonb_build_object(
    'period', jsonb_build_object(
      'from', to_char((current_date - interval '1 day')::date, 'YYYY-MM-DD'),
      'to', to_char((current_date - interval '1 day')::date, 'YYYY-MM-DD')
    ),
    'summary', jsonb_build_object(
      'totalIncome', 0,
      'totalExpense', 50000,
      'grossProfit', -50000,
      'expenseByCategory', jsonb_build_object(
        'bahan', 0,
        'operasional', 50000,
        'lainnya', 0
      )
    ),
    'dailyBreakdown', jsonb_build_array(
      jsonb_build_object(
        'date', to_char((current_date - interval '1 day')::date, 'YYYY-MM-DD'),
        'income', 0,
        'expense', 50000,
        'grossProfit', -50000
      )
    )
  ),
  'cashbook menangani skenario defisit dengan grossProfit negatif saat pengeluaran melebihi pemasukan'
);

-- ------------------------------------------------------------
-- 6. Uji Multi-Hari: Penggabungan Tanggal & Urutan Terbalik (desc)
-- ------------------------------------------------------------
select is(
  (public.cashbook((current_date - interval '1 day')::date, current_date))->'summary',
  jsonb_build_object(
    'totalIncome', 40000,
    'totalExpense', 80000,
    'grossProfit', -40000,
    'expenseByCategory', jsonb_build_object(
      'bahan', 15000,
      'operasional', 60000,
      'lainnya', 5000
    )
  ),
  'cashbook multi-hari mengagregasi total akumulasi summary dengan benar'
);

select is(
  (public.cashbook((current_date - interval '1 day')::date, current_date))->'dailyBreakdown',
  jsonb_build_array(
    jsonb_build_object(
      'date', to_char(current_date, 'YYYY-MM-DD'),
      'income', 40000,
      'expense', 30000,
      'grossProfit', 10000
    ),
    jsonb_build_object(
      'date', to_char((current_date - interval '1 day')::date, 'YYYY-MM-DD'),
      'income', 0,
      'expense', 50000,
      'grossProfit', -50000
    )
  ),
  'dailyBreakdown terurut dari tanggal paling baru (desc)'
);

-- ------------------------------------------------------------
-- 7. Uji Periode Kosong (Nol Transaksi)
-- ------------------------------------------------------------
select is(
  public.cashbook((current_date + interval '2 days')::date, (current_date + interval '2 days')::date),
  jsonb_build_object(
    'period', jsonb_build_object(
      'from', to_char((current_date + interval '2 days')::date, 'YYYY-MM-DD'),
      'to', to_char((current_date + interval '2 days')::date, 'YYYY-MM-DD')
    ),
    'summary', jsonb_build_object(
      'totalIncome', 0,
      'totalExpense', 0,
      'grossProfit', 0,
      'expenseByCategory', jsonb_build_object(
        'bahan', 0,
        'operasional', 0,
        'lainnya', 0
      )
    ),
    'dailyBreakdown', '[]'::jsonb
  ),
  'cashbook pada periode tanpa transaksi menghasilkan angka 0 dan dailyBreakdown kosong'
);

-- ------------------------------------------------------------
-- 8. Uji RLS Tabel expenses (SELECT, INSERT, UPDATE, DELETE oleh Pemilik)
-- ------------------------------------------------------------
-- SELECT
select is(
  (select count(*)::int from public.expenses where id = '44444444-4444-4444-4444-444444444444'::uuid),
  1,
  'pemilik dapat membaca data pengeluaran (SELECT)'
);

-- INSERT
insert into public.expenses (
  id, expense_date, description, amount, category
) values (
  '88888888-8888-8888-8888-888888888888'::uuid,
  current_date,
  'Beli Beras 10kg',
  140000,
  'bahan'
);

select is(
  (select count(*)::int from public.expenses where id = '88888888-8888-8888-8888-888888888888'::uuid),
  1,
  'pemilik dapat menambahkan catatan pengeluaran (INSERT)'
);

-- UPDATE
update public.expenses
   set amount = 145000
 where id = '88888888-8888-8888-8888-888888888888'::uuid;

select is(
  (select amount from public.expenses where id = '88888888-8888-8888-8888-888888888888'::uuid),
  145000,
  'pemilik dapat memperbarui catatan pengeluaran (UPDATE)'
);

-- DELETE
delete from public.expenses
 where id = '88888888-8888-8888-8888-888888888888'::uuid;

select is(
  (select count(*)::int from public.expenses where id = '88888888-8888-8888-8888-888888888888'::uuid),
  0,
  'pemilik dapat menghapus catatan pengeluaran (DELETE)'
);

select * from finish();
rollback;
