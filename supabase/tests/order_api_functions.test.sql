-- Tes fungsi get_order & claim_paid (M2: Issue #7)
begin;
create extension if not exists pgtap with schema extensions;

select plan(15);

-- ------------------------------------------------------------
-- Fixture Data
-- ------------------------------------------------------------
insert into public.orders (
  id,
  public_token,
  order_date,
  daily_number,
  customer_name,
  customer_phone,
  order_type,
  payment_method,
  payment_status,
  status,
  total,
  device_id,
  ip_hash,
  idempotency_key,
  paid_at
) values
(
  '11111111-1111-1111-1111-111111111111'::uuid,
  'tokentestqris0000000000001',
  current_date,
  101,
  'Pelanggan QRIS',
  '081234567890',
  'dine_in',
  'qris',
  'belum_bayar',
  'baru',
  15000,
  'device-secret-1',
  'ip-secret-hash-1',
  'idem-qris-fixture',
  null
),
(
  '22222222-2222-2222-2222-222222222222'::uuid,
  'tokentestcash0000000000002',
  current_date,
  102,
  'Pelanggan Cash',
  '089876543210',
  'takeaway',
  'cash',
  'belum_bayar',
  'baru',
  20000,
  'device-secret-2',
  'ip-secret-hash-2',
  'idem-cash-fixture',
  null
),
(
  '33333333-3333-3333-3333-333333333333'::uuid,
  'tokentestlunas000000000003',
  current_date,
  103,
  'Pelanggan Lunas',
  '081112223334',
  'dine_in',
  'qris',
  'lunas',
  'dimasak',
  25000,
  'device-secret-3',
  'ip-secret-hash-3',
  'idem-lunas-fixture',
  now()
);

insert into public.order_items (
  order_id,
  name,
  unit_price,
  quantity,
  options,
  note,
  subtotal
) values (
  '11111111-1111-1111-1111-111111111111'::uuid,
  'Nasi Campur',
  15000,
  1,
  '[]'::jsonb,
  'Jangan terlalu asin',
  15000
);

-- ------------------------------------------------------------
-- 1. get_order(token)
-- ------------------------------------------------------------
select is(
  public.get_order('token-tidak-ada-999'),
  null,
  'get_order mengembalikan null jika token tidak ditemukan'
);

select is(
  public.get_order('tokentestqris0000000000001')->>'customer_name',
  'Pelanggan QRIS',
  'get_order mengembalikan customer_name yang benar'
);

select is(
  (public.get_order('tokentestqris0000000000001')->'items'->0->>'name'),
  'Nasi Campur',
  'get_order mengembalikan daftar item pesanan'
);

-- Verifikasi Privasi: tidak ada customer_phone, device_id, ip_hash
select is(
  public.get_order('tokentestqris0000000000001')->>'customer_phone',
  null,
  'get_order TIDAK PERNAH memuat customer_phone'
);

select is(
  public.get_order('tokentestqris0000000000001')->>'device_id',
  null,
  'get_order TIDAK PERNAH memuat device_id'
);

select is(
  public.get_order('tokentestqris0000000000001')->>'ip_hash',
  null,
  'get_order TIDAK PERNAH memuat ip_hash'
);

-- ------------------------------------------------------------
-- 2. claim_paid(token)
-- ------------------------------------------------------------
select is(
  public.claim_paid('token-tidak-ada-999'),
  null,
  'claim_paid mengembalikan null jika token tidak ditemukan'
);

-- QRIS belum_bayar -> berubah jadi menunggu_verifikasi
select is(
  public.claim_paid('tokentestqris0000000000001'),
  jsonb_build_object('success', true, 'payment_status', 'menunggu_verifikasi'),
  'claim_paid pada QRIS belum_bayar mengubah payment_status menjadi menunggu_verifikasi'
);

select is(
  (select payment_status from public.orders where public_token = 'tokentestqris0000000000001'),
  'menunggu_verifikasi',
  'database tersimpan dengan status menunggu_verifikasi'
);

-- Replay claim_paid saat sudah menunggu_verifikasi tidak merusak status
select is(
  public.claim_paid('tokentestqris0000000000001'),
  jsonb_build_object('success', true, 'payment_status', 'menunggu_verifikasi'),
  'claim_paid ulang tetap mengembalikan status menunggu_verifikasi'
);

-- Cash tidak boleh berubah jadi menunggu_verifikasi
select is(
  public.claim_paid('tokentestcash0000000000002'),
  jsonb_build_object('success', true, 'payment_status', 'belum_bayar'),
  'claim_paid pada pesanan cash tidak mengubah payment_status'
);

select is(
  (select payment_status from public.orders where public_token = 'tokentestcash0000000000002'),
  'belum_bayar',
  'database pesanan cash tetap belum_bayar'
);

-- Pesanan yang sudah lunas tidak boleh diubah
select is(
  public.claim_paid('tokentestlunas000000000003'),
  jsonb_build_object('success', true, 'payment_status', 'lunas'),
  'claim_paid pada pesanan yang sudah lunas tidak mengubah status lunas'
);

-- ------------------------------------------------------------
-- 3. Keamanan Hak Akses (RLS & Revoke)
-- ------------------------------------------------------------
set local role anon;
select throws_ok(
  $$select public.get_order('tokentestqris0000000000001')$$,
  '42501',
  null,
  'role anon tidak memiliki hak akses execute pada get_order'
);

select throws_ok(
  $$select public.claim_paid('tokentestqris0000000000001')$$,
  '42501',
  null,
  'role anon tidak memiliki hak akses execute pada claim_paid'
);

select * from finish();
rollback;
