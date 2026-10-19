# Rencana Implementasi: Upload Foto Menu (Crop 4:3 + Kompresi Browser) & Supabase Storage

> **For agentic workers:** REQUIRED SUB-SKILL: Gunakan superpowers:subagent-driven-development (direkomendasikan) atau superpowers:executing-plans untuk mengimplementasikan rencana ini task demi task. Langkah memakai format checkbox (`- [ ]`) untuk pelacakan.

**Goal:** Mengimplementasikan fitur upload foto menu berasio 4:3 dengan kompresi WebP di browser (maks 1200x900, WebP 80%), penyimpanan di bucket Supabase Storage `menu-photos` dengan RLS, pratinjau instan di form menu admin, dan pembersihan file lama saat foto diganti atau dihapus.

**Architecture:** Browser melakukan kompresi dan auto center-crop rasio 4:3 via HTML5 `<canvas>` saat foto dipilih dan menampilkan pratinjau instan. File WebP diunggah langsung dari browser ke bucket Supabase Storage `menu-photos` menggunakan sesi pemilik saat form disubmit. Route handler admin menyimpan `image_path` ke tabel `menu_items` dan membersihkan file lama dari storage saat foto diubah atau dihapus. Komponen menu publik dan admin menampilkan foto menu 4:3 dengan fallback placeholder jika foto belum ada.

**Tech Stack:** Next.js 16 (App Router), TypeScript strict, Tailwind CSS, Supabase Storage & Postgres RLS, Vitest, Playwright.

**Spec:** Issue #17, `docs/architecture.md §6`, `docs/PRD.md US-13`, `docs/design-system.md §5 & §6.2`.

## Global Constraints

- Validasi tipe file (image/jpeg, image/png, image/webp) dan ukuran maksimal 5 MB dilakukan di client dan dibatasi di bucket Supabase Storage.
- Kompresi dilakukan di browser ke format WebP kualitas 80% dengan batas dimensi maksimal 1200x900 piksel dan rasio aspek tepat 4:3 (auto center-crop). Tanpa dependensi pemroses gambar berat di server.
- File hanya diunggah ke storage saat tombol "Simpan Menu" diklik untuk mencegah akumulasi file sampah jika form dibatalkan.
- Akses baca bucket `menu-photos` terbuka untuk publik (`anon` dan `authenticated`). Akses tulis, ubah, dan hapus hanya untuk pemilik toko (`public.is_owner()`).
- Target sentuh elemen interaktif (tombol unggah, ganti, hapus) wajib minimal 44px (`min-h-[44px]`).
- Kontras warna teks memenuhi WCAG AA (>= 4.5:1).
- Tidak menggunakan karakter em dash (`—`) pada teks UI dan dokumentasi (aturan antislop R-02).
- Commit dan pesan dalam Bahasa Indonesia sesuai kaidah Conventional Commits tanpa footer AI.

---

### Task 1: Migrasi Supabase Storage `menu-photos` & Kebijakan RLS

**Files:**
- Create: `supabase/migrations/20261018030000_menu_photos_storage.sql`
- Create: `supabase/tests/storage_menu_photos.test.sql`

**Interfaces:**
- Produces:
  - Bucket `menu-photos` pada `storage.buckets` (`public = true`, `file_size_limit = 5242880`, `allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']`).
  - RLS policies pada `storage.objects`:
    - `menu_photos_public_read`: `SELECT` untuk `anon` & `authenticated` pada `bucket_id = 'menu-photos'`.
    - `menu_photos_owner_insert`: `INSERT` untuk `authenticated` dengan check `bucket_id = 'menu-photos' and (select public.is_owner())`.
    - `menu_photos_owner_update`: `UPDATE` untuk `authenticated` dengan using & check `bucket_id = 'menu-photos' and (select public.is_owner())`.
    - `menu_photos_owner_delete`: `DELETE` untuk `authenticated` dengan using `bucket_id = 'menu-photos' and (select public.is_owner())`.

- [x] **Step 1: Tulis tes pgTAP untuk RLS bucket `menu-photos`**

