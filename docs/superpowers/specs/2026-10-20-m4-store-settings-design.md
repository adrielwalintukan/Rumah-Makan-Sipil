# Desain Teknis: Pengaturan Toko & Keamanan Akun (M4: Issue #19)

Dokumen spesifikasi desain teknis untuk **Milestone M4: Issue #19 (`[M4] Pengaturan toko: QRIS, WhatsApp, nama/tagline, harga Dos, ganti password`)**.

- **Issue GitHub:** [#19](https://github.com/adrielwalintukan/Rumah-Makan-Sipil/issues/19)
- **Dokumen Acuan:** `docs/PRD.md` (D11), `docs/user-flows.md` (§5), `docs/architecture.md` (§4–§6, §10), `docs/design-system.md`

---

## 1. Ringkasan & Tujuan

Memberikan kemampuan penuh bagi pemilik toko untuk mengelola identitas dan profil warung secara mandiri dari dashboard admin (`/admin/pengaturan`), meliputi:
1. Mengunggah dan memperbarui gambar QRIS statis DANA Bisnis yang disimpan di bucket Supabase Storage `store`.
2. Mengubah nama toko, tagline, nomor kontak WhatsApp (format `62...`), dan harga Paket Dos.
3. Mengganti password akun pemilik toko secara aman dari sesi aktif dashboard.
4. Memastikan perubahan pengaturan langsung terefleksi secara publik di antarmuka pelanggan (header nama/tagline toko, dialog Paket Dos, dan layar pembayaran QRIS).

---

## 2. Arsitektur Database & Storage

### 2.1 Bucket Supabase Storage `store`
- **Bucket ID / Name:** `'store'`
- **Akses Publik:** `true` (pelanggan dapat memuat gambar QRIS tanpa token autentikasi).
- **Batas Ukuran:** `5242880` bytes (5 MB).
- **MIME Types:** `image/jpeg`, `image/png`, `image/webp`.
- **Kebijakan RLS (`storage.objects`):**
  - `store_public_read`: `select to anon, authenticated using (bucket_id = 'store')`
  - `store_owner_insert`: `insert to authenticated with check (bucket_id = 'store' and (select public.is_owner()))`
  - `store_owner_update`: `update to authenticated using (bucket_id = 'store' and (select public.is_owner())) with check (bucket_id = 'store' and (select public.is_owner()))`
  - `store_owner_delete`: `delete to authenticated using (bucket_id = 'store' and (select public.is_owner()))`
- **Struktur File:** Gambar QRIS disimpan dengan pola `qris/<uuid>.webp`.

### 2.2 Tabel Database `public.settings`
Tabel `settings` memiliki baris tunggal (`id = 1`) yang sudah dibuat pada skema awal:
```sql
create table public.settings (
  id integer primary key default 1 check (id = 1),
  is_open boolean not null default false,
  store_name text not null,
  tagline text,
  qris_image_path text,
  whatsapp_number text not null check (whatsapp_number ~ '^62[0-9]{8,13}$'),
  dos_price integer not null check (dos_price >= 0)
);
```
- Kebijakan RLS:
  - Publik (`anon`, `authenticated`): Izin `SELECT` (data toko bersifat publik).
  - Pemilik (`authenticated` dengan `public.is_owner()`): Izin `UPDATE`.

---

## 3. Skema Validasi Zod & Route Handler API

### 3.1 Skema Zod (`lib/admin-settings.ts`)
```ts
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
```

### 3.2 Endpoint `GET /api/admin/settings`
- Autentikasi: Memeriksa sesi pemilik via `getAdminUser()`. Jika tidak sah, kembalikan 401.
- Query: Mengambil baris `settings` (`id = 1`) dengan kolom `store_name, tagline, whatsapp_number, dos_price, qris_image_path, is_open`.
- Respons: HTTP 200 dengan data JSON.

### 3.3 Endpoint `PATCH /api/admin/settings`
- Autentikasi: Memeriksa sesi pemilik via `getAdminUser()`.
- Validasi Body: Menggunakan `updateStoreSettingsSchema.safeParse(body)`.
- Pembersihan Foto Lama (*Defensive Cleanup*):
  - Jika `qris_image_path` dikirim dan berbeda dari path lama di database, atau diubah menjadi null:
    - Ambil path lama dari database.
    - Hapus file lama dari bucket `store` via `supabase.storage.from("store").remove([oldPath])`.
    - Kegagalan penghapusan storage dicatat ke log tanpa membatalkan mutasi database.
- Update Database: Update baris `settings` dengan `id = 1`.
- Cache Revalidation:
  - `revalidatePath("/")` (memperbarui header nama, tagline, dan link Paket Dos di halaman pelanggan).
  - `revalidatePath("/admin")` (memperbarui status toko di header admin).
  - `revalidatePath("/admin/pengaturan")` (memperbarui form admin).
- Respons: HTTP 200 dengan data terbaru.

---

## 4. Antarmuka Pengguna Admin (`/admin/pengaturan`)

Halaman `/admin/pengaturan` terdiri dari dua kartu terpisah dengan tombol simpan mandiri:

### 4.1 Kartu 1: Profil & Pengaturan Toko
- **Form Fields:**
  - Nama Toko: Input teks dengan counter karakter (maks. 100).
  - Tagline: Input teks dengan counter karakter (maks. 150).
  - Nomor WhatsApp: Input teks dengan format `628...` dan teks bantuan panduan format.
  - Harga Paket Dos: Input angka dengan tampilan format Rupiah dinamis (`Rp 25.000`).
- **Komponen Uploader Gambar QRIS:**
  - Area pratinjau responsif menampilkan gambar QRIS saat ini atau gambar baru yang dipilih.
  - Menjaga rasio asli gambar (aspek rasio natural QRIS tanpa pemotongan / auto-crop paksa agar kode QR tetap scannable).
  - Tombol aksi: "Pilih Gambar QRIS" / "Ganti Gambar" dan "Hapus Gambar" (target sentuh minimal 44px).
  - Kompresi sisi klien via Canvas: Mengonversi ke WebP kualitas 85% dengan batas lebar/tinggi maksimal 1200px untuk menghemat storage dan mempercepat muat gambar di HP pelanggan.
  - Upload langsung dari browser ke bucket Supabase `store` saat tombol "Simpan Pengaturan" ditekan.
- **Tombol "Simpan Pengaturan":**
  - State loading saat pengunggahan dan penyimpanan berlangsung.
  - Notifikasi sukses atau error yang jelas.

### 4.2 Kartu 2: Keamanan Akun (Ganti Password)
- **Form Fields:**
  - Password Baru: Input tipe password, minimal 8 karakter.
  - Konfirmasi Password Baru: Input tipe password, harus identik dengan Password Baru.
  - Tombol intip password (Show/Hide) dengan target sentuh $\ge 44\text{px}$.
- **Aksi Submit:**
  - Memanggil `supabase.auth.updateUser({ password: newPassword })` secara langsung menggunakan sesi aktif pemilik.
  - Menampilkan feedback sukses berwarna hijau dan mengosongkan kembali kolom input password.
  - Jika gagal, tampilkan pesan error yang mudah dipahami.

---

## 5. Integrasi dengan Halaman Pelanggan

1. **Header Toko (`components/pelanggan/header.tsx` / `app/(pelanggan)/page.tsx`):**
   - Menampilkan `store_name` dan `tagline` terbaru dari `settings`.
2. **Dialog / Banner Paket Dos:**
   - Menampilkan harga `dos_price` terbaru yang diformat Rupiah.
   - Tombol "Pesan lewat WhatsApp" mengarahkan ke `https://wa.me/<whatsapp_number>?text=...` menggunakan nomor toko terbaru.
3. **Layar Pembayaran QRIS (`components/pelanggan/payment-card.tsx`):**
   - Menampilkan gambar QRIS dari bucket `store` berdasarkan `qris_image_path`.
   - Jika `qris_image_path` kosong, tetap menampilkan instruksi cadangan untuk scan QRIS fisik di meja kasir atau bayar cash.

---

## 6. Strategi Pengujian

1. **Database & RLS (pgTAP):**
   - File: `supabase/tests/storage_store.test.sql`
   - Memverifikasi konfigurasi bucket `store` dan kebijakan RLS (publik dapat membaca, non-pemilik ditolak menulis/menghapus, pemilik berhasil menulis/menghapus).
2. **Unit Tests (Vitest):**
   - File: `lib/admin-settings.test.ts` (menguji skema validasi Zod untuk seluruh field dan regex WhatsApp).
   - File: `app/api/admin/settings/settings-api.test.ts` (menguji endpoint GET & PATCH, proteksi 401 unauthenticated, pembersihan foto lama dari storage, dan error handling).
3. **End-to-End Tests (Playwright):**
   - File: `e2e/admin-settings.spec.ts`
   - Alur pengujian:
     1. Login admin dan buka `/admin/pengaturan`.
     2. Ubah data toko dan upload file gambar QRIS sintetis.
     3. Simpan dan verifikasi notifikasi sukses.
     4. Buka halaman pelanggan `/` dan verifikasi bahwa nama toko dan harga Dos telah berubah.
     5. Cleanup memulihkan pengaturan default toko di `afterAll`.
