-- Migrasi: Fungsi RPC atomik untuk simpan menu beserta grup pilihan dan opsinya (M4: Issue #18)
-- docs/PRD.md D6, US-13; docs/architecture.md §4–6

create or replace function public.save_menu_item_with_options(
  p_menu_id uuid,
  p_item jsonb,
  p_groups jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_menu_id uuid;
  v_category_id uuid;
  v_name text;
  v_description text;
  v_price integer;
  v_image_path text;
  v_is_available boolean;
  v_sort_order integer;
  v_max_sort integer;

  v_group_elem jsonb;
  v_group_id uuid;
  v_group_ids_kept uuid[] := array[]::uuid[];

  v_option_elem jsonb;
  v_option_id uuid;
  v_option_ids_kept uuid[] := array[]::uuid[];

  v_result jsonb;
begin
  -- 1. Validasi hak akses pemilik (AGENTS.md §8.2, docs/architecture.md §6)
  if not (select public.is_owner()) then
    raise exception 'Akses ditolak'
      using errcode = '42501';
  end if;

  -- 2. CREATE atau UPDATE menu_items
  if p_menu_id is null then
    -- CREATE MODE
    v_category_id := (p_item->>'category_id')::uuid;
    if v_category_id is null then
      raise exception 'category_id wajib diisi'
        using errcode = '22023';
    end if;

    v_name := trim(p_item->>'name');
    if v_name is null or length(v_name) = 0 then
      raise exception 'Nama menu wajib diisi'
        using errcode = '22023';
    end if;

    v_price := (p_item->>'price')::integer;
    if v_price is null or v_price < 0 then
      raise exception 'Harga tidak valid'
        using errcode = '22023';
    end if;

    v_description := nullif(trim(p_item->>'description'), '');
    v_image_path := nullif(trim(p_item->>'image_path'), '');
    v_is_available := coalesce((p_item->>'is_available')::boolean, true);

    if p_item ? 'sort_order' and p_item->>'sort_order' is not null and trim(p_item->>'sort_order') != '' and (p_item->>'sort_order')::integer >= 0 then
      v_sort_order := (p_item->>'sort_order')::integer;
    else
      select coalesce(max(sort_order), -1) + 1
      into v_max_sort
      from public.menu_items
      where category_id = v_category_id and is_active = true;

      v_sort_order := v_max_sort;
    end if;

    insert into public.menu_items (
      category_id,
      name,
      description,
      price,
      image_path,
      is_available,
      is_active,
      sort_order
    )
    values (
      v_category_id,
      v_name,
      v_description,
      v_price,
      v_image_path,
      v_is_available,
      true,
      v_sort_order
    )
    returning id into v_menu_id;

  else
    -- UPDATE MODE
    v_menu_id := p_menu_id;

    -- Update hanya field yang disertakan
    update public.menu_items
    set
      category_id = coalesce((p_item->>'category_id')::uuid, category_id),
      name = coalesce(nullif(trim(p_item->>'name'), ''), name),
      description = case when p_item ? 'description' then nullif(trim(p_item->>'description'), '') else description end,
      price = coalesce((p_item->>'price')::integer, price),
      image_path = case when p_item ? 'image_path' then nullif(trim(p_item->>'image_path'), '') else image_path end,
      is_available = coalesce((p_item->>'is_available')::boolean, is_available),
      sort_order = coalesce((p_item->>'sort_order')::integer, sort_order)
    where id = v_menu_id and is_active = true;

    if not found then
      raise exception 'Menu tidak ditemukan atau sudah tidak aktif'
        using errcode = 'P0002';
    end if;
  end if;

  -- 3. Sinkronisasi option_groups jika p_groups disertakan
  if p_groups is not null and jsonb_typeof(p_groups) = 'array' then
    for v_group_elem in select * from jsonb_array_elements(p_groups)
    loop
      v_group_id := nullif(trim(v_group_elem->>'id'), '')::uuid;

      if v_group_id is not null and exists (select 1 from public.option_groups where id = v_group_id and menu_item_id = v_menu_id) then
        -- UPDATE grup yang ada
        update public.option_groups
        set
          name = trim(v_group_elem->>'name'),
          type = v_group_elem->>'type',
          required = coalesce((v_group_elem->>'required')::boolean, false),
          sort_order = coalesce((v_group_elem->>'sort_order')::integer, 0)
        where id = v_group_id;
      else
        -- INSERT grup baru
        insert into public.option_groups (
          menu_item_id,
          name,
          type,
          required,
          sort_order
        )
        values (
          v_menu_id,
          trim(v_group_elem->>'name'),
          v_group_elem->>'type',
          coalesce((v_group_elem->>'required')::boolean, false),
          coalesce((v_group_elem->>'sort_order')::integer, 0)
        )
        returning id into v_group_id;
      end if;

      v_group_ids_kept := array_append(v_group_ids_kept, v_group_id);

      -- Sinkronisasi options dalam grup ini
      v_option_ids_kept := array[]::uuid[];

      if v_group_elem->'options' is not null and jsonb_typeof(v_group_elem->'options') = 'array' then
        for v_option_elem in select * from jsonb_array_elements(v_group_elem->'options')
        loop
          v_option_id := nullif(trim(v_option_elem->>'id'), '')::uuid;

          if v_option_id is not null and exists (select 1 from public.options where id = v_option_id and group_id = v_group_id) then
            -- UPDATE opsi yang ada
            update public.options
            set
              name = trim(v_option_elem->>'name'),
              price_delta = coalesce((v_option_elem->>'price_delta')::integer, 0),
              is_available = coalesce((v_option_elem->>'is_available')::boolean, true),
              sort_order = coalesce((v_option_elem->>'sort_order')::integer, 0)
            where id = v_option_id;
          else
            -- INSERT opsi baru
            insert into public.options (
              group_id,
              name,
              price_delta,
              is_available,
              sort_order
            )
            values (
              v_group_id,
              trim(v_option_elem->>'name'),
              coalesce((v_option_elem->>'price_delta')::integer, 0),
              coalesce((v_option_elem->>'is_available')::boolean, true),
              coalesce((v_option_elem->>'sort_order')::integer, 0)
            )
            returning id into v_option_id;
          end if;

          v_option_ids_kept := array_append(v_option_ids_kept, v_option_id);
        end loop;
      end if;

      -- Hapus opsi dalam grup ini yang tidak ada di payload
      delete from public.options
      where group_id = v_group_id
        and not (id = any(v_option_ids_kept));
    end loop;

    -- Hapus grup pada menu ini yang tidak ada di payload (otomatis cascade menghapus options di dalamnya)
    delete from public.option_groups
    where menu_item_id = v_menu_id
      and not (id = any(v_group_ids_kept));
  end if;

  -- 4. Ambil dan kembalikan data lengkap hasil simpan
  select jsonb_build_object(
    'id', m.id,
    'category_id', m.category_id,
    'name', m.name,
    'description', m.description,
    'price', m.price,
    'image_path', m.image_path,
    'is_available', m.is_available,
    'is_active', m.is_active,
    'sort_order', m.sort_order,
    'option_groups', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', g.id,
            'name', g.name,
            'type', g.type,
            'required', g.required,
            'sort_order', g.sort_order,
            'options', coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object(
                    'id', o.id,
                    'name', o.name,
                    'price_delta', o.price_delta,
                    'is_available', o.is_available,
                    'sort_order', o.sort_order
                  ) order by o.sort_order asc, o.name asc
                )
                from public.options o
                where o.group_id = g.id
              ),
              '[]'::jsonb
            )
          ) order by g.sort_order asc, g.name asc
        )
        from public.option_groups g
        where g.menu_item_id = m.id
      ),
      '[]'::jsonb
    )
  )
  into v_result
  from public.menu_items m
  where m.id = v_menu_id;

  return v_result;
end;
$$;

-- Izin eksekusi
revoke all on function public.save_menu_item_with_options(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_menu_item_with_options(uuid, jsonb, jsonb) to authenticated;
