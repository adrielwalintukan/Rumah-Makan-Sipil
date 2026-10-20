-- Migrasi Supabase Storage: Bucket store dan Kebijakan RLS (Issue #19)

-- 1. Buat atau perbarui konfigurasi bucket store
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'store',
  'store',
  true,
  5242880, -- 5 MB (5 * 1024 * 1024)
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 2. Kebijakan RLS storage.objects untuk bucket store

-- Baca publik untuk anon dan authenticated
drop policy if exists "store_public_read" on storage.objects;
create policy "store_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'store');

-- Pemilik toko dapat mengunggah file
drop policy if exists "store_owner_insert" on storage.objects;
create policy "store_owner_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'store'
    and (select public.is_owner())
  );

-- Pemilik toko dapat memperbarui file
drop policy if exists "store_owner_update" on storage.objects;
create policy "store_owner_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'store'
    and (select public.is_owner())
  )
  with check (
    bucket_id = 'store'
    and (select public.is_owner())
  );

-- Pemilik toko dapat menghapus file
drop policy if exists "store_owner_delete" on storage.objects;
create policy "store_owner_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'store'
    and (select public.is_owner())
  );
