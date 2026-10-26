# Spesifikasi Desain: Editor Grup Pilihan & Opsi Menu (Issue #18)

- **Milestone:** M4 (Kelola menu & pengaturan)
- **Fitur / User Story:** US-13, D6 (Kelola menu)
- **Issue Terkait:** Closes #18
- **Dokumen Acuan:** `docs/PRD.md §4.2 (US-13)`, `docs/architecture.md §4–6`, `docs/design-system.md §5 & §6.2`, `docs/roadmap.md`
- **Tanggal:** 19 Oktober 2026
- **Status:** Approved

---

## 1. Latar Belakang & Tujuan

Pada Milestone M4, pemilik warung (koki sekaligus kasir) perlu dapat menambahkan kustomisasi menu seperti varian suhu (Panas/Dingin), level pedas (Sedang/Pedas), atau tambahan (Telur/Tahu) langsung dari dashboard.

Kriteria penerimaan:
1. Pemilik menambah jenis kopi baru beserta pilihannya (misalnya "Panas", "Dingin") $\to$ langsung muncul di bottom sheet pilihan pelanggan.
2. Opsi yang ditandai "Habis" tampil nonaktif di bottom sheet pelanggan (sudah didukung di M1).
3. Transaksi penyimpanan bersifat atomik: menu beserta seluruh grup dan opsi disimpan atau dirollback secara serentak jika ada kegagalan validasi.
4. Riwayat pesanan lama (`order_items.options`) tidak terpengaruh jika grup atau opsi menu diubah/dihapus karena telah disimpan dalam bentuk *snapshot* JSONB.

---

## 2. Arsitektur Database & RPC Atomik

Tabel `option_groups` dan `options` sudah didefinisikan pada migrasi awal:
- `public.option_groups`: `id (uuid PK)`, `menu_item_id (uuid FK on delete cascade)`, `name (text)`, `type (single|multiple)`, `required (bool)`, `sort_order (int)`.
- `public.options`: `id (uuid PK)`, `group_id (uuid FK on delete cascade)`, `name (text)`, `price_delta (int >= 0)`, `is_available (bool)`, `sort_order (int)`.

### 2.1 Fungsi PostgreSQL RPC

Dibuat file migrasi `supabase/migrations/20261019000000_save_menu_item_with_options.sql`:

```sql
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
-- Hanya pemilik yang berhak mengeksekusi
-- Jika p_menu_id IS NULL: INSERT menu_items baru
-- Jika p_menu_id IS NOT NULL: UPDATE menu_items yang ada
-- Sinkronisasi option_groups (delete yang hilang, insert baru, update yang ada)
-- Sinkronisasi options per group (delete yang hilang, insert baru, update yang ada)
-- Mengembalikan objek menu lengkap beserta array option_groups dan options
$$;
```

Aturan atomisitas & keamanan:
1. `SECURITY DEFINER` dengan pengecekan `if not (select public.is_owner()) then raise exception 'Akses ditolak'; end if;`.
2. Jika ada opsi atau grup yang melanggar batasan database (panjang karakter, tipe, atau harga negatif), fungsi otomatis melemparkan exception dan seluruh transaksi dirollback.
3. Hak eksekusi diberikan ke `authenticated`, dicabut dari `anon`.

### 2.2 Pengujian pgTAP (`supabase/tests/menu_options_rpc.test.sql`)

- Menguji pembuatan menu baru dengan grup pilihan tunggal (*single*) dan majemuk (*multiple*).
- Menguji pembaruan menu: menambah opsi baru, mengubah harga opsi, mengubah ketersediaan opsi (`is_available = false`).
- Menguji penghapusan grup/opsi yang tidak disertakan dalam payload (memastikan cascade delete bersih).
- Menguji penolakan eksekusi untuk user anonim atau non-pemilik.
- Menguji rollback transaksi saat data payload tidak valid.

---

## 3. Skema Validasi Zod & Kontrak API

### 3.1 Skema Zod (`lib/admin-menu-schemas.ts`)

- `optionSchema`:
  - `id`: `z.string().regex(UUID_REGEX).optional()`
  - `name`: `z.string().trim().min(1, "Nama opsi wajib diisi").max(50, "Nama opsi maksimal 50 karakter")`
  - `price_delta`: `z.number().int("Tambahan harga harus bilangan bulat").min(0, "Tambahan harga tidak boleh negatif").default(0)`
  - `is_available`: `z.boolean().default(true)`
  - `sort_order`: `z.number().int().min(0).default(0)`
- `optionGroupSchema`:
  - `id`: `z.string().regex(UUID_REGEX).optional()`
  - `name`: `z.string().trim().min(1, "Nama grup wajib diisi").max(50, "Nama grup maksimal 50 karakter")`
  - `type`: `z.enum(["single", "multiple"])`
  - `required`: `z.boolean().default(false)`
  - `sort_order`: `z.number().int().min(0).default(0)`
  - `options`: `z.array(optionSchema).min(1, "Setiap grup pilihan wajib memiliki minimal 1 opsi")`
  - `superRefine`: memastikan tidak ada nama opsi yang duplikat dalam satu grup (case-insensitive).
