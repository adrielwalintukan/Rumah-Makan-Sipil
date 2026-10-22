-- Tes fungsi SQL report_summary dan top_items (Milestone M5: Issue #21)
begin;
create extension if not exists pgtap with schema extensions;

select plan(11);

-- ------------------------------------------------------------
-- Fixture Data: Akun Pemilik & User Non-Pemilik
-- ------------------------------------------------------------
insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'owner-report@warung.local'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'stranger-report@warung.local');

insert into public.admins (user_id)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid);

-- ------------------------------------------------------------
-- 1. Uji Keamanan: User Non-Pemilik Ditolak (42501)
-- ------------------------------------------------------------
set local role authenticated;
set local "request.jwt.claims" = '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "authenticated"}';

select throws_ok(
  $$select public.report_summary(current_date, current_date)$$,
  '42501',
  null,
  'user non-pemilik ditolak saat memanggil report_summary'
);

select throws_ok(
  $$select public.top_items(current_date, current_date, 5)$$,
  '42501',
  null,
  'user non-pemilik ditolak saat memanggil top_items'
);

-- ------------------------------------------------------------
-- 2. Setup Data Sintetis Sebagai Pemilik
-- ------------------------------------------------------------
set local "request.jwt.claims" = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

-- Pesanan 1 (Hari ini, selesai, cash, lunas, total 35.000)
insert into public.orders (
  id, public_token, order_date, daily_number, customer_name,
  order_type, payment_method, payment_status, status, total,
  device_id, ip_hash, idempotency_key, paid_at
) values (
  '11111111-1111-1111-1111-111111111111'::uuid,
  'tokenrep0000000000000001',
  current_date, 1, 'Budi Santoso',
  'dine_in', 'cash', 'lunas', 'selesai', 35000,
  'dev-r1', 'hash-r1', 'idem-rep-1', now()
);

insert into public.order_items (order_id, name, unit_price, quantity, subtotal)
values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'Ayam Goreng Spesial', 15000, 2, 30000),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'Es Teh Manis', 5000, 1, 5000);

-- Pesanan 2 (Hari ini, dimasak, qris, lunas, total 50.000)
insert into public.orders (
  id, public_token, order_date, daily_number, customer_name,
  order_type, payment_method, payment_status, status, total,
  device_id, ip_hash, idempotency_key, paid_at
) values (
  '22222222-2222-2222-2222-222222222222'::uuid,
  'tokenrep0000000000000002',
  current_date, 2, 'Siti Rahma',
  'takeaway', 'qris', 'lunas', 'dimasak', 50000,
  'dev-r2', 'hash-r2', 'idem-rep-2', now()
);

insert into public.order_items (order_id, name, unit_price, quantity, subtotal)
values
  ('22222222-2222-2222-2222-222222222222'::uuid, 'Nasi Goreng Komplit', 20000, 2, 40000),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'Es Teh Manis', 5000, 2, 10000);

-- Pesanan 3 (Hari ini, belum lunas: cash, belum_bayar, total 25.000)
insert into public.orders (
  id, public_token, order_date, daily_number, customer_name,
  order_type, payment_method, payment_status, status, total,
  device_id, ip_hash, idempotency_key, paid_at
) values (
  '33333333-3333-3333-3333-333333333333'::uuid,
  'tokenrep0000000000000003',
  current_date, 3, 'Ahmad Belum Bayar',
  'dine_in', 'cash', 'belum_bayar', 'baru', 25000,
  'dev-r3', 'hash-r3', 'idem-rep-3', null
);

insert into public.order_items (order_id, name, unit_price, quantity, subtotal)
values
  ('33333333-3333-3333-3333-333333333333'::uuid, 'Ayam Bakar Madu', 25000, 1, 25000);

