-- Tes pgTAP kolom menu_items.is_featured (menu unggulan di banner, Issue #63)
begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid, 'owner-featured@warung.local'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'::uuid, 'stranger-featured@warung.local')
on conflict (id) do nothing;

insert into public.admins (user_id)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid)
on conflict do nothing;

insert into public.categories (id, name, sort_order)
values ('11111111-1111-1111-1111-1111111111f1'::uuid, 'Kategori Unggulan', 1);

insert into public.menu_items (id, category_id, name, price, is_featured, is_active)
values
  ('33333333-3333-3333-3333-3333333333f1'::uuid, '11111111-1111-1111-1111-1111111111f1'::uuid, 'Menu Unggulan Uji', 12000, false, true),
  -- Menu terhapus lunak yang masih ber-flag unggulan tidak boleh sampai ke banner pelanggan
  ('33333333-3333-3333-3333-3333333333f2'::uuid, '11111111-1111-1111-1111-1111111111f1'::uuid, 'Menu Unggulan Nonaktif', 9000, true, false);

select col_not_null('public', 'menu_items', 'is_featured', 'is_featured wajib terisi');
select is(
  (select is_featured from public.menu_items where id = '33333333-3333-3333-3333-3333333333f1'::uuid),
  false,
  'menu baru default bukan unggulan'
);

-- Pelanggan anonim: boleh membaca flag, tidak boleh mengubahnya
set local role anon;
select is(
  (select is_featured from public.menu_items where id = '33333333-3333-3333-3333-3333333333f1'::uuid),
  false,
  'anon bisa membaca is_featured menu aktif'
);
select is(
  (select count(*) from public.menu_items where is_featured),
  0::bigint,
  'menu unggulan yang nonaktif tidak terlihat oleh anon (tidak dipromosikan di banner)'
);
update public.menu_items set is_featured = true where id = '33333333-3333-3333-3333-3333333333f1'::uuid;
reset role;
select is(
  (select is_featured from public.menu_items where id = '33333333-3333-3333-3333-3333333333f1'::uuid),
  false,
  'anon tidak bisa menjadikan menu unggulan'
);

-- User login bukan pemilik: tidak bisa mengubah
set local "request.jwt.claims" to '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1","role":"authenticated"}';
set local role authenticated;
update public.menu_items set is_featured = true where id = '33333333-3333-3333-3333-3333333333f1'::uuid;
reset role;
select is(
  (select is_featured from public.menu_items where id = '33333333-3333-3333-3333-3333333333f1'::uuid),
  false,
  'bukan pemilik tidak bisa menjadikan menu unggulan'
);

-- Pemilik: bisa mengubah
set local "request.jwt.claims" to '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1","role":"authenticated"}';
set local role authenticated;
update public.menu_items set is_featured = true where id = '33333333-3333-3333-3333-3333333333f1'::uuid;
reset role;
select is(
  (select is_featured from public.menu_items where id = '33333333-3333-3333-3333-3333333333f1'::uuid),
  true,
  'pemilik bisa menjadikan menu unggulan'
);

select * from finish();
rollback;
