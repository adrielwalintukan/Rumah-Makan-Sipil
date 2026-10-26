# Pengaturan Toko & Keamanan Akun Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengimplementasikan fitur Pengaturan Toko lengkap (Issue #19) mencakup pengelolaan bucket storage `store` untuk QRIS DANA Bisnis, formulir data toko (WhatsApp, nama toko, tagline, harga Paket Dos), formulir ganti password pemilik, serta integrasi pembaruan ke antarmuka publik pelanggan.

**Architecture:** 
- Storage bucket `store` di Supabase Storage dengan RLS baca publik dan tulis/hapus hanya pemilik (`public.is_owner()`).
- Endpoint Route Handler REST `GET /api/admin/settings` dan `PATCH /api/admin/settings` dengan validasi Zod ketat (`updateStoreSettingsSchema`) dan *defensive cleanup* foto QRIS lama.
- Komponen antarmuka admin di `/admin/pengaturan` terpisah menjadi dua kartu mandiri (Profil & Toko, Keamanan Akun) dengan kompresi QRIS browser tanpa pemotongan rasio, direct upload ke Supabase Storage, serta pemanggilan `supabase.auth.updateUser` untuk ganti password.
- Pengujian komprehensif: pgTAP untuk Storage RLS, Vitest untuk skema/kompresi/API, dan Playwright untuk alur E2E mobile-first.

**Tech Stack:** Next.js 16 (App Router, Turbopack), TypeScript, Tailwind CSS, shadcn/ui (Radix UI), Supabase Postgres, Supabase Storage, Supabase Auth, Zod, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-20-m4-store-settings-design.md`

## Global Constraints

- Wajib menggunakan Conventional Commits dengan deskripsi dalam Bahasa Indonesia dan **tanpa footer AI** (AGENTS.md §13).
- Tidak ada em dash (`—`) dalam teks UI atau pesan error; gunakan tanda hubung, koma, titik dua, atau tanda kurung (antislop R-02).
- Target sentuh interaktif pada HP (360px viewport) wajib minimal 44px (`min-h-[44px] min-w-[44px]`) (AGENTS.md §8.9, antislop R-03).
- Kontras warna teks memenuhi standar WCAG AA (`text-ink-900`, `text-ink-700`) (AGENTS.md §8.9, antislop R-25).
- Hanya pemilik toko (`authenticated` dengan `public.is_owner()`) yang dapat mengubah pengaturan atau mengunggah gambar QRIS.
- Nomor WhatsApp wajib divalidasi dengan regex `^62[0-9]{8,13}$` sesuai check constraint database.
- Gambar QRIS dikompresi tanpa crop paksa (mempertahankan rasio asli) agar kode QR tetap dapat dibaca oleh kamera pelanggan.

---

### Task 1: Migrasi Supabase Storage Bucket `store` & Kebijakan RLS + Test pgTAP

**Files:**
- Create: `supabase/migrations/20261020000000_store_storage.sql`
- Test: `supabase/tests/storage_store.test.sql`

**Interfaces:**
- Produces: Bucket `store` pada schema `storage.buckets`, kebijakan RLS baca publik pada `storage.objects` untuk bucket `store`, dan kebijakan insert/update/delete hanya untuk pemilik toko (`public.is_owner()`).

- [ ] **Step 1: Tulis tes pgTAP untuk bucket `store` dan RLS**

Tulis suite pgTAP di `supabase/tests/storage_store.test.sql` yang memverifikasi:
1. Bucket `store` terdaftar dengan `public = true`.
2. Role `anon` dapat membaca (`SELECT`) objek di bucket `store`.
3. Role `anon` ditolak saat mencoba `INSERT`, `UPDATE`, atau `DELETE`.
4. Role `authenticated` non-pemilik ditolak saat mencoba mutasi.
5. Role `authenticated` pemilik (`is_owner() = true`) dapat melakukan `INSERT`, `UPDATE`, dan `DELETE`.

- [ ] **Step 2: Jalankan tes untuk memastikan gagal (RED)**

Jalankan: `npx supabase test db` (atau via CI).
Ekspektasi: Gagal karena bucket `store` dan kebijakannya belum dibuat.

- [ ] **Step 3: Tulis migrasi SQL bucket `store`**

Tulis di `supabase/migrations/20261020000000_store_storage.sql`:
```sql
-- Migrasi Supabase Storage: Bucket store dan Kebijakan RLS (Issue #19)

-- 1. Buat atau perbarui konfigurasi bucket store
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'store',
  'store',
  true,
  5242880, -- 5 MB (5 * 1024 * 1024)
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 2. Kebijakan RLS storage.objects untuk bucket store

-- Baca publik untuk anon dan authenticated
drop policy if exists "store_public_read" on storage.objects;
create policy "store_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'store');

-- Pemilik toko dapat mengunggah file
drop policy if exists "store_owner_insert" on storage.objects;
create policy "store_owner_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'store'
    and (select public.is_owner())
  );

