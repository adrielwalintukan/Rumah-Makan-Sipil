-- Menu unggulan: pemilik memilih menu yang tampil sebagai banner di halaman pelanggan (Issue #63).
-- RLS tidak berubah: publik membaca menu aktif, hanya pemilik yang boleh mengubah (policy menu_items yang ada).
alter table public.menu_items
  add column is_featured boolean not null default false;
