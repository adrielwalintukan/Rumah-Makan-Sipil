-- Tes Supabase Storage menu-photos & Kebijakan RLS (Issue #17)
begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

-- ------------------------------------------------------------
-- Fixture Data: Akun Pemilik dan Akun Bukan Pemilik
-- ------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'pemilik-storage@test.local'),
  ('00000000-0000-0000-0000-0000000000b2', 'bukan-pemilik-storage@test.local')
on conflict (id) do nothing;

insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000000a1')
on conflict (user_id) do nothing;

-- Objek fixture awal (disisipkan dalam konteks postgres tanpa bypass)
insert into storage.objects (bucket_id, name, owner)
values ('menu-photos', 'fixture-publik.webp', '00000000-0000-0000-0000-0000000000a1');

-- ------------------------------------------------------------
-- 1. Verifikasi Konfigurasi Bucket
-- ------------------------------------------------------------
-- Bucket menu-photos ada dan publik
select is(
  (select count(*) from storage.buckets where id = 'menu-photos' and public = true),
  1::bigint,
  'bucket menu-photos ada dan berstatus publik'
);

-- Batas ukuran file 5 MB
select is(
  (select file_size_limit from storage.buckets where id = 'menu-photos'),
  5242880::bigint,
  'batas ukuran file bucket adalah 5 MB'
);

-- Allowed mime types sesuai spek (jpeg, png, webp)
select is(
  (select allowed_mime_types from storage.buckets where id = 'menu-photos'),
  array['image/jpeg', 'image/png', 'image/webp']::text[],
  'allowed mime types bucket mencakup jpeg, png, webp'
);

-- ------------------------------------------------------------
-- 2. Hak Akses Anonymous
-- ------------------------------------------------------------
set local role anon;
set local "request.jwt.claims" to '{"role":"anon"}';
set local "request.jwt.claim.sub" to '';

-- Anonymous dapat membaca objek di menu-photos (memastikan membaca fixture)
select is(
  (select count(*) from storage.objects where bucket_id = 'menu-photos' and name = 'fixture-publik.webp'),
  1::bigint,
  'anon dapat membaca objek di menu-photos'
);

-- Anonymous tidak dapat upload ke menu-photos (42501)
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner) values ('menu-photos', 'tes-anon.webp', null)$$,
  '42501',
  null,
  'anon ditolak saat upload ke menu-photos'
);

-- ------------------------------------------------------------
-- 3. Hak Akses Authenticated Bukan Pemilik
-- ------------------------------------------------------------
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "00000000-0000-0000-0000-0000000000b2", "role": "authenticated"}';
set local "request.jwt.claim.sub" to '00000000-0000-0000-0000-0000000000b2';

-- User authenticated bukan pemilik ditolak saat upload ke menu-photos (42501)
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner) values ('menu-photos', 'tes-bukan-pemilik.webp', '00000000-0000-0000-0000-0000000000b2')$$,
  '42501',
  null,
  'user authenticated bukan pemilik ditolak saat upload ke menu-photos'
);

-- ------------------------------------------------------------
-- 4. Hak Akses Pemilik Toko
-- ------------------------------------------------------------
set local "request.jwt.claims" to '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
set local "request.jwt.claim.sub" to '00000000-0000-0000-0000-0000000000a1';

-- Pemilik dapat upload ke menu-photos
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner) values ('menu-photos', 'tes-pemilik.webp', '00000000-0000-0000-0000-0000000000a1')$$,
  'pemilik dapat upload objek ke menu-photos'
);

-- Pemilik dapat memperbarui objek di menu-photos
select lives_ok(
  $$update storage.objects set metadata = '{"size": 1024}'::jsonb where bucket_id = 'menu-photos' and name = 'tes-pemilik.webp'$$,
  'pemilik dapat memperbarui objek di menu-photos'
);

-- Kebijakan delete pemilik terpasang di pg_policies
select ok(
  exists(
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'menu_photos_owner_delete'
      and cmd = 'DELETE'
  ),
  'kebijakan menu_photos_owner_delete terpasang pada storage.objects'
);

-- Kebijakan delete pemilik memeriksa public.is_owner()
select ok(
  exists(
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'menu_photos_owner_delete'
      and qual like '%is_owner%'
  ),
  'kebijakan menu_photos_owner_delete memeriksa fungsi is_owner'
);

select * from finish();
rollback;
