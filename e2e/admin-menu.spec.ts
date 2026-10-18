import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Pengujian End-to-End (E2E) Kelola Menu (Issue #16):
// Menguji alur lengkap pemilik: Login -> CRUD Kategori & Urutan -> Tambah Menu -> Toggle Habis/Tersedia (verifikasi tampilan pelanggan) -> Ubah Menu -> Hapus Lunak -> Cleanup.
// Hanya dijalankan pada lingkungan Supabase lokal (CI), bukan hosted.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const isLocal = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url);
test.skip(!isLocal || !serviceKey, "Butuh Supabase lokal (supabase start) + SUPABASE_SERVICE_ROLE_KEY");

const db = isLocal && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false } }) : null;

const testRunId = Date.now();
const ADMIN_EMAIL = `admin-menu-${testRunId}@test.local`;
const PASSWORD = "Password123!";
const CATEGORY_NAME = `Kategori E2E ${testRunId}`;
const MENU_NAME = `Menu E2E ${testRunId}`;
const UPDATED_MENU_NAME = `Menu E2E ${testRunId} Spesial`;

let adminUserId: string | null = null;
let initialIsOpen: boolean | null = null;
let createdCategoryId: string | null = null;
let createdMenuItemId: string | null = null;

test.beforeAll(async () => {
  if (!db) return;

  // 1. Pastikan toko buka di pengaturan agar menu dapat dipesan di tampilan pelanggan
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
});

test.afterAll(async () => {
  if (!db) return;

  // 1. Bersihkan menu sintetis terlebih dahulu (mencegah pelanggaran foreign key pada kategori)
  if (createdMenuItemId) {
    const { error: delMenuErr } = await db.from("menu_items").delete().eq("id", createdMenuItemId);
    expect(delMenuErr).toBeNull();
  }
  const { error: delMenuByNameErr } = await db
    .from("menu_items")
    .delete()
    .like("name", `Menu E2E ${testRunId}%`);
  expect(delMenuByNameErr).toBeNull();

  // 2. Bersihkan kategori sintetis
  if (createdCategoryId) {
    const { error: delCatErr } = await db.from("categories").delete().eq("id", createdCategoryId);
    expect(delCatErr).toBeNull();
  }
  const { error: delCatByNameErr } = await db.from("categories").delete().eq("name", CATEGORY_NAME);
  expect(delCatByNameErr).toBeNull();

  // 3. Bersihkan akun admin
  if (adminUserId) {
    const { error: delAdminRowErr } = await db.from("admins").delete().eq("user_id", adminUserId);
    expect(delAdminRowErr).toBeNull();

    const { error: delAuthErr } = await db.auth.admin.deleteUser(adminUserId);
    expect(delAuthErr).toBeNull();
  }

  // 4. Pulihkan status buka toko ke kondisi awal
  if (initialIsOpen !== null) {
    const { error: restoreStoreErr } = await db
      .from("settings")
      .update({ is_open: initialIsOpen })
      .eq("id", 1);
    expect(restoreStoreErr).toBeNull();
  }
});

