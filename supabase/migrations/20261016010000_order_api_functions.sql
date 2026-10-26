-- Migrasi fungsi API pesanan: get_order & claim_paid (M2: Issue #7)
-- docs/architecture.md §5.2, docs/PRD.md US-04, US-06, AGENTS.md §8.2, §8.3, §8.6

-- ------------------------------------------------------------
-- 1. get_order(token text)
-- Data aman publik untuk halaman lacak pelanggan (tanpa device_id, ip_hash, customer_phone).
-- ------------------------------------------------------------
create or replace function public.get_order(token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := trim(token);
  v_order record;
  v_items jsonb;
begin
  if v_token is null or v_token = '' then
    return null;
  end if;

  select
    o.id,
    o.public_token,
    o.order_date,
    o.daily_number,
    o.customer_name,
    o.order_type,
    o.payment_method,
    o.payment_status,
    o.status,
    o.cancel_reason,
    o.total,
    o.created_at,
    o.paid_at
  into v_order
  from public.orders o
  where o.public_token = v_token;

  if not found then
    return null;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', oi.id,
        'name', oi.name,
        'unit_price', oi.unit_price,
        'quantity', oi.quantity,
        'options', oi.options,
        'note', oi.note,
        'subtotal', oi.subtotal
      )
      order by oi.id
    ),
    '[]'::jsonb
  )
  into v_items
  from public.order_items oi
  where oi.order_id = v_order.id;

  return jsonb_build_object(
    'public_token', v_order.public_token,
    'order_date', v_order.order_date,
    'daily_number', v_order.daily_number,
    'customer_name', v_order.customer_name,
    'order_type', v_order.order_type,
    'payment_method', v_order.payment_method,
    'payment_status', v_order.payment_status,
    'status', v_order.status,
    'cancel_reason', v_order.cancel_reason,
    'total', v_order.total,
    'created_at', v_order.created_at,
    'paid_at', v_order.paid_at,
    'items', v_items
  );
end;
$$;

revoke all on function public.get_order(text) from public;
revoke all on function public.get_order(text) from anon, authenticated;
grant execute on function public.get_order(text) to service_role;

-- ------------------------------------------------------------
-- 2. claim_paid(token text)
-- Pelanggan mengklaim sudah bayar QRIS. Hanya mengubah jika QRIS & belum_bayar.
-- ------------------------------------------------------------
create or replace function public.claim_paid(token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := trim(token);
  v_payment_method text;
  v_payment_status text;
  v_updated_status text;
begin
  if v_token is null or v_token = '' then
    return null;
  end if;

  select o.payment_method, o.payment_status
  into v_payment_method, v_payment_status
  from public.orders o
  where o.public_token = v_token;

  if not found then
    return null;
  end if;

  -- Hanya jika payment_method = 'qris' dan payment_status = 'belum_bayar'
  if v_payment_method = 'qris' and v_payment_status = 'belum_bayar' then
    update public.orders
    set payment_status = 'menunggu_verifikasi'
    where public_token = v_token
    returning payment_status into v_updated_status;
  else
    v_updated_status := v_payment_status;
  end if;

  return jsonb_build_object(
    'success', true,
    'payment_status', v_updated_status
  );
end;
$$;

revoke all on function public.claim_paid(text) from public;
revoke all on function public.claim_paid(text) from anon, authenticated;
grant execute on function public.claim_paid(text) to service_role;
