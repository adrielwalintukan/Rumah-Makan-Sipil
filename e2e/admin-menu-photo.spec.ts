import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { MENU_PHOTOS_BUCKET } from "@/lib/storage";

// Pengujian End-to-End (E2E) Upload Foto Menu (Issue #17):
// Menguji alur lengkap pemilik: Login -> Tambah Menu dengan Foto (crop & kompres browser) ->
// Verifikasi Foto di Admin & Pelanggan -> Ubah Menu (Hapus Foto) -> Verifikasi Placeholder Inisial di Admin & Pelanggan -> Cleanup.
// Hanya dijalankan pada lingkungan Supabase lokal (CI), bukan hosted.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const isLocal = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url);
test.skip(!isLocal || !serviceKey, "Butuh Supabase lokal (supabase start) + SUPABASE_SERVICE_ROLE_KEY");

const db = isLocal && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false } }) : null;

const testRunId = Date.now();
const ADMIN_EMAIL = `admin-photo-${testRunId}@test.local`;
const PASSWORD = "Password123!";
const CATEGORY_NAME = `Kategori Foto E2E ${testRunId}`;
const MENU_NAME = `Menu Foto E2E ${testRunId}`;

let adminUserId: string | null = null;
let initialIsOpen: boolean | null = null;
let createdCategoryId: string | null = null;
let createdMenuItemId: string | null = null;
let uploadedImagePath: string | null = null;

test.beforeAll(async () => {
  if (!db) return;

  // 1. Pastikan toko buka di pengaturan agar menu dapat dilihat di tampilan pelanggan
  const { data: storeSetting, error: storeGetErr } = await db
    .from("settings")
    .select("is_open")
    .eq("id", 1)
    .single();
  expect(storeGetErr).toBeNull();
  initialIsOpen = storeSetting?.is_open ?? null;

  if (!initialIsOpen) {
    const { error: storeErr } = await db.from("settings").update({ is_open: true }).eq("id", 1);
    expect(storeErr).toBeNull();
  }

  // 2. Buat akun pemilik di Supabase Auth & daftarkan ke tabel admins
  const { data: adminAuth, error: adminErr } = await db.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });
  expect(adminErr).toBeNull();
  expect(adminAuth.user).toBeTruthy();
  adminUserId = adminAuth.user!.id;

  const { error: insertAdminErr } = await db.from("admins").insert({ user_id: adminUserId });
  expect(insertAdminErr).toBeNull();

  // 3. Buat kategori sintetis untuk fixture menu
  const { data: catData, error: catErr } = await db
    .from("categories")
    .insert({ name: CATEGORY_NAME, sort_order: 999 })
    .select("id")
    .single();
  expect(catErr).toBeNull();
  expect(catData?.id).toBeTruthy();
  createdCategoryId = catData!.id;
});

test.afterAll(async () => {
  if (!db) return;

  // 1. Bersihkan file foto dari Supabase Storage jika masih ada
  if (uploadedImagePath) {
    const { error: delStorageErr } = await db.storage
      .from(MENU_PHOTOS_BUCKET)
      .remove([uploadedImagePath]);
    expect(delStorageErr).toBeNull();
  }

  // 2. Bersihkan menu sintetis
  if (createdMenuItemId) {
    const { error: delMenuErr } = await db
      .from("menu_items")
      .delete()
      .eq("id", createdMenuItemId);
    expect(delMenuErr).toBeNull();
  }
  const { error: delMenuByNameErr } = await db
    .from("menu_items")
    .delete()
    .like("name", `Menu Foto E2E ${testRunId}%`);
  expect(delMenuByNameErr).toBeNull();

  // 3. Bersihkan kategori sintetis
  if (createdCategoryId) {
    const { error: delCatErr } = await db
      .from("categories")
      .delete()
      .eq("id", createdCategoryId);
    expect(delCatErr).toBeNull();
  }
  const { error: delCatByNameErr } = await db
    .from("categories")
    .delete()
    .eq("name", CATEGORY_NAME);
  expect(delCatByNameErr).toBeNull();

  // 4. Bersihkan akun admin
  if (adminUserId) {
    const { error: delAdminRowErr } = await db
      .from("admins")
      .delete()
      .eq("user_id", adminUserId);
    expect(delAdminRowErr).toBeNull();

    const { error: delAuthErr } = await db.auth.admin.deleteUser(adminUserId);
    expect(delAuthErr).toBeNull();
  }

  // 5. Pulihkan status buka toko ke kondisi semula
  if (initialIsOpen !== null) {
    const { error: restoreStoreErr } = await db
      .from("settings")
      .update({ is_open: initialIsOpen })
      .eq("id", 1);
    expect(restoreStoreErr).toBeNull();
  }
});

