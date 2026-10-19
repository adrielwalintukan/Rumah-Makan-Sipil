# [M4] Editor Grup Pilihan & Opsi Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memungkinkan pemilik warung untuk menambah, mengubah, mengurutkan, dan mengatur ketersediaan (*Tersedia/Habis*) grup pilihan dan opsi menu (seperti varian Panas/Dingin atau level pedas) langsung dari dashboard admin, yang seketika tercermin pada bottom sheet pemesanan pelanggan.

**Architecture:** Penyimpanan data bersifat atomik dalam satu transaksi database PostgreSQL melalui fungsi RPC `save_menu_item_with_options` (ROLLBACK otomatis jika terjadi pelanggaran validasi/constraint). Validasi input dilakukan berlapis via Zod di Route Handler Next.js dan constraint database. Antarmuka pengeditan grup pilihan dan opsi disematkan langsung di form menu (`MenuItemForm`) menggunakan tombol reorder Naik (▲)/Turun (▼) dengan target sentuh $\ge 44\text{ px}$ tanpa library eksternal baru (*ponytail principle*).

**Tech Stack:** Next.js 16 (App Router), TypeScript strict, Supabase (PostgreSQL, RLS, pgTAP), Zod, Tailwind CSS, Lucide React, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-19-m4-menu-options-design.md`

## Global Constraints

- Validasi harga dan mutasi di server; nominal selalu integer Rupiah check (price_delta >= 0, price >= 0).
- Hapus menu selalu menggunakan hapus lunak (`is_active = false`) agar integritas riwayat pesanan (`order_items.options` yang berupa snapshot JSONB) tetap terjaga.
- Target sentuh interaktif pada HP (360 px) wajib $\ge 44\text{ px}$ (`min-h-[44px]`, `min-w-[44px]`).
- Kontras warna teks memenuhi standar WCAG AA ($\ge 4.5:1$ untuk teks normal).
- Tidak ada *em dash* (`—`) pada teks UI atau pesan error (aturan antislop R-02).
- Zero external libraries baru untuk reorder atau form (gunakan HTML standar & manipulasi state React array).
- Seluruh dokumen dan pesan commit menggunakan Conventional Commits dalam Bahasa Indonesia tanpa footer AI.

---

### Task 1: Migrasi PostgreSQL RPC `save_menu_item_with_options` & Test pgTAP

**Files:**
- Create: `supabase/migrations/20261019000000_save_menu_item_with_options.sql`
- Create: `supabase/tests/menu_options_rpc.test.sql`

**Interfaces:**
- Produces: `public.save_menu_item_with_options(p_menu_id uuid, p_item jsonb, p_groups jsonb)` returning `jsonb`

- [ ] **Step 1: Tulis tes pgTAP untuk RPC `save_menu_item_with_options`**

Buat file `supabase/tests/menu_options_rpc.test.sql`:

```sql
begin;
select plan(7);

-- 1. Verifikasi fungsi ada
select has_function('public', 'save_menu_item_with_options', array['uuid', 'jsonb', 'jsonb'], 'Fungsi save_menu_item_with_options harus ada');

-- Setup user & kategori uji
create temp table _test_ctx as
select
  gen_random_uuid() as admin_id,
  gen_random_uuid() as cat_id;

insert into public.admins (user_id)
select admin_id from _test_ctx;

insert into public.categories (id, name, sort_order)
select cat_id, 'Kategori Uji RPC', 1 from _test_ctx;

-- Simulasi role anonim ditolak
set local role anon;
select throws_ok(
  format($$select public.save_menu_item_with_options(null, '{"category_id":"%s","name":"Menu Anon","price":10000}'::jsonb, '[]'::jsonb)$$, (select cat_id from _test_ctx)),
  'Akses ditolak',
  'Anonim tidak boleh mengeksekusi save_menu_item_with_options'
);

-- Simulasi role pemilik terautentikasi
reset role;
set local role authenticated;
select set_config('request.jwt.claims', format('{"sub":"%s"}', (select admin_id from _test_ctx)), true);