- `menuItemSchema` / `menuItemWithGroupsSchema`:
  - Menyertakan `option_groups: z.array(optionGroupSchema).default([])`.
  - `superRefine`: memastikan tidak ada nama grup yang duplikat dalam satu menu (case-insensitive).

### 3.2 Kontrak API

- `POST /api/admin/menu`:
  - Menerima payload menu lengkap termasuk `option_groups: [...]`.
  - Memanggil `rpc("save_menu_item_with_options", { p_menu_id: null, p_item, p_groups })`.
  - Mengembalikan `201 Created` dengan data menu lengkap.
- `PATCH /api/admin/menu/[id]`:
  - Menerima mutasi data menu dan `option_groups: [...]`.
  - Jika terdapat pembaruan `image_path`, tetap mempertahankan mitigasi pembersihan file foto lama dari storage jika referensi nol.
  - Memanggil RPC untuk menyimpan perubahan secara atomik.
- `GET /api/admin/menu/[id]`:
  - Mengambil data menu beserta `option_groups(id, name, type, required, sort_order, options(id, name, price_delta, is_available, sort_order))` terurut berdasarkan `sort_order`.

---

## 4. Antarmuka Pengguna: `OptionGroupEditor`

### 4.1 Komponen `OptionGroupEditor` (`components/admin/menu/option-group-editor.tsx`)

- Komponen berbasis form bebas (*free-form builder*), tanpa library eksternal baru (*ponytail principle*).
- Tombol "+ Tambah Grup Pilihan" berukuran minimal 44 px.
- Kartu Grup Pilihan:
  - Header grup:
    - Input nama grup (`text-sm`, label "Nama Grup Pilihan").
    - Pilihan tipe: Radio atau Toggle pill "Pilih Satu (Single)" vs "Boleh Lebih dari Satu (Multiple)".
    - Checkbox: "Wajib dipilih pelanggan".
    - Tombol urutan: Naik (▲) dan Turun (▼) dengan target sentuh $\ge 44\text{ px}$.
    - Tombol Hapus Grup (🗑️) dengan dialog konfirmasi jika grup telah berisi opsi.
  - Daftar opsi dalam grup:
    - Baris opsi responsif (di layar 360 px mengalir vertikal ringkas 2 baris; di desktop 1 baris).
    - Tombol urutan opsi (▲, ▼).
    - Input nama opsi (placeholder: "Misal: Panas, Dingin").
    - Input tambahan harga (+ Rp, default 0, nominal Rupiah bulat).
    - Switch toggle ketersediaan: **Tersedia / Habis** untuk opsi tersebut.
    - Tombol Hapus Opsi (🗑️).
  - Tombol "+ Tambah Opsi" di bawah daftar.

### 4.2 Integrasi di `MenuItemForm` & Halaman Edit

- Disematkan di `components/admin/menu/menu-item-form.tsx` di bawah kartu foto dan di atas tombol aksi simpan/batal.
- Halaman `app/admin/(dashboard)/menu/[id]/page.tsx` memuat `option_groups` secara lengkap saat server-side render dan memasukkannya ke `initialData`.

---

## 5. Rencana Pengujian

1. **Unit Test Vitest:**
   - `lib/admin-menu-schemas.test.ts`: uji validasi Zod untuk opsi, grup pilihan, minimal 1 opsi, dan deteksi duplikat nama.
   - `app/api/admin/menu/menu-api.test.ts`: uji POST & PATCH menu dengan grup & opsi, verifikasi response JSON, dan penolakan payload cacat.
2. **Database Test pgTAP:**
   - `supabase/tests/menu_options_rpc.test.sql`: uji eksekusi fungsi RPC, integritas data, dan rollback atomik.
3. **End-to-End Test Playwright (`e2e/admin-menu-options.spec.ts`):**
   - Pemilik login admin $\to$ buat menu "Kopi Tubruk" dengan grup "Varian Suhu" (Panas Rp 0, Dingin +Rp 2.000) $\to$ cek di halaman pelanggan `/` bottom sheet menampilkan opsi dan perhitungan harga yang tepat.
   - Kembali ke admin $\to$ ubah opsi "Dingin" menjadi "Habis" $\to$ cek di halaman pelanggan bahwa "Dingin" tampil nonaktif (disabled) dan tidak bisa dipilih.
   - Tambah opsi baru "Extra Susu +Rp 3.000" $\to$ verifikasi tersimpan dan muncul di pelanggan.
   - Teardown otomatis di `afterAll` membersihkan semua data sintetis.
