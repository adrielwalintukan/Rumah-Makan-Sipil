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

async function setQrisImagePath(path: string | null) {
  const { error } = await db!.from("settings").update({ qris_image_path: path }).eq("id", 1);
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
  await setQrisImagePath(null);
  await clearOrders();
});

test("layar pembayaran QRIS: total besar, tombol 'Saya sudah bayar' mengubah status ke Menunggu Verifikasi", async ({
  page,
}) => {
  // Set gambar QRIS contoh
  await setQrisImagePath("qris-dana-test.png");

  // 1. Buat pesanan QRIS lewat alur checkout
  await page.goto("/");
  const card = page.getByTestId("menu-card").filter({ hasText: "Nasi Telur" });
  await card.getByRole("button", { name: "Tambah Nasi Telur" }).click();

  await page.goto("/checkout");
  await page.getByLabel(/NAMA PEMESAN/).fill("Ahmad QRIS");
  await page.getByRole("radio", { name: /QRIS/ }).click();

  const submitBtn = page.getByRole("button", { name: /Pesan Sekarang/ });
  await submitBtn.click();

  // 2. Tiba di halaman pesanan
  await expect(page).toHaveURL(/\/pesanan\/[a-zA-Z0-9_-]+/);

  // Verifikasi total besar dan instruksi nominal persis
  await expect(page.getByTestId("payment-total-amount")).toBeVisible();
  await expect(page.getByText(/Masukkan nominal persis/)).toBeVisible();

  // Verifikasi badge awal "Belum Bayar"
  await expect(page.getByText("Belum Bayar")).toBeVisible();

  // Verifikasi tombol "Saya sudah bayar"
  const claimBtn = page.getByRole("button", { name: "Saya sudah bayar" });
  await expect(claimBtn).toBeVisible();

  // 3. Tekan "Saya sudah bayar"
  await claimBtn.click();

  // 4. Verifikasi status bayar berubah jadi "Menunggu Verifikasi"
  await expect(page.getByText("Menunggu Verifikasi")).toBeVisible();
  await expect(page.getByText("Menunggu Verifikasi Kasir")).toBeVisible();

  // Tombol "Saya sudah bayar" tidak lagi tampil
  await expect(page.getByRole("button", { name: "Saya sudah bayar" })).toHaveCount(0);
});

test("layar pembayaran Cash: menampilkan instruksi kasir dan nomor antrean", async ({ page }) => {
  // 1. Buat pesanan Cash lewat alur checkout
  await page.goto("/");
  const card = page.getByTestId("menu-card").filter({ hasText: "Nasi Telur" });
  await card.getByRole("button", { name: "Tambah Nasi Telur" }).click();

  await page.goto("/checkout");
  await page.getByLabel(/NAMA PEMESAN/).fill("Siti Cash");
  await page.getByRole("radio", { name: /Cash/ }).click();

  const submitBtn = page.getByRole("button", { name: /Pesan Sekarang/ });
  await submitBtn.click();

  // 2. Tiba di halaman pesanan
  await expect(page).toHaveURL(/\/pesanan\/[a-zA-Z0-9_-]+/);

  // Verifikasi instruksi bayar di kasir
  await expect(page.getByText("Bayar di Kasir")).toBeVisible();
  await expect(page.getByText(/Sebutkan nama/)).toBeVisible();
  await expect(page.getByText("Siti Cash")).toBeVisible();
});

test("fallback QRIS: jika gambar QRIS belum diupload, tampil pesan alternatif", async ({ page }) => {
  // Kosongkan gambar QRIS
  await setQrisImagePath(null);

  // Buat pesanan QRIS
  await page.goto("/");
  const card = page.getByTestId("menu-card").filter({ hasText: "Nasi Telur" });
  await card.getByRole("button", { name: "Tambah Nasi Telur" }).click();

  await page.goto("/checkout");
  await page.getByLabel(/NAMA PEMESAN/).fill("Joko Fallback");
  await page.getByRole("radio", { name: /QRIS/ }).click();

  const submitBtn = page.getByRole("button", { name: /Pesan Sekarang/ });
  await submitBtn.click();

  await expect(page).toHaveURL(/\/pesanan\/[a-zA-Z0-9_-]+/);

  // Verifikasi pesan fallback
  await expect(page.getByText("QRIS digital belum tersedia di layar")).toBeVisible();
  // Tombol klaim bayar tetap tersedia
  await expect(page.getByRole("button", { name: "Saya sudah bayar" })).toBeVisible();
});
