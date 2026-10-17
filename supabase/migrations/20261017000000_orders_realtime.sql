-- Publikasi Realtime untuk tabel orders (docs/architecture.md §7 & Issue #12).
-- Dashboard pemilik subscribe postgres_changes pada tabel orders.
-- RLS pada tabel orders tetap membatasi akses hanya untuk is_owner().

alter publication supabase_realtime add table public.orders;

-- Set replica identity full agar event UPDATE menyertakan seluruh kolom pesanan.
alter table public.orders replica identity full;