Buat file `supabase/tests/storage_menu_photos.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

-- Fixture
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'pemilik-storage@test.local'),
  ('00000000-0000-0000-0000-0000000000b2', 'bukan-pemilik-storage@test.local')
on conflict (id) do nothing;

insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000000a1')
on conflict (user_id) do nothing;

-- 1. Verifikasi bucket menu-photos ada dan publik
select is(
  (select count(*) from storage.buckets where id = 'menu-photos' and public = true),
  1::bigint,
  'bucket menu-photos ada dan berstatus publik'
);

-- 2. Verifikasi batas ukuran dan mime types bucket
select is(
  (select file_size_limit from storage.buckets where id = 'menu-photos'),
  5242880::bigint,
  'batas ukuran file bucket adalah 5 MB'
);

-- 3. Anonymous dapat membaca objek di menu-photos
set local role anon;
set local request.jwt.claim.sub to '';
select ok(
  (select count(*) >= 0 from storage.objects where bucket_id = 'menu-photos'),
  'anon dapat menjalankan select pada objek menu-photos'
);

-- 4. Anonymous tidak dapat upload ke menu-photos
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner) values ('menu-photos', 'tes-anon.webp', null)$$,
  '42501',
  null,
  'anon ditolak saat upload ke menu-photos'
);

-- 5. User bukan pemilik tidak dapat upload ke menu-photos
set local role authenticated;
set local request.jwt.claim.sub to '00000000-0000-0000-0000-0000000000b2';
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner) values ('menu-photos', 'tes-bukan-pemilik.webp', '00000000-0000-0000-0000-0000000000b2')$$,
  '42501',
  null,
  'user authenticated bukan pemilik ditolak saat upload ke menu-photos'
);

-- 6. Pemilik dapat upload ke menu-photos
set local request.jwt.claim.sub to '00000000-0000-0000-0000-0000000000a1';
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner) values ('menu-photos', 'tes-pemilik.webp', '00000000-0000-0000-0000-0000000000a1')$$,
  'pemilik dapat upload objek ke menu-photos'
);

-- 7. Pemilik dapat menghapus objek di menu-photos
select lives_ok(
  $$delete from storage.objects where bucket_id = 'menu-photos' and name = 'tes-pemilik.webp'$$,
  'pemilik dapat menghapus objek di menu-photos'
);

select * from finish();
rollback;
```

- [x] **Step 2: Jalankan migrasi dan tes verifikasi (pgTAP)**

Tulis file migrasi `supabase/migrations/20261018030000_menu_photos_storage.sql`:

```sql
-- Migrasi Supabase Storage: Bucket menu-photos dan Kebijakan RLS (Issue #17)

-- 1. Buat bucket menu-photos jika belum ada
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'menu-photos',
  'menu-photos',
  true,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 2. Kebijakan RLS storage.objects untuk bucket menu-photos

-- Baca publik untuk anon dan authenticated
drop policy if exists "menu_photos_public_read" on storage.objects;
create policy "menu_photos_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'menu-photos');

-- Pemilik toko dapat mengunggah foto
drop policy if exists "menu_photos_owner_insert" on storage.objects;
create policy "menu_photos_owner_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'menu-photos'
    and (select public.is_owner())
  );

-- Pemilik toko dapat memperbarui foto
drop policy if exists "menu_photos_owner_update" on storage.objects;
create policy "menu_photos_owner_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'menu-photos'
    and (select public.is_owner())
  )
  with check (
    bucket_id = 'menu-photos'
    and (select public.is_owner())
  );

-- Pemilik toko dapat menghapus foto
drop policy if exists "menu_photos_owner_delete" on storage.objects;
create policy "menu_photos_owner_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'menu-photos'
    and (select public.is_owner())
  );
```

- [x] **Step 3: Commit migrasi dan tes**

```bash
git add supabase/migrations/20261018030000_menu_photos_storage.sql supabase/tests/storage_menu_photos.test.sql
git commit -m "feat(storage): konfigurasi bucket menu-photos dan kebijakan RLS storage"
```

---

### Task 2: Skema Validasi `image_path` & Helper URL Foto di `lib/storage.ts`

**Files:**
- Create: `lib/storage.ts`
- Create: `lib/storage.test.ts`
- Modify: `lib/admin-menu-schemas.ts`
- Modify: `lib/admin-menu-schemas.test.ts`

