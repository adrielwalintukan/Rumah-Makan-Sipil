-- Migrasi aksi pesanan pemilik: state machine validasi transisi & fungsi admin_update_order (M3: Issue #13)
-- docs/PRD.md D3, D4, US-11, §6; docs/user-flows.md §2-4; AGENTS.md §8.3

-- ------------------------------------------------------------
-- 1. Trigger validasi transisi status pesanan & status bayar
-- ------------------------------------------------------------
create or replace function public.validate_order_status_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- 1. Validasi transisi status masak
  if OLD.status is distinct from NEW.status then
    -- Pesanan selesai atau batal tidak dapat diubah statusnya lagi (terminal state)
    if OLD.status = 'selesai' then
      raise exception 'INVALID_STATUS_TRANSITION: Pesanan yang sudah selesai tidak dapat diubah statusnya lagi'
        using errcode = '22023';
    end if;

    if OLD.status = 'batal' then
      raise exception 'INVALID_STATUS_TRANSITION: Pesanan yang sudah dibatalkan tidak dapat diubah statusnya lagi'
        using errcode = '22023';
    end if;

    -- Transisi yang diizinkan:
    -- baru -> dimasak, baru -> batal
    -- dimasak -> siap, dimasak -> batal
    -- siap -> selesai, siap -> batal
    if OLD.status = 'baru' and NEW.status not in ('dimasak', 'batal') then
      raise exception 'INVALID_STATUS_TRANSITION: Pesanan baru hanya dapat beralih ke dimasak atau batal (diberikan: %)', NEW.status
        using errcode = '22023';
    end if;

    if OLD.status = 'dimasak' and NEW.status not in ('siap', 'batal') then
      raise exception 'INVALID_STATUS_TRANSITION: Pesanan yang sedang dimasak hanya dapat beralih ke siap atau batal (diberikan: %)', NEW.status
        using errcode = '22023';
    end if;

    if OLD.status = 'siap' and NEW.status not in ('selesai', 'batal') then
      raise exception 'INVALID_STATUS_TRANSITION: Pesanan siap hanya dapat beralih ke selesai atau batal (diberikan: %)', NEW.status
        using errcode = '22023';
    end if;
  end if;

  -- 2. Validasi transisi status bayar
  if OLD.payment_status is distinct from NEW.payment_status then
    -- Pesanan yang sudah lunas tidak dapat diubah status bayarnya lagi (terminal state)
    if OLD.payment_status = 'lunas' then
      raise exception 'INVALID_PAYMENT_TRANSITION: Status pembayaran yang sudah lunas tidak dapat diubah lagi'
        using errcode = '22023';
    end if;

    -- belum_bayar hanya bisa ke menunggu_verifikasi (oleh pelanggan) atau lunas (oleh pemilik)
    if OLD.payment_status = 'belum_bayar' and NEW.payment_status not in ('menunggu_verifikasi', 'lunas') then
      raise exception 'INVALID_PAYMENT_TRANSITION: Status belum bayar hanya dapat beralih ke menunggu verifikasi atau lunas (diberikan: %)', NEW.payment_status
        using errcode = '22023';
    end if;

    -- menunggu_verifikasi hanya bisa ke lunas (diverifikasi pemilik) atau belum_bayar (pemilik tolak: belum masuk)
    if OLD.payment_status = 'menunggu_verifikasi' and NEW.payment_status not in ('lunas', 'belum_bayar') then
      raise exception 'INVALID_PAYMENT_TRANSITION: Status menunggu verifikasi hanya dapat beralih ke lunas atau belum bayar (diberikan: %)', NEW.payment_status
        using errcode = '22023';
    end if;
  end if;

  -- 3. Sinkronisasi paid_at dengan payment_status
  if NEW.payment_status = 'lunas' and NEW.paid_at is null then
    NEW.paid_at := now();
  elsif NEW.payment_status <> 'lunas' then
    NEW.paid_at := null;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_validate_order_status_transition on public.orders;
create trigger trg_validate_order_status_transition
before update on public.orders
for each row
execute function public.validate_order_status_transition();

-- ------------------------------------------------------------
-- 2. admin_update_order(p_order_id, p_action, p_cancel_reason)
-- Memproses aksi pesanan dari dashboard pemilik secara aman.
-- ------------------------------------------------------------
create or replace function public.admin_update_order(
  p_order_id uuid,
  p_action text,
  p_cancel_reason text default null
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_clean_reason text := nullif(trim(p_cancel_reason), '');
begin
  -- Hanya pemilik resmi yang dapat mengeksekusi aksi pesanan (AGENTS.md §8.3, docs/architecture.md §6)
  if not public.is_owner() then
    raise exception 'FORBIDDEN: Hanya akun pemilik yang memiliki hak akses untuk memproses pesanan'
      using errcode = '42501';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND: Pesanan dengan ID % tidak ditemukan', p_order_id
      using errcode = 'P0002';
  end if;

  case p_action
    when 'mulai_masak' then
      update public.orders
      set status = 'dimasak'
      where id = p_order_id
      returning * into v_order;

    when 'siap' then
      update public.orders
      set status = 'siap'
      where id = p_order_id
      returning * into v_order;

    when 'selesai' then
      update public.orders
      set status = 'selesai'
      where id = p_order_id
      returning * into v_order;

    when 'batal' then
      update public.orders
      set
        status = 'batal',
        cancel_reason = v_clean_reason
      where id = p_order_id
      returning * into v_order;

    when 'tandai_lunas' then
      update public.orders
      set
        payment_status = 'lunas',
        paid_at = coalesce(paid_at, now())
      where id = p_order_id
      returning * into v_order;

    when 'pembayaran_belum_masuk' then
      update public.orders
      set
        payment_status = 'belum_bayar',
        paid_at = null
      where id = p_order_id
      returning * into v_order;

    else
      raise exception 'INVALID_ACTION: Aksi pesanan tidak valid: %', p_action
        using errcode = '22023';
  end case;

  return v_order;
end;
$$;

revoke all on function public.admin_update_order(uuid, text, text) from public, anon;
grant execute on function public.admin_update_order(uuid, text, text) to authenticated;