-- 2. Test create menu dengan grup & opsi
select lives_ok(
  format($$
    select public.save_menu_item_with_options(
      null,
      '{"category_id":"%s","name":"Kopi RPC","price":15000,"description":"Kopi enak","is_available":true}'::jsonb,
      '[{"name":"Suhu","type":"single","required":true,"sort_order":0,"options":[{"name":"Panas","price_delta":0,"is_available":true,"sort_order":0},{"name":"Dingin","price_delta":2000,"is_available":true,"sort_order":1}]}]'::jsonb
    )
  $$, (select cat_id from _test_ctx)),
  'Pemilik bisa membuat menu baru dengan grup pilihan dan opsi'
);

-- 3. Verifikasi data tersimpan di tabel
select results_eq(
  $$ select name, price from public.menu_items where name = 'Kopi RPC' $$,
  $$ values ('Kopi RPC'::text, 15000::integer) $$,
  'Menu_items Kopi RPC harus tersimpan dengan harga 15000'
);

select results_eq(
  $$ select count(*)::integer from public.options o join public.option_groups g on g.id = o.group_id join public.menu_items m on m.id = g.menu_item_id where m.name = 'Kopi RPC' $$,
  $$ values (2::integer) $$,
  'Harus ada 2 opsi tersimpan untuk Kopi RPC'
);

-- 4. Test update menu: ubah opsi & tambah opsi baru
select lives_ok(
  format($$
    with m as (select id from public.menu_items where name = 'Kopi RPC' limit 1),
         g as (select id from public.option_groups where name = 'Suhu' limit 1),
         opt as (select id from public.options where name = 'Dingin' limit 1)
    select public.save_menu_item_with_options(
      m.id,
      '{"name":"Kopi RPC Updated","price":16000}'::jsonb,
      jsonb_build_array(
        jsonb_build_object(
          'id', g.id,
          'name', 'Suhu Pilihan',
          'type', 'single',
          'required', true,
          'sort_order', 0,
          'options', jsonb_build_array(
            jsonb_build_object('id', opt.id, 'name', 'Dingin Banget', 'price_delta', 3000, 'is_available', false, 'sort_order', 0),
            jsonb_build_object('name', 'Hangat Sedang', 'price_delta', 1000, 'is_available', true, 'sort_order', 1)
          )
        )
      )
    )
    from m, g, opt
  $$),
  'Pemilik bisa mengupdate menu, grup, dan opsi yang ada'
);