test("alur upload foto menu: pratinjau 4:3, simpan, cek foto di admin & pelanggan, hapus foto", async ({ page }) => {
  // -------------------------------------------------------------
  // 1. Otentikasi Admin
  // -------------------------------------------------------------
  await page.goto("/admin/login");
  await page.getByLabel(/Email Pemilik/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/Kata Sandi/i).fill(PASSWORD);
  await page.getByRole("button", { name: "Masuk ke Dashboard" }).click();

  await expect(page).toHaveURL(/\/admin/);
  await expect(page.getByRole("heading", { level: 1, name: "Pesanan Live" })).toBeVisible();

  // -------------------------------------------------------------
  // 2. Buka Form Tambah Menu Baru (/admin/menu/baru)
  // -------------------------------------------------------------
  await page.goto("/admin/menu/baru");
  await expect(page).toHaveURL(/\/admin\/menu\/baru$/);
  await expect(page.getByRole("heading", { level: 1, name: "Tambah Menu Baru" })).toBeVisible();

  // -------------------------------------------------------------
  // 3. Isi Field Form Menu
  // -------------------------------------------------------------
  await expect(page.locator("select#category_id option").filter({ hasText: CATEGORY_NAME })).toBeAttached();
  await page.locator("select#category_id").selectOption({ label: CATEGORY_NAME });

  await page.getByLabel(/Nama Menu/i).fill(MENU_NAME);
  await page.getByLabel(/Harga/i).fill("25000");
  await page.getByLabel(/Deskripsi/i).fill("Deskripsi menu foto e2e");

  // -------------------------------------------------------------
  // 4. Buat Buffer Gambar Uji & Unggah ke Input File
  // -------------------------------------------------------------
  // 1x1 transparent PNG buffer valid
  const sampleImageBuffer = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64"
  );

  await page.setInputFiles("#menu-photo-input, input[type='file']", {
    name: "test-menu-photo.png",
    mimeType: "image/png",
    buffer: sampleImageBuffer,
  });

  // -------------------------------------------------------------
  // 5. Verifikasi Pratinjau Foto & Tombol Aksi
  // -------------------------------------------------------------
  await expect(page.getByRole("button", { name: "Ganti Foto" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Hapus Foto" })).toBeVisible();
  await expect(page.locator("img[alt='Pratinjau foto menu']")).toBeVisible();

  // -------------------------------------------------------------
  // 6. Simpan Menu Baru
  // -------------------------------------------------------------
  await page.getByRole("button", { name: "Simpan Menu" }).click();
  await expect(page).toHaveURL(/\/admin\/menu$/);

  // -------------------------------------------------------------
  // 7. Verifikasi Kartu Menu di /admin/menu Memuat Gambar
  // -------------------------------------------------------------
  const adminCardWithPhoto = page
    .locator('[data-testid="admin-menu-card"]')
    .filter({ hasText: MENU_NAME });
  await expect(adminCardWithPhoto).toBeVisible();
  await expect(adminCardWithPhoto.locator("img")).toBeVisible();

  // Tangkap ID menu dan image_path dari database untuk teardown
  if (db) {
    const { data: menuData } = await db
      .from("menu_items")
      .select("id, image_path")
      .eq("name", MENU_NAME)
      .maybeSingle();
    if (menuData?.id) createdMenuItemId = menuData.id;
    if (menuData?.image_path) uploadedImagePath = menuData.image_path;
  }

  // -------------------------------------------------------------
  // 8. Verifikasi di Halaman Pelanggan (/) Memuat Gambar
  // -------------------------------------------------------------
  await page.goto("/");
  const customerCardWithPhoto = page
    .locator("article[data-testid='menu-card']")
    .filter({ hasText: MENU_NAME });
  await expect(customerCardWithPhoto).toBeVisible();
  await expect(customerCardWithPhoto.locator("img")).toBeVisible();

  // -------------------------------------------------------------
  // 9. Kembali ke /admin/menu dan Buka Halaman Ubah Menu
  // -------------------------------------------------------------
  await page.goto("/admin/menu");
  const itemCardToEdit = page
    .locator('[data-testid="admin-menu-card"]')
    .filter({ hasText: MENU_NAME });
  await itemCardToEdit.getByRole("link", { name: "Ubah" }).click();

  await expect(page).toHaveURL(/\/admin\/menu\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { level: 1, name: "Ubah Menu" })).toBeVisible();

  const urlParts = page.url().split("/");
  createdMenuItemId = urlParts[urlParts.length - 1];

  // -------------------------------------------------------------
  // 10. Verifikasi Foto Ter-load, Lalu Hapus Foto
  // -------------------------------------------------------------
  await expect(page.getByRole("button", { name: "Hapus Foto" })).toBeVisible();
  await expect(page.locator("img[alt='Pratinjau foto menu']")).toBeVisible();

  await page.getByRole("button", { name: "Hapus Foto" }).click();
  await expect(page.getByText("Belum ada foto menu")).toBeVisible();
  await expect(page.getByRole("button", { name: "Pilih Foto" })).toBeVisible();

  // -------------------------------------------------------------
  // 11. Simpan Perubahan Menu Tanpa Foto
  // -------------------------------------------------------------
  await page.getByRole("button", { name: "Simpan Menu" }).click();
  await expect(page).toHaveURL(/\/admin\/menu$/);

  // -------------------------------------------------------------
  // 12. Verifikasi di /admin/menu Menampilkan Placeholder Inisial
  // -------------------------------------------------------------
  const adminCardNoPhoto = page
    .locator('[data-testid="admin-menu-card"]')
    .filter({ hasText: MENU_NAME });
  await expect(adminCardNoPhoto).toBeVisible();
  await expect(adminCardNoPhoto.locator("img")).not.toBeVisible();
  await expect(adminCardNoPhoto.getByText(MENU_NAME.charAt(0).toUpperCase())).toBeVisible();

  // -------------------------------------------------------------
  // 13. Verifikasi di Halaman Pelanggan (/) Menampilkan Placeholder Inisial
  // -------------------------------------------------------------
  await page.goto("/");
  const customerCardNoPhoto = page
    .locator("article[data-testid='menu-card']")
    .filter({ hasText: MENU_NAME });
  await expect(customerCardNoPhoto).toBeVisible();
  await expect(customerCardNoPhoto.locator("img")).not.toBeVisible();
  await expect(customerCardNoPhoto.getByText(MENU_NAME.charAt(0).toUpperCase())).toBeVisible();
});
