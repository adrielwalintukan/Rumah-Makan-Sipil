-- Tes Supabase Storage store & Kebijakan RLS (Issue #19)
begin;
create extension if not exists pgtap with schema extensions;

select plan(15);

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
values ('store', 'fixture-publik.webp', '00000000-0000-0000-0000-0000000000a1');

-- ------------------------------------------------------------
-- 1. Verifikasi Konfigurasi Bucket
-- ------------------------------------------------------------
-- Bucket store ada dan publik
select is(
  (select count(*) from storage.buckets where id = 'store' and public = true),
  1::bigint,
  'bucket store ada dan berstatus publik'
);

-- Batas ukuran file 5 MB
select is(
  (select file_size_limit from storage.buckets where id = 'store'),
  5242880::bigint,
  'batas ukuran file bucket adalah 5 MB'
);

-- Allowed mime types sesuai spek (jpeg, png, webp)
select is(
  (select allowed_mime_types from storage.buckets where id = 'store'),
  array['image/jpeg', 'image/png', 'image/webp']::text[],
  'allowed mime types bucket mencakup jpeg, png, webp'
);

-- ------------------------------------------------------------
-- 2. Hak Akses Anonymous
-- ------------------------------------------------------------
set local role anon;
set local "request.jwt.claims" to '{"role":"anon"}';
set local "request.jwt.claim.sub" to '';

-- Anonymous dapat membaca objek di store (memastikan membaca fixture)
select is(
  (select count(*) from storage.objects where bucket_id = 'store' and name = 'fixture-publik.webp'),
  1::bigint,
  'anon dapat membaca objek di store'
);

-- Anonymous tidak dapat upload ke store (42501)
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner) values ('store', 'tes-anon.webp', null)$$,
  '42501',
  null,
  'anon ditolak saat upload ke store'
);

-- Anonymous tidak dapat memperbarui objek di store
update storage.objects set metadata = '{"anon": true}'::jsonb where bucket_id = 'store' and name = 'fixture-publik.webp';
select is(
  (select metadata from storage.objects where bucket_id = 'store' and name = 'fixture-publik.webp'),
  null,
  'anon tidak dapat memperbarui objek di store'
);

-- Anonymous tidak dapat menghapus objek di store
delete from storage.objects where bucket_id = 'store' and name = 'fixture-publik.webp';
select is(
  (select count(*) from storage.objects where bucket_id = 'store' and name = 'fixture-publik.webp'),
  1::bigint,
  'anon tidak dapat menghapus objek di store'
);

-- ------------------------------------------------------------
-- 3. Hak Akses Authenticated Bukan Pemilik
-- ------------------------------------------------------------
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "00000000-0000-0000-0000-0000000000b2", "role": "authenticated"}';
set local "request.jwt.claim.sub" to '00000000-0000-0000-0000-0000000000b2';

-- User authenticated bukan pemilik ditolak saat upload ke store (42501)
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner) values ('store', 'tes-bukan-pemilik.webp', '00000000-0000-0000-0000-0000000000b2')$$,
  '42501',
  null,
  'user authenticated bukan pemilik ditolak saat upload ke store'
);

-- User authenticated bukan pemilik tidak dapat memperbarui objek di store
update storage.objects set metadata = '{"bukan_pemilik": true}'::jsonb where bucket_id = 'store' and name = 'fixture-publik.webp';
select is(
  (select metadata from storage.objects where bucket_id = 'store' and name = 'fixture-publik.webp'),
  null,
  'user authenticated bukan pemilik tidak dapat memperbarui objek di store'
);

-- User authenticated bukan pemilik tidak dapat menghapus objek di store
delete from storage.objects where bucket_id = 'store' and name = 'fixture-publik.webp';
select is(
  (select count(*) from storage.objects where bucket_id = 'store' and name = 'fixture-publik.webp'),
  1::bigint,
  'user authenticated bukan pemilik tidak dapat menghapus objek di store'
);

-- ------------------------------------------------------------
-- 4. Hak Akses Pemilik Toko
-- ------------------------------------------------------------
set local "request.jwt.claims" to '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
set local "request.jwt.claim.sub" to '00000000-0000-0000-0000-0000000000a1';

-- Pemilik dapat upload ke store
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner) values ('store', 'tes-pemilik.webp', '00000000-0000-0000-0000-0000000000a1')$$,
  'pemilik dapat upload objek ke store'
);

-- Pemilik dapat memperbarui objek di store
select lives_ok(
  $$update storage.objects set metadata = '{"size": 1024}'::jsonb where bucket_id = 'store' and name = 'tes-pemilik.webp'$$,
  'pemilik dapat memperbarui objek di store'
);

-- Pemilik dapat menghapus objek di store
select lives_ok(
  $$delete from storage.objects where bucket_id = 'store' and name = 'tes-pemilik.webp'$$,
  'pemilik dapat menghapus objek di store'
);

-- Kebijakan delete pemilik terpasang di pg_policies
select ok(
  exists(
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'store_owner_delete'
      and cmd = 'DELETE'
  ),
  'kebijakan store_owner_delete terpasang pada storage.objects'
);

-- Kebijakan delete pemilik memeriksa public.is_owner()
select ok(
  exists(
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'store_owner_delete'
      and qual like '%is_owner%'
  ),
  'kebijakan store_owner_delete memeriksa fungsi is_owner'
);

select * from finish();
rollback;