-- Pemilik toko dapat memperbarui file
drop policy if exists "store_owner_update" on storage.objects;
create policy "store_owner_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'store'
    and (select public.is_owner())
  )
  with check (
    bucket_id = 'store'
    and (select public.is_owner())
  );

-- Pemilik toko dapat menghapus file
drop policy if exists "store_owner_delete" on storage.objects;
create policy "store_owner_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'store'
    and (select public.is_owner())
  );
```

- [ ] **Step 4: Jalankan tes untuk memastikan lulus (GREEN)**

Verifikasi sintaks dan struktur SQL.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261020000000_store_storage.sql supabase/tests/storage_store.test.sql
git commit -m "feat(db): buat bucket storage store beserta kebijakan RLS untuk aset toko"
```

---

### Task 2: Skema Validasi Zod `updateStoreSettingsSchema` & Unit Tests

**Files:**
- Modify: `lib/admin-settings.ts`
- Modify: `lib/admin-settings.test.ts`

**Interfaces:**
- Produces: `updateStoreSettingsSchema`, `UpdateStoreSettingsInput`, `STORE_QRIS_PATH_REGEX`.
- Consumes: Zod library.

- [ ] **Step 1: Tulis tes unit yang gagal di `lib/admin-settings.test.ts` (RED)**

Tambahkan pengujian untuk `updateStoreSettingsSchema`:
1. Menerima data valid lengkap: `{ store_name: "Rumah Makan Sipil", tagline: "Makan Enak", whatsapp_number: "62895806567230", dos_price: 25000, qris_image_path: "qris/dana.webp", is_open: true }`.
2. Menolak `store_name` kosong atau lebih dari 100 karakter.
3. Menolak `tagline` lebih dari 150 karakter.
4. Menolak format `whatsapp_number` yang tidak diawali 62 atau memiliki panjang tidak valid (mis. `08123...`, `62123`, `62` + 14 digit).
5. Menerima `whatsapp_number` valid `62895806567230`.
6. Menolak `dos_price` negatif atau non-integer.
7. Menerima `qris_image_path` null atau format valid `qris/xxx.webp`.
8. Menolak `qris_image_path` dengan ekstensi atau direktori tidak valid (mis. `items/xxx.webp`, `qris/xxx.gif`).
9. Menolak field tambahan yang tidak dikenal (`.strict()`).

- [ ] **Step 2: Jalankan tes untuk memastikan gagal (RED)**

Jalankan: `npx vitest run lib/admin-settings.test.ts`
Ekspektasi: FAIL karena `updateStoreSettingsSchema` belum diimplementasikan.

- [ ] **Step 3: Implementasikan skema di `lib/admin-settings.ts` (GREEN)**