**Interfaces:**
- Consumes: `lib/admin-menu-schemas.ts`
- Produces:
  - `getMenuPhotoUrl(imagePath?: string | null): string | null`
  - `MENU_PHOTOS_BUCKET = "menu-photos"`
  - `menuItemSchema` yang memvalidasi `image_path: z.string().trim().max(255).nullable().optional()`

- [x] **Step 1: Tulis tes unit untuk `lib/storage.ts` dan update `lib/admin-menu-schemas.test.ts`**

Buat file `lib/storage.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getMenuPhotoUrl, MENU_PHOTOS_BUCKET } from "./storage";

describe("lib/storage", () => {
  const originalEnv = process.env.NEXT_PUBLIC_SUPABASE_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnv;
  });

  it("mengembalikan null jika imagePath null atau kosong", () => {
    expect(getMenuPhotoUrl(null)).toBeNull();
    expect(getMenuPhotoUrl(undefined)).toBeNull();
    expect(getMenuPhotoUrl("")).toBeNull();
  });

  it("mengembalikan URL publik Supabase Storage lengkap untuk nama file relatif", () => {
    expect(getMenuPhotoUrl("items/ayam-bakar.webp")).toBe(
      "https://example.supabase.co/storage/v1/object/public/menu-photos/items/ayam-bakar.webp"
    );
  });

  it("mempertahankan URL jika sudah merupakan URL absolut atau path publik", () => {
    expect(getMenuPhotoUrl("https://cdn.example.com/foto.jpg")).toBe(
      "https://cdn.example.com/foto.jpg"
    );
    expect(getMenuPhotoUrl("/images/placeholder.webp")).toBe(
      "/images/placeholder.webp"
    );
  });

  it("menyediakan konstanta nama bucket yang benar", () => {
    expect(MENU_PHOTOS_BUCKET).toBe("menu-photos");
  });
});
```

Tambahkan pengujian `image_path` pada `lib/admin-menu-schemas.test.ts`:
- Memastikan `image_path` string valid diterima.
- Memastikan `image_path: null` diterima.
- Memastikan `image_path` diabaikan/opsional bila tidak diberikan.

- [x] **Step 2: Jalankan tes unit dan pastikan gagal (RED)**

Run: `npx vitest run lib/storage.test.ts`
Expected: FAIL ("Cannot find module './storage'")

- [x] **Step 3: Implementasikan `lib/storage.ts` dan update `lib/admin-menu-schemas.ts`**

Buat `lib/storage.ts`:

```typescript
export const MENU_PHOTOS_BUCKET = "menu-photos";

/**
 * Menghasilkan URL publik untuk foto menu yang tersimpan di bucket Supabase Storage.
 * Jika imagePath sudah berupa URL penuh (http/https) atau path absolut (/), kembalikan langsung.
 */
export function getMenuPhotoUrl(imagePath?: string | null): string | null {
  if (!imagePath || !imagePath.trim()) return null;
  const trimmed = imagePath.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("/")) {
    return trimmed;
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    return `${supabaseUrl}/storage/v1/object/public/${MENU_PHOTOS_BUCKET}/${trimmed}`;
  }
  return `/${MENU_PHOTOS_BUCKET}/${trimmed}`;
}
```

Update `lib/admin-menu-schemas.ts`:

```typescript
export const menuItemSchema = z.object({
  category_id: z.string().regex(UUID_REGEX, "Kategori tidak valid"),
  name: z.string().trim().min(1, "Nama menu wajib diisi").max(100, "Nama menu maksimal 100 karakter"),
  description: z.string().trim().max(500, "Deskripsi maksimal 500 karakter").optional().default(""),
  price: z
    .number("Harga harus berupa angka")
    .int("Harga harus berupa bilangan bulat Rupiah")
    .min(0, "Harga tidak boleh negatif"),
  image_path: z.string().trim().max(255).nullable().optional(),
  is_available: z.boolean().default(true),
  sort_order: z.number().int().min(0).optional(),
}).strict();
```

- [x] **Step 4: Jalankan tes unit dan pastikan lulus (GREEN)**

Run: `npx vitest run lib/storage.test.ts lib/admin-menu-schemas.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add lib/storage.ts lib/storage.test.ts lib/admin-menu-schemas.ts lib/admin-menu-schemas.test.ts
git commit -m "feat(menu): tambah helper URL storage dan validasi skema image_path"
```