-- Pesanan 4 (Hari ini, dibatalkan: qris, lunas, batal, total 40.000)
insert into public.orders (
  id, public_token, order_date, daily_number, customer_name,
  order_type, payment_method, payment_status, status, total,
  device_id, ip_hash, idempotency_key, paid_at
) values (
  '44444444-4444-4444-4444-444444444444'::uuid,
  'tokenrep0000000000000004',
  current_date, 4, 'Dewi Batal',
  'takeaway', 'qris', 'lunas', 'batal', 40000,
  'dev-r4', 'hash-r4', 'idem-rep-4', now()
);

insert into public.order_items (order_id, name, unit_price, quantity, subtotal)
values
  ('44444444-4444-4444-4444-444444444444'::uuid, 'Ayam Goreng Spesial', 20000, 2, 40000);

-- Pesanan 5 (Hari ini, verifikasi tertunda: qris, menunggu_verifikasi, total 30.000)
insert into public.orders (
  id, public_token, order_date, daily_number, customer_name,
  order_type, payment_method, payment_status, status, total,
  device_id, ip_hash, idempotency_key, paid_at
) values (
  '55555555-5555-5555-5555-555555555555'::uuid,
  'tokenrep0000000000000005',
  current_date, 5, 'Eko Menunggu',
  'dine_in', 'qris', 'menunggu_verifikasi', 'baru', 30000,
  'dev-r5', 'hash-r5', 'idem-rep-5', null
);

insert into public.order_items (order_id, name, unit_price, quantity, subtotal)
values
  ('55555555-5555-5555-5555-555555555555'::uuid, 'Soto Ayam', 30000, 1, 30000);

-- Pesanan 6 (Kemarin, selesai, cash, lunas, total 60.000)
insert into public.orders (
  id, public_token, order_date, daily_number, customer_name,
  order_type, payment_method, payment_status, status, total,
  device_id, ip_hash, idempotency_key, paid_at
) values (
  '66666666-6666-6666-6666-666666666666'::uuid,
  'tokenrep0000000000000006',
  (current_date - interval '1 day')::date, 1, 'Kemarin Customer',
  'dine_in', 'cash', 'lunas', 'selesai', 60000,
  'dev-r6', 'hash-r6', 'idem-rep-6', now()
);

insert into public.order_items (order_id, name, unit_price, quantity, subtotal)
values
  ('66666666-6666-6666-6666-666666666666'::uuid, 'Bebek Goreng', 30000, 2, 60000);

-- Pesanan 7 (2 hari lalu, selesai, qris, lunas, total 75.000)
insert into public.orders (
  id, public_token, order_date, daily_number, customer_name,
  order_type, payment_method, payment_status, status, total,
  device_id, ip_hash, idempotency_key, paid_at
) values (
  '77777777-7777-7777-7777-777777777777'::uuid,
  'tokenrep0000000000000007',
  (current_date - interval '2 days')::date, 1, 'Lalu Customer',
  'takeaway', 'qris', 'lunas', 'selesai', 75000,
  'dev-r7', 'hash-r7', 'idem-rep-7', now()
);

insert into public.order_items (order_id, name, unit_price, quantity, subtotal)
values
  ('77777777-7777-7777-7777-777777777777'::uuid, 'Nasi Goreng Komplit', 20000, 3, 60000),
  ('77777777-7777-7777-7777-777777777777'::uuid, 'Es Jeruk', 5000, 3, 15000);

-- ------------------------------------------------------------
-- 3. Uji report_summary Hari Ini
-- ------------------------------------------------------------
select is(
  public.report_summary(current_date, current_date),
  jsonb_build_object(
    'totalOrders', 2,
    'totalRevenue', 85000,
    'totalCash', 35000,
    'totalQris', 50000,
    'cashOrders', 1,
    'qrisOrders', 1
  ),
  'report_summary hari ini mengabaikan pesanan belum lunas dan batal'
);

-- ------------------------------------------------------------
-- 4. Uji report_summary Periode Kosong
-- ------------------------------------------------------------
select is(
  public.report_summary((current_date + interval '1 day')::date, (current_date + interval '1 day')::date),
  jsonb_build_object(
    'totalOrders', 0,
    'totalRevenue', 0,
    'totalCash', 0,
    'totalQris', 0,
    'cashOrders', 0,
    'qrisOrders', 0
  ),
  'report_summary periode tanpa transaksi mengembalikan nilai nol'
);

