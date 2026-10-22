-- Migrasi pembaruan fungsi public.report_summary untuk menambahkan cashOrders dan qrisOrders (Milestone M5: Issue #21)
-- public.report_summary(p_from_date date, p_to_date date)

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
  v_cash_orders bigint := 0;
  v_qris_orders bigint := 0;
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
    coalesce(sum(case when payment_method = 'qris' then total else 0 end), 0)::bigint,
    count(case when payment_method = 'cash' then 1 end)::bigint,
    count(case when payment_method = 'qris' then 1 end)::bigint
  into
    v_total_orders,
    v_total_revenue,
    v_total_cash,
    v_total_qris,
    v_cash_orders,
    v_qris_orders
  from public.orders
  where order_date >= p_from_date
    and order_date <= p_to_date
    and payment_status = 'lunas'
    and status <> 'batal';

  return jsonb_build_object(
    'totalOrders', v_total_orders,
    'totalRevenue', v_total_revenue,
    'totalCash', v_total_cash,
    'totalQris', v_total_qris,
    'cashOrders', v_cash_orders,
    'qrisOrders', v_qris_orders
  );
end;
$$;

revoke all on function public.report_summary(date, date) from public, anon;
grant execute on function public.report_summary(date, date) to authenticated;
