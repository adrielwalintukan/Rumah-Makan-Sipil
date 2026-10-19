-- Tes pgTAP fungsi RPC save_menu_item_with_options (M4: Issue #18)
begin;
create extension if not exists pgtap with schema extensions;

select plan(30);

-- 1. Verifikasi fungsi ada
select has_function(
  'public',
  'save_menu_item_with_options',
  array['uuid', 'jsonb', 'jsonb'],
  'Fungsi save_menu_item_with_options harus ada'
);

-- ------------------------------------------------------------
-- Fixture Data: User Pemilik, User Biasa, Kategori, Menu Lain
-- ------------------------------------------------------------
create temp table _test_ctx as
select
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid as admin_id,
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid as stranger_id,
  gen_random_uuid() as cat_id,
  gen_random_uuid() as other_menu_id,
  gen_random_uuid() as other_group_id,
  gen_random_uuid() as other_option_id;

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

-- Buat menu lain untuk pengujian kepemilikan ID grup & opsi asing
insert into public.menu_items (id, category_id, name, price, sort_order)
select other_menu_id, cat_id, 'Menu Tetangga', 20000, 2 from _test_ctx;

insert into public.option_groups (id, menu_item_id, name, type, required, sort_order)
select other_group_id, other_menu_id, 'Grup Tetangga', 'single', false, 0 from _test_ctx;

insert into public.options (id, group_id, name, price_delta, sort_order)
select other_option_id, other_group_id, 'Opsi Tetangga', 1000, 0 from _test_ctx;

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
         g as (select id from public.option_groups where name = 'Suhu' and menu_item_id = (select id from m) limit 1),
         opt as (select o.id from public.options o join g on o.group_id = g.id where o.name = 'Dingin' limit 1)
    select public.save_menu_item_with_options(
      (select id from m),
      '{"name":"Kopi RPC Updated","price":16000}'::jsonb,
      jsonb_build_array(
        jsonb_build_object(
          'id', (select id from g),
          'name', 'Suhu Pilihan',
          'type', 'single',
          'required', true,
          'sort_order', 0,
          'options', jsonb_build_array(
            jsonb_build_object('id', (select id from opt), 'name', 'Dingin Banget', 'price_delta', 3000, 'is_available', false, 'sort_order', 0),
            jsonb_build_object('name', 'Hangat Sedang', 'price_delta', 1000, 'is_available', true, 'sort_order', 1)
          )
        )
      )
    )
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
    select public.save_menu_item_with_options(
      (select id from public.menu_items where name = 'Kopi RPC Updated' limit 1),
      '{"name":"Kopi Invalid"}'::jsonb,
      '[{"name":"Invalid Group","type":"single","required":false,"sort_order":0,"options":[{"name":"Bad","price_delta":-500,"is_available":true,"sort_order":0}]}]'::jsonb
    )
  $$),
  '22023',
  'Harga tambahan opsi tidak boleh negatif',
  'Transaksi harus gagal dan rollback jika price_delta negatif'
);

-- Verifikasi rollback: nama menu tetap Kopi RPC Updated
select results_eq(
  $$ select name from public.menu_items where name = 'Kopi RPC Updated' $$,
  $$ values ('Kopi RPC Updated'::text) $$,
  'Nama menu tidak berubah karena rollback berhasil'
);