Perbarui `lib/admin-settings.ts`:
```ts
import { z } from "zod";

export const updateStoreStatusSchema = z.object({
  is_open: z.boolean({
    message: "Status buka/tutup toko harus berupa boolean.",
  }),
}).strict();

export type UpdateStoreStatusInput = z.infer<typeof updateStoreStatusSchema>;

export const STORE_QRIS_PATH_REGEX = /^qris\/[a-zA-Z0-9_-]+\.(webp|jpg|jpeg|png)$/;

export const updateStoreSettingsSchema = z.object({
  store_name: z
    .string()
    .trim()
    .min(1, "Nama toko wajib diisi")
    .max(100, "Nama toko maksimal 100 karakter"),
  tagline: z
    .string()
    .trim()
    .max(150, "Tagline maksimal 150 karakter")
    .transform((val) => (val === "" ? null : val))
    .nullable()
    .optional(),
  whatsapp_number: z
    .string()
    .trim()
    .regex(
      /^62[0-9]{8,13}$/,
      "Nomor WhatsApp harus diawali 62 dan diikuti 8 sampai 13 digit angka (contoh: 62895806567230)"
    ),
  dos_price: z
    .number({ message: "Harga Paket Dos harus berupa angka" })
    .int("Harga Paket Dos harus berupa bilangan bulat Rupiah")
    .min(0, "Harga Paket Dos tidak boleh negatif"),
  qris_image_path: z
    .string()
    .trim()
    .max(255, "Path gambar QRIS maksimal 255 karakter")
    .transform((val) => (val === "" ? null : val))
    .nullable()
    .optional()
    .refine(
      (val) => val === null || val === undefined || STORE_QRIS_PATH_REGEX.test(val),
      {
        message: "Format path QRIS tidak valid. Harus berupa path relatif dalam folder qris/ (mis. qris/file.webp)",
      }
    ),
  is_open: z.boolean().optional(),
}).strict();

export type UpdateStoreSettingsInput = z.infer<typeof updateStoreSettingsSchema>;
```

- [ ] **Step 4: Jalankan tes untuk memastikan lulus (GREEN)**

Jalankan: `npx vitest run lib/admin-settings.test.ts`
Ekspektasi: PASS (seluruh test case lulus).

- [ ] **Step 5: Commit**

```bash
git add lib/admin-settings.ts lib/admin-settings.test.ts
git commit -m "feat(settings): buat skema validasi Zod updateStoreSettingsSchema"
```

---

### Task 3: Helper Storage URL `STORE_BUCKET`, `getQrisImageUrl`, & Kompresi QRIS

**Files:**
- Modify: `lib/storage.ts`
- Modify: `lib/storage.test.ts`
- Modify: `lib/image-compression.ts`
- Modify: `lib/image-compression.test.ts`

**Interfaces:**
- Produces: `STORE_BUCKET`, `getQrisImageUrl`, `compressQrisPhoto`.

- [ ] **Step 1: Tulis tes unit untuk helper storage QRIS dan kompresi (RED)**

1. Di `lib/storage.test.ts`: uji fungsi `getQrisImageUrl(path)` mengembalikan URL publik Supabase Storage untuk bucket `store`, URL absolut jika diawali http/https, dan null jika null/kosong.
2. Di `lib/image-compression.test.ts`: uji fungsi `compressQrisPhoto(file)` memastikan menghasilkan Blob WebP tanpa crop rasio paksa, dengan ukuran maksimal dimensi yang terjaga.

- [ ] **Step 2: Jalankan tes untuk memastikan gagal (RED)**

Jalankan: `npx vitest run lib/storage.test.ts lib/image-compression.test.ts`
Ekspektasi: FAIL karena fungsi belum didefinisikan.

- [ ] **Step 3: Implementasikan fungsi helper di `lib/storage.ts` dan `lib/image-compression.ts` (GREEN)**

1. Di `lib/storage.ts`:
```ts
export const STORE_BUCKET = "store";

export function getQrisImageUrl(imagePath?: string | null): string | null {
  if (!imagePath || !imagePath.trim()) return null;
  const trimmed = imagePath.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("/")) {
    return trimmed;
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    const baseUrl = supabaseUrl.replace(/\/+$/, "");
    const cleanPath = trimmed.replace(/^\/+/, "");
    return `${baseUrl}/storage/v1/object/public/${STORE_BUCKET}/${cleanPath}`;
  }
  return `/${STORE_BUCKET}/${trimmed}`;
}
```

2. Di `lib/image-compression.ts`:
Tambahkan `compressQrisPhoto(file: File, options?: { maxDimension?: number; quality?: number }): Promise<Blob>` yang mempertahankan aspek rasio gambar asli (aspek rasio natural QRIS), melakukan kompresi Canvas ke format `image/webp` (default kualitas 85%, maxDimension 1200).