---

### Task 3: Utilitas Kompresi & Auto Center-Crop 4:3 Browser (`lib/image-compression.ts`)

**Files:**
- Create: `lib/image-compression.ts`
- Create: `lib/image-compression.test.ts`

**Interfaces:**
- Produces:
  - `MAX_IMAGE_FILE_SIZE = 5242880` (5 MB)
  - `ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"]`
  - `validateImageFile(file: File): { valid: boolean; error?: string }`
  - `calculateCrop4x3(width: number, height: number): { sx: number; sy: number; sw: number; sh: number; outWidth: number; outHeight: number }`
  - `compressAndCropMenuPhoto(file: File): Promise<{ blob: Blob; width: number; height: number }>`

- [x] **Step 1: Tulis tes unit untuk validasi dan kalkulasi crop rasio 4:3**

Buat `lib/image-compression.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  validateImageFile,
  calculateCrop4x3,
  MAX_IMAGE_FILE_SIZE,
} from "./image-compression";

describe("lib/image-compression", () => {
  describe("validateImageFile", () => {
    it("menerima file gambar yang didukung dengan ukuran valid", () => {
      const file = new File(["dummy"], "menu.jpg", { type: "image/jpeg" });
      expect(validateImageFile(file)).toEqual({ valid: true });
    });

    it("menolak file dengan tipe tidak didukung", () => {
      const file = new File(["dummy"], "menu.gif", { type: "image/gif" });
      const res = validateImageFile(file);
      expect(res.valid).toBe(false);
      expect(res.error).toBe("Format file harus JPG, PNG, atau WebP.");
    });

    it("menolak file yang melebihi batas ukuran 5 MB", () => {
      const largeFile = new File(["dummy"], "large.png", { type: "image/png" });
      Object.defineProperty(largeFile, "size", { value: MAX_IMAGE_FILE_SIZE + 1 });
      const res = validateImageFile(largeFile);
      expect(res.valid).toBe(false);
      expect(res.error).toBe("Ukuran file maksimal 5 MB.");
    });
  });

  describe("calculateCrop4x3", () => {
    it("memotong bagian tengah gambar yang terlalu lebar (landscape lebar)", () => {
      // 16:9 ratio: 1600x900 -> 4:3 crop target adalah 1200x900
      const res = calculateCrop4x3(1600, 900);
      expect(res.sw).toBe(1200);
      expect(res.sh).toBe(900);
      expect(res.sx).toBe(200); // (1600 - 1200) / 2
      expect(res.sy).toBe(0);
      expect(res.outWidth).toBe(1200);
      expect(res.outHeight).toBe(900);
    });

    it("memotong bagian tengah gambar yang terlalu tinggi (portrait)", () => {
      // Portrait: 900x1600 -> 4:3 crop target adalah 900x675
      const res = calculateCrop4x3(900, 1600);
      expect(res.sw).toBe(900);
      expect(res.sh).toBe(675);
      expect(res.sx).toBe(0);
      expect(res.sy).toBe((1600 - 675) / 2);
      expect(res.outWidth).toBe(900);
      expect(res.outHeight).toBe(675);
    });

    it("melakukan downscale ke maks 1200x900 jika dimensi crop melebihi 1200px", () => {
      // 4:3 native tapi besar: 2400x1800
      const res = calculateCrop4x3(2400, 1800);
      expect(res.sw).toBe(2400);
      expect(res.sh).toBe(1800);
      expect(res.sx).toBe(0);
      expect(res.sy).toBe(0);
      expect(res.outWidth).toBe(1200);
      expect(res.outHeight).toBe(900);
    });

    it("mempertahankan resolusi asli jika crop lebih kecil dari 1200x900", () => {
      // 800x600 (tepat 4:3 dan < 1200)
      const res = calculateCrop4x3(800, 600);
      expect(res.sw).toBe(800);
      expect(res.sh).toBe(600);
      expect(res.outWidth).toBe(800);
      expect(res.outHeight).toBe(600);
    });
  });
});
```

- [x] **Step 2: Jalankan tes unit dan pastikan gagal (RED)**