-- Verifikasi rollback: grup Invalid Group tidak tersimpan ke database
select is_empty(
  $$ select 1 from public.option_groups where name = 'Invalid Group' $$,
  'Grup Invalid Group tidak tersimpan ke database karena rollback'
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

-- ------------------------------------------------------------
-- 13. Validasi Invariant SQL pada p_groups & options
-- ------------------------------------------------------------
-- Nama menu > 50 karakter ditolak
select throws_ok(
  format($$
    select public.save_menu_item_with_options(
      null,
      '{"category_id":"%s","name":"Menu Yang Namanya Sengaja Dibuat Terlalu Panjang Melebihi Batas Maksimal Lima Puluh Karakter","price":10000}'::jsonb,
      null
    )
  $$, (select cat_id from _test_ctx)),
  '22023',
  'Nama menu maksimal 50 karakter',
  'Nama menu lebih dari 50 karakter ditolak di SQL'
);

-- Nama grup kosong ditolak
select throws_ok(
  format($$
    select public.save_menu_item_with_options(
      (select id from public.menu_items where name = 'Kopi RPC Updated' limit 1),
      '{}'::jsonb,
      '[{"name":"","type":"single","options":[{"name":"Opsi 1"}]}]'::jsonb
    )
  $$),
  '22023',
  'Nama grup pilihan wajib diisi',
  'Nama grup pilihan kosong ditolak di SQL'
);

-- Nama grup > 50 karakter ditolak
select throws_ok(
  format($$
    select public.save_menu_item_with_options(
      (select id from public.menu_items where name = 'Kopi RPC Updated' limit 1),
      '{}'::jsonb,
      '[{"name":"Grup Pilihan Yang Namanya Sengaja Dibuat Terlalu Panjang Melebihi Batas","type":"single","options":[{"name":"Opsi 1"}]}]'::jsonb
    )
  $$),
  '22023',
  'Nama grup pilihan maksimal 50 karakter',
  'Nama grup pilihan lebih dari 50 karakter ditolak di SQL'
);

-- Duplikat nama grup case-insensitive ditolak
select throws_ok(
  format($$
    select public.save_menu_item_with_options(
      (select id from public.menu_items where name = 'Kopi RPC Updated' limit 1),
      '{}'::jsonb,
      '[
        {"name":"Level","type":"single","options":[{"name":"Sedang"}]},
        {"name":"level","type":"single","options":[{"name":"Pedas"}]}
      ]'::jsonb
    )
  $$),
  '22023',
  'Nama grup pilihan tidak boleh duplikat: level',
  'Duplikasi nama grup pilihan (case-insensitive) ditolak di SQL'
);

-- Tipe grup tidak valid ditolak
select throws_ok(
  format($$
    select public.save_menu_item_with_options(
      (select id from public.menu_items where name = 'Kopi RPC Updated' limit 1),
      '{}'::jsonb,
      '[{"name":"Varian","type":"invalid_type","options":[{"name":"Opsi 1"}]}]'::jsonb
    )
  $$),
  '22023',
  'Tipe grup pilihan harus single atau multiple',
  'Tipe grup selain single/multiple ditolak di SQL'
);

-- Grup tanpa opsi (options kosong) ditolak
select throws_ok(
  format($$
    select public.save_menu_item_with_options(
      (select id from public.menu_items where name = 'Kopi RPC Updated' limit 1),
      '{}'::jsonb,
      '[{"name":"Varian","type":"single","options":[]}]'::jsonb
    )
  $$),
  '22023',
  'Grup pilihan Varian harus memiliki minimal 1 opsi',
  'Grup tanpa opsi ditolak di SQL'
);

-- Nama opsi kosong ditolak
select throws_ok(
  format($$
    select public.save_menu_item_with_options(
      (select id from public.menu_items where name = 'Kopi RPC Updated' limit 1),
      '{}'::jsonb,
      '[{"name":"Varian","type":"single","options":[{"name":""}]}]'::jsonb
    )
  $$),
  '22023',
  'Nama opsi wajib diisi',
  'Nama opsi kosong ditolak di SQL'
);

-- Nama opsi > 50 karakter ditolak
select throws_ok(
  format($$
    select public.save_menu_item_with_options(
      (select id from public.menu_items where name = 'Kopi RPC Updated' limit 1),
      '{}'::jsonb,
      '[{"name":"Varian","type":"single","options":[{"name":"Nama Opsi Ini Sengaja Dibuat Panjang Sekali Lebih Dari Lima Puluh Karakter"}]}]'::jsonb
    )
  $$),
  '22023',
  'Nama opsi maksimal 50 karakter',
  'Nama opsi lebih dari 50 karakter ditolak di SQL'
);

