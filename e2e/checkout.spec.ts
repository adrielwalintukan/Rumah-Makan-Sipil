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

test("alur checkout lengkap dari keranjang sampai pesanan berhasil dibuat (360 px)", async ({ page }) => {
  // 1. Pilih menu dari beranda
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "SIPIL" })).toBeVisible();

  // Tambah "Nasi Telur" (menu tanpa pilihan)
  const card = page.getByTestId("menu-card").filter({ hasText: "Nasi Telur" });
  await card.getByRole("button", { name: "Tambah Nasi Telur" }).click();

  // 2. Buka keranjang
  const cartBar = page.getByRole("link", { name: /Lihat keranjang/ });
  await expect(cartBar).toBeVisible();
  await cartBar.click();
  await expect(page).toHaveURL("/keranjang");

  // Verifikasi tombol "Lanjut pesan" aktif dan klik
  const lanjutBtn = page.getByRole("link", { name: "Lanjut pesan" });
  await expect(lanjutBtn).toBeVisible();
  await lanjutBtn.click();
  await expect(page).toHaveURL("/checkout");

  // 3. Halaman Checkout: verifikasi elemen
  await expect(page.getByRole("heading", { level: 1, name: "Checkout Pesanan" })).toBeVisible();
  await expect(page.getByText(/1x Nasi Telur/)).toBeVisible();

  // Pilih Bungkus
  await page.getByRole("radio", { name: "Bungkus" }).click();
  await expect(page.getByRole("radio", { name: "Bungkus" })).toHaveAttribute("aria-checked", "true");

  // Isi Nama dan No HP
  const nameInput = page.getByLabel(/NAMA PEMESAN/);
  await nameInput.fill("Budi Santoso");

  const phoneInput = page.getByLabel(/NO. WHATSAPP \/ HP/);
  await phoneInput.fill("081234567890");

  // Pilih QRIS
  await page.getByRole("radio", { name: /QRIS/ }).click();

  // 4. Kirim Pesanan
  const submitBtn = page.getByRole("button", { name: /Pesan Sekarang/ });
  await expect(submitBtn).toBeEnabled();
  await submitBtn.click();

  // 5. Berhasil: diarahkan ke /pesanan/[token]
  await expect(page).toHaveURL(/\/pesanan\/[a-zA-Z0-9_-]+/);
  await expect(page.getByText("Pesanan Berhasil Dibuat!")).toBeVisible();
  await expect(page.getByText("Budi Santoso")).toBeVisible();
  await expect(page.getByText("Bungkus")).toBeVisible();
  await expect(page.getByText("QRIS", { exact: true })).toBeVisible();

  // 6. Verifikasi keranjang sudah dikosongkan
  await page.goto("/keranjang");
  await expect(page.getByText("Keranjang masih kosong")).toBeVisible();
});

test("checkout menampilkan peringatan jika nama kosong", async ({ page }) => {
  // Tambah item ke keranjang dulu
  await page.goto("/");
  const card = page.getByTestId("menu-card").filter({ hasText: "Nasi Telur" });
  await card.getByRole("button", { name: "Tambah Nasi Telur" }).click();

  await page.goto("/checkout");
  await expect(page.getByRole("heading", { level: 1, name: "Checkout Pesanan" })).toBeVisible();

  // Langsung klik submit tanpa mengisi nama
  const submitBtn = page.getByRole("button", { name: /Pesan Sekarang/ });
  await submitBtn.click();

  // Error validasi nama muncul
  await expect(page.getByText(/Nama pemesan wajib diisi/)).toBeVisible();
  // URL tidak berpindah
  await expect(page).toHaveURL("/checkout");
});