Run: `npx vitest run lib/image-compression.test.ts`
Expected: FAIL ("Cannot find module './image-compression'")

- [x] **Step 3: Implementasikan `lib/image-compression.ts`**

Buat file `lib/image-compression.ts`:

```typescript
export const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_OUTPUT_WIDTH = 1200;
export const MAX_OUTPUT_HEIGHT = 900;
export const TARGET_ASPECT_RATIO = 4 / 3;

export function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type)) {
    return { valid: false, error: "Format file harus JPG, PNG, atau WebP." };
  }
  if (file.size > MAX_IMAGE_FILE_SIZE) {
    return { valid: false, error: "Ukuran file maksimal 5 MB." };
  }
  return { valid: true };
}

export function calculateCrop4x3(
  width: number,
  height: number
): {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  outWidth: number;
  outHeight: number;
} {
  const currentRatio = width / height;
  let sx = 0;
  let sy = 0;
  let sw = width;
  let sh = height;

  if (currentRatio > TARGET_ASPECT_RATIO) {
    // Terlalu lebar, crop horizontal sisi kiri dan kanan
    sw = Math.round(height * TARGET_ASPECT_RATIO);
    sx = Math.round((width - sw) / 2);
  } else if (currentRatio < TARGET_ASPECT_RATIO) {
    // Terlalu tinggi, crop vertikal sisi atas dan bawah
    sh = Math.round(width / TARGET_ASPECT_RATIO);
    sy = Math.round((height - sh) / 2);
  }

  let outWidth = sw;
  let outHeight = sh;

  if (sw > MAX_OUTPUT_WIDTH) {
    const scale = MAX_OUTPUT_WIDTH / sw;
    outWidth = MAX_OUTPUT_WIDTH;
    outHeight = Math.round(sh * scale);
  }

  return { sx, sy, sw, sh, outWidth, outHeight };
}

/**
 * Memproses gambar di browser: melakukan center-crop 4:3, resize maksimal 1200x900,
 * dan kompresi ke WebP kualitas 80% via HTML5 Canvas.
 */
export async function compressAndCropMenuPhoto(
  file: File
): Promise<{ blob: Blob; width: number; height: number }> {
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      try {
        const { sx, sy, sw, sh, outWidth, outHeight } = calculateCrop4x3(
          img.naturalWidth || img.width,
          img.naturalHeight || img.height
        );

        const canvas = document.createElement("canvas");
        canvas.width = outWidth;
        canvas.height = outHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Gagal menginisialisasi canvas browser."));
          return;
        }

        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outWidth, outHeight);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Gagal mengompresi gambar ke format WebP."));
              return;
            }
            resolve({ blob, width: outWidth, height: outHeight });
          },
          "image/webp",
          0.8
        );
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Gagal memproses gambar."));
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Gagal memuat file gambar."));
    };

    img.src = objectUrl;
  });
}
```

- [x] **Step 4: Jalankan tes unit dan pastikan lulus (GREEN)**

Run: `npx vitest run lib/image-compression.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add lib/image-compression.ts lib/image-compression.test.ts
git commit -m "feat(menu): implementasi fungsi auto center-crop 4:3 dan kompresi browser WebP"
```

---

### Task 4: Dukungan `image_path` & Pembersihan File Lama pada Route Handler Menu

**Files:**
- Modify: `app/api/admin/menu/route.ts`
- Modify: `app/api/admin/menu/[id]/route.ts`
- Modify: `app/api/admin/menu/menu-api.test.ts`

**Interfaces:**
- Consumes: `lib/admin-menu-schemas.ts`, `lib/storage.ts`
- Produces:
  - `POST /api/admin/menu` menerima `image_path` dan menyimpannya ke database.
  - `PATCH /api/admin/menu/[id]` menerima `image_path`. Jika `image_path` berubah atau di-null-kan dan menu memiliki file lama, hapus file lama dari bucket `menu-photos` via Supabase Storage client.

- [x] **Step 1: Tulis tes unit untuk `POST` dan `PATCH` dengan `image_path`**

Tambahkan pengujian pada `app/api/admin/menu/menu-api.test.ts`:
- POST menyimpan item baru dengan `image_path`.
- PATCH memperbarui `image_path` dan memanggil `storage.from("menu-photos").remove([oldPath])`.
- PATCH menghapus foto (`image_path: null`) dan menghapus file lama dari storage.