- [ ] **Step 4: Jalankan tes untuk memastikan lulus (GREEN)**

Jalankan: `npx vitest run lib/storage.test.ts lib/image-compression.test.ts`
Ekspektasi: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/storage.ts lib/storage.test.ts lib/image-compression.ts lib/image-compression.test.ts
git commit -m "feat(storage): tambah helper getQrisImageUrl dan kompresi foto QRIS"
```

---

### Task 4: Route Handler `app/api/admin/settings/route.ts` & API Unit Tests

**Files:**
- Modify: `app/api/admin/settings/route.ts`
- Create: `app/api/admin/settings/settings-api.test.ts`

**Interfaces:**
- Produces: `GET /api/admin/settings` (return full store settings) dan `PATCH /api/admin/settings` (update settings + defensive cleanup foto QRIS lama).
- Consumes: `getAdminUser()`, `updateStoreSettingsSchema`, `STORE_BUCKET`.

- [ ] **Step 1: Tulis unit test untuk Route Handler `app/api/admin/settings/settings-api.test.ts` (RED)**

Uji skenario:
1. `GET`: mengembalikan 401 jika unauthenticated.
2. `GET`: mengembalikan 200 dan data lengkap `{ store_name, tagline, whatsapp_number, dos_price, qris_image_path, is_open }`.
3. `PATCH`: mengembalikan 401 jika unauthenticated.
4. `PATCH`: mengembalikan 400 jika request body bukan JSON atau melanggar skema.
5. `PATCH`: mengembalikan 200 saat memperbarui profil toko dan menghapus file QRIS lama dari storage jika diganti.
6. `PATCH`: tetap mengembalikan 200 jika penghapusan file lama di storage gagal (*defensive cleanup*).

- [ ] **Step 2: Jalankan tes untuk memastikan gagal (RED)**

Jalankan: `npx vitest run app/api/admin/settings/settings-api.test.ts`
Ekspektasi: FAIL.

- [ ] **Step 3: Implementasikan Route Handler di `app/api/admin/settings/route.ts` (GREEN)**

Perbarui `app/api/admin/settings/route.ts`:
- Perbarui fungsi `GET` agar mengambil kolom `store_name, tagline, whatsapp_number, dos_price, qris_image_path, is_open`.
- Perbarui fungsi `PATCH` agar memvalidasi dengan `updateStoreSettingsSchema`.
- Jika `qris_image_path` berubah, ambil `oldQrisPath` dari database. Jika `oldQrisPath && oldQrisPath !== data.qris_image_path`, panggil `storage.from(STORE_BUCKET).remove([oldQrisPath])` di dalam blok `try-catch`.
- Perbarui baris `settings` `id = 1` dengan seluruh field yang dikirim.
- Panggil `revalidatePath("/")`, `revalidatePath("/admin")`, dan `revalidatePath("/admin/pengaturan")`.
- Kembalikan 200 dengan data terbaru.

- [ ] **Step 4: Jalankan tes untuk memastikan lulus (GREEN)**

Jalankan: `npx vitest run app/api/admin/settings/settings-api.test.ts`
Ekspektasi: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/settings/route.ts app/api/admin/settings/settings-api.test.ts
git commit -m "feat(api): endpoint GET dan PATCH pengaturan toko lengkap dengan pembersihan file lama"
```

---

### Task 5: Komponen Form Pengaturan Toko & Ganti Password di `/admin/pengaturan`

**Files:**
- Create: `components/admin/settings/store-settings-form.tsx`
- Create: `components/admin/settings/change-password-form.tsx`
- Modify: `app/admin/(dashboard)/pengaturan/page.tsx`

**Interfaces:**
- Produces: Komponen `StoreSettingsForm` dan `ChangePasswordForm`.
- Consumes: `updateStoreSettingsSchema`, `getQrisImageUrl`, `compressQrisPhoto`, `STORE_BUCKET`, `supabase.auth.updateUser`.

- [ ] **Step 1: Buat komponen `StoreSettingsForm` di `components/admin/settings/store-settings-form.tsx`**

