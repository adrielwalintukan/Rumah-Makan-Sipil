import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Pengujian End-to-End (E2E) Editor Grup Pilihan & Opsi Menu (Issue #18):
// Menguji alur lengkap:
// 1. Admin membuat menu baru dengan grup pilihan (single wajib & multiple opsional).
// 2. Pelanggan melihat menu beropsi, membuka bottom sheet, memilih opsi, dan verifikasi total harga dinamis.
// 3. Admin mengubah ketersediaan opsi menjadi "Habis".
// 4. Pelanggan melihat opsi berstatus Habis dan disabled (tidak dapat dipilih).
// 5. Admin menambah opsi baru dan menghapus salah satu grup pilihan.
// 6. Pelanggan melihat opsi baru dan grup yang dihapus sudah tidak muncul.
// 7. Teardown membersihkan menu, kategori, admin sintetis, dan memulihkan status toko.
//
// Hanya dijalankan pada lingkungan Supabase lokal (CI), bukan hosted.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const isLocal = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url);
test.skip(!isLocal || !serviceKey, "Butuh Supabase lokal (supabase start) + SUPABASE_SERVICE_ROLE_KEY");

const db = isLocal && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false } }) : null;

const testRunId = Date.now().toString(36);
const ADMIN_EMAIL = `admin-options-${testRunId}@test.local`;
const PASSWORD = "Password123!";
const CATEGORY_NAME = `Kategori Opsi E2E ${testRunId}`;
const MENU_NAME = `Kopi Opsi E2E ${testRunId}`;

let adminUserId: string | null = null;
let initialIsOpen: boolean | null = null;
let createdCategoryId: string | null = null;
let createdMenuItemId: string | null = null;

test.beforeAll(async () => {
  if (!db) return;

  // 1. Pastikan toko buka di pengaturan agar menu dapat dilihat dan dipesan di tampilan pelanggan
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

  // 3. Buat kategori sintetis untuk menu opsi
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

  // 1. Bersihkan menu sintetis (cascade ke option_groups & options)
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
    .like("name", `Kopi Opsi E2E ${testRunId}%`);
  expect(delMenuByNameErr).toBeNull();

  // 2. Bersihkan kategori sintetis
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

  // 3. Bersihkan akun admin
  if (adminUserId) {
    const { error: delAdminRowErr } = await db
      .from("admins")
      .delete()
      .eq("user_id", adminUserId);
    expect(delAdminRowErr).toBeNull();

    const { error: delAuthErr } = await db.auth.admin.deleteUser(adminUserId);
    expect(delAuthErr).toBeNull();
  }

  // 4. Pulihkan status buka toko ke kondisi semula
  if (initialIsOpen !== null) {
    const { error: restoreStoreErr } = await db
      .from("settings")
      .update({ is_open: initialIsOpen })
      .eq("id", 1);
    expect(restoreStoreErr).toBeNull();
  }
});