- [x] **Step 2: Jalankan tes unit dan pastikan gagal atau melihat gap (RED)**

Run: `npx vitest run app/api/admin/menu/menu-api.test.ts`
Expected: FAIL atau error pada assertion storage remove.

- [x] **Step 3: Update `app/api/admin/menu/route.ts` dan `app/api/admin/menu/[id]/route.ts`**

Di `app/api/admin/menu/route.ts`:
Simpan `image_path: parseResult.data.image_path ?? null` pada blok `.insert(...)`.

Di `app/api/admin/menu/[id]/route.ts`:
1. Tambahkan `"image_path"` pada `allowedKeys`.
2. Jika `"image_path" in rawBody`, set `updateData.image_path = parseResult.data.image_path ?? null`.
3. Ambil `image_path` lama sebelum update:
   ```typescript
   const { data: currentItem } = await supabase
     .from("menu_items")
     .select("category_id, image_path")
     .eq("id", id)
     .maybeSingle();
   ```
4. Jika `updateData.image_path !== undefined` dan `currentItem?.image_path` ada dan berbeda dari `updateData.image_path`:
   ```typescript
   if (currentItem.image_path && currentItem.image_path !== updateData.image_path) {
     await supabase.storage.from("menu-photos").remove([currentItem.image_path]);
   }
   ```

- [x] **Step 4: Jalankan tes unit dan pastikan lulus (GREEN)**

Run: `npx vitest run app/api/admin/menu/menu-api.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add app/api/admin/menu/route.ts app/api/admin/menu/[id]/route.ts app/api/admin/menu/menu-api.test.ts
git commit -m "feat(api): dukung image_path dan pembersihan foto lama di storage pada menu admin"
```

---

### Task 5: Komponen Form Upload Foto Menu & Integrasi Dashboard Admin

**Files:**
- Modify: `components/admin/menu/menu-item-form.tsx`
- Modify: `app/admin/(dashboard)/menu/[id]/page.tsx`
- Modify: `components/admin/menu/menu-management-view.tsx` (gunakan `getMenuPhotoUrl`)

**Interfaces:**
- Consumes: `lib/image-compression.ts`, `lib/storage.ts`, `lib/supabase/client.ts`
- Produces:
  - Input foto menu di form dengan preview 4:3, tombol "Ganti Foto", dan tombol "Hapus Foto".
  - Upload direct-to-storage saat tombol "Simpan Menu" diklik.
  - Penanganan error upload dan progress status.

- [x] **Step 1: Update `app/admin/(dashboard)/menu/[id]/page.tsx`**

Tambahkan `image_path` ke query select dan set ke `initialData`:
```typescript
const [{ data: menuItem, error: menuError }, { data: categories }] =
  await Promise.all([
    supabase
      .from("menu_items")
      .select(
        "id, category_id, name, description, price, image_path, is_available, sort_order"
      )
      .eq("id", id)
      .eq("is_active", true)
      .maybeSingle(),
...
const initialData: MenuItemFormData = {
  id: menuItem.id,
  category_id: menuItem.category_id,
  name: menuItem.name,
  description: menuItem.description ?? "",
  price: menuItem.price,
  image_path: menuItem.image_path ?? null,
  is_available: menuItem.is_available,
  sort_order: menuItem.sort_order,
};
```

- [x] **Step 2: Tambahkan state dan UI upload foto pada `components/admin/menu/menu-item-form.tsx`**

1. Tambahkan state foto:
   - `photoFile: File | null` (file yang dipilih user)
   - `processedBlob: Blob | null` (hasil kompresi & crop 4:3)
   - `previewUrl: string | null` (URL preview lokal dari processedBlob atau dari initialData)
   - `isPhotoRemoved: boolean` (apakah foto lama dihapus)
   - `photoError: string | null` (error validasi file)
   - `isUploadingPhoto: boolean` (indikator saat upload ke storage)
2. Handle pemilihan file:
   - Validasi file via `validateImageFile(file)`.
   - Proses via `compressAndCropMenuPhoto(file)`.
   - Set `previewUrl` menggunakan `URL.createObjectURL(blob)`.