-- ------------------------------------------------------------
-- 5. Uji report_summary Multi-Hari (Cash vs QRIS)
-- ------------------------------------------------------------
select is(
  public.report_summary((current_date - interval '1 day')::date, current_date),
  jsonb_build_object(
    'totalOrders', 3,
    'totalRevenue', 145000,
    'totalCash', 95000,
    'totalQris', 50000,
    'cashOrders', 2,
    'qrisOrders', 1
  ),
  'report_summary rentang multi-hari mengakumulasi pesanan cash dan qris dengan benar'
);

-- ------------------------------------------------------------
-- 6. Uji top_items Hari Ini (Default Limit 5)
-- ------------------------------------------------------------
select is(
  public.top_items(current_date, current_date),
  jsonb_build_array(
    jsonb_build_object('name', 'Es Teh Manis', 'total_quantity', 3, 'total_revenue', 15000),
    jsonb_build_object('name', 'Nasi Goreng Komplit', 'total_quantity', 2, 'total_revenue', 40000),
    jsonb_build_object('name', 'Ayam Goreng Spesial', 'total_quantity', 2, 'total_revenue', 30000)
  ),
  'top_items mengurutkan menu terlaris hari ini dan mengabaikan pesanan belum lunas/batal'
);

-- ------------------------------------------------------------
-- 7. Uji top_items dengan Parameter Limit = 1
-- ------------------------------------------------------------
select is(
  public.top_items(current_date, current_date, 1),
  jsonb_build_array(
    jsonb_build_object('name', 'Es Teh Manis', 'total_quantity', 3, 'total_revenue', 15000)
  ),
  'top_items membatasi jumlah hasil sesuai parameter limit'
);

-- ------------------------------------------------------------
-- 8. Uji top_items Periode Kosong
-- ------------------------------------------------------------
select is(
  public.top_items((current_date + interval '1 day')::date, (current_date + interval '1 day')::date),
  '[]'::jsonb,
  'top_items pada periode tanpa pesanan mengembalikan array kosong'
);

-- ------------------------------------------------------------
-- 9. Uji top_items Multi-Hari (Tie Breaker: Kuantitas -> Omzet -> Alfabetis)
-- ------------------------------------------------------------
select is(
  public.top_items((current_date - interval '2 days')::date, current_date, 2),
  jsonb_build_array(
    jsonb_build_object('name', 'Nasi Goreng Komplit', 'total_quantity', 5, 'total_revenue', 100000),
    jsonb_build_object('name', 'Es Jeruk', 'total_quantity', 3, 'total_revenue', 15000)
  ),
  'top_items multi-hari menerapkan pemeringkatan kuantitas, omzet, dan nama alfabetis'
);

-- ------------------------------------------------------------
-- 10. Uji top_items dengan Batas Limit Non-Positif (<= 0 Di-clamp ke 1)
-- ------------------------------------------------------------
select is(
  public.top_items(current_date, current_date, 0),
  jsonb_build_array(
    jsonb_build_object('name', 'Es Teh Manis', 'total_quantity', 3, 'total_revenue', 15000)
  ),
  'top_items menjaga batas minimum limit bernilai 1 jika diberikan limit <= 0'
);

-- ------------------------------------------------------------
-- 11. Uji top_items dengan Parameter Limit Bernilai NULL (Fallback Default 5)
-- ------------------------------------------------------------
select is(
  public.top_items(current_date, current_date, null),
  jsonb_build_array(
    jsonb_build_object('name', 'Es Teh Manis', 'total_quantity', 3, 'total_revenue', 15000),
    jsonb_build_object('name', 'Nasi Goreng Komplit', 'total_quantity', 2, 'total_revenue', 40000),
    jsonb_build_object('name', 'Ayam Goreng Spesial', 'total_quantity', 2, 'total_revenue', 30000)
  ),
  'top_items menangani p_limit null dengan fallback ke batas default 5'
);

select * from finish();
rollback;