Komponen form klien untuk pengaturan toko:
- Props: `initialSettings: StoreSettings`.
- State untuk `store_name`, `tagline`, `whatsapp_number`, `dos_price`, pratinjau gambar QRIS, dan file blob hasil kompresi.
- Uploader QRIS:
  - Pratinjau gambar dengan aspek rasio natural (tinggi maks 240px, kontras jelas).
  - Tombol "Pilih Gambar QRIS" / "Ganti Gambar" dan "Hapus Gambar" dengan `min-h-[44px]`.
  - Pilihan file mengompresi gambar via `compressQrisPhoto` dan membuat object URL pratinjau instan (dengan memory leak cleanup `URL.revokeObjectURL`).
- Submit handler:
  - Validasi klien menggunakan `updateStoreSettingsSchema`.
  - Jika ada `processedBlob`, upload langsung ke `store/qris/[uuid].webp`.
  - Kirim PATCH request ke `/api/admin/settings`.
  - Tampilkan toast / pesan feedback sukses berwarna hijau dan status error jika gagal.

- [ ] **Step 2: Buat komponen `ChangePasswordForm` di `components/admin/settings/change-password-form.tsx`**

Komponen form klien untuk ganti password:
- Input `Password Baru` dan `Konfirmasi Password Baru` (minimal 8 karakter).
- Tombol intip password (Show/Hide) min 44px.
- Validasi: password minimal 8 karakter dan konfirmasi harus cocok.
- Submit handler:
  - Memanggil `supabase.auth.updateUser({ password: newPassword })`.
  - Tampilkan pesan sukses, kosongkan input password.
  - Tangani error secara ramah.

- [ ] **Step 3: Integrasikan ke `app/admin/(dashboard)/pengaturan/page.tsx`**

- Server component mengambil data `settings` awal dari database `createServerSupabaseClient()`.
- Render judul halaman "Pengaturan Toko", deskripsi, dan dua kartu terpisah:
  1. Kartu Pengaturan Toko (`<StoreSettingsForm initialSettings={settings} />`)
  2. Kartu Keamanan Akun (`<ChangePasswordForm />`)
- Pastikan tampilan responsif rapi di HP (360px), tablet, dan desktop tanpa overflow horizontal.

- [ ] **Step 4: Verifikasi build, typecheck, dan lint**

Jalankan:
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

- [ ] **Step 5: Commit**

```bash
git add components/admin/settings/store-settings-form.tsx components/admin/settings/change-password-form.tsx app/admin/\(dashboard\)/pengaturan/page.tsx
git commit -m "feat(admin): implementasi halaman pengaturan toko dan form ganti password"
```

---

### Task 6: Integrasi Halaman Pelanggan, Pengujian End-to-End, & Sinkronisasi Roadmap

**Files:**
- Create: `e2e/admin-settings.spec.ts`
- Modify: `docs/roadmap.md`

**Interfaces:**
- Refleksi perubahan pengaturan pada halaman publik pelanggan (`/` dan `/pesanan/[token]`).
- Checklist penyelesaian Milestone M4 pada `docs/roadmap.md`.

- [ ] **Step 1: Tulis tes E2E Playwright `e2e/admin-settings.spec.ts`**

Buat pengujian Playwright:
1. Login sebagai pemilik toko dan navigasi ke `/admin/pengaturan`.
2. Ubah nama toko, nomor WhatsApp, dan harga Paket Dos.
3. Unggah gambar QRIS sintetis.
4. Klik tombol simpan dan verifikasi notifikasi sukses muncul.
5. Buka halaman utama pelanggan (`/`) dan pastikan nama toko dan harga Dos terefleksi.
6. Teardown di `afterAll`: memulihkan nilai default pengaturan toko.

- [ ] **Step 2: Jalankan pengujian dan build**

Jalankan:
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

- [ ] **Step 3: Perbarui `docs/roadmap.md`**

Tandai checklist selesai untuk Issue #19:
`- [x] Pengaturan: QRIS, WhatsApp, nama/tagline, harga Dos, ganti password`

- [ ] **Step 4: Commit**

```bash
git add e2e/admin-settings.spec.ts docs/roadmap.md
git commit -m "test(e2e): tambah pengujian alur pengaturan toko dan sinkronkan roadmap"
```