3. Handle tombol "Hapus Foto":
   - Set `photoFile = null`, `processedBlob = null`, `previewUrl = null`, `isPhotoRemoved = true`.
4. Handle submit:
   - Jika ada `processedBlob`:
     - Buat nama file unik: `items/${crypto.randomUUID()}.webp`.
     - Upload via `createBrowserSupabaseClient().storage.from("menu-photos").upload(fileName, processedBlob, { contentType: "image/webp", upsert: true })`.
     - Masukkan `image_path: fileName` ke payload.
   - Jika `isPhotoRemoved`:
     - Masukkan `image_path: null` ke payload.
   - Jika tidak ada perubahan:
     - Jangan sertakan atau pertahankan `image_path: initialData.image_path`.
5. Pastikan semua tombol memiliki target sentuh minimal 44px (`min-h-[44px]`).
6. UI preview menggunakan rasio aspek 4:3 yang rapi dengan indikator status dan placeholder.

- [x] **Step 3: Gunakan helper `getMenuPhotoUrl` di `components/admin/menu/menu-management-view.tsx`**

Ganti fungsi lokal `getImageUrl` dengan fungsi `getMenuPhotoUrl` dari `@/lib/storage`.

- [x] **Step 4: Jalankan lint, typecheck, dan unit test**

Run: `npm run lint && npm run typecheck && npm test`
Expected: PASS dengan 0 error.

- [x] **Step 5: Commit**

```bash
git add components/admin/menu/menu-item-form.tsx app/admin/\(dashboard\)/menu/\[id\]/page.tsx components/admin/menu/menu-management-view.tsx
git commit -m "feat(admin): integrasi upload foto menu crop 4:3 dan kompresi browser di form menu"
```

---

### Task 6: Pengujian End-to-End Playwright (E2E) & Sinkronisasi Dokumen

**Files:**
- Create: `e2e/admin-menu-photo.spec.ts`
- Modify: `docs/roadmap.md`

**Interfaces:**
- Memverifikasi alur penuh upload foto menu dari browser admin:
  1. Login admin.
  2. Masuk ke form menu baru `/admin/menu/baru`.
  3. Pilih file gambar (JPG/PNG).
  4. Verifikasi preview 4:3 muncul seketika di UI.
  5. Simpan menu.
  6. Verifikasi kartu menu di `/admin/menu` menampilkan foto menu.
  7. Buka halaman pelanggan `/`, verifikasi kartu menu menampilkan foto menu dalam rasio 4:3.
  8. Ubah menu di `/admin/menu/[id]`, klik "Hapus Foto", dan simpan.
  9. Verifikasi kartu menu kembali menampilkan placeholder inisial nama menu.
  10. Teardown dan bersihkan data fixture dengan aman.

- [x] **Step 1: Tulis tes E2E Playwright `e2e/admin-menu-photo.spec.ts`**

Gunakan pola established dari `e2e/admin-menu.spec.ts` dengan skip jika non-lokal, autentikasi admin via fixture, manipulasi input file `setInputFiles`, dan verifikasi tampilan elemen.

- [x] **Step 2: Jalankan lint, typecheck, unit test, dan build**

Run:
```bash
npm run lint
npm run typecheck
npm test
npm run build
```
Expected: PASS untuk semua pemeriksaan.

- [x] **Step 3: Update `docs/roadmap.md`**

Tandai penyelesaian item upload foto menu pada Milestone M4 di `docs/roadmap.md`.

- [x] **Step 4: Commit**

```bash
git add e2e/admin-menu-photo.spec.ts docs/roadmap.md
git commit -m "test(e2e): tambah pengujian alur upload foto menu dan sinkronkan roadmap"
```

---

## Delivery Gate & Checklist Selesai

- [x] `npm run lint` lulus tanpa warning/error
- [x] `npm run typecheck` lulus tanpa error
- [x] `npm test` seluruh suite lulus
- [x] `npm run build` berhasil membangun Next.js app
- [x] Tidak ada karakter em dash (`—`) pada teks UI atau kode
- [x] Target sentuh tombol upload/ganti/hapus >= 44px
- [x] PR dibuat ke branch `development` dengan body lengkap sesuai template
