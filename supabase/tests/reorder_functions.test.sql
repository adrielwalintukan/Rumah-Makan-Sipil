-- Tes pgTAP fungsi reorder_categories & reorder_menu_items (M4: Issue #16)
begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

-- ------------------------------------------------------------
-- Fixture Data: Admin & Kategori & Menu
-- ------------------------------------------------------------
insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'owner-reorder@warung.local'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'stranger-reorder@warung.local')
on conflict (id) do nothing;

insert into public.admins (user_id)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid)
on conflict do nothing;

insert into public.categories (id, name, sort_order)
values
  ('c1111111-1111-1111-1111-111111111111'::uuid, 'Kategori Reorder A', 1),
  ('c2222222-2222-2222-2222-222222222222'::uuid, 'Kategori Reorder B', 2);

insert into public.menu_items (id, category_id, name, price, sort_order, is_active)
values
  ('m1111111-1111-1111-1111-111111111111'::uuid, 'c1111111-1111-1111-1111-111111111111'::uuid, 'Menu Reorder A', 10000, 1, true),
  ('m2222222-2222-2222-2222-222222222222'::uuid, 'c1111111-1111-1111-1111-111111111111'::uuid, 'Menu Reorder B', 15000, 2, true),
  ('m3333333-3333-3333-3333-333333333333'::uuid, 'c1111111-1111-1111-1111-111111111111'::uuid, 'Menu Reorder Inactive', 20000, 3, false);

-- ------------------------------------------------------------
-- 1. Proteksi Hak Akses (Non-Pemilik Ditolak)
-- ------------------------------------------------------------
set local role authenticated;
set local "request.jwt.claims" = '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "authenticated"}';

select throws_ok(
  $$select public.reorder_categories('[{"id":"c1111111-1111-1111-1111-111111111111","sort_order":5}]'::jsonb)$$,
  '42501',
  null,
  'reorder_categories menolak eksekusi dari user non-pemilik'
);

select throws_ok(
  $$select public.reorder_menu_items('[{"id":"m1111111-1111-1111-1111-111111111111","sort_order":5}]'::jsonb)$$,
  '42501',
  null,
  'reorder_menu_items menolak eksekusi dari user non-pemilik'
);

-- ------------------------------------------------------------
-- 2. Eksekusi Berhasil oleh Pemilik
-- ------------------------------------------------------------
set local "request.jwt.claims" = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

select lives_ok(
  $$select public.reorder_categories('[{"id":"c1111111-1111-1111-1111-111111111111","sort_order":10},{"id":"c2222222-2222-2222-2222-222222222222","sort_order":20}]'::jsonb)$$,
  'reorder_categories berhasil dijalankan oleh pemilik'
);

select is(
  (select sort_order from public.categories where id = 'c1111111-1111-1111-1111-111111111111'::uuid),
  10,
  'sort_order kategori A terupdate menjadi 10'
);

-- ------------------------------------------------------------
-- 3. Bukti Atomisitas: Rollback Penuh saat Salah Satu Item Gagal
-- ------------------------------------------------------------
-- Coba update kategori A ke 99 bersamaan dengan ID fiktif
select throws_ok(
  $$select public.reorder_categories('[{"id":"c1111111-1111-1111-1111-111111111111","sort_order":99},{"id":"c9999999-9999-9999-9999-999999999999","sort_order":99}]'::jsonb)$$,
  'P0002',
  null,
  'reorder_categories melempar error P0002 ketika menemukan ID tidak ada'
);

select is(
  (select sort_order from public.categories where id = 'c1111111-1111-1111-1111-111111111111'::uuid),
  10,
  'sort_order kategori A tetap 10 (seluruh transaksi di-rollback secara atomik)'
);

-- ------------------------------------------------------------
-- 4. Reorder Menu & Bukti Atomisitas Menu
-- ------------------------------------------------------------
select lives_ok(
  $$select public.reorder_menu_items('[{"id":"m1111111-1111-1111-1111-111111111111","sort_order":10},{"id":"m2222222-2222-2222-2222-222222222222","sort_order":20}]'::jsonb)$$,
  'reorder_menu_items berhasil dijalankan oleh pemilik'
);

-- Coba update menu A ke 99 bersamaan dengan menu tidak aktif m3333333
select throws_ok(
  $$select public.reorder_menu_items('[{"id":"m1111111-1111-1111-1111-111111111111","sort_order":99},{"id":"m3333333-3333-3333-3333-333333333333","sort_order":99}]'::jsonb)$$,
  'P0002',
  null,
  'reorder_menu_items melempar P0002 jika ada menu yang tidak aktif / tidak ditemukan'
);

rollback;
