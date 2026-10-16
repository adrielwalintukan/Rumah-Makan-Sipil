-- Tes fungsi create_order (M2: Issue #6)
begin;
create extension if not exists pgtap with schema extensions;

select plan(27);

-- ------------------------------------------------------------
-- Fixture Data
-- ------------------------------------------------------------
-- Ambil ID menu dan opsi dari seed
create temp table _test_ids on commit drop as
select
  m.id as mie_id,
  (select o.id from public.options o join public.option_groups g on g.id = o.group_id where g.menu_item_id = m.id and o.name = 'Kuah') as kuah_id,
  (select o.id from public.options o join public.option_groups g on g.id = o.group_id where g.menu_item_id = m.id and o.name = 'Goreng') as goreng_id,
  (select o.id from public.options o join public.option_groups g on g.id = o.group_id where g.menu_item_id = m.id and o.name = 'Telur') as telur_id,
  (select g.id from public.option_groups g where g.menu_item_id = m.id and g.name = 'Tambahan') as tambahan_group_id,
  (select id from public.menu_items where name = 'Nasi Campur') as nasi_id
from public.menu_items m
where m.name = 'Mie';

-- Tambah fixture menu habis dan opsi habis
insert into public.menu_items (category_id, name, price, is_available, is_active)
select category_id, 'Mie Habis', 8000, false, true
from public.menu_items
where name = 'Mie';

insert into public.options (group_id, name, price_delta, is_available)
select tambahan_group_id, 'Opsi Habis', 1000, false
from _test_ids;

-- ------------------------------------------------------------
-- 1. Toko Tutup (settings.is_open = false)
-- ------------------------------------------------------------
select throws_matching(
  $$select public.create_order(
    jsonb_build_object(
      'customer_name', 'Budi',
      'order_type', 'dine_in',
      'payment_method', 'cash',
      'idempotency_key', 'idem-tutup-001',
      'items', jsonb_build_array(
        jsonb_build_object(
          'menu_item_id', (select mie_id from _test_ids),
          'quantity', 1,
          'option_ids', jsonb_build_array((select kuah_id from _test_ids))
        )
      )
    ),
    'device-001',
    'ip-001'
  )$$,
  'STORE_CLOSED',
  'create_order ditolak jika toko tutup (STORE_CLOSED)'
);

-- Buka toko untuk pengujian selanjutnya
update public.settings set is_open = true where id = 1;

-- ------------------------------------------------------------
-- 2. Validasi Payload Dasar
-- ------------------------------------------------------------
select throws_matching(
  $$select public.create_order(
    jsonb_build_object(
      'customer_name', 'A',
      'order_type', 'dine_in',
      'payment_method', 'cash',
      'idempotency_key', 'idem-name-short',
      'items', jsonb_build_array()
    ),
    'dev-1',
    'ip-1'
  )$$,
  'customer_name harus antara 2 dan 30 karakter',
  'nama kurang dari 2 karakter ditolak'
);

select throws_matching(
  $$select public.create_order(
    jsonb_build_object(
      'customer_name', 'Budi',
      'customer_phone', '12345',
      'order_type', 'dine_in',
      'payment_method', 'cash',
      'idempotency_key', 'idem-phone-invalid',
      'items', jsonb_build_array()
    ),
    'dev-1',
    'ip-1'
  )$$,
  'customer_phone tidak valid',
  'nomor hp tidak valid formatnya ditolak'
);

select throws_matching(
  $$select public.create_order(
    jsonb_build_object(
      'customer_name', 'Budi',
      'order_type', 'invalid_type',
      'payment_method', 'cash',
      'idempotency_key', 'idem-type-invalid',
      'items', jsonb_build_array()
    ),
    'dev-1',
    'ip-1'
  )$$,
  'order_type harus dine_in atau takeaway',
  'order_type tidak valid ditolak'
);

select throws_matching(
  $$select public.create_order(
    jsonb_build_object(
      'customer_name', 'Budi',
      'order_type', 'dine_in',
      'payment_method', 'bitcoin',
      'idempotency_key', 'idem-pay-invalid',
      'items', jsonb_build_array()
    ),
    'dev-1',
    'ip-1'
  )$$,
  'payment_method harus qris atau cash',
  'payment_method selain qris/cash ditolak'
);

select throws_matching(
  $$select public.create_order(
    jsonb_build_object(
      'customer_name', 'Budi',
      'order_type', 'dine_in',
      'payment_method', 'cash',
      'idempotency_key', 'idem-empty-items',
      'items', '[]'::jsonb
    ),
    'dev-1',
    'ip-1'
  )$$,
  'jumlah baris item harus antara 1 dan 30',
  'items kosong ditolak'
);

-- ------------------------------------------------------------
-- 3. Validasi Item & Opsi
-- ------------------------------------------------------------
select throws_matching(
  $$select public.create_order(
    jsonb_build_object(
      'customer_name', 'Budi',
      'order_type', 'dine_in',
      'payment_method', 'cash',
      'idempotency_key', 'idem-qty-invalid',
      'items', jsonb_build_array(
        jsonb_build_object(
          'menu_item_id', (select mie_id from _test_ids),
          'quantity', 0
        )
      )
    ),
    'dev-1',
    'ip-1'
  )$$,
  'kuantitas harus antara 1 dan 20',
  'quantity 0 ditolak'
);

select throws_matching(
  $$select public.create_order(
    jsonb_build_object(
      'customer_name', 'Budi',
      'order_type', 'dine_in',
      'payment_method', 'cash',
      'idempotency_key', 'idem-note-toolong',
      'items', jsonb_build_array(
        jsonb_build_object(
          'menu_item_id', (select nasi_id from _test_ids),
          'quantity', 1,
          'note', repeat('x', 101)
        )
      )
    ),
    'dev-1',
    'ip-1'
  )$$,
  'catatan maksimal 100 karakter',
  'catatan lebih dari 100 karakter ditolak'
);

select throws_matching(
  $$select public.create_order(
    jsonb_build_object(
      'customer_name', 'Budi',
      'order_type', 'dine_in',
      'payment_method', 'cash',
      'idempotency_key', 'idem-unknown-menu',
      'items', jsonb_build_array(
        jsonb_build_object(
          'menu_item_id', 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid,
          'quantity', 1
        )
      )
    ),
    'dev-1',
    'ip-1'
  )$$,
  'menu tidak ditemukan atau sudah tidak aktif',
  'menu id tidak ada ditolak'
);

select throws_matching(
  $$select public.create_order(
    jsonb_build_object(
      'customer_name', 'Budi',
      'order_type', 'dine_in',
      'payment_method', 'cash',
      'idempotency_key', 'idem-wrong-opt',
      'items', jsonb_build_array(
        jsonb_build_object(
          'menu_item_id', (select nasi_id from _test_ids),
          'quantity', 1,
          'option_ids', jsonb_build_array((select telur_id from _test_ids))
        )
      )
    ),
    'dev-1',
    'ip-1'
  )$$,
  'opsi tidak valid untuk menu ini',
  'opsi bukan milik menu ditolak'
);

select throws_matching(
  $$select public.create_order(
    jsonb_build_object(
      'customer_name', 'Budi',
      'order_type', 'dine_in',
      'payment_method', 'cash',
      'idempotency_key', 'idem-missing-req',
      'items', jsonb_build_array(
        jsonb_build_object(
          'menu_item_id', (select mie_id from _test_ids),
          'quantity', 1,
          'option_ids', jsonb_build_array((select telur_id from _test_ids)) -- Opsi Jenis (Kuah/Goreng) belum dipilih
        )
      )
    ),
    'dev-1',
    'ip-1'
  )$$,
  'grup pilihan wajib belum dipilih',
  'grup pilihan wajib tidak dipilih ditolak'
);

select throws_matching(
  $$select public.create_order(
    jsonb_build_object(
      'customer_name', 'Budi',
      'order_type', 'dine_in',
      'payment_method', 'cash',
      'idempotency_key', 'idem-multi-single',
      'items', jsonb_build_array(
        jsonb_build_object(
          'menu_item_id', (select mie_id from _test_ids),
          'quantity', 1,
          'option_ids', jsonb_build_array(
            (select kuah_id from _test_ids),
            (select goreng_id from _test_ids)
          )
        )
      )
    ),
    'dev-1',
    'ip-1'
  )$$,
  'grup pilihan single hanya boleh 1 opsi',
  'memilih lebih dari 1 opsi pada grup single ditolak'
);

-- ------------------------------------------------------------
-- 4. Ketersediaan Item / Opsi (ITEM_UNAVAILABLE)
-- ------------------------------------------------------------
select throws_matching(
  $$select public.create_order(
    jsonb_build_object(
      'customer_name', 'Budi',
      'order_type', 'dine_in',
      'payment_method', 'cash',
      'idempotency_key', 'idem-menu-habis',
      'items', jsonb_build_array(
        jsonb_build_object(
          'menu_item_id', (select id from public.menu_items where name = 'Mie Habis'),
          'quantity', 1
        )
      )
    ),
    'dev-1',
    'ip-1'
  )$$,
  'ITEM_UNAVAILABLE',
  'menu habis ditolak dengan kode ITEM_UNAVAILABLE'
);

select throws_matching(
  $$select public.create_order(
    jsonb_build_object(
      'customer_name', 'Budi',
      'order_type', 'dine_in',
      'payment_method', 'cash',
      'idempotency_key', 'idem-opt-habis',
      'items', jsonb_build_array(
        jsonb_build_object(
          'menu_item_id', (select mie_id from _test_ids),
          'quantity', 1,
          'option_ids', jsonb_build_array(
            (select kuah_id from _test_ids),
            (select id from public.options where name = 'Opsi Habis')
          )
        )
      )
    ),
    'dev-1',
    'ip-1'
  )$$,
  'ITEM_UNAVAILABLE',
  'opsi habis ditolak dengan kode ITEM_UNAVAILABLE'
);

-- ------------------------------------------------------------
-- 5. Pembuatan Pesanan Berhasil & Hitung Harga Server
-- ------------------------------------------------------------
-- Pesanan 1: Mie (7000) + Kuah (0) + Telur (3000) = 10000. Payload memberi total bohong 1 perak
create temp table _order_1 on commit drop as
select public.create_order(
  jsonb_build_object(
    'customer_name', 'Adriel',
    'customer_phone', '081234567890',
    'order_type', 'dine_in',
    'payment_method', 'qris',
    'idempotency_key', 'idem-sukses-001',
    'total', 1, -- Harusnya diabaikan server
    'items', jsonb_build_array(
      jsonb_build_object(
        'menu_item_id', (select mie_id from _test_ids),
        'quantity', 2,
        'option_ids', jsonb_build_array(
          (select kuah_id from _test_ids),
          (select telur_id from _test_ids)
        ),
        'note', 'Pedas sedang'
      )
    )
  ),
  'device-user-1',
  'ip-hash-user-1'
) as res;

select is(
  ((select res->>'daily_number' from _order_1)::int),
  1,
  'nomor harian pertama adalah 1'
);

select is(
  ((select res->>'total' from _order_1)::int),
  20000, -- (7000 + 0 + 3000) * 2 = 20000
  'total dihitung server dari tabel menu (harga payload diabaikan)'
);

select cmp_ok(
  length((select res->>'public_token' from _order_1)),
  '>=',
  22,
  'public_token panjangnya >= 22 karakter'
);

select is(
  (select count(*) from public.orders where idempotency_key = 'idem-sukses-001' and total = 20000 and status = 'baru'),
  1::bigint,
  'record orders tersimpan dengan status baru'
);

select is(
  (select count(*) from public.order_items oi
   join public.orders o on o.id = oi.order_id
   where o.idempotency_key = 'idem-sukses-001'
     and oi.name = 'Mie'
     and oi.unit_price = 10000
     and oi.quantity = 2
     and oi.subtotal = 20000
     and oi.note = 'Pedas sedang'),
  1::bigint,
  'record order_items tersimpan dengan snapshot harga dan catatan yang benar'
);

select is(
  (select count(*)
   from public.order_items oi
   join public.orders o on o.id = oi.order_id
   where o.idempotency_key = 'idem-sukses-001'
     and oi.options @> '[{"name": "Kuah"}, {"name": "Telur"}]'::jsonb),
  1::bigint,
  'snapshot options memuat opsi Kuah dan Telur'
);

-- ------------------------------------------------------------
-- 6. Nomor Antrean Bertambah Berurutan
-- ------------------------------------------------------------
create temp table _order_2 on commit drop as
select public.create_order(
  jsonb_build_object(
    'customer_name', 'Budi',
    'order_type', 'takeaway',
    'payment_method', 'cash',
    'idempotency_key', 'idem-sukses-002',
    'items', jsonb_build_array(
      jsonb_build_object(
        'menu_item_id', (select nasi_id from _test_ids),
        'quantity', 1
      )
    )
  ),
  'device-user-2',
  'ip-hash-user-2'
) as res;

select is(
  ((select res->>'daily_number' from _order_2)::int),
  2,
  'pesanan kedua mendapat daily_number 2'
);

-- ------------------------------------------------------------
-- 7. Idempotensi
-- ------------------------------------------------------------
create temp table _order_replay on commit drop as
select public.create_order(
  jsonb_build_object(
    'customer_name', 'Budi',
    'order_type', 'takeaway',
    'payment_method', 'cash',
    'idempotency_key', 'idem-sukses-002',
    'items', jsonb_build_array(
      jsonb_build_object(
        'menu_item_id', (select nasi_id from _test_ids),
        'quantity', 1
      )
    )
  ),
  'device-user-2',
  'ip-hash-user-2'
) as res;

select is(
  (select res from _order_replay),
  (select res from _order_2),
  'kirim ulang dengan idempotency_key yang sama mengembalikan hasil pesanan yang sama'
);

select is(
  (select count(*) from public.orders where idempotency_key = 'idem-sukses-002'),
  1::bigint,
  'tidak ada duplikasi baris pesanan untuk idempotency_key yang sama'
);

-- ------------------------------------------------------------
-- 8. Rate Limiting (Maks 3 pesanan per device_id / ip_hash per 10 menit)
-- ------------------------------------------------------------
-- device-rate-test membuat 3 pesanan berturut-turut (IP berbeda)
select public.create_order(
  jsonb_build_object(
    'customer_name', 'User Rate 1',
    'order_type', 'dine_in',
    'payment_method', 'cash',
    'idempotency_key', 'idem-rate-dev-1',
    'items', jsonb_build_array(jsonb_build_object('menu_item_id', (select nasi_id from _test_ids), 'quantity', 1))
  ),
  'device-rate-test',
  'ip-rate-a'
);

select public.create_order(
  jsonb_build_object(
    'customer_name', 'User Rate 2',
    'order_type', 'dine_in',
    'payment_method', 'cash',
    'idempotency_key', 'idem-rate-dev-2',
    'items', jsonb_build_array(jsonb_build_object('menu_item_id', (select nasi_id from _test_ids), 'quantity', 1))
  ),
  'device-rate-test',
  'ip-rate-b'
);

select public.create_order(
  jsonb_build_object(
    'customer_name', 'User Rate 3',
    'order_type', 'dine_in',
    'payment_method', 'cash',
    'idempotency_key', 'idem-rate-dev-3',
    'items', jsonb_build_array(jsonb_build_object('menu_item_id', (select nasi_id from _test_ids), 'quantity', 1))
  ),
  'device-rate-test',
  'ip-rate-c'
);

-- Pesanan ke-4 dari device_id yang sama harus ditolak
select throws_matching(
  $$select public.create_order(
    jsonb_build_object(
      'customer_name', 'User Rate 4',
      'order_type', 'dine_in',
      'payment_method', 'cash',
      'idempotency_key', 'idem-rate-dev-4',
      'items', jsonb_build_array(jsonb_build_object('menu_item_id', (select nasi_id from _test_ids), 'quantity', 1))
    ),
    'device-rate-test',
    'ip-rate-d'
  )$$,
  'RATE_LIMITED',
  'pesanan ke-4 dari device yang sama dalam 10 menit ditolak RATE_LIMITED'
);

-- Uji rate limit berdasarkan ip_hash:
-- ip-shared membuat 3 pesanan dari 3 device_id berbeda
select public.create_order(
  jsonb_build_object(
    'customer_name', 'IP Rate 1',
    'order_type', 'dine_in',
    'payment_method', 'cash',
    'idempotency_key', 'idem-rate-ip-1',
    'items', jsonb_build_array(jsonb_build_object('menu_item_id', (select nasi_id from _test_ids), 'quantity', 1))
  ),
  'dev-ip-1',
  'ip-shared'
);

select public.create_order(
  jsonb_build_object(
    'customer_name', 'IP Rate 2',
    'order_type', 'dine_in',
    'payment_method', 'cash',
    'idempotency_key', 'idem-rate-ip-2',
    'items', jsonb_build_array(jsonb_build_object('menu_item_id', (select nasi_id from _test_ids), 'quantity', 1))
  ),
  'dev-ip-2',
  'ip-shared'
);

select public.create_order(
  jsonb_build_object(
    'customer_name', 'IP Rate 3',
    'order_type', 'dine_in',
    'payment_method', 'cash',
    'idempotency_key', 'idem-rate-ip-3',
    'items', jsonb_build_array(jsonb_build_object('menu_item_id', (select nasi_id from _test_ids), 'quantity', 1))
  ),
  'dev-ip-3',
  'ip-shared'
);

-- Pesanan ke-4 dari ip_hash yang sama (dengan device baru) harus ditolak
select throws_matching(
  $$select public.create_order(
    jsonb_build_object(
      'customer_name', 'IP Rate 4',
      'order_type', 'dine_in',
      'payment_method', 'cash',
      'idempotency_key', 'idem-rate-ip-4',
      'items', jsonb_build_array(jsonb_build_object('menu_item_id', (select nasi_id from _test_ids), 'quantity', 1))
    ),
    'dev-ip-4',
    'ip-shared'
  )$$,
  'RATE_LIMITED',
  'pesanan ke-4 dari ip_hash yang sama dalam 10 menit ditolak RATE_LIMITED'
);

-- ------------------------------------------------------------
-- 9. Keamanan & Hak Akses (RLS / Revoke)
-- ------------------------------------------------------------
set local role anon;
select throws_ok(
  $$select public.create_order('{}'::jsonb, 'd', 'h')$$,
  '42501',
  null,
  'role anon tidak memiliki izin execute pada create_order'
);

set local role authenticated;
select throws_ok(
  $$select public.create_order('{}'::jsonb, 'd', 'h')$$,
  '42501',
  null,
  'role authenticated tidak memiliki izin execute pada create_order'
);

select * from finish();
rollback;