test("alur kelola menu: CRUD kategori & menu, urutan, toggle habis, dan hapus lunak", async ({ page }) => {
  // -------------------------------------------------------------
  // 1. Otentikasi & Akses Halaman Kelola Menu
  // -------------------------------------------------------------
  await page.goto("/admin/login");
  await page.getByLabel(/Email Pemilik/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/Kata Sandi/i).fill(PASSWORD);
  await page.getByRole("button", { name: "Masuk ke Dashboard" }).click();

  await expect(page).toHaveURL(/\/admin/);
  await expect(page.getByRole("heading", { level: 1, name: "Pesanan Live" })).toBeVisible();

  // Navigasi ke halaman Kelola Menu
  await page.goto("/admin/menu");
  await expect(page).toHaveURL(/\/admin\/menu$/);
  await expect(page.getByRole("heading", { level: 1, name: "Kelola Menu" })).toBeVisible();

  // -------------------------------------------------------------
  // 2. Kelola Kategori (Buat Kategori Baru Sintetis & Verifikasi Urutan)
  // -------------------------------------------------------------
  await page.getByRole("button", { name: "Kelola Kategori" }).first().click();

  const categoryDialog = page.getByRole("dialog");
  await expect(categoryDialog).toBeVisible();
  await expect(categoryDialog.getByRole("heading", { name: "Kelola Kategori" })).toBeVisible();

  // Tambahkan kategori baru
  await categoryDialog.getByRole("textbox", { name: "Nama kategori baru" }).fill(CATEGORY_NAME);
  await categoryDialog.getByRole("button", { name: "Tambah", exact: true }).click();

  // Verifikasi kategori muncul di daftar dalam dialog
  const categoryRegion = categoryDialog.getByRole("region", { name: "Daftar Kategori" });
  await expect(categoryRegion.getByText(CATEGORY_NAME)).toBeVisible();

  // Simpan ID kategori untuk teardown
  if (db) {
    const { data: catData } = await db.from("categories").select("id").eq("name", CATEGORY_NAME).maybeSingle();
    if (catData?.id) createdCategoryId = catData.id;
  }

  // Verifikasi tombol urutan pada kategori terakhir (tombol ke bawah dinonaktifkan)
  const catItem = categoryRegion.locator("div").filter({ hasText: CATEGORY_NAME }).last();
  await expect(catItem.getByRole("button", { name: `Pindahkan ${CATEGORY_NAME} ke bawah` })).toBeDisabled();

  // Tutup dialog kategori
  await categoryDialog.getByRole("button", { name: "Tutup" }).first().click();
  await expect(categoryDialog).not.toBeVisible();

  // Verifikasi kategori muncul di tab filter halaman kelola menu
  await expect(page.getByRole("button", { name: new RegExp(`^${CATEGORY_NAME}`) })).toBeVisible();

  // -------------------------------------------------------------
  // 3. Tambah Menu Baru (/admin/menu/baru)
  // -------------------------------------------------------------
  await page.getByRole("link", { name: "Tambah Menu" }).first().click();
  await expect(page).toHaveURL(/\/admin\/menu\/baru$/);
  await expect(page.getByRole("heading", { level: 1, name: "Tambah Menu Baru" })).toBeVisible();

  // Pastikan opsi kategori yang baru dibuat tersedia di dropdown dan pilih
  await expect(page.locator("select#category_id option").filter({ hasText: CATEGORY_NAME })).toBeAttached();
  await page.locator("select#category_id").selectOption({ label: CATEGORY_NAME });

  // Isi data menu baru
  await page.getByLabel(/Nama Menu/i).fill(MENU_NAME);
  await page.getByLabel(/Harga/i).fill("15000");
  await page.getByLabel(/Deskripsi/i).fill("Deskripsi menu e2e");

  // Simpan menu baru
  await page.getByRole("button", { name: "Simpan Menu" }).click();

  // Verifikasi diarahkan kembali ke /admin/menu dan item muncul di daftar
  await expect(page).toHaveURL(/\/admin\/menu$/);
  const itemCard = page.locator('[data-testid="admin-menu-card"]').filter({ hasText: MENU_NAME });
  await expect(itemCard).toBeVisible();
  await expect(itemCard.getByRole("heading", { level: 2, name: MENU_NAME })).toBeVisible();
  await expect(itemCard.getByText(/Rp\s?15\.000/)).toBeVisible();

  // Verifikasi tombol urutan menu (karena merupakan satu-satunya item di kategori ini, kedua tombol nonaktif)
  await expect(itemCard.getByRole("button", { name: `Pindahkan menu ${MENU_NAME} ke atas` })).toBeDisabled();
  await expect(itemCard.getByRole("button", { name: `Pindahkan menu ${MENU_NAME} ke bawah` })).toBeDisabled();

  // -------------------------------------------------------------
  // 4. Toggle Ketersediaan (Habis -> Cek Pelanggan -> Tersedia)
  // -------------------------------------------------------------
  // Ubah status ketersediaan menjadi Habis di /admin/menu
  const toggleBtn = page.getByRole("switch", { name: new RegExp(`Status ketersediaan ${MENU_NAME}`) });
  await expect(toggleBtn).toBeVisible();
  await expect(toggleBtn).toHaveAttribute("aria-checked", "true");
  await toggleBtn.click();
  await expect(toggleBtn).toHaveAttribute("aria-checked", "false");
  await expect(toggleBtn).toBeEnabled();

  // Buka halaman pelanggan (/), verifikasi menu berstatus Habis dan tombol Tambah nonaktif
  await page.goto("/");
  const customerCardHabis = page.locator("article[data-testid='menu-card']").filter({ hasText: MENU_NAME });
  await expect(customerCardHabis).toBeVisible();
  await expect(customerCardHabis.getByText("Habis")).toBeVisible();
  await expect(customerCardHabis.getByRole("button", { name: `Tambah ${MENU_NAME}` })).not.toBeVisible();
  await expect(customerCardHabis.getByRole("button", { name: MENU_NAME, exact: true })).toBeDisabled();

  // Kembali ke /admin/menu, ubah status ketersediaan kembali menjadi Tersedia
  await page.goto("/admin/menu");
  const toggleBtnBack = page.getByRole("switch", { name: new RegExp(`Status ketersediaan ${MENU_NAME}`) });
  await expect(toggleBtnBack).toBeVisible();
  await expect(toggleBtnBack).toHaveAttribute("aria-checked", "false");
  await toggleBtnBack.click();
  await expect(toggleBtnBack).toHaveAttribute("aria-checked", "true");
  await expect(toggleBtnBack).toBeEnabled();

  // Verifikasi di halaman pelanggan (/) tombol Tambah aktif kembali
  await page.goto("/");
  const customerCardTersedia = page.locator("article[data-testid='menu-card']").filter({ hasText: MENU_NAME });
  await expect(customerCardTersedia).toBeVisible();
  await expect(customerCardTersedia.getByRole("button", { name: `Tambah ${MENU_NAME}` })).toBeVisible();
  await expect(customerCardTersedia.getByRole("button", { name: `Tambah ${MENU_NAME}` })).toBeEnabled();
  await expect(customerCardTersedia.getByRole("button", { name: MENU_NAME, exact: true })).toBeEnabled();

  // -------------------------------------------------------------
  // 5. Ubah Menu & Hapus Lunak (Soft Delete)
  // -------------------------------------------------------------
  // Kembali ke /admin/menu dan klik Ubah
  await page.goto("/admin/menu");
  const currentItemCard = page.locator('[data-testid="admin-menu-card"]').filter({ hasText: MENU_NAME });
  await currentItemCard.getByRole("link", { name: "Ubah" }).click();

  // Halaman ubah menu (/admin/menu/[id])
  await expect(page).toHaveURL(/\/admin\/menu\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { level: 1, name: "Ubah Menu" })).toBeVisible();

  // Tangkap ID menu dari URL untuk kebersihan teardown
  const urlParts = page.url().split("/");
  createdMenuItemId = urlParts[urlParts.length - 1];

  // Ubah nama menu dan harga
  await page.getByLabel(/Nama Menu/i).fill(UPDATED_MENU_NAME);
  await page.getByLabel(/Harga/i).fill("25000");
  await page.getByRole("button", { name: "Simpan Menu" }).click();

  // Verifikasi perubahan tampil di daftar /admin/menu
  await expect(page).toHaveURL(/\/admin\/menu$/);
  const updatedItemCard = page.locator('[data-testid="admin-menu-card"]').filter({ hasText: UPDATED_MENU_NAME });
  await expect(updatedItemCard).toBeVisible();
  await expect(updatedItemCard.getByRole("heading", { level: 2, name: UPDATED_MENU_NAME })).toBeVisible();
  await expect(updatedItemCard.getByText(/Rp\s?25\.000/)).toBeVisible();

  // Buka dialog konfirmasi hapus lunak pada menu
  await page.getByRole("button", { name: `Hapus menu ${UPDATED_MENU_NAME}` }).click();

  const deleteDialog = page.getByRole("dialog");
  await expect(deleteDialog).toBeVisible();
  await expect(deleteDialog.getByRole("heading", { name: `Hapus Menu ${UPDATED_MENU_NAME}?` })).toBeVisible();

  // Konfirmasi hapus menu
  await deleteDialog.getByRole("button", { name: /^(Hapus Menu|Ya, Hapus)$/i }).click();
  await expect(deleteDialog).not.toBeVisible();

  // Verifikasi menu tidak tampil lagi di /admin/menu
  await expect(page.getByRole("heading", { level: 2, name: UPDATED_MENU_NAME })).not.toBeVisible();

  // Verifikasi di halaman pelanggan (/), menu tidak tampil sama sekali (is_active = false)
  await page.goto("/");
  await expect(page.locator("article[data-testid='menu-card']").filter({ hasText: UPDATED_MENU_NAME })).not.toBeVisible();
});
