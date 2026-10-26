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
  v_group_name text;
  v_group_type text;
  v_group_required boolean;
  v_group_sort integer;
  v_group_names text[] := array[]::text[];
  v_group_ids_kept uuid[] := array[]::uuid[];

  v_option_elem jsonb;
  v_option_id uuid;
  v_option_name text;
  v_option_price_delta integer;
  v_option_is_available boolean;
  v_option_sort integer;
  v_option_names text[] := array[]::text[];
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
    v_category_id := nullif(trim(p_item->>'category_id'), '')::uuid;
    if v_category_id is null then
      raise exception 'category_id wajib diisi'
        using errcode = '22023';
    end if;

    v_name := trim(p_item->>'name');
    if v_name is null or length(v_name) = 0 then
      raise exception 'Nama menu wajib diisi'
        using errcode = '22023';
    end if;

    if length(v_name) > 80 then
      raise exception 'Nama menu maksimal 80 karakter'
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

    if p_item ? 'sort_order' and p_item->>'sort_order' is not null and trim(p_item->>'sort_order') != '' then
      v_sort_order := (p_item->>'sort_order')::integer;
      if v_sort_order is null or v_sort_order < 0 then
        raise exception 'Urutan menu tidak boleh negatif'
          using errcode = '22023';
      end if;
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

    if p_item ? 'name' then
      v_name := trim(p_item->>'name');
      if v_name is null or length(v_name) = 0 then
        raise exception 'Nama menu wajib diisi'
          using errcode = '22023';
      end if;
      if length(v_name) > 80 then
        raise exception 'Nama menu maksimal 80 karakter'
          using errcode = '22023';
      end if;
    end if;

    if p_item ? 'price' then
      v_price := (p_item->>'price')::integer;
      if v_price is null or v_price < 0 then
        raise exception 'Harga tidak valid'
          using errcode = '22023';
      end if;
    end if;

    if p_item ? 'sort_order' and p_item->>'sort_order' is not null and trim(p_item->>'sort_order') != '' then
      v_sort_order := (p_item->>'sort_order')::integer;
      if v_sort_order is null or v_sort_order < 0 then
        raise exception 'Urutan menu tidak boleh negatif'
          using errcode = '22023';
      end if;
    end if;

    -- Update hanya field yang disertakan
    update public.menu_items
    set
      category_id = coalesce(nullif(trim(p_item->>'category_id'), '')::uuid, category_id),
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
  if p_groups is not null then
    if jsonb_typeof(p_groups) != 'array' then
      raise exception 'p_groups harus berupa array JSON'
        using errcode = '22023';
    end if;

    v_group_names := array[]::text[];
    v_group_ids_kept := array[]::uuid[];

    for v_group_elem in select * from jsonb_array_elements(p_groups)
    loop
      if jsonb_typeof(v_group_elem) != 'object' then
        raise exception 'Elemen grup pilihan harus berupa object JSON'
          using errcode = '22023';
      end if;

      v_group_name := trim(v_group_elem->>'name');
      if v_group_name is null or length(v_group_name) = 0 then
        raise exception 'Nama grup pilihan wajib diisi'
          using errcode = '22023';
      end if;
      if length(v_group_name) > 50 then
        raise exception 'Nama grup pilihan maksimal 50 karakter'
          using errcode = '22023';
      end if;

      if lower(v_group_name) = any(v_group_names) then
        raise exception 'Nama grup pilihan tidak boleh duplikat: %', v_group_name
          using errcode = '22023';
      end if;
      v_group_names := array_append(v_group_names, lower(v_group_name));

      v_group_type := v_group_elem->>'type';
      if v_group_type is null or v_group_type not in ('single', 'multiple') then
        raise exception 'Tipe grup pilihan harus single atau multiple'
          using errcode = '22023';
      end if;

      v_group_required := coalesce((v_group_elem->>'required')::boolean, false);
      v_group_sort := coalesce((v_group_elem->>'sort_order')::integer, 0);
      if v_group_sort < 0 then
        raise exception 'Urutan grup pilihan tidak boleh negatif'
          using errcode = '22023';
      end if;

      v_group_id := nullif(trim(v_group_elem->>'id'), '')::uuid;

      if v_group_id is not null then
        -- Cek kepemilikan grup id terhadap menu ini
        if not exists (select 1 from public.option_groups where id = v_group_id and menu_item_id = v_menu_id) then
          raise exception 'Grup pilihan dengan id % tidak ditemukan pada menu ini', v_group_id
            using errcode = 'P0002';
        end if;

        -- UPDATE grup yang ada
        update public.option_groups
        set
          name = v_group_name,
          type = v_group_type,
          required = v_group_required,
          sort_order = v_group_sort
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
          v_group_name,
          v_group_type,
          v_group_required,
          v_group_sort
        )
        returning id into v_group_id;
      end if;

      v_group_ids_kept := array_append(v_group_ids_kept, v_group_id);

      -- Validasi options dalam grup ini (minimal 1 opsi)
      if v_group_elem->'options' is null or jsonb_typeof(v_group_elem->'options') != 'array' or jsonb_array_length(v_group_elem->'options') < 1 then
        raise exception 'Grup pilihan % harus memiliki minimal 1 opsi', v_group_name
          using errcode = '22023';
      end if;

      v_option_names := array[]::text[];
      v_option_ids_kept := array[]::uuid[];

      for v_option_elem in select * from jsonb_array_elements(v_group_elem->'options')
      loop
        if jsonb_typeof(v_option_elem) != 'object' then
          raise exception 'Elemen opsi harus berupa object JSON'
            using errcode = '22023';
        end if;

        v_option_name := trim(v_option_elem->>'name');
        if v_option_name is null or length(v_option_name) = 0 then
          raise exception 'Nama opsi wajib diisi'
            using errcode = '22023';
        end if;
        if length(v_option_name) > 50 then
          raise exception 'Nama opsi maksimal 50 karakter'
            using errcode = '22023';
        end if;

        if lower(v_option_name) = any(v_option_names) then
          raise exception 'Nama opsi tidak boleh duplikat dalam satu grup: %', v_option_name
            using errcode = '22023';
        end if;
        v_option_names := array_append(v_option_names, lower(v_option_name));

        v_option_price_delta := coalesce((v_option_elem->>'price_delta')::integer, 0);
        if v_option_price_delta < 0 then
          raise exception 'Harga tambahan opsi tidak boleh negatif'
            using errcode = '22023';
        end if;

        v_option_is_available := coalesce((v_option_elem->>'is_available')::boolean, true);
        v_option_sort := coalesce((v_option_elem->>'sort_order')::integer, 0);
        if v_option_sort < 0 then
          raise exception 'Urutan opsi tidak boleh negatif'
            using errcode = '22023';
        end if;

        v_option_id := nullif(trim(v_option_elem->>'id'), '')::uuid;

        if v_option_id is not null then
          -- Cek kepemilikan opsi id terhadap grup ini
          if not exists (select 1 from public.options where id = v_option_id and group_id = v_group_id) then
            raise exception 'Opsi dengan id % tidak ditemukan pada grup ini', v_option_id
              using errcode = 'P0002';
          end if;

          -- UPDATE opsi yang ada
          update public.options
          set
            name = v_option_name,
            price_delta = v_option_price_delta,
            is_available = v_option_is_available,
            sort_order = v_option_sort
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
            v_option_name,
            v_option_price_delta,
            v_option_is_available,
            v_option_sort
          )
          returning id into v_option_id;
        end if;

        v_option_ids_kept := array_append(v_option_ids_kept, v_option_id);
      end loop;

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