-- Duplikat nama opsi dalam satu grup case-insensitive ditolak
select throws_ok(
  format($$
    select public.save_menu_item_with_options(
      (select id from public.menu_items where name = 'Kopi RPC Updated' limit 1),
      '{}'::jsonb,
      '[{"name":"Varian","type":"single","options":[{"name":"Manis"},{"name":"manis"}]}]'::jsonb
    )
  $$),
  '22023',
  'Nama opsi tidak boleh duplikat dalam satu grup: manis',
  'Duplikasi nama opsi dalam satu grup (case-insensitive) ditolak di SQL'
);

-- ------------------------------------------------------------
-- 14. Validasi p_groups (non-array, null, empty array)
-- ------------------------------------------------------------
-- p_groups bukan array ditolak
select throws_ok(
  format($$
    select public.save_menu_item_with_options(
      (select id from public.menu_items where name = 'Kopi RPC Updated' limit 1),
      '{"price":17000}'::jsonb,
      '{"bukan":"array"}'::jsonb
    )
  $$),
  '22023',
  'p_groups harus berupa array JSON',
  'p_groups berupa object/non-array ditolak eksplisit'
);

-- p_groups = null adalah no-op (tidak mengubah grup yang ada)
select lives_ok(
  format($$
    select public.save_menu_item_with_options(
      (select id from public.menu_items where name = 'Kopi RPC Updated' limit 1),
      '{"price":17500}'::jsonb,
      null
    )
  $$),
  'p_groups null berhasil dieksekusi tanpa error'
);

select results_eq(
  $$ select count(*)::integer from public.option_groups g join public.menu_items m on m.id = g.menu_item_id where m.name = 'Kopi RPC Updated' $$,
  $$ values (1::integer) $$,
  'Grup pilihan tidak terhapus jika p_groups null (no-op)'
);

-- p_groups = '[]'::jsonb menghapus semua grup pada menu
select lives_ok(
  format($$
    select public.save_menu_item_with_options(
      (select id from public.menu_items where name = 'Kopi RPC Updated' limit 1),
      '{}'::jsonb,
      '[]'::jsonb
    )
  $$),
  'p_groups array kosong berhasil dieksekusi untuk menghapus semua grup'
);

select results_eq(
  $$ select count(*)::integer from public.option_groups g join public.menu_items m on m.id = g.menu_item_id where m.name = 'Kopi RPC Updated' $$,
  $$ values (0::integer) $$,
  'Semua grup pilihan terhapus jika p_groups array kosong'
);

-- ------------------------------------------------------------
-- 15. Validasi Kepemilikan ID Grup dan Opsi Asing
-- ------------------------------------------------------------
-- Payload menyertakan ID grup dari menu lain ditolak P0002
select throws_ok(
  format($$
    select public.save_menu_item_with_options(
      (select id from public.menu_items where name = 'Kopi RPC Updated' limit 1),
      '{}'::jsonb,
      jsonb_build_array(
        jsonb_build_object(
          'id', (select other_group_id from _test_ctx),
          'name', 'Coba Ambil Grup Tetangga',
          'type', 'single',
          'options', jsonb_build_array(jsonb_build_object('name', 'Opsi 1'))
        )
      )
    )
  $$),
  'P0002',
  format('Grup pilihan dengan id %s tidak ditemukan pada menu ini', (select other_group_id from _test_ctx)),
  'ID grup dari menu lain ditolak dengan error P0002'
);

-- Payload menyertakan ID opsi dari grup lain ditolak P0002
select throws_ok(
  format($$
    select public.save_menu_item_with_options(
      (select other_menu_id from _test_ctx),
      '{}'::jsonb,
      jsonb_build_array(
        jsonb_build_object(
          'id', (select other_group_id from _test_ctx),
          'name', 'Grup Tetangga Asli',
          'type', 'single',
          'options', jsonb_build_array(
            jsonb_build_object('id', gen_random_uuid(), 'name', 'Opsi Asing Tak Dikenal')
          )
        )
      )
    )
  $$),
  'P0002',
  null,
  'ID opsi yang tidak ada pada grup target ditolak dengan error P0002'
);

select * from finish();
rollback;
