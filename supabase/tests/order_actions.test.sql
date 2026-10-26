-- Tes state machine & fungsi admin_update_order (M3: Issue #13)
begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

-- ------------------------------------------------------------
-- Fixture Data: Admin & Pesanan
-- ------------------------------------------------------------
-- Buat user pemilik dan user non-pemilik
insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'owner-test@warung.local'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'stranger-test@warung.local');

insert into public.admins (user_id)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid);

-- Buat fixture pesanan
insert into public.orders (
  id,
  public_token,
  order_date,
  daily_number,
  customer_name,
  order_type,
  payment_method,
  payment_status,
  status,
  total,
  device_id,
  ip_hash,
  idempotency_key
) values
(
  '11111111-1111-1111-1111-111111111111'::uuid,
  'tokenaction0000000000001',
  current_date,
  1,
  'Pelanggan 1',
  'dine_in',
  'cash',
  'belum_bayar',
  'baru',
  25000,
  'device-1',
  'hash-1',
  'idem-act-1'
),
(
  '22222222-2222-2222-2222-222222222222'::uuid,
  'tokenaction0000000000002',
  current_date,
  2,
  'Pelanggan 2',
  'takeaway',
  'qris',
  'menunggu_verifikasi',
  'baru',
  35000,
  'device-2',
  'hash-2',
  'idem-act-2'
);

-- Set sesi sebagai pemilik
set local role authenticated;
set local "request.jwt.claims" = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

-- ------------------------------------------------------------
-- 1. Transisi Status Masak yang Sah
-- ------------------------------------------------------------
-- baru -> dimasak
select is(
  (select status from public.admin_update_order('11111111-1111-1111-1111-111111111111'::uuid, 'mulai_masak')),
  'dimasak',
  'admin_update_order mulai_masak mengubah status dari baru ke dimasak'
);

-- dimasak -> siap
select is(
  (select status from public.admin_update_order('11111111-1111-1111-1111-111111111111'::uuid, 'siap')),
  'siap',
  'admin_update_order siap mengubah status dari dimasak ke siap'
);

-- siap -> selesai
select is(
  (select status from public.admin_update_order('11111111-1111-1111-1111-111111111111'::uuid, 'selesai')),
  'selesai',
  'admin_update_order selesai mengubah status dari siap ke selesai'
);

-- ------------------------------------------------------------
-- 2. Transisi Status Masak yang Tidak Sah (Harus Ditolak)
-- ------------------------------------------------------------
-- Dari selesai tidak bisa diubah ke status lain lagi (terminal state)
select throws_ok(
  $$select public.admin_update_order('11111111-1111-1111-1111-111111111111'::uuid, 'mulai_masak')$$,
  '22023',
  null,
  'pesanan selesai tidak dapat diubah statusnya lagi'
);

-- Lompat status: buat pesanan baru untuk menguji lompatan tidak sah
insert into public.orders (
  id,
  public_token,
  order_date,
  daily_number,
  customer_name,
  order_type,
  payment_method,
  payment_status,
  status,
  total,
  device_id,
  ip_hash,
  idempotency_key
) values (
  '33333333-3333-3333-3333-333333333333'::uuid,
  'tokenaction0000000000003',
  current_date,
  3,
  'Pelanggan 3',
  'dine_in',
  'cash',
  'belum_bayar',
  'baru',
  10000,
  'device-3',
  'hash-3',
  'idem-act-3'
);

-- baru -> selesai (lompat 2 langkah) ditolak
select throws_ok(
  $$select public.admin_update_order('33333333-3333-3333-3333-333333333333'::uuid, 'selesai')$$,
  '22023',
  null,
  'lompat status dari baru ke selesai ditolak'
);

-- baru -> siap (lompat 1 langkah) ditolak
select throws_ok(
  $$select public.admin_update_order('33333333-3333-3333-3333-333333333333'::uuid, 'siap')$$,
  '22023',
  null,
  'lompat status dari baru ke siap ditolak'
);

-- ------------------------------------------------------------
-- 3. Pembatalan Pesanan (Batal)
-- ------------------------------------------------------------
-- baru -> batal dengan cancel_reason
select is(
  (select status from public.admin_update_order('33333333-3333-3333-3333-333333333333'::uuid, 'batal', 'Bahan habis')),
  'batal',
  'admin_update_order batal mengubah status ke batal'
);

select is(
  (select cancel_reason from public.orders where id = '33333333-3333-3333-3333-333333333333'::uuid),
  'Bahan habis',
  'alasan pembatalan tersimpan di kolom cancel_reason'
);

-- Dari batal tidak dapat diubah ke status lain lagi
select throws_ok(
  $$select public.admin_update_order('33333333-3333-3333-3333-333333333333'::uuid, 'mulai_masak')$$,
  '22023',
  null,
  'pesanan batal tidak dapat diubah statusnya lagi'
);

-- ------------------------------------------------------------
-- 4. Transisi Status Pembayaran
-- ------------------------------------------------------------
-- belum_bayar -> lunas (mengisi paid_at)
select is(
  (select payment_status from public.admin_update_order('11111111-1111-1111-1111-111111111111'::uuid, 'tandai_lunas')),
  'lunas',
  'admin_update_order tandai_lunas mengubah payment_status menjadi lunas'
);

select ok(
  (select paid_at is not null from public.orders where id = '11111111-1111-1111-1111-111111111111'::uuid),
  'kolom paid_at terisi otomatis saat status menjadi lunas'
);

-- lunas tidak dapat diubah kembali ke belum_bayar
select throws_ok(
  $$select public.admin_update_order('11111111-1111-1111-1111-111111111111'::uuid, 'pembayaran_belum_masuk')$$,
  '22023',
  null,
  'status lunas tidak dapat diubah kembali'
);

-- menunggu_verifikasi -> pembayaran_belum_masuk (kembali ke belum_bayar)
select is(
  (select payment_status from public.admin_update_order('22222222-2222-2222-2222-222222222222'::uuid, 'pembayaran_belum_masuk')),
  'belum_bayar',
  'admin_update_order pembayaran_belum_masuk mengubah payment_status kembali ke belum_bayar'
);

-- ------------------------------------------------------------
-- 5. Hak Akses & Keamanan
-- ------------------------------------------------------------
-- Role anon ditolak execute
set local role anon;
select throws_ok(
  $$select public.admin_update_order('22222222-2222-2222-2222-222222222222'::uuid, 'mulai_masak')$$,
  '42501',
  null,
  'role anon tidak memiliki hak akses execute pada admin_update_order'
);

-- Authenticated user yang BUKAN pemilik ditolak (42501)
set local role authenticated;
set local "request.jwt.claims" = '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "authenticated"}';

select throws_ok(
  $$select public.admin_update_order('22222222-2222-2222-2222-222222222222'::uuid, 'mulai_masak')$$,
  '42501',
  null,
  'user yang bukan pemilik ditolak mengeksekusi admin_update_order'
);

-- Aksi tidak sah (invalid action string) oleh pemilik
set local "request.jwt.claims" = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

select throws_ok(
  $$select public.admin_update_order('22222222-2222-2222-2222-222222222222'::uuid, 'aksi_ngawur')$$,
  '22023',
  null,
  'aksi yang tidak terdaftar ditolak dengan kode 22023'
);

select * from finish();
rollback;
