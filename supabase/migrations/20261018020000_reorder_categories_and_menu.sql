-- Migrasi fungsi RPC reorder kategori & menu secara atomik (M4: Issue #16)
-- docs/PRD.md D6, US-13; docs/architecture.md §5.4

-- ------------------------------------------------------------
-- 1. reorder_categories(p_items jsonb)
-- Memperbarui sort_order kategori secara atomik dalam satu transaksi.
-- ------------------------------------------------------------
create or replace function public.reorder_categories(p_items jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_id uuid;
  v_sort_order integer;
begin
  -- Hanya akun pemilik resmi yang berhak mengatur urutan (AGENTS.md §8.2, docs/architecture.md §6)
  if not public.is_owner() then
    raise exception 'FORBIDDEN: Hanya akun pemilik yang memiliki hak akses'
      using errcode = '42501';
  end if;

  if p_items is null or jsonb_typeof(p_items) != 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'INVALID_INPUT: Daftar urutan tidak boleh kosong'
      using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_id := (v_item->>'id')::uuid;
    v_sort_order := (v_item->>'sort_order')::integer;

    if v_sort_order < 0 then
      raise exception 'INVALID_SORT_ORDER: sort_order tidak boleh negatif'
        using errcode = '22023';
    end if;

    update public.categories
    set sort_order = v_sort_order
    where id = v_id;

    if not found then
      raise exception 'CATEGORY_NOT_FOUND: Kategori dengan ID % tidak ditemukan', v_id
        using errcode = 'P0002';
    end if;
  end loop;
end;
$$;

revoke all on function public.reorder_categories(jsonb) from public, anon;
grant execute on function public.reorder_categories(jsonb) to authenticated;

-- ------------------------------------------------------------
-- 2. reorder_menu_items(p_items jsonb)
-- Memperbarui sort_order menu aktif secara atomik dalam satu transaksi.
-- ------------------------------------------------------------
create or replace function public.reorder_menu_items(p_items jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_id uuid;
  v_sort_order integer;
begin
  -- Hanya akun pemilik resmi yang berhak mengatur urutan (AGENTS.md §8.2, docs/architecture.md §6)
  if not public.is_owner() then
    raise exception 'FORBIDDEN: Hanya akun pemilik yang memiliki hak akses'
      using errcode = '42501';
  end if;

  if p_items is null or jsonb_typeof(p_items) != 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'INVALID_INPUT: Daftar urutan tidak boleh kosong'
      using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_id := (v_item->>'id')::uuid;
    v_sort_order := (v_item->>'sort_order')::integer;

    if v_sort_order < 0 then
      raise exception 'INVALID_SORT_ORDER: sort_order tidak boleh negatif'
        using errcode = '22023';
    end if;

    update public.menu_items
    set sort_order = v_sort_order
    where id = v_id and is_active = true;

    if not found then
      raise exception 'MENU_ITEM_NOT_FOUND: Menu dengan ID % tidak ditemukan atau tidak aktif', v_id
        using errcode = 'P0002';
    end if;
  end loop;
end;
$$;

revoke all on function public.reorder_menu_items(jsonb) from public, anon;
grant execute on function public.reorder_menu_items(jsonb) to authenticated;
