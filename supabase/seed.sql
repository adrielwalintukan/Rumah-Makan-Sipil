-- Data menu awal dari docs/menu-seed.md. Baris settings ada di migrasi.

insert into public.categories (name, sort_order)
values ('Makanan', 1), ('Minuman', 2);

insert into public.menu_items (category_id, name, description, price, sort_order)
select c.id, v.name, v.description, v.price, v.sort_order
from (values
  ('Makanan', 'Nasi Campur', null, 15000, 1),
  ('Makanan', 'Nasi Telur', null, 10000, 2),
  ('Makanan', 'Miedal/Tinutuan', null, 10000, 3),
  ('Makanan', 'Cotto Ayam', 'Laksa / Mie / Nasi', 15000, 4),
  ('Makanan', 'Gorengan (isi 4)', null, 5000, 5),
  ('Makanan', 'Mie', 'Kuah / Goreng, bisa tambah telur', 7000, 6),
  ('Minuman', 'Teh Manis', 'Panas / Dingin', 5000, 1),
  ('Minuman', 'Kopi', 'Golda, Good Day Cappuccino', 5000, 2),
  ('Minuman', 'Susu', null, 7000, 3),
  ('Minuman', 'Soda', 'Coca Cola / Fanta / Sprite', 7000, 4),
  ('Minuman', 'Aqua', null, 5000, 5)
) as v (category, name, description, price, sort_order)
join public.categories c on c.name = v.category;

insert into public.option_groups (menu_item_id, name, type, required, sort_order)
select m.id, v.name, v.type, v.required, v.sort_order
from (values
  ('Cotto Ayam', 'Pilihan', 'single', true, 1),
  ('Mie', 'Jenis', 'single', true, 1),
  ('Mie', 'Tambahan', 'multiple', false, 2),
  ('Teh Manis', 'Penyajian', 'single', true, 1),
  ('Kopi', 'Jenis', 'single', true, 1),
  ('Kopi', 'Penyajian', 'single', true, 2),
  ('Soda', 'Pilihan', 'single', true, 1)
) as v (menu, name, type, required, sort_order)
join public.menu_items m on m.name = v.menu;

insert into public.options (group_id, name, price_delta, sort_order)
select g.id, v.name, v.price_delta, v.sort_order
from (values
  ('Cotto Ayam', 'Pilihan', 'Laksa', 0, 1),
  ('Cotto Ayam', 'Pilihan', 'Mie', 0, 2),
  ('Cotto Ayam', 'Pilihan', 'Nasi', 0, 3),
  ('Mie', 'Jenis', 'Kuah', 0, 1),
  ('Mie', 'Jenis', 'Goreng', 0, 2),
  ('Mie', 'Tambahan', 'Telur', 3000, 1),
  ('Teh Manis', 'Penyajian', 'Panas', 0, 1),
  ('Teh Manis', 'Penyajian', 'Dingin', 0, 2),
  ('Kopi', 'Jenis', 'Golda', 0, 1),
  ('Kopi', 'Jenis', 'Good Day Cappuccino', 0, 2),
  ('Kopi', 'Penyajian', 'Panas', 0, 1),
  ('Kopi', 'Penyajian', 'Dingin', 0, 2),
  ('Soda', 'Pilihan', 'Coca Cola', 0, 1),
  ('Soda', 'Pilihan', 'Fanta', 0, 2),
  ('Soda', 'Pilihan', 'Sprite', 0, 3)
) as v (menu, grp, name, price_delta, sort_order)
join public.menu_items m on m.name = v.menu
join public.option_groups g on g.menu_item_id = m.id and g.name = v.grp;
