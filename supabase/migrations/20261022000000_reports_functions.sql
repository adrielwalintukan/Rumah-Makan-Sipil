-- Migrasi fungsi SQL laporan penjualan dan menu terlaris (Milestone M5: Issue #21)
-- public.report_summary(p_from_date date, p_to_date date)
-- public.top_items(p_from_date date, p_to_date date, p_limit int default 5)

create or replace function public.report_summary(
  p_from_date date,
  p_to_date date
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
begin
  -- 1. Validasi hak akses akun pemilik (AGENTS.md §8.3, docs/architecture.md §6)
  if not public.is_owner() then
    raise exception 'FORBIDDEN: Hanya akun pemilik yang memiliki hak akses'
      using errcode = '42501';
  end if;

  -- 2. Agregasi pesanan lunas non-batal dalam rentang tanggal
  select
    count(*)::bigint,
    coalesce(sum(total), 0)::bigint,
    coalesce(sum(case when payment_method = 'cash' then total else 0 end), 0)::bigint,
    coalesce(sum(case when payment_method = 'qris' then total else 0 end), 0)::bigint
  into
    v_total_orders,
    v_total_revenue,
    v_total_cash,
    v_total_qris
  from public.orders
  where order_date >= p_from_date
    and order_date <= p_to_date
    and payment_status = 'lunas'
    and status <> 'batal';

  return jsonb_build_object(
    'totalOrders', v_total_orders,
    'totalRevenue', v_total_revenue,
    'totalCash', v_total_cash,
    'totalQris', v_total_qris
  );
end;
$$;

revoke all on function public.report_summary(date, date) from public, anon;
grant execute on function public.report_summary(date, date) to authenticated;

create or replace function public.top_items(
  p_from_date date,
  p_to_date date,
  p_limit int default 5
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_safe_limit int;
begin
  -- 1. Validasi hak akses akun pemilik (AGENTS.md §8.3, docs/architecture.md §6)
  if not public.is_owner() then
    raise exception 'FORBIDDEN: Hanya akun pemilik yang memiliki hak akses'
      using errcode = '42501';
  end if;

  -- 2. Batas aman limit antara 1 dan 50 (default 5 jika null)
  v_safe_limit := greatest(1, least(coalesce(p_limit, 5), 50));

  -- 3. Agregasi penjualan menu pesanan lunas non-batal
  select coalesce(jsonb_agg(item_row), '[]'::jsonb)
  into v_result
  from (
    select
      oi.name,
      sum(oi.quantity)::int as total_quantity,
      sum(oi.subtotal)::bigint as total_revenue
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where o.order_date >= p_from_date
      and o.order_date <= p_to_date
      and o.payment_status = 'lunas'
      and o.status <> 'batal'
    group by oi.name
    order by total_quantity desc, total_revenue desc, oi.name asc
    limit v_safe_limit
  ) item_row;

  return v_result;
end;
$$;

revoke all on function public.top_items(date, date, int) from public, anon;
grant execute on function public.top_items(date, date, int) to authenticated;
