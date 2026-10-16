import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const isLocal = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url);
test.skip(!isLocal || !serviceKey, "Butuh Supabase lokal (supabase start) + SUPABASE_SERVICE_ROLE_KEY");

const db = isLocal && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false } }) : null;

const ADMIN_EMAIL = `admin-e2e-${Date.now()}@test.local`;
const REGULAR_EMAIL = `user-biasa-${Date.now()}@test.local`;
const PASSWORD = "Password123!";

let adminUserId: string | null = null;
let regularUserId: string | null = null;

test.beforeAll(async () => {
  if (!db) return;

  // 1. Buat user admin pemilik di Auth & daftarkan ke tabel admins
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

  // 2. Buat user biasa (bukan pemilik)
  const { data: regularAuth, error: regErr } = await db.auth.admin.createUser({
    email: REGULAR_EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });
  expect(regErr).toBeNull();
  expect(regularAuth.user).toBeTruthy();
  regularUserId = regularAuth.user!.id;
});

test.afterAll(async () => {
  if (!db) return;
  if (adminUserId) {
    await db.from("admins").delete().eq("user_id", adminUserId);
    await db.auth.admin.deleteUser(adminUserId);
  }
  if (regularUserId) {
    await db.auth.admin.deleteUser(regularUserId);
  }
});

test("akses /admin dan /admin/menu tanpa login otomatis diarahkan ke /admin/login", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);

  await page.goto("/admin/menu");
  await expect(page).toHaveURL(/\/admin\/login/);

  // Form login tampil lengkap dengan input email dan password
  await expect(page.getByLabel(/Email Pemilik/i)).toBeVisible();
  await expect(page.getByLabel(/Kata Sandi/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Masuk ke Dashboard" })).toBeVisible();
});

test("login dengan kata sandi salah menampilkan pesan kesalahan", async ({ page }) => {
  await page.goto("/admin/login");

  await page.getByLabel(/Email Pemilik/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/Kata Sandi/i).fill("PasswordSalah123!");
  await page.getByRole("button", { name: "Masuk ke Dashboard" }).click();

  await expect(page.getByText("Email atau kata sandi tidak valid")).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("user login yang bukan pemilik ditolak masuk ke /admin", async ({ page }) => {
  await page.goto("/admin/login");

  await page.getByLabel(/Email Pemilik/i).fill(REGULAR_EMAIL);
  await page.getByLabel(/Kata Sandi/i).fill(PASSWORD);
  await page.getByRole("button", { name: "Masuk ke Dashboard" }).click();

  // Ditolak karena bukan pemilik resmi
  await expect(page.getByText("Akun ini tidak memiliki hak akses pemilik.")).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("pemilik resmi berhasil login, melihat navigasi dashboard, dan bisa logout", async ({ page }) => {
  await page.goto("/admin/login");

  await page.getByLabel(/Email Pemilik/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/Kata Sandi/i).fill(PASSWORD);
  await page.getByRole("button", { name: "Masuk ke Dashboard" }).click();

  // Berhasil dialihkan ke dashboard /admin
  await expect(page).toHaveURL(/\/admin/);
  await expect(page.getByRole("heading", { level: 1, name: "Pesanan Live" })).toBeVisible();

  // Verifikasi navigasi bottom tab di HP (360 px)
  const mobileNav = page.getByRole("navigation", { name: "Navigasi mobile admin" });
  await expect(mobileNav).toBeVisible();
  await expect(mobileNav.getByRole("link", { name: "Pesanan" })).toBeVisible();
  await expect(mobileNav.getByRole("link", { name: "Menu" })).toBeVisible();

  // Navigasi ke menu lain berfungsi
  await mobileNav.getByRole("link", { name: "Menu" }).click();
  await expect(page).toHaveURL(/\/admin\/menu/);
  await expect(page.getByRole("heading", { level: 1, name: "Kelola Menu" })).toBeVisible();

  // Tombol Logout berfungsi
  const logoutBtn = page.getByRole("button", { name: /Keluar/i }).first();
  await expect(logoutBtn).toBeVisible();
  await logoutBtn.click();

  // Kembali ke /admin/login setelah logout
  await expect(page).toHaveURL(/\/admin\/login/);
});
