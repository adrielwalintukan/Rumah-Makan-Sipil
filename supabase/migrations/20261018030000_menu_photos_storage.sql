-- Migrasi Supabase Storage: Bucket menu-photos dan Kebijakan RLS (Issue #17)

-- 1. Buat atau perbarui konfigurasi bucket menu-photos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'menu-photos',
  'menu-photos',
  true,
  5242880, -- 5 MB (5 * 1024 * 1024)
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 2. Kebijakan RLS storage.objects untuk bucket menu-photos

-- Baca publik untuk anon dan authenticated
drop policy if exists "menu_photos_public_read" on storage.objects;
create policy "menu_photos_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'menu-photos');

-- Pemilik toko dapat mengunggah foto
drop policy if exists "menu_photos_owner_insert" on storage.objects;
create policy "menu_photos_owner_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'menu-photos'
    and (select public.is_owner())
  );

-- Pemilik toko dapat memperbarui foto
drop policy if exists "menu_photos_owner_update" on storage.objects;
create policy "menu_photos_owner_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'menu-photos'
    and (select public.is_owner())
  )
  with check (
    bucket_id = 'menu-photos'
    and (select public.is_owner())
  );

-- Pemilik toko dapat menghapus foto
drop policy if exists "menu_photos_owner_delete" on storage.objects;
create policy "menu_photos_owner_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'menu-photos'
    and (select public.is_owner())
  );
