-- Skema awal Rumah Makan Sipil (docs/architecture.md §4 & §6).
-- Fungsi pesanan (create_order dkk.) menyusul di M2, storage di M4, publikasi realtime di M3.

-- ============================================================
-- Pemilik
-- ============================================================

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()))
$$;

revoke execute on function public.is_owner() from public;
grant execute on function public.is_owner() to anon, authenticated;

-- ============================================================
-- Menu
-- ============================================================

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 50),
  sort_order integer not null default 0
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 80),
  description text check (length(description) <= 200),
  price integer not null check (price >= 0),
  image_path text,
  is_available boolean not null default true,
  is_active boolean not null default true,
  sort_order integer not null default 0
);

create index menu_items_category_id_idx on public.menu_items (category_id);

create table public.option_groups (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references public.menu_items (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 50),
  type text not null check (type in ('single', 'multiple')),
  required boolean not null default false,
  sort_order integer not null default 0
);

create index option_groups_menu_item_id_idx on public.option_groups (menu_item_id);

create table public.options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.option_groups (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 50),
  price_delta integer not null default 0 check (price_delta >= 0),
  is_available boolean not null default true,
  sort_order integer not null default 0
);

create index options_group_id_idx on public.options (group_id);

-- ============================================================
-- Pesanan
-- ============================================================

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  public_token text not null unique check (length(public_token) >= 22),
  order_date date not null,
  daily_number integer not null check (daily_number > 0),
  customer_name text not null check (length(trim(customer_name)) between 2 and 30),
  customer_phone text check (customer_phone ~ '^(\+62|62|0)8[0-9]{7,12}$'),
  order_type text not null check (order_type in ('dine_in', 'takeaway')),
  payment_method text not null check (payment_method in ('qris', 'cash')),
  payment_status text not null default 'belum_bayar'
    check (payment_status in ('belum_bayar', 'menunggu_verifikasi', 'lunas')),
  status text not null default 'baru'
    check (status in ('baru', 'dimasak', 'siap', 'selesai', 'batal')),
  cancel_reason text check (length(cancel_reason) <= 200),
  total integer not null check (total >= 0),
  device_id text not null,
  ip_hash text not null,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  unique (order_date, daily_number),
  check ((payment_status = 'lunas') = (paid_at is not null))
);

create index orders_order_date_status_idx on public.orders (order_date desc, status);
create index orders_device_id_created_at_idx on public.orders (device_id, created_at);
create index orders_ip_hash_created_at_idx on public.orders (ip_hash, created_at);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  menu_item_id uuid references public.menu_items (id) on delete set null,
  name text not null,
  unit_price integer not null check (unit_price >= 0),
  quantity integer not null check (quantity between 1 and 20),
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  note text check (length(note) <= 100),
  subtotal integer not null check (subtotal = unit_price * quantity)
);

create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_menu_item_id_idx on public.order_items (menu_item_id);

-- Nomor antrean harian (WITA); dipakai create_order di M2.
create table public.daily_counters (
  day date primary key,
  last_number integer not null check (last_number > 0)
);

-- ============================================================
-- Keuangan & pengaturan
-- ============================================================

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null,
  description text not null check (length(trim(description)) between 1 and 100),
  amount integer not null check (amount > 0),
  category text not null check (category in ('bahan', 'operasional', 'lainnya')),
  created_at timestamptz not null default now()
);

create index expenses_expense_date_idx on public.expenses (expense_date);

create table public.settings (
  id integer primary key default 1 check (id = 1),
  is_open boolean not null default false,
  store_name text not null,
  tagline text,
  qris_image_path text,
  whatsapp_number text not null check (whatsapp_number ~ '^62[0-9]{8,13}$'),
  dos_price integer not null check (dos_price >= 0)
);

-- Baris tunggal wajib ada di semua lingkungan, jadi masuk migrasi (bukan seed).
insert into public.settings (id, is_open, store_name, tagline, whatsapp_number, dos_price)
values (1, false, 'Rumah Makan Sipil', 'Makan Enak, Setiap Hari', '62895806567230', 25000);

-- ============================================================
-- RLS (docs/architecture.md §6)
-- ============================================================

alter table public.admins enable row level security;
alter table public.categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.option_groups enable row level security;
alter table public.options enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.daily_counters enable row level security;
alter table public.expenses enable row level security;
alter table public.settings enable row level security;

-- Pelanggan tidak pernah menyentuh tabel ini langsung (AGENTS.md §8.2); pertahanan lapis kedua selain RLS.
revoke all on public.admins, public.orders, public.order_items, public.daily_counters, public.expenses
  from anon;

-- Menu: publik membaca yang aktif, pemilik mengelola semua.
create policy "publik baca kategori" on public.categories
  for select to anon, authenticated using (true);
create policy "pemilik kelola kategori" on public.categories
  for all to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));

create policy "publik baca menu aktif" on public.menu_items
  for select to anon, authenticated using (is_active or (select public.is_owner()));
create policy "pemilik kelola menu" on public.menu_items
  for all to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));

create policy "publik baca grup pilihan menu aktif" on public.option_groups
  for select to anon, authenticated using (
    (select public.is_owner())
    or exists (select 1 from public.menu_items m where m.id = menu_item_id and m.is_active)
  );
create policy "pemilik kelola grup pilihan" on public.option_groups
  for all to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));

create policy "publik baca opsi menu aktif" on public.options
  for select to anon, authenticated using (
    (select public.is_owner())
    or exists (
      select 1 from public.option_groups g join public.menu_items m on m.id = g.menu_item_id
      where g.id = group_id and m.is_active
    )
  );
create policy "pemilik kelola opsi" on public.options
  for all to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));

-- Pengaturan: semua kolom memang tampil ke pelanggan; hanya pemilik yang mengubah.
create policy "publik baca pengaturan" on public.settings
  for select to anon, authenticated using (true);
create policy "pemilik ubah pengaturan" on public.settings
  for update to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));

-- Data operasional: hanya pemilik.
create policy "pemilik kelola pesanan" on public.orders
  for all to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
create policy "pemilik kelola item pesanan" on public.order_items
  for all to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
create policy "pemilik kelola pengeluaran" on public.expenses
  for all to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
create policy "pemilik baca nomor harian" on public.daily_counters
  for select to authenticated using ((select public.is_owner()));
create policy "pemilik baca admins" on public.admins
  for select to authenticated using ((select public.is_owner()));
