-- Pengujian pgTAP untuk publikasi Realtime tabel orders & RLS (Issue #12 & docs/architecture.md §7)
begin;
create extension if not exists pgtap with schema extensions;

select plan(5);

-- 1. Verifikasi orders terdaftar di publikasi supabase_realtime
select is(
  (select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'),
  1::bigint,
  'tabel orders terdaftar di publikasi supabase_realtime'
);

-- 2. Verifikasi replica identity orders adalah full ('f')
select is(
  (select relreplident from pg_class where relname = 'orders' and relnamespace = 'public'::regnamespace),
  'f'::"char",
  'replica identity tabel orders adalah full'
);

-- Fixture data user
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'owner-rt@test.local'),
  ('00000000-0000-0000-0000-0000000000f2', 'guest-rt@test.local');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000000f1');

insert into public.orders (
  public_token, order_date, daily_number, customer_name, order_type, payment_method,
  total, device_id, ip_hash, idempotency_key
) values (
  'tokenrealtimetest0000001', current_date, 999, 'Tester Realtime', 'dine_in', 'cash',
  20000, 'device-rt', 'hash-rt', 'idem-rt'
);

-- 3. Pelanggan anonim tidak bisa membaca orders (RLS tetap melindungi Realtime)
set local role anon;
select throws_ok('select * from public.orders', '42501', null, 'anon tidak bisa membaca orders');

-- 4. User login yang bukan pemilik tidak melihat orders
reset role;
set local "request.jwt.claims" to '{"sub":"00000000-0000-0000-0000-0000000000f2","role":"authenticated"}';
set local role authenticated;
select is((select count(*) from public.orders), 0::bigint, 'bukan pemilik tidak melihat pesanan via RLS');

-- 5. Pemilik resmi (is_owner) bisa membaca orders untuk realtime stream
reset role;
set local "request.jwt.claims" to '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';
set local role authenticated;
select is((select count(*) from public.orders where public_token = 'tokenrealtimetest0000001'), 1::bigint, 'pemilik dapat membaca pesanan untuk stream realtime');

select * from finish();
rollback;