test("alur kelola grup pilihan dan opsi menu: buat menu beropsi, pesan di pelanggan, ubah habis, tambah opsi baru", async ({ page }) => {
  // -------------------------------------------------------------
  // 1. Login Admin & Masuk ke Form Tambah Menu Baru
  // -------------------------------------------------------------
  await page.goto("/admin/login");
  await page.getByLabel(/Email Pemilik/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/Kata Sandi/i).fill(PASSWORD);
  await page.getByRole("button", { name: "Masuk ke Dashboard" }).click();

  await expect(page).toHaveURL(/\/admin/);
  await expect(page.getByRole("heading", { level: 1, name: "Pesanan Live" })).toBeVisible();

  await page.goto("/admin/menu/baru");
  await expect(page).toHaveURL(/\/admin\/menu\/baru$/);
  await expect(page.getByRole("heading", { level: 1, name: "Tambah Menu Baru" })).toBeVisible();

  // -------------------------------------------------------------
  // 2. Isi Form Menu dengan 2 Grup Pilihan & Opsi
  // -------------------------------------------------------------
  // Pilih kategori sintetis
  await expect(page.locator("select#category_id option").filter({ hasText: CATEGORY_NAME })).toBeAttached();
  await page.locator("select#category_id").selectOption({ label: CATEGORY_NAME });

  // Isi data dasar menu
  await page.getByLabel(/Nama Menu/i).fill(MENU_NAME);
  await page.getByLabel(/Harga/i).fill("15000");
  await page.getByLabel(/Deskripsi/i).fill("Kopi dengan aneka pilihan");

  // Tambah Grup 1: "Varian Suhu" (Pilih Satu / Single, Wajib)
  await page.getByRole("button", { name: "Tambah Grup Pilihan" }).click();
  const group1Card = page.locator('[data-testid="option-group-card"]').filter({ has: page.locator("#group-name-0") });
  await expect(group1Card).toBeVisible();

  await group1Card.locator("#group-name-0").fill("Varian Suhu");
  await group1Card.getByRole("radio", { name: "Pilih Satu (Single)" }).click();

  const requiredCheckbox = group1Card.getByLabel(/Wajib dipilih pelanggan/i);
  await requiredCheckbox.check();
  await expect(requiredCheckbox).toBeChecked();

  // Opsi 1 di Grup 1: "Panas", tambahan harga Rp 0 (default)
  await group1Card.getByLabel("Nama opsi").first().fill("Panas");

  // Opsi 2 di Grup 1: "Dingin", tambahan harga Rp 2.000
  await group1Card.getByRole("button", { name: "Tambah Opsi" }).click();
  await group1Card.getByLabel("Nama opsi").nth(1).fill("Dingin");
  await group1Card.getByLabel("Tambahan harga (Rp)").nth(1).fill("2000");

  // Tambah Grup 2: "Topping Ekstra" (Boleh Lebih dari Satu / Multiple, Opsional)
  await page.getByRole("button", { name: "Tambah Grup Pilihan" }).click();
  const group2Card = page.locator('[data-testid="option-group-card"]').filter({ has: page.locator("#group-name-1") });
  await expect(group2Card).toBeVisible();

  await group2Card.locator("#group-name-1").fill("Topping Ekstra");
  await group2Card.getByRole("radio", { name: "Boleh Lebih dari Satu (Multiple)" }).click();

  // Opsi 1 di Grup 2: "Jelly", tambahan harga Rp 3.000
  await group2Card.getByLabel("Nama opsi").first().fill("Jelly");
  await group2Card.getByLabel("Tambahan harga (Rp)").first().fill("3000");

  // Simpan menu baru
  await page.getByRole("button", { name: "Simpan Menu" }).click();
  await expect(page).toHaveURL(/\/admin\/menu$/, { timeout: 15000 });

  // Verifikasi menu muncul di daftar kelola menu
  const adminCard = page.locator('[data-testid="admin-menu-card"]').filter({ hasText: MENU_NAME });
  await expect(adminCard).toBeVisible();
  await expect(adminCard.getByRole("heading", { level: 2, name: MENU_NAME })).toBeVisible();

  // Ambil ID menu untuk teardown jika diperlukan
  const ubahLinkHref = await adminCard.getByRole("link", { name: "Ubah" }).getAttribute("href");
  if (ubahLinkHref) {
    createdMenuItemId = ubahLinkHref.split("/").pop() ?? null;
  }

  // -------------------------------------------------------------
  // 3. Verifikasi di Halaman Pelanggan (/)
  // -------------------------------------------------------------
  await page.goto("/");
  const customerCard = page.locator("article[data-testid='menu-card']").filter({ hasText: MENU_NAME });
  await expect(customerCard).toBeVisible();

  // Buka bottom sheet pilihan menu
  await customerCard.getByRole("button", { name: MENU_NAME, exact: true }).click();

  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("heading", { name: MENU_NAME })).toBeVisible();

  // Verifikasi grup "Varian Suhu" & opsinya
  await expect(sheet.getByText("Varian Suhu")).toBeVisible();
  await expect(sheet.getByText("Panas")).toBeVisible();
  await expect(sheet.getByText("Dingin")).toBeVisible();
  await expect(sheet.getByText(/\+Rp\s?2\.000/)).toBeVisible();

  // Verifikasi grup "Topping Ekstra" & opsinya
  await expect(sheet.getByText("Topping Ekstra")).toBeVisible();
  await expect(sheet.getByText("Jelly")).toBeVisible();
  await expect(sheet.getByText(/\+Rp\s?3\.000/)).toBeVisible();

  // Pilih "Dingin" (+Rp 2.000) dan "Jelly" (+Rp 3.000)
  await sheet.locator("label").filter({ hasText: "Dingin" }).click();
  await sheet.locator("label").filter({ hasText: "Jelly" }).click();

  // Verifikasi total harga: Rp 15.000 + Rp 2.000 + Rp 3.000 = Rp 20.000
  const addToCartButton = sheet.getByRole("button", { name: /Tambah · Rp\s?20\.000/ });
  await expect(addToCartButton).toBeVisible();
  await expect(addToCartButton).toBeEnabled();

  // -------------------------------------------------------------
  // 4. Ubah Ketersediaan Opsi Menjadi "Habis" di Admin
  // -------------------------------------------------------------
  await page.goto("/admin/menu");
  const adminMenuCardToEdit = page.locator('[data-testid="admin-menu-card"]').filter({ hasText: MENU_NAME });
  await adminMenuCardToEdit.getByRole("link", { name: "Ubah" }).click();

  await expect(page).toHaveURL(/\/admin\/menu\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { level: 1, name: "Ubah Menu" })).toBeVisible();

  // Cari opsi Dingin, ubah toggle ketersediaan menjadi Habis
  const dinginSwitch = page.getByRole("switch", { name: "Status ketersediaan opsi Dingin" });
  await expect(dinginSwitch).toBeVisible();
  await expect(dinginSwitch).toHaveAttribute("aria-checked", "true");
  await dinginSwitch.click();
  await expect(dinginSwitch).toHaveAttribute("aria-checked", "false");

  // Simpan perubahan menu
  await page.getByRole("button", { name: "Simpan Menu" }).click();
  await expect(page).toHaveURL(/\/admin\/menu$/, { timeout: 15000 });

  // -------------------------------------------------------------
  // 5. Verifikasi Opsi Habis di Halaman Pelanggan
  // -------------------------------------------------------------
  await page.goto("/");
  const customerCardAfterSoldOut = page.locator("article[data-testid='menu-card']").filter({ hasText: MENU_NAME });
  await expect(customerCardAfterSoldOut).toBeVisible();

  // Buka kembali bottom sheet
  await customerCardAfterSoldOut.getByRole("button", { name: MENU_NAME, exact: true }).click();
  const sheetAfterSoldOut = page.getByRole("dialog");
  await expect(sheetAfterSoldOut).toBeVisible();

  // Verifikasi opsi Dingin menampilkan label "Habis" dan radio button-nya disabled
  const dinginLabel = sheetAfterSoldOut.locator("label").filter({ hasText: "Dingin" });
  await expect(dinginLabel).toBeVisible();
  await expect(dinginLabel.getByText("Habis")).toBeVisible();
  await expect(dinginLabel.locator("input")).toBeDisabled();

  // -------------------------------------------------------------
  // 6. Ubah/Tambah Opsi Baru di Admin & Hapus Grup Topping
  // -------------------------------------------------------------
  await page.goto("/admin/menu");
  const adminMenuCardToUpdate = page.locator('[data-testid="admin-menu-card"]').filter({ hasText: MENU_NAME });
  await adminMenuCardToUpdate.getByRole("link", { name: "Ubah" }).click();

  await expect(page).toHaveURL(/\/admin\/menu\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { level: 1, name: "Ubah Menu" })).toBeVisible();

  // Tambah opsi "Es Batu (+Rp 1.000)" pada grup "Varian Suhu" (Grup #1)
  const editGroup1Card = page.locator('[data-testid="option-group-card"]').filter({ has: page.locator("#group-name-0") });
  await editGroup1Card.getByRole("button", { name: "Tambah Opsi" }).click();

  // Opsi ke-3 (indeks 2: Panas, Dingin, Es Batu)
  await editGroup1Card.getByLabel("Nama opsi").nth(2).fill("Es Batu");
  await editGroup1Card.getByLabel("Tambahan harga (Rp)").nth(2).fill("1000");

  // Hapus grup "Topping Ekstra"
  await page.getByRole("button", { name: "Hapus grup Topping Ekstra" }).click();

  // Konfirmasi dialog hapus grup
  const deleteGroupDialog = page.getByRole("dialog");
  await expect(deleteGroupDialog).toBeVisible();
  await expect(deleteGroupDialog.getByRole("heading", { name: "Hapus Grup Pilihan" })).toBeVisible();
  await deleteGroupDialog.getByRole("button", { name: "Hapus Grup" }).click();
  await expect(deleteGroupDialog).toBeHidden();

  // Verifikasi grup Topping Ekstra sudah tidak ada di form
  await expect(page.locator("#group-name-1")).not.toBeVisible();

  // Simpan perubahan menu
  await page.getByRole("button", { name: "Simpan Menu" }).click();
  await expect(page).toHaveURL(/\/admin\/menu$/, { timeout: 15000 });

  // -------------------------------------------------------------
  // 7. Verifikasi Perubahan Akhir di Pelanggan
  // -------------------------------------------------------------
  await page.goto("/");
  const finalCustomerCard = page.locator("article[data-testid='menu-card']").filter({ hasText: MENU_NAME });
  await expect(finalCustomerCard).toBeVisible();

  // Buka bottom sheet
  await finalCustomerCard.getByRole("button", { name: MENU_NAME, exact: true }).click();
  const finalSheet = page.getByRole("dialog");
  await expect(finalSheet).toBeVisible();

  // Verifikasi opsi "Es Batu" muncul dengan harga +Rp 1.000
  await expect(finalSheet.getByText("Es Batu")).toBeVisible();
  await expect(finalSheet.getByText(/\+Rp\s?1\.000/)).toBeVisible();

  // Verifikasi grup "Topping Ekstra" sudah tidak ada
  await expect(finalSheet.getByText("Topping Ekstra")).not.toBeVisible();
});
