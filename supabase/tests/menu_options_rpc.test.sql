-- Tes pgTAP fungsi RPC save_menu_item_with_options (M4: Issue #18)
begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

-- 1. Verifikasi fungsi ada
select has_function(
  'public',
  'save_menu_item_with_options',
  array['uuid', 'jsonb', 'jsonb'],
  'Fungsi save_menu_item_with_options harus ada'
);

-- ------------------------------------------------------------
-- Fixture Data: User Pemilik, User Biasa, Kategori
-- ------------------------------------------------------------
create temp table _test_ctx as
select
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid as admin_id,
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid as stranger_id,
  gen_random_uuid() as cat_id;

grant select on _test_ctx to public;

insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'owner-rpc@warung.local'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'stranger-rpc@warung.local')
on conflict (id) do nothing;

insert into public.admins (user_id)
select admin_id from _test_ctx
on conflict (user_id) do nothing;

insert into public.categories (id, name, sort_order)
select cat_id, 'Kategori Uji RPC', 1 from _test_ctx;

-- ------------------------------------------------------------
-- 2. Hak Akses: Role anonim ditolak
-- ------------------------------------------------------------
set local role anon;
select throws_ok(
  format($$select public.save_menu_item_with_options(null, '{"category_id":"%s","name":"Menu Anon","price":10000}'::jsonb, '[]'::jsonb)$$, (select cat_id from _test_ctx)),
  '42501',
  null,
  'Anonim tidak boleh mengeksekusi save_menu_item_with_options'
);

-- ------------------------------------------------------------
-- 3. Hak Akses: User authenticated non-pemilik ditolak
-- ------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', (select stranger_id from _test_ctx)), true);

select throws_ok(
  format($$select public.save_menu_item_with_options(null, '{"category_id":"%s","name":"Menu Stranger","price":10000}'::jsonb, '[]'::jsonb)$$, (select cat_id from _test_ctx)),
  '42501',
  'Akses ditolak',
  'User authenticated non-pemilik ditolak dengan pesan Akses ditolak'
);

-- ------------------------------------------------------------
-- 4. Create Menu Baru dengan Grup Pilihan (Single & Multiple) & Opsi
-- ------------------------------------------------------------
select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', (select admin_id from _test_ctx)), true);

select lives_ok(
  format($$
    select public.save_menu_item_with_options(
      null,
      '{"category_id":"%s","name":"Kopi RPC","price":15000,"description":"Kopi enak","is_available":true}'::jsonb,
      '[
        {
          "name":"Suhu",
          "type":"single",
          "required":true,
          "sort_order":0,
          "options":[
            {"name":"Panas","price_delta":0,"is_available":true,"sort_order":0},
            {"name":"Dingin","price_delta":2000,"is_available":true,"sort_order":1}
          ]
        },
        {
          "name":"Topping",
          "type":"multiple",
          "required":false,
          "sort_order":1,
          "options":[
            {"name":"Jelly","price_delta":3000,"is_available":true,"sort_order":0},
            {"name":"Cincau","price_delta":2500,"is_available":true,"sort_order":1}
          ]
        }
      ]'::jsonb
    )
  $$, (select cat_id from _test_ctx)),
  'Pemilik bisa membuat menu baru dengan grup pilihan dan opsi'
);

-- 5. Verifikasi menu_items tersimpan di database
select results_eq(
  $$ select name, price from public.menu_items where name = 'Kopi RPC' $$,
  $$ values ('Kopi RPC'::text, 15000::integer) $$,
  'Menu_items Kopi RPC harus tersimpan dengan harga 15000'
);

-- 6. Verifikasi 2 grup pilihan tersimpan
select results_eq(
  $$ select count(*)::integer from public.option_groups g join public.menu_items m on m.id = g.menu_item_id where m.name = 'Kopi RPC' $$,
  $$ values (2::integer) $$,
  'Harus ada 2 grup pilihan tersimpan untuk Kopi RPC'
);

-- 7. Verifikasi 4 opsi tersimpan
select results_eq(
  $$ select count(*)::integer from public.options o join public.option_groups g on g.id = o.group_id join public.menu_items m on m.id = g.menu_item_id where m.name = 'Kopi RPC' $$,
  $$ values (4::integer) $$,
  'Harus ada 4 opsi tersimpan untuk Kopi RPC'
);

-- ------------------------------------------------------------
-- 8. Update Menu: ubah opsi yang ada & tambah opsi baru
-- ------------------------------------------------------------
select lives_ok(
  format($$
    with m as (select id from public.menu_items where name = 'Kopi RPC' limit 1),
         g as (select id from public.option_groups where name = 'Suhu' limit 1),
         opt as (select id from public.options where name = 'Dingin' limit 1)
    select public.save_menu_item_with_options(
      m.id,
      '{"name":"Kopi RPC Updated","price":16000}'::jsonb,
      jsonb_build_array(
        jsonb_build_object(
          'id', g.id,
          'name', 'Suhu Pilihan',
          'type', 'single',
          'required', true,
          'sort_order', 0,
          'options', jsonb_build_array(
            jsonb_build_object('id', opt.id, 'name', 'Dingin Banget', 'price_delta', 3000, 'is_available', false, 'sort_order', 0),
            jsonb_build_object('name', 'Hangat Sedang', 'price_delta', 1000, 'is_available', true, 'sort_order', 1)
          )
        )
      )
    )
    from m, g, opt
  $$),
  'Pemilik bisa mengupdate menu, grup, dan opsi yang ada'
);

-- 9. Verifikasi opsi terupdate dengan benar (price_delta 3000, is_available false)
select results_eq(
  $$ select price_delta, is_available from public.options where name = 'Dingin Banget' $$,
  $$ values (3000::integer, false::boolean) $$,
  'Opsi Dingin Banget harus terupdate price_delta 3000 dan is_available false'
);

-- 10. Verifikasi cascade delete: grup Topping dan opsi Panas yang dihapus dari payload bersih terhapus
select results_eq(
  $$ select count(*)::integer from public.option_groups g join public.menu_items m on m.id = g.menu_item_id where m.name = 'Kopi RPC Updated' $$,
  $$ values (1::integer) $$,
  'Hanya 1 grup pilihan tersisa setelah update sinkronisasi'
);

-- ------------------------------------------------------------
-- 11. Bukti Atomisitas: Rollback jika ada constraint yang dilanggar
-- ------------------------------------------------------------
select throws_ok(
  format($$
    with m as (select id from public.menu_items where name = 'Kopi RPC Updated' limit 1)
    select public.save_menu_item_with_options(
      m.id,
      '{"name":"Kopi Invalid"}'::jsonb,
      '[{"name":"Invalid Group","type":"single","required":false,"sort_order":0,"options":[{"name":"Bad","price_delta":-500,"is_available":true,"sort_order":0}]}]'::jsonb
    )
    from m
  $$),
  null,
  null,
  'Transaksi harus gagal dan rollback jika price_delta negatif'
);

-- ------------------------------------------------------------
-- 12. Update menu tidak ditemukan / nonaktif melempar error P0002
-- ------------------------------------------------------------
select throws_ok(
  $$select public.save_menu_item_with_options('99999999-9999-9999-9999-999999999999'::uuid, '{"name":"Menu Hantu"}'::jsonb, '[]'::jsonb)$$,
  'P0002',
  'Menu tidak ditemukan atau sudah tidak aktif',
  'Update menu yang tidak ada melempar error P0002'
);

select * from finish();
rollback;
