-- Skema, constraint, seed, dan RLS awal (docs/architecture.md §4 & §6).
begin;
create extension if not exists pgtap with schema extensions;

select plan(22);

-- ------------------------------------------------------------
-- Fixture (sebagai postgres): pemilik, user biasa, menu nonaktif, satu pesanan
-- ------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'pemilik@test.local'),
  ('00000000-0000-0000-0000-0000000000b2', 'bukan-pemilik@test.local');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000000a1');

insert into public.menu_items (category_id, name, price, is_active)
select id, 'Fixture Nonaktif', 1000, false from public.categories where name = 'Makanan';

insert into public.orders (
  public_token, order_date, daily_number, customer_name, order_type, payment_method,
  total, device_id, ip_hash, idempotency_key
) values (
  'tokenfixture0000000000001', current_date, 1, 'Budi', 'dine_in', 'cash',
  15000, 'device-fixture', 'hash-fixture', 'idem-fixture'
);

-- ------------------------------------------------------------
-- Skema & seed
-- ------------------------------------------------------------
select is(
  (select count(*) from pg_tables where schemaname = 'public' and not rowsecurity),
  0::bigint,
  'RLS aktif di semua tabel public'
);
select is((select count(*) from public.settings), 1::bigint, 'settings berisi tepat satu baris');
select is(
  (select whatsapp_number from public.settings),
  '62895806567230',
  'nomor WhatsApp toko sesuai menu-seed'
);
select is((select is_open from public.settings), false, 'toko tutup secara default');
select is(
  (select count(*) from public.menu_items where name <> 'Fixture Nonaktif'),
  11::bigint,
  'seed berisi 11 menu'
);
select is(
  (select m.price + o.price_delta
   from public.menu_items m
   join public.option_groups g on g.menu_item_id = m.id
   join public.options o on o.group_id = g.id
   where m.name = 'Mie' and o.name = 'Telur'),
  10000,
  'Mie + Telur = Rp10.000 seperti di banner'
);

-- ------------------------------------------------------------
-- Constraint
-- ------------------------------------------------------------
select throws_ok(
  $$insert into public.settings (id, store_name, whatsapp_number, dos_price) values (2, 'x', '62811111111', 0)$$,
  '23514', null, 'settings hanya boleh id = 1'
);
select throws_ok(
  $$insert into public.menu_items (category_id, name, price) select id, 'Minus', -1 from public.categories limit 1$$,
  '23514', null, 'harga menu tidak boleh negatif'
);
select throws_ok(
  $$insert into public.orders (public_token, order_date, daily_number, customer_name, order_type, payment_method,
      total, device_id, ip_hash, idempotency_key)
    values ('tokenfixture0000000000002', current_date, 1, 'Ani', 'takeaway', 'qris', 5000, 'd', 'h', 'idem-2')$$,
  '23505', null, 'nomor antrean unik per tanggal'
);
select throws_ok(
  $$update public.orders set payment_status = 'lunas' where idempotency_key = 'idem-fixture'$$,
  '23514', null, 'status lunas wajib disertai paid_at'
);
select throws_ok(
  $$insert into public.order_items (order_id, name, unit_price, quantity, subtotal)
    select id, 'Nasi Campur', 15000, 2, 15000 from public.orders where idempotency_key = 'idem-fixture'$$,
  '23514', null, 'subtotal harus unit_price x quantity'
);

-- ------------------------------------------------------------
-- Pelanggan anonim
-- ------------------------------------------------------------
set local role anon;

select is(
  (select count(*) from public.menu_items where name = 'Nasi Campur'),
  1::bigint,
  'anon bisa membaca menu aktif'
);
select is(
  (select count(*) from public.menu_items where name = 'Fixture Nonaktif'),
  0::bigint,
  'anon tidak bisa membaca menu nonaktif'
);
select throws_ok('select * from public.orders', '42501', null, 'anon tidak bisa membaca orders');
select throws_ok('select * from public.expenses', '42501', null, 'anon tidak bisa membaca expenses');
select throws_ok(
  $$insert into public.categories (name) values ('Iseng')$$,
  '42501', null, 'anon tidak bisa menambah kategori'
);

update public.settings set is_open = true;
reset role;
select is((select is_open from public.settings), false, 'anon tidak bisa membuka toko');

-- ------------------------------------------------------------
-- User login yang bukan pemilik
-- ------------------------------------------------------------
set local "request.jwt.claims" to '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';
set local role authenticated;

select is((select count(*) from public.orders), 0::bigint, 'bukan pemilik tidak melihat pesanan');
select throws_ok(
  $$insert into public.categories (name) values ('Iseng')$$,
  '42501', null, 'bukan pemilik tidak bisa menambah kategori'
);

-- ------------------------------------------------------------
-- Pemilik
-- ------------------------------------------------------------
reset role;
set local "request.jwt.claims" to '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
set local role authenticated;

select is((select count(*) from public.orders), 1::bigint, 'pemilik melihat pesanan');
select is(
  (select count(*) from public.menu_items where name = 'Fixture Nonaktif'),
  1::bigint,
  'pemilik melihat menu nonaktif'
);
update public.settings set is_open = true;
reset role;
select is((select is_open from public.settings), true, 'pemilik bisa membuka toko');

select * from finish();
rollback;
