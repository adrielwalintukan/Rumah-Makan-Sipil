-- Migrasi fungsi RPC agregasi ringkasan riwayat pesanan (Milestone M5: Issue #20)
-- Menghitung total pesanan, omzet lunas, cash, dan qris secara server-side di database.
-- Menghindari limitasi default 1.000 baris PostgREST saat volume pesanan tinggi.

create or replace function public.admin_get_order_history_summary(
  p_from_date date,
  p_to_date date,
  p_status text default 'all',
  p_search text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total_orders bigint := 0;
  v_total_revenue bigint := 0;
  v_total_cash bigint := 0;
  v_total_qris bigint := 0;
  v_clean_search text;
  v_daily_num int := null;
begin
  -- 1. Validasi hak akses akun pemilik (AGENTS.md §8.3, docs/architecture.md §6)
  if not public.is_owner() then
    raise exception 'FORBIDDEN: Hanya akun pemilik yang memiliki hak akses'
      using errcode = '42501';
  end if;

  -- 2. Parsing kata kunci pencarian
  if p_search is not null and trim(p_search) <> '' then
    v_clean_search := trim(p_search);
    if v_clean_search ~ '^#?[0-9]+$' then
      v_daily_num := regexp_replace(v_clean_search, '^#', '')::int;
    end if;
  end if;

  -- 3. Agregasi langsung di Postgres
  select
    count(*)::bigint,
    coalesce(sum(case when payment_status = 'lunas' and status <> 'batal' then total else 0 end), 0)::bigint,
    coalesce(sum(case when payment_status = 'lunas' and status <> 'batal' and payment_method = 'cash' then total else 0 end), 0)::bigint,
    coalesce(sum(case when payment_status = 'lunas' and status <> 'batal' and payment_method = 'qris' then total else 0 end), 0)::bigint
  into
    v_total_orders,
    v_total_revenue,
    v_total_cash,
    v_total_qris
  from public.orders
  where order_date >= p_from_date
    and order_date <= p_to_date
    and (
      p_status = 'all'
      or (p_status = 'selesai' and status = 'selesai')
      or (p_status = 'batal' and status = 'batal')
    )
    and (
      v_clean_search is null
      or customer_name ilike ('%' || v_clean_search || '%')
      or (v_daily_num is not null and daily_number = v_daily_num)
    );

  return jsonb_build_object(
    'totalOrders', v_total_orders,
    'totalRevenue', v_total_revenue,
    'totalCash', v_total_cash,
    'totalQris', v_total_qris
  );
end;
$$;

revoke all on function public.admin_get_order_history_summary(date, date, text, text) from public, anon;
grant execute on function public.admin_get_order_history_summary(date, date, text, text) to authenticated;
