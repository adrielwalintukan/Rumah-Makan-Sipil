-- Migrasi: Fungsi SQL cashbook untuk buku kas dan laba kotor (Milestone M5: Issue #22)

create or replace function public.cashbook(
  p_from_date date,
  p_to_date date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_income bigint;
  v_expense bigint;
  v_profit bigint;
  v_expense_bahan bigint;
  v_expense_operasional bigint;
  v_expense_lainnya bigint;
  v_daily jsonb;
begin
  -- 1. Penegakan Keamanan: Hanya pemilik yang berhak
  if not public.is_owner() then
    raise exception 'FORBIDDEN: Hanya akun pemilik yang memiliki hak akses' using errcode = '42501';
  end if;

  -- 2. Validasi parameter tanggal
  if p_from_date is null or p_to_date is null then
    raise exception 'INVALID_PARAMETER: Tanggal awal dan akhir harus diisi' using errcode = '22023';
  end if;

  if p_from_date > p_to_date then
    raise exception 'INVALID_PARAMETER: Tanggal awal tidak boleh lebih besar dari tanggal akhir' using errcode = '22023';
  end if;

  -- 3. Hitung total pemasukan dari pesanan lunas non-batal
  select coalesce(sum(o.total), 0)
    into v_income
    from public.orders o
   where o.order_date between p_from_date and p_to_date
     and o.payment_status = 'lunas'
     and o.status <> 'batal';

  -- 4. Hitung total pengeluaran dan rincian per kategori
  select coalesce(sum(e.amount), 0),
         coalesce(sum(case when e.category = 'bahan' then e.amount else 0 end), 0),
         coalesce(sum(case when e.category = 'operasional' then e.amount else 0 end), 0),
         coalesce(sum(case when e.category = 'lainnya' then e.amount else 0 end), 0)
    into v_expense,
         v_expense_bahan,
         v_expense_operasional,
         v_expense_lainnya
    from public.expenses e
   where e.expense_date between p_from_date and p_to_date;

  -- 5. Hitung laba kotor total
  v_profit := v_income - v_expense;

  -- 6. Agregasi rincian buku kas harian
  with dates as (
    select distinct o.order_date as dt
      from public.orders o
     where o.order_date between p_from_date and p_to_date
       and o.payment_status = 'lunas'
       and o.status <> 'batal'
    union
    select distinct e.expense_date as dt
      from public.expenses e
     where e.expense_date between p_from_date and p_to_date
  ),
  daily_income as (
    select o.order_date as dt,
           coalesce(sum(o.total), 0) as income
      from public.orders o
     where o.order_date between p_from_date and p_to_date
       and o.payment_status = 'lunas'
       and o.status <> 'batal'
     group by o.order_date
  ),
  daily_expense as (
    select e.expense_date as dt,
           coalesce(sum(e.amount), 0) as expense
      from public.expenses e
     where e.expense_date between p_from_date and p_to_date
     group by e.expense_date
  )
  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'date', to_char(d.dt, 'YYYY-MM-DD'),
               'income', coalesce(di.income, 0),
               'expense', coalesce(de.expense, 0),
               'grossProfit', coalesce(di.income, 0) - coalesce(de.expense, 0)
             )
             order by d.dt desc
           ),
           '[]'::jsonb
         )
    into v_daily
    from dates d
    left join daily_income di on di.dt = d.dt
    left join daily_expense de on de.dt = d.dt;

  -- 7. Bentuk hasil akhir jsonb
  return jsonb_build_object(
    'period', jsonb_build_object(
      'from', to_char(p_from_date, 'YYYY-MM-DD'),
      'to', to_char(p_to_date, 'YYYY-MM-DD')
    ),
    'summary', jsonb_build_object(
      'totalIncome', v_income,
      'totalExpense', v_expense,
      'grossProfit', v_profit,
      'expenseByCategory', jsonb_build_object(
        'bahan', v_expense_bahan,
        'operasional', v_expense_operasional,
        'lainnya', v_expense_lainnya
      )
    ),
    'dailyBreakdown', v_daily
  );
end;
$$;

revoke all on function public.cashbook(date, date) from public, anon;
grant execute on function public.cashbook(date, date) to authenticated;
