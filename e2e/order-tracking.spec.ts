import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Tes ini mengubah data dan membuat pesanan. Hanya boleh jalan ke Supabase lokal (CI), bukan hosted.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const isLocal = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url);
test.skip(!isLocal || !serviceKey, "Butuh Supabase lokal (supabase start) + SUPABASE_SERVICE_ROLE_KEY");

const db = isLocal && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false } }) : null;

async function setStoreOpen(isOpen: boolean) {
  const { error } = await db!.from("settings").update({ is_open: isOpen }).eq("id", 1);
  expect(error).toBeNull();
}

async function clearOrders() {
  const { error } = await db!.from("orders").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  expect(error).toBeNull();
}

test.beforeEach(async () => {
  await setStoreOpen(true);
  await clearOrders();
});

test.afterAll(async () => {
  await setStoreOpen(false);
  await clearOrders();
});

test("halaman lacak memperbarui status masak secara otomatis tanpa reload (polling ≤ 5 detik)", async ({
  page,
}) => {
  // 1. Buat pesanan baru
  await page.goto("/");
  const card = page.getByTestId("menu-card").filter({ hasText: "Nasi Telur" });
  await card.getByRole("button", { name: "Tambah Nasi Telur" }).click();

  await page.goto("/checkout");
  await page.getByLabel(/NAMA PEMESAN/).fill("Rudi Lacak");
  await page.getByRole("radio", { name: /Cash/ }).click();

  const submitBtn = page.getByRole("button", { name: /Pesan Sekarang/ });
  await submitBtn.click();

  // 2. Berada di halaman lacak
  await expect(page).toHaveURL(/\/pesanan\/[a-zA-Z0-9_-]+/);
  const token = page.url().split("/pesanan/")[1];
  expect(token).toBeTruthy();

  // Verifikasi status awal "Menunggu Dimasak"
  const statusRegion = page.getByRole("status");
  await expect(statusRegion).toBeVisible();
  await expect(statusRegion.getByText("Menunggu Dimasak")).toBeVisible();

  // 3. Ubah status pesanan di database lokal menjadi 'dimasak'
  const { error: errCook } = await db!
    .from("orders")
    .update({ status: "dimasak" })
    .eq("public_token", token);
  expect(errCook).toBeNull();

  // Verifikasi halaman otomatis memperbarui status menjadi "Sedang Dimasak" (timeout cukup untuk polling 5s)
  await expect(statusRegion.getByText("Sedang Dimasak")).toBeVisible({ timeout: 10000 });

  // 4. Ubah status pesanan di database lokal menjadi 'siap'
  const { error: errReady } = await db!
    .from("orders")
    .update({ status: "siap" })
    .eq("public_token", token);
  expect(errReady).toBeNull();

  // Verifikasi banner status Siap muncul dengan teks pengumuman
  const readyBanner = page.getByTestId("order-ready-banner");
  await expect(readyBanner).toBeVisible({ timeout: 10000 });
  await expect(
    readyBanner.getByText("Pesanan kamu siap! Silakan ambil di kasir."),
  ).toBeVisible();
});

test("halaman lacak menampilkan status pesanan dibatalkan beserta alasannya", async ({
  page,
}) => {
  // 1. Buat pesanan baru
  await page.goto("/");
  const card = page.getByTestId("menu-card").filter({ hasText: "Nasi Telur" });
  await card.getByRole("button", { name: "Tambah Nasi Telur" }).click();

  await page.goto("/checkout");
  await page.getByLabel(/NAMA PEMESAN/).fill("Doni Batal");
  await page.getByRole("radio", { name: /Cash/ }).click();

  const submitBtn = page.getByRole("button", { name: /Pesan Sekarang/ });
  await submitBtn.click();

  await expect(page).toHaveURL(/\/pesanan\/[a-zA-Z0-9_-]+/);
  const token = page.url().split("/pesanan/")[1];

  // 2. Ubah status pesanan di database menjadi 'batal' dengan alasan
  const { error } = await db!
    .from("orders")
    .update({ status: "batal", cancel_reason: "Stok bahan habis mendadak" })
    .eq("public_token", token);
  expect(error).toBeNull();

  // 3. Verifikasi halaman lacak menampilkan informasi pembatalan
  const cancelBanner = page.getByTestId("order-cancelled-banner");
  await expect(cancelBanner).toBeVisible({ timeout: 10000 });
  await expect(cancelBanner.getByText("Pesanan dibatalkan")).toBeVisible();
  await expect(cancelBanner.getByText(/Stok bahan habis mendadak/)).toBeVisible();
});

test("banner pesanan aktif tampil di halaman menu dan mengarah ke link lacak", async ({
  page,
}) => {
  // 1. Buat pesanan baru
  await page.goto("/");
  const card = page.getByTestId("menu-card").filter({ hasText: "Nasi Telur" });
  await card.getByRole("button", { name: "Tambah Nasi Telur" }).click();

  await page.goto("/checkout");
  await page.getByLabel(/NAMA PEMESAN/).fill("Maya Banner");
  await page.getByRole("radio", { name: /Cash/ }).click();

  const submitBtn = page.getByRole("button", { name: /Pesan Sekarang/ });
  await submitBtn.click();

  await expect(page).toHaveURL(/\/pesanan\/[a-zA-Z0-9_-]+/);
  const orderUrl = page.url();

  // 2. Kunjungi kembali halaman menu utama
  await page.goto("/");

  // 3. Verifikasi banner pesanan aktif tampil
  const activeSection = page.getByRole("region", { name: "Pesanan aktif" });
  await expect(activeSection).toBeVisible();
  await expect(activeSection.getByText(/Pesanan aktif kamu/)).toBeVisible();

  // Klik tautan di banner → mengarah kembali ke URL pesanan
  await activeSection.getByRole("link").click();
  await expect(page).toHaveURL(orderUrl);
});
