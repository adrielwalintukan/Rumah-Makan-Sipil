import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// E2E menu unggulan (Issue #63): pemilik menandai menu ⭐ Banner -> menu tampil di banner pelanggan
// dan tombolnya menambah ke keranjang -> pemilik melepas tanda -> banner menu hilang.
// Hanya dijalankan pada Supabase lokal (CI), bukan hosted.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const isLocal = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url);
test.skip(!isLocal || !serviceKey, "Butuh Supabase lokal (supabase start) + SUPABASE_SERVICE_ROLE_KEY");

const db = isLocal && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false } }) : null;

const runId = Date.now();
const ADMIN_EMAIL = `admin-unggulan-${runId}@test.local`;
const PASSWORD = "Password123!";
const CATEGORY_NAME = `Kategori Unggulan ${runId}`;
const MENU_NAME = `Menu Unggulan ${runId}`;

let adminUserId: string | null = null;
let categoryId: string | null = null;
let initialIsOpen: boolean | null = null;

test.beforeAll(async () => {
  if (!db) return;

  const { data: store, error: storeErr } = await db.from("settings").select("is_open").eq("id", 1).single();
  expect(storeErr).toBeNull();
  initialIsOpen = store!.is_open;
  if (!initialIsOpen) expect((await db.from("settings").update({ is_open: true }).eq("id", 1)).error).toBeNull();

  const { data: auth, error: authErr } = await db.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });
  expect(authErr).toBeNull();
  adminUserId = auth.user!.id;
  expect((await db.from("admins").insert({ user_id: adminUserId })).error).toBeNull();

  const { data: cat, error: catErr } = await db
    .from("categories")
    .insert({ name: CATEGORY_NAME, sort_order: 99 })
    .select("id")
    .single();
  expect(catErr).toBeNull();
  categoryId = cat!.id;
  expect(
    (await db.from("menu_items").insert({ category_id: categoryId, name: MENU_NAME, price: 12000 })).error,
  ).toBeNull();
});

test.afterAll(async () => {
  if (!db) return;
  if (categoryId) {
    expect((await db.from("menu_items").delete().eq("category_id", categoryId)).error).toBeNull();
    expect((await db.from("categories").delete().eq("id", categoryId)).error).toBeNull();
  }
  if (adminUserId) {
    expect((await db.from("admins").delete().eq("user_id", adminUserId)).error).toBeNull();
    expect((await db.auth.admin.deleteUser(adminUserId)).error).toBeNull();
  }
  if (initialIsOpen !== null) {
    expect((await db.from("settings").update({ is_open: initialIsOpen }).eq("id", 1)).error).toBeNull();
  }
});

test("pemilik menandai menu unggulan dan menu tampil di banner pelanggan", async ({ page }) => {
  const banner = page.locator('section[aria-roledescription="carousel"]');

  // Sebelum ditandai: tidak ada slide menu ini
  await page.goto("/");
  await expect(banner).toBeVisible();
  await expect(banner.getByRole("button", { name: `Tambah ${MENU_NAME}` })).toHaveCount(0);

  // Pemilik menandai ⭐ Banner
  await page.goto("/admin/login");
  await page.getByLabel(/Email Pemilik/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/Kata Sandi/i).fill(PASSWORD);
  await page.getByRole("button", { name: "Masuk ke Dashboard" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Pesanan Live" })).toBeVisible();

  await page.goto("/admin/menu");
  const star = page.getByRole("button", { name: `Tampilkan ${MENU_NAME} di banner` });
  await expect(star).toHaveAttribute("aria-pressed", "false");
  await star.click();
  await expect(star).toHaveAttribute("aria-pressed", "true");
  await expect(star).toBeEnabled();

  // Pelanggan: slide menu unggulan tampil pertama, tombol Tambah mengisi keranjang
  await page.goto("/");
  await expect(banner.getByRole("listitem").first()).toHaveAttribute("aria-label", new RegExp(`^1 dari \\d+: ${MENU_NAME}$`));
  await banner.getByRole("button", { name: `Tambah ${MENU_NAME}` }).click();
  await expect(page.getByRole("link", { name: /1 item/ })).toBeVisible();

  // Pemilik melepas tanda -> slide hilang
  await page.goto("/admin/menu");
  const starAgain = page.getByRole("button", { name: `Tampilkan ${MENU_NAME} di banner` });
  await starAgain.click();
  await expect(starAgain).toHaveAttribute("aria-pressed", "false");
  await expect(starAgain).toBeEnabled();

  await page.goto("/");
  await expect(banner.getByRole("button", { name: `Tambah ${MENU_NAME}` })).toHaveCount(0);
});
