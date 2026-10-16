-- Migrasi fungsi create_order (M2: Issue #6)
-- docs/architecture.md §5.1, docs/PRD.md §6, AGENTS.md §8.1, §8.4, §8.5, §8.8

create extension if not exists pgcrypto with schema extensions;

create or replace function public.create_order(
  payload jsonb,
  device_id text,
  ip_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_idempotency_key text;
  v_existing_token text;
  v_existing_daily_number integer;
  v_existing_total integer;
  v_is_open boolean;
  v_recent_orders_count integer;
  v_customer_name text;
  v_customer_phone text;
  v_order_type text;
  v_payment_method text;
  v_items jsonb;
  v_item_count integer;
  v_item jsonb;
  v_menu_id uuid;
  v_qty integer;
  v_note text;
  v_opt_ids_json jsonb;
  v_opt_ids uuid[];
  v_menu_record record;
  v_group_record record;
  v_opt_record record;
  v_selected_count integer;
  v_unit_price integer;
  v_subtotal integer;
  v_total integer := 0;
  v_order_date date;
  v_daily_number integer;
  v_public_token text;
  v_order_id uuid;
  v_item_options_snapshot jsonb;
  v_unavailable_ids jsonb := '[]'::jsonb;
  v_validated_items jsonb := '[]'::jsonb;
  v_idx integer;
begin
  -- 1. Idempotensi: jika idempotency_key sudah ada, kembalikan pesanan yang sama
  v_idempotency_key := pg_catalog.trim(payload->>'idempotency_key');
  if v_idempotency_key is null or v_idempotency_key = '' then
    raise exception '{"code": "INVALID_ITEM", "message": "idempotency_key wajib diisi"}';
  end if;

  select o.public_token, o.daily_number, o.total
  into v_existing_token, v_existing_daily_number, v_existing_total
  from public.orders o
  where o.idempotency_key = v_idempotency_key;

  if found then
    return pg_catalog.jsonb_build_object(
      'public_token', v_existing_token,
      'daily_number', v_existing_daily_number,
      'total', v_existing_total
    );
  end if;

  -- 2. Tolak jika settings.is_open = false
  select s.is_open into v_is_open from public.settings s where s.id = 1;
  if not coalesce(v_is_open, false) then
    raise exception '{"code": "STORE_CLOSED"}';
  end if;

  -- 3. Rate limit: tolak jika sudah ada >= 3 pesanan dari device_id atau ip_hash dalam 10 menit terakhir
  if device_id is null or pg_catalog.trim(device_id) = '' or ip_hash is null or pg_catalog.trim(ip_hash) = '' then
    raise exception '{"code": "INVALID_ITEM", "message": "device_id dan ip_hash wajib diisi"}';
  end if;

  select count(*)
  into v_recent_orders_count
  from public.orders o
  where (o.device_id = device_id or o.ip_hash = ip_hash)
    and o.created_at > (pg_catalog.now() - interval '10 minutes');

  if v_recent_orders_count >= 3 then
    raise exception '{"code": "RATE_LIMITED"}';
  end if;

  -- 4. Validasi payload dasar
  v_customer_name := pg_catalog.trim(payload->>'customer_name');
  if v_customer_name is null or pg_catalog.length(v_customer_name) < 2 or pg_catalog.length(v_customer_name) > 30 then
    raise exception '{"code": "INVALID_ITEM", "message": "customer_name harus antara 2 dan 30 karakter"}';
  end if;

  v_customer_phone := pg_catalog.trim(payload->>'customer_phone');
  if v_customer_phone is not null and v_customer_phone <> '' then
    if v_customer_phone !~ '^(\+62|62|0)8[0-9]{7,12}$' then
      raise exception '{"code": "INVALID_ITEM", "message": "customer_phone tidak valid"}';
    end if;
  else
    v_customer_phone := null;
  end if;

  v_order_type := payload->>'order_type';
  if v_order_type is null or v_order_type not in ('dine_in', 'takeaway') then
    raise exception '{"code": "INVALID_ITEM", "message": "order_type harus dine_in atau takeaway"}';
  end if;

  v_payment_method := payload->>'payment_method';
  if v_payment_method is null or v_payment_method not in ('qris', 'cash') then
    raise exception '{"code": "INVALID_ITEM", "message": "payment_method harus qris atau cash"}';
  end if;

  v_items := payload->'items';
  if v_items is null or pg_catalog.jsonb_typeof(v_items) <> 'array' then
    raise exception '{"code": "INVALID_ITEM", "message": "items wajib berupa array"}';
  end if;

  v_item_count := pg_catalog.jsonb_array_length(v_items);
  if v_item_count < 1 or v_item_count > 30 then
    raise exception '{"code": "INVALID_ITEM", "message": "jumlah baris item harus antara 1 dan 30"}';
  end if;

  -- 5. Validasi tiap item & opsi, hitung harga dari database
  for v_idx in 0 .. (v_item_count - 1) loop
    v_item := v_items->v_idx;

    -- Validasi menu_item_id
    begin
      v_menu_id := (v_item->>'menu_item_id')::uuid;
    exception when others then
      raise exception '{"code": "INVALID_ITEM", "message": "menu_item_id tidak valid"}';
    end;

    if v_menu_id is null then
      raise exception '{"code": "INVALID_ITEM", "message": "menu_item_id wajib diisi"}';
    end if;

    select m.id, m.name, m.price, m.is_available, m.is_active
    into v_menu_record
    from public.menu_items m
    where m.id = v_menu_id;

    if not found or not v_menu_record.is_active then
      raise exception '{"code": "INVALID_ITEM", "message": "menu tidak ditemukan atau sudah tidak aktif"}';
    end if;

    if not v_menu_record.is_available then
      v_unavailable_ids := v_unavailable_ids || pg_catalog.jsonb_build_array(v_menu_id::text);
    end if;

    -- Validasi quantity (1–20)
    v_qty := (v_item->>'quantity')::integer;
    if v_qty is null or v_qty < 1 or v_qty > 20 then
      raise exception '{"code": "INVALID_ITEM", "message": "kuantitas harus antara 1 dan 20"}';
    end if;

    -- Validasi note (maks 100 karakter)
    v_note := pg_catalog.nullif(pg_catalog.trim(v_item->>'note'), '');
    if v_note is not null and pg_catalog.length(v_note) > 100 then
      raise exception '{"code": "INVALID_ITEM", "message": "catatan maksimal 100 karakter"}';
    end if;

    -- Validasi opsi
    v_opt_ids_json := v_item->'option_ids';
    if v_opt_ids_json is not null and pg_catalog.jsonb_typeof(v_opt_ids_json) <> 'array' then
      raise exception '{"code": "INVALID_ITEM", "message": "option_ids harus berupa array"}';
    end if;

    if v_opt_ids_json is null then
      v_opt_ids_json := '[]'::jsonb;
    end if;

    -- Parse UUID array
    begin
      select coalesce(pg_catalog.array_agg(x::uuid), array[]::uuid[])
      into v_opt_ids
      from pg_catalog.jsonb_array_elements_text(v_opt_ids_json) as x;
    exception when others then
      raise exception '{"code": "INVALID_ITEM", "message": "format id opsi tidak valid"}';
    end;

    -- Cek duplikat opsi dalam satu item
    if pg_catalog.coalesce(pg_catalog.array_length(v_opt_ids, 1), 0) <> pg_catalog.jsonb_array_length(v_opt_ids_json) then
      raise exception '{"code": "INVALID_ITEM", "message": "opsi duplikat dalam satu item"}';
    end if;

    if pg_catalog.coalesce(pg_catalog.array_length(v_opt_ids, 1), 0) > 0 then
      if (select count(distinct id) from unnest(v_opt_ids) as id) <> pg_catalog.array_length(v_opt_ids, 1) then
        raise exception '{"code": "INVALID_ITEM", "message": "opsi duplikat dalam satu item"}';
      end if;
    end if;

    -- Cek semua opsi terdaftar dan milik menu_item ini
    for v_opt_record in
      select o.id, o.name, o.price_delta, o.is_available, g.id as group_id, g.name as group_name
      from unnest(v_opt_ids) as opt_id
      left join public.options o on o.id = opt_id
      left join public.option_groups g on g.id = o.group_id and g.menu_item_id = v_menu_id
    loop
      if v_opt_record.id is null or v_opt_record.group_id is null then
        raise exception '{"code": "INVALID_ITEM", "message": "opsi tidak valid untuk menu ini"}';
      end if;

      if not v_opt_record.is_available then
        v_unavailable_ids := v_unavailable_ids || pg_catalog.jsonb_build_array(v_opt_record.id::text);
      end if;
    end loop;

    -- Validasi aturan grup pilihan (required & single)
    for v_group_record in
      select g.id, g.name, g.type, g.required
      from public.option_groups g
      where g.menu_item_id = v_menu_id
    loop
      select count(*)
      into v_selected_count
      from public.options o
      where o.group_id = v_group_record.id
        and o.id = any(v_opt_ids);

      if v_group_record.required and v_selected_count = 0 then
        raise exception '{"code": "INVALID_ITEM", "message": "grup pilihan wajib belum dipilih"}';
      end if;

      if v_group_record.type = 'single' and v_selected_count > 1 then
        raise exception '{"code": "INVALID_ITEM", "message": "grup pilihan single hanya boleh 1 opsi"}';
      end if;
    end loop;

    -- Hitung unit_price dan susun snapshot options
    select
      coalesce(v_menu_record.price + sum(o.price_delta), v_menu_record.price),
      coalesce(
        pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'group', g.name,
            'name', o.name,
            'price_delta', o.price_delta
          )
          order by g.sort_order, o.sort_order
        ),
        '[]'::jsonb
      )
    into v_unit_price, v_item_options_snapshot
    from public.options o
    join public.option_groups g on g.id = o.group_id
    where o.id = any(v_opt_ids);

    if v_unit_price is null then
      v_unit_price := v_menu_record.price;
      v_item_options_snapshot := '[]'::jsonb;
    end if;

    v_subtotal := v_unit_price * v_qty;
    v_total := v_total + v_subtotal;

    v_validated_items := v_validated_items || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'menu_item_id', v_menu_id,
        'name', v_menu_record.name,
        'unit_price', v_unit_price,
        'quantity', v_qty,
        'options', v_item_options_snapshot,
        'note', v_note,
        'subtotal', v_subtotal
      )
    );
  end loop;

  -- Jika ada item/opsi yang habis (is_available = false), tolak dengan ITEM_UNAVAILABLE
  if pg_catalog.jsonb_array_length(v_unavailable_ids) > 0 then
    raise exception '{"code": "ITEM_UNAVAILABLE", "item_ids": %}', v_unavailable_ids;
  end if;

  -- 6. Ambil nomor antrean harian (WITA: Asia/Makassar)
  v_order_date := (pg_catalog.now() at time zone 'Asia/Makassar')::date;

  insert into public.daily_counters (day, last_number)
  values (v_order_date, 1)
  on conflict (day) do update
  set last_number = public.daily_counters.last_number + 1
  returning last_number into v_daily_number;

  -- 7. Generate public_token (32 karakter hex acak, unik, aman untuk URL)
  v_public_token := pg_catalog.encode(extensions.gen_random_bytes(16), 'hex');
  v_order_id := pg_catalog.gen_random_uuid();

  -- Insert orders
  insert into public.orders (
    id,
    public_token,
    order_date,
    daily_number,
    customer_name,
    customer_phone,
    order_type,
    payment_method,
    payment_status,
    status,
    total,
    device_id,
    ip_hash,
    idempotency_key
  ) values (
    v_order_id,
    v_public_token,
    v_order_date,
    v_daily_number,
    v_customer_name,
    v_customer_phone,
    v_order_type,
    v_payment_method,
    'belum_bayar',
    'baru',
    v_total,
    device_id,
    ip_hash,
    v_idempotency_key
  );

  -- Insert order_items
  insert into public.order_items (
    order_id,
    menu_item_id,
    name,
    unit_price,
    quantity,
    options,
    note,
    subtotal
  )
  select
    v_order_id,
    (elem->>'menu_item_id')::uuid,
    elem->>'name',
    (elem->>'unit_price')::integer,
    (elem->>'quantity')::integer,
    elem->'options',
    elem->>'note',
    (elem->>'subtotal')::integer
  from pg_catalog.jsonb_array_elements(v_validated_items) as elem;

  -- Kembalikan token, nomor harian, dan total
  return pg_catalog.jsonb_build_object(
    'public_token', v_public_token,
    'daily_number', v_daily_number,
    'total', v_total
  );
end;
$$;

-- Izin akses: hanya service_role (dan postgres superuser)
revoke all on function public.create_order(jsonb, text, text) from public;
revoke all on function public.create_order(jsonb, text, text) from anon, authenticated;
grant execute on function public.create_order(jsonb, text, text) to service_role;
