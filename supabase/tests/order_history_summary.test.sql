-- Tes fungsi RPC admin_get_order_history_summary (Milestone M5: Issue #20)
begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

-- ------------------------------------------------------------
-- Fixture Data: Admin & User Non-Admin
-- ------------------------------------------------------------
insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'owner-summary@warung.local'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'stranger-summary@warung.local');

insert into public.admins (user_id)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid);

-- ------------------------------------------------------------
-- 1. Uji Keamanan: User Non-Pemilik Ditolak (42501)
-- ------------------------------------------------------------
set local role authenticated;
set local "request.jwt.claims" = '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "authenticated"}';

select throws_ok(
  $$select public.admin_get_order_history_summary(current_date, current_date, 'all', null)$$,
  '42501',
  null,
  'user non-pemilik ditolak saat memanggil admin_get_order_history_summary'
);

-- ------------------------------------------------------------
-- 2. Setup Data Sintetis Sebagai Pemilik
-- ------------------------------------------------------------
set local "request.jwt.claims" = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

-- Pesanan 1: Hari ini, selesai, cash, lunas, total 35.000
insert into public.orders (
  id, public_token, order_date, daily_number, customer_name,
  order_type, payment_method, payment_status, status, total,
  device_id, ip_hash, idempotency_key
) values (
  '11111111-1111-1111-1111-111111111111'::uuid,
  'tokensummary0000000000001',
  current_date, 1, 'Budi Santoso',
  'dine_in', 'cash', 'lunas', 'selesai', 35000,
  'dev-s1', 'hash-s1', 'idem-s1'
);

-- Pesanan 2: Hari ini, selesai, qris, lunas, total 50.000
insert into public.orders (
  id, public_token, order_date, daily_number, customer_name,
  order_type, payment_method, payment_status, status, total,
  device_id, ip_hash, idempotency_key
) values (
  '22222222-2222-2222-2222-222222222222'::uuid,
  'tokensummary0000000000002',
  current_date, 2, 'Siti Rahma',
  'takeaway', 'qris', 'lunas', 'selesai', 50000,
  'dev-s2', 'hash-s2', 'idem-s2'
);

-- Pesanan 3: Hari ini, selesai, cash, belum_bayar, total 20.000 (tidak boleh masuk omzet)
insert into public.orders (
  id, public_token, order_date, daily_number, customer_name,
  order_type, payment_method, payment_status, status, total,
  device_id, ip_hash, idempotency_key
) values (
  '33333333-3333-3333-3333-333333333333'::uuid,
  'tokensummary0000000000003',
  current_date, 3, 'Ahmad Belum Bayar',
  'dine_in', 'cash', 'belum_bayar', 'selesai', 20000,
  'dev-s3', 'hash-s3', 'idem-s3'
);

-- Pesanan 4: Hari ini, batal, qris, lunas, total 40.000 (tidak boleh masuk omzet karena batal)
insert into public.orders (
  id, public_token, order_date, daily_number, customer_name,
  order_type, payment_method, payment_status, status, total,
  device_id, ip_hash, idempotency_key
) values (
  '44444444-4444-4444-4444-444444444444'::uuid,
  'tokensummary0000000000004',
  current_date, 4, 'Dewi Batal',
  'takeaway', 'qris', 'lunas', 'batal', 40000,
  'dev-s4', 'hash-s4', 'idem-s4'
);

-- Pesanan 5: Kemarin, selesai, cash, lunas, total 60.000
insert into public.orders (
  id, public_token, order_date, daily_number, customer_name,
  order_type, payment_method, payment_status, status, total,
  device_id, ip_hash, idempotency_key
) values (
  '55555555-5555-5555-5555-555555555555'::uuid,
  'tokensummary0000000000005',
  current_date - interval '1 day', 1, 'Kemarin Customer',
  'dine_in', 'cash', 'lunas', 'selesai', 60000,
  'dev-s5', 'hash-s5', 'idem-s5'
);

-- ------------------------------------------------------------
-- 3. Agregasi Hari Ini (Status = 'all')
-- ------------------------------------------------------------
select is(
  public.admin_get_order_history_summary(current_date, current_date, 'all', null),
  jsonb_build_object(
    'totalOrders', 4,
    'totalRevenue', 85000,
    'totalCash', 35000,
    'totalQris', 50000
  ),
  'agregasi hari ini menghitung 4 pesanan dengan omzet lunas 85.000 (35rb cash + 50rb qris)'
);

-- ------------------------------------------------------------
-- 4. Filter Status: 'batal'
-- ------------------------------------------------------------
select is(
  public.admin_get_order_history_summary(current_date, current_date, 'batal', null),
  jsonb_build_object(
    'totalOrders', 1,
    'totalRevenue', 0,
    'totalCash', 0,
    'totalQris', 0
  ),
  'filter status batal hanya menghitung 1 pesanan dengan omzet 0'
);

-- ------------------------------------------------------------
-- 5. Filter Pencarian Nama: 'Budi'
-- ------------------------------------------------------------
select is(
  public.admin_get_order_history_summary(current_date, current_date, 'all', 'Budi'),
  jsonb_build_object(
    'totalOrders', 1,
    'totalRevenue', 35000,
    'totalCash', 35000,
    'totalQris', 0
  ),
  'filter pencarian nama Budi menghitung 1 pesanan'
);

-- ------------------------------------------------------------
-- 6. Filter Pencarian Nomor Antrean: '#2'
-- ------------------------------------------------------------
select is(
  public.admin_get_order_history_summary(current_date, current_date, 'all', '#2'),
  jsonb_build_object(
    'totalOrders', 1,
    'totalRevenue', 50000,
    'totalCash', 0,
    'totalQris', 50000
  ),
  'filter pencarian nomor antrean #2 menghitung 1 pesanan qris lunas 50.000'
);

-- ------------------------------------------------------------
-- 7. Rentang Tanggal: Kemarin hingga Hari Ini
-- ------------------------------------------------------------
select is(
  public.admin_get_order_history_summary((current_date - interval '1 day')::date, current_date, 'all', null),
  jsonb_build_object(
    'totalOrders', 5,
    'totalRevenue', 145000,
    'totalCash', 95000,
    'totalQris', 50000
  ),
  'rentang kemarin hingga hari ini mencakup 5 pesanan total 145.000'
);

-- ------------------------------------------------------------
-- 8. Pengujian Skala: Melewati Batas Default 1.000 Baris PostgREST
-- ------------------------------------------------------------
-- Sisipkan 1.050 pesanan sintetis tambahan pada tanggal 2 hari lalu
insert into public.orders (
  id, public_token, order_date, daily_number, customer_name,
  order_type, payment_method, payment_status, status, total,
  device_id, ip_hash, idempotency_key
)
select
  gen_random_uuid(),
  'tok_bulk_' || i,
  current_date - interval '2 days',
  i,
  'Bulk User ' || i,
  'dine_in',
  'cash',
  'lunas',
  'selesai',
  10000,
  'dev-bulk',
  'hash-bulk',
  'idem-bulk-' || i
from generate_series(1, 1050) as i;

select is(
  public.admin_get_order_history_summary((current_date - interval '2 days')::date, (current_date - interval '2 days')::date, 'all', null),
  jsonb_build_object(
    'totalOrders', 1050,
    'totalRevenue', 10500000,
    'totalCash', 10500000,
    'totalQris', 0
  ),
  'agregasi SQL berhasil mengakumulasi 1.050 baris (melebihi limit bawaan 1.000 PostgREST)'
);

select * from finish();
rollback;