-- 5. Test rollback jika constraint dilanggar (misal price_delta negatif)
select throws_ok(
  format($$
    with m as (select id from public.menu_items where name = 'Kopi RPC Updated' limit 1)
    select public.save_menu_item_with_options(
      m.id,
      '{"name":"Kopi Invalid"}'::jsonb,
      '[{"name":"Invalid Group","type":"single","required":false,"sort_order":0,"options":[{"name":"Bad","price_delta":-500,"is_available":true,"sort_order":0}]}]'::jsonb
    )
    from m
  $$),
  null,
  'Transaksi harus gagal dan rollback jika price_delta negatif'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Jalankan pgTAP untuk memastikan tes gagal (RED)**

Run:
```bash
npx supabase test db --debug supabase/tests/menu_options_rpc.test.sql
```
Expected: FAIL karena fungsi `save_menu_item_with_options` belum ada.

- [ ] **Step 3: Buat implementasi migrasi SQL `save_menu_item_with_options`**

Buat file `supabase/migrations/20261019000000_save_menu_item_with_options.sql`:

```sql
-- Migrasi: Fungsi RPC atomik untuk simpan menu beserta grup pilihan dan opsinya
create or replace function public.save_menu_item_with_options(
  p_menu_id uuid,
  p_item jsonb,
  p_groups jsonb default '[]'::jsonb
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
  v_group_ids_kept uuid[] := array[]::uuid[];

  v_option_elem jsonb;
  v_option_id uuid;
  v_option_ids_kept uuid[] := array[]::uuid[];

  v_result jsonb;
begin
  -- 1. Validasi hak akses pemilik
  if not (select public.is_owner()) then
    raise exception 'Akses ditolak';
  end if;

  -- 2. CREATE atau UPDATE menu_items
  if p_menu_id is null then
    -- CREATE MODE
    v_category_id := (p_item->>'category_id')::uuid;
    if v_category_id is null then
      raise exception 'category_id wajib diisi';
    end if;

    v_name := trim(p_item->>'name');
    if v_name is null or length(v_name) = 0 then
      raise exception 'Nama menu wajib diisi';
    end if;

    v_price := (p_item->>'price')::integer;
    if v_price is null or v_price < 0 then
      raise exception 'Harga tidak valid';
    end if;

    v_description := nullif(trim(p_item->>'description'), '');
    v_image_path := nullif(trim(p_item->>'image_path'), '');
    v_is_available := coalesce((p_item->>'is_available')::boolean, true);

    if p_item->'sort_order' is not null and (p_item->>'sort_order')::integer > 0 then
      v_sort_order := (p_item->>'sort_order')::integer;
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

    -- Update hanya field yang disertakan
    update public.menu_items
    set
      category_id = coalesce((p_item->>'category_id')::uuid, category_id),
      name = coalesce(nullif(trim(p_item->>'name'), ''), name),
      description = case when p_item ? 'description' then nullif(trim(p_item->>'description'), '') else description end,
      price = coalesce((p_item->>'price')::integer, price),
      image_path = case when p_item ? 'image_path' then nullif(trim(p_item->>'image_path'), '') else image_path end,
      is_available = coalesce((p_item->>'is_available')::boolean, is_available),
      sort_order = coalesce((p_item->>'sort_order')::integer, sort_order)
    where id = v_menu_id and is_active = true;

    if not found then
      raise exception 'Menu tidak ditemukan atau sudah tidak aktif';
    end if;
  end if;

  -- 3. Sinkronisasi option_groups jika p_groups disertakan
  if p_groups is not null and jsonb_typeof(p_groups) = 'array' then
    for v_group_elem in select * from jsonb_array_elements(p_groups)
    loop
      v_group_id := (v_group_elem->>'id')::uuid;

      if v_group_id is not null and exists (select 1 from public.option_groups where id = v_group_id and menu_item_id = v_menu_id) then
        -- UPDATE grup yang ada
        update public.option_groups
        set
          name = trim(v_group_elem->>'name'),
          type = v_group_elem->>'type',
          required = coalesce((v_group_elem->>'required')::boolean, false),
          sort_order = coalesce((v_group_elem->>'sort_order')::integer, 0)
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
          trim(v_group_elem->>'name'),
          v_group_elem->>'type',
          coalesce((v_group_elem->>'required')::boolean, false),
          coalesce((v_group_elem->>'sort_order')::integer, 0)
        )
        returning id into v_group_id;
      end if;

      v_group_ids_kept := array_append(v_group_ids_kept, v_group_id);

      -- Sinkronisasi options dalam grup ini
      v_option_ids_kept := array[]::uuid[];

      if v_group_elem->'options' is not null and jsonb_typeof(v_group_elem->'options') = 'array' then
        for v_option_elem in select * from jsonb_array_elements(v_group_elem->'options')
        loop
          v_option_id := (v_option_elem->>'id')::uuid;

          if v_option_id is not null and exists (select 1 from public.options where id = v_option_id and group_id = v_group_id) then
            -- UPDATE opsi yang ada
            update public.options
            set
              name = trim(v_option_elem->>'name'),
              price_delta = coalesce((v_option_elem->>'price_delta')::integer, 0),
              is_available = coalesce((v_option_elem->>'is_available')::boolean, true),
              sort_order = coalesce((v_option_elem->>'sort_order')::integer, 0)
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
              trim(v_option_elem->>'name'),
              coalesce((v_option_elem->>'price_delta')::integer, 0),
              coalesce((v_option_elem->>'is_available')::boolean, true),
              coalesce((v_option_elem->>'sort_order')::integer, 0)
            )
            returning id into v_option_id;
          end if;

          v_option_ids_kept := array_append(v_option_ids_kept, v_option_id);
        end loop;
      end if;

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
```

- [ ] **Step 4: Jalankan tes pgTAP untuk memastikan lulus (GREEN)**

Run:
```bash
npx supabase test db
```
Expected: PASS untuk seluruh test suite termasuk `menu_options_rpc.test.sql`.

- [ ] **Step 5: Commit migrasi & test**

```bash
git add supabase/migrations/20261019000000_save_menu_item_with_options.sql supabase/tests/menu_options_rpc.test.sql
git commit -m "feat(db): fungsi RPC save_menu_item_with_options untuk simpan menu dan grup pilihan secara atomik"
```

---

### Task 2: Skema Validasi Zod `optionSchema`, `optionGroupSchema`, & `menuItemWithGroupsSchema`

**Files:**
- Modify: `lib/admin-menu-schemas.ts`
- Modify: `lib/admin-menu-schemas.test.ts`

**Interfaces:**
- Produces: `optionSchema`, `optionGroupSchema`, `menuItemWithGroupsSchema`, types `OptionInput`, `OptionGroupInput`, `MenuItemWithGroupsInput`

- [ ] **Step 1: Tulis tes unit gagal untuk skema opsi dan grup pilihan**

Tambahkan blok uji di `lib/admin-menu-schemas.test.ts`:
- Uji validasi `optionSchema`: nama 1–50 karakter, price_delta $\ge 0$, is_available boolean, sort_order $\ge 0$, id UUID opsional.
- Uji validasi `optionGroupSchema`: nama 1–50 karakter, type `single` atau `multiple`, required boolean, options array minimal 1 opsi, deteksi nama opsi duplikat dalam satu grup.
- Uji validasi `menuItemWithGroupsSchema`: menu tanpa grup pilihan (array kosong) diizinkan, menu dengan grup divalidasi, deteksi nama grup duplikat dalam satu menu.

- [ ] **Step 2: Jalankan tes Vitest untuk verifikasi RED**

Run:
```bash
npx vitest run lib/admin-menu-schemas.test.ts
```
Expected: FAIL karena skema belum diekspor.

- [ ] **Step 3: Implementasikan skema di `lib/admin-menu-schemas.ts`**

Ekspor skema Zod `optionSchema`, `optionGroupSchema`, `menuItemWithGroupsSchema`, dan TypeScript types yang sesuai, dengan `.strict()` dan `superRefine` untuk duplikasi nama.

- [ ] **Step 4: Jalankan tes Vitest untuk verifikasi GREEN**

Run:
```bash
npx vitest run lib/admin-menu-schemas.test.ts
```
Expected: PASS semua tes skema.

- [ ] **Step 5: Commit**

```bash
git add lib/admin-menu-schemas.ts lib/admin-menu-schemas.test.ts
git commit -m "feat(menu): skema validasi Zod untuk grup pilihan dan opsi menu"
```

---

### Task 3: Integrasi API Route Handlers Menu (`POST`, `PATCH`, `GET`) dengan RPC

**Files:**
- Modify: `app/api/admin/menu/route.ts`
- Modify: `app/api/admin/menu/[id]/route.ts`
- Modify: `app/api/admin/menu/menu-api.test.ts`

**Interfaces:**
- Consumes: `menuItemWithGroupsSchema` from `@/lib/admin-menu-schemas`
- Calls: `supabase.rpc("save_menu_item_with_options", { ... })`

- [ ] **Step 1: Tulis tes unit API gagal di `app/api/admin/menu/menu-api.test.ts`**

Tambahkan skenario:
- `POST /api/admin/menu` berhasil membuat menu dengan `option_groups` bersarang dan mengembalikan status 201.
- `POST /api/admin/menu` menolak payload dengan grup yang tidak memiliki opsi (400 Bad Request).
- `PATCH /api/admin/menu/[id]` berhasil mengupdate grup dan opsi menu secara atomik.
- `GET /api/admin/menu/[id]` mengembalikan data menu beserta `option_groups` dan `options`.

- [ ] **Step 2: Jalankan tes untuk verifikasi RED**

Run:
```bash
npx vitest run app/api/admin/menu/menu-api.test.ts
```
Expected: FAIL pada tes baru.

- [ ] **Step 3: Implementasikan pemanggilan RPC di route handlers**

- Di `app/api/admin/menu/route.ts`:
  - Parse request body dengan `menuItemWithGroupsSchema`.
  - Panggil `supabase.rpc("save_menu_item_with_options", { p_menu_id: null, p_item: ..., p_groups: parseResult.data.option_groups })`.
  - Kembalikan `NextResponse.json(data, { status: 201 })`.
- Di `app/api/admin/menu/[id]/route.ts`:
  - Pada `GET`: query select menyertakan `option_groups(id, name, type, required, sort_order, options(id, name, price_delta, is_available, sort_order))`.
  - Pada `PATCH`: jika `option_groups` disertakan di body, validasi dengan `z.array(optionGroupSchema)` dan panggil `save_menu_item_with_options` dengan `p_menu_id: id`. Pertahankan mitigasi pembersihan foto lama jika `image_path` berubah.

- [ ] **Step 4: Jalankan tes Vitest untuk verifikasi GREEN**

Run:
```bash
npx vitest run app/api/admin/menu/menu-api.test.ts
```
Expected: PASS seluruh tes API.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/menu/route.ts app/api/admin/menu/[id]/route.ts app/api/admin/menu/menu-api.test.ts
git commit -m "feat(api): integrasi endpoint menu admin dengan RPC save_menu_item_with_options"
```

---

### Task 4: Komponen UI `OptionGroupEditor`

**Files:**
- Create: `components/admin/menu/option-group-editor.tsx`

**Interfaces:**
- Produces: `OptionGroupEditor` component with props `groups: OptionGroupFormData[]`, `onChange: (groups: OptionGroupFormData[]) => void`, `disabled?: boolean`, `errors?: Record<string, string>`

- [ ] **Step 1: Buat tipe data form grup & opsi di `components/admin/menu/option-group-editor.tsx`**

Definisikan tipe:
```typescript
export interface OptionFormData {
  id?: string;
  name: string;
  price_delta: number;
  is_available: boolean;
  sort_order: number;
}

export interface OptionGroupFormData {
  id?: string;
  name: string;
  type: "single" | "multiple";
  required: boolean;
  sort_order: number;
  options: OptionFormData[];
}
```

- [ ] **Step 2: Implementasikan komponen `OptionGroupEditor`**

- Tombol "+ Tambah Grup Pilihan" (`Button variant="outline"`, target sentuh $\ge 44\text{ px}$).
- Kartu Grup Pilihan:
  - Header: Input teks nama grup, tombol pilih tipe (Radio/Tab `Pilih Satu` / `Boleh Lebih dari Satu`), checkbox `Wajib dipilih pelanggan`, tombol Naik (▲) & Turun (▼), tombol Hapus Grup (🗑️).
  - Baris opsi:
    - Tombol urutan opsi Naik (▲) dan Turun (▼).
    - Input nama opsi (placeholder: "Misal: Panas, Dingin").
    - Input harga delta (angka Rupiah bulat, default 0).
    - Switch toggle ketersediaan: "Tersedia / Habis".
    - Tombol Hapus Opsi (🗑️).
  - Tombol "+ Tambah Opsi" (target sentuh $\ge 44\text{ px}$).
  - Responsif: tidak ada overflow horizontal pada 360 px, label jelas, kontras AA, tanpa em dash.

- [ ] **Step 3: Verifikasi lint dan typecheck**

Run:
```bash
npm run lint && npm run typecheck
```
Expected: PASS tanpa error.

- [ ] **Step 4: Commit**

```bash
git add components/admin/menu/option-group-editor.tsx
git commit -m "feat(admin): buat komponen editor grup pilihan dan opsi menu"
```

---

### Task 5: Integrasi `OptionGroupEditor` ke `MenuItemForm` & Halaman Edit

**Files:**
- Modify: `components/admin/menu/menu-item-form.tsx`
- Modify: `app/admin/(dashboard)/menu/[id]/page.tsx`

**Interfaces:**
- Consumes: `OptionGroupEditor` from `@/components/admin/menu/option-group-editor`
- Updates: `MenuItemFormData` to include `option_groups: OptionGroupFormData[]`

- [ ] **Step 1: Perbarui tipe `MenuItemFormData` di `components/admin/menu/menu-item-form.tsx`**

Tambahkan field `option_groups: OptionGroupFormData[]` pada `MenuItemFormData`.

- [ ] **Step 2: Sisipkan `OptionGroupEditor` di form `MenuItemForm`**

- Tambahkan state `optionGroups` yang diinisialisasi dari `initialData?.option_groups ?? []`.
- Validasi sisi klien sebelum submit: pastikan setiap grup memiliki minimal 1 opsi dan tidak ada nama duplikat. Tampilkan pesan kesalahan ramah pengguna jika ada grup yang belum lengkap.
- Sertakan `option_groups` dalam payload yang dikirim ke `saveMenuItemWithPhotoCleanup`.

- [ ] **Step 3: Perbarui loader halaman edit di `app/admin/(dashboard)/menu/[id]/page.tsx`**

Query select diperluas menyertakan:
```typescript
"id, category_id, name, description, price, image_path, is_available, sort_order, option_groups(id, name, type, required, sort_order, options(id, name, price_delta, is_available, sort_order))"
```
Sortir `option_groups` dan `options` berdasarkan `sort_order` sebelum dimasukkan ke `initialData`.

- [ ] **Step 4: Verifikasi build lokal**

Run:
```bash
npm run lint && npm run typecheck && npm test && npm run build
```
Expected: PASS tanpa error, seluruh 21 rute terkompilasi.

- [ ] **Step 5: Commit**

```bash
git add components/admin/menu/menu-item-form.tsx app/admin/\(dashboard\)/menu/\[id\]/page.tsx
git commit -m "feat(admin): integrasi editor grup pilihan ke form tambah dan ubah menu"
```

---

### Task 6: Pengujian End-to-End Playwright & Sinkronisasi Roadmap

**Files:**
- Create: `e2e/admin-menu-options.spec.ts`
- Modify: `docs/roadmap.md`

**Interfaces:**
- Playwright E2E test covering full customer & admin lifecycle for menu options

- [ ] **Step 1: Tulis tes Playwright `e2e/admin-menu-options.spec.ts`**

Alur pengujian:
1. Otentikasi admin.
2. Buat kategori sintetis dan menu baru "Kopi E2E Options" dengan:
   - Grup 1 (Single, Wajib): "Varian Suhu" $\to$ "Panas (Rp 0)", "Dingin (+Rp 2.000)".
   - Grup 2 (Multiple, Opsional): "Topping" $\to$ "Jelly (+Rp 3.000)".
3. Kunjungi halaman pelanggan `/`, klik kartu "Kopi E2E Options".
4. Verifikasi bottom sheet pilihan muncul dengan opsi "Panas" dan "Dingin", pilih "Dingin", verifikasi total harga berubah menjadi Rp 17.000.
5. Kembali ke admin `/admin/menu/[id]`, ubah opsi "Dingin" menjadi "Habis", lalu simpan.
6. Buka kembali halaman pelanggan `/`, verifikasi opsi "Dingin" berstatus disabled (tidak bisa diklik).
7. Kembali ke admin, tambah opsi "Es Batu (+Rp 1.000)" pada grup dan hapus grup "Topping", lalu simpan.
8. Buka kembali halaman pelanggan, verifikasi perubahan berhasil diterapkan.
9. `afterAll` teardown: hapus menu sintetis, kategori sintetis, admin sintetis, dan pulihkan pengaturan toko.

- [ ] **Step 2: Perbarui checklist di `docs/roadmap.md`**

Tandai selesai:
```markdown
- [x] Editor grup pilihan & opsi
```

- [ ] **Step 3: Jalankan verifikasi menyeluruh lokal**

Run:
```bash
npm run lint
npm run typecheck
npm test
npm run build
```
Expected: PASS seluruh pemeriksaan (0 error).

- [ ] **Step 4: Commit**

```bash
git add e2e/admin-menu-options.spec.ts docs/roadmap.md
git commit -m "test(e2e): tambah pengujian alur editor grup pilihan opsi dan sinkronkan roadmap"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Semua requirement dari spec tercakup: RPC PostgreSQL atomik, Zod schema, API route handlers, OptionGroupEditor UI, integrasi form, Playwright E2E, dan sinkronisasi roadmap.
- [x] **No Placeholders:** Setiap task mendefinisikan path file eksplisit, tipe interface, kode step, dan perintah verifikasi.
- [x] **Aturan domain & anti-slop:** Target sentuh $\ge 44\text{ px}$, validasi server, tidak ada em dash, tidak ada library eksternal baru (*ponytail*), dan tidak mengubah riwayat pesanan lama.
