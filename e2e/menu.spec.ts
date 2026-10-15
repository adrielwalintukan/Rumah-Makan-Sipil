import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Tes ini mengubah data (buka/tutup toko, Habis). Hanya boleh jalan ke Supabase lokal (CI), bukan hosted.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const isLocal = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url);
test.skip(!isLocal || !serviceKey, "Butuh Supabase lokal (supabase start) + SUPABASE_SERVICE_ROLE_KEY");

const db = isLocal && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false } }) : null;

async function setStoreOpen(isOpen: boolean) {
  const { error } = await db!.from("settings").update({ is_open: isOpen }).eq("id", 1);
  expect(error).toBeNull();
}
async function updateItem(name: string, values: Record<string, unknown>) {
  const { error } = await db!.from("menu_items").update(values).eq("name", name);
  expect(error).toBeNull();
}

const cartBar = (page: Page) => page.getByRole("link", { name: /Lihat keranjang/ });

test.beforeAll(async () => {
  await setStoreOpen(true);
  await updateItem("Susu", { is_available: false });
  // Path fiktif: gambar gagal dimuat, tapi kotak 4:3 tetap harus sama ukurannya dengan placeholder.
  await updateItem("Nasi Campur", { image_path: "tes/nasi-campur.webp" });
});

test.afterAll(async () => {
  await setStoreOpen(false);
  await updateItem("Susu", { is_available: true });
  await updateItem("Nasi Campur", { image_path: null });
});

test("menu tampil per kategori, Habis nonaktif, kartu foto & tanpa foto sama ukuran", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "SIPIL" })).toBeVisible();
  await expect(page.getByText("Buka", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Makanan" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Minuman" })).toBeVisible();
  await expect(page.getByTestId("menu-card")).toHaveCount(11);

  const susu = page.getByTestId("menu-card").filter({ hasText: "Susu" });
  await expect(susu.getByText("Habis")).toBeVisible();
  await expect(susu.getByRole("button", { name: "Tambah Susu" })).toHaveCount(0);

  const photoBox = async (name: string) =>
    page.getByTestId("menu-card").filter({ hasText: name }).locator(":scope > div").first().boundingBox();
  const withPhoto = await photoBox("Nasi Campur");
  const withoutPhoto = await photoBox("Nasi Telur");
  expect(withPhoto?.width).toBe(withoutPhoto?.width);
  expect(withPhoto?.height).toBe(withoutPhoto?.height);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
  await page.screenshot({ path: "test-results/layar/menu-360.png", fullPage: true });
});

test("menu tanpa pilihan: + menambah, lalu berubah jadi stepper", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Tambah Aqua" }).click();
  await expect(cartBar(page)).toContainText("1 item · Rp5.000");
  await page.getByRole("button", { name: "Tambah Aqua" }).click();
  await expect(cartBar(page)).toContainText("2 item · Rp10.000");
  await page.getByRole("button", { name: "Kurangi Aqua" }).click();
  await expect(cartBar(page)).toContainText("1 item · Rp5.000");
});

test("menu berpilihan: grup wajib, harga ikut tambahan, pilihan beda = baris terpisah", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Tambah Mie", exact: true }).click();
  const sheet = page.getByRole("dialog");
  const add = sheet.getByRole("button", { name: /^Tambah · / });
  await expect(add).toHaveText("Tambah · Rp7.000");
  await expect(add).toBeDisabled();

  await sheet.getByLabel("Goreng").check();
  await sheet.getByLabel("Telur").check();
  await sheet.getByRole("textbox").fill("tidak pedas");
  await expect(add).toHaveText("Tambah · Rp10.000");
  await expect(add).toBeEnabled();
  await page.screenshot({ path: "test-results/layar/sheet-360.png" });
  await add.click();
  await expect(sheet).toBeHidden();
  await expect(cartBar(page)).toContainText("1 item · Rp10.000");

  await page.getByRole("button", { name: "Tambah Mie", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Kuah").check();
  await page.getByRole("dialog").getByRole("button", { name: /^Tambah · / }).click();
  await expect(cartBar(page)).toContainText("2 item · Rp17.000");

  await cartBar(page).click();
  await expect(page).toHaveURL(/\/keranjang$/);
  await expect(page.getByTestId("cart-line")).toHaveCount(2);
  await expect(page.getByText("“tidak pedas”")).toBeVisible();
});

test("keranjang: ubah jumlah, hapus, dan tetap tersimpan setelah reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Tambah Aqua" }).click();
  await page.getByRole("button", { name: "Tambah Gorengan (isi 4)" }).click();
  await cartBar(page).click();

  await expect(page.getByTestId("cart-total")).toHaveText("Rp10.000");
  await page.getByRole("button", { name: "Tambah Aqua" }).click();
  await expect(page.getByTestId("cart-total")).toHaveText("Rp15.000");

  await page.reload();
  await expect(page.getByTestId("cart-total")).toHaveText("Rp15.000");
  await page.screenshot({ path: "test-results/layar/keranjang-360.png", fullPage: true });

  await page.getByRole("button", { name: /Hapus Gorengan/ }).click();
  await expect(page.getByTestId("cart-line")).toHaveCount(1);
  await expect(page.getByTestId("cart-total")).toHaveText("Rp10.000");
});

test("menu yang Habis setelah masuk keranjang ditandai dan tidak dihitung", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Tambah Aqua" }).click();
  await updateItem("Aqua", { is_available: false });
  try {
    await page.goto("/keranjang");
    await expect(page.getByText("Habis atau berubah. Hapus dari keranjang.")).toBeVisible();
    await expect(page.getByTestId("cart-total")).toHaveText("Rp0");
  } finally {
    await updateItem("Aqua", { is_available: true });
  }
});

test("toko tutup: banner tampil dan tombol tambah nonaktif (P10)", async ({ page }) => {
  await setStoreOpen(false);
  try {
    await page.goto("/");
    await expect(page.getByRole("status")).toContainText("toko sedang tutup");
    await expect(page.getByRole("button", { name: "Tambah Aqua" })).toBeDisabled();
  } finally {
    await setStoreOpen(true);
  }
});

test("Paket Dos membuka WhatsApp dengan pesan terisi (US-07)", async ({ page }) => {
  await page.goto("/");
  const link = page.getByRole("link", { name: "Pesan via WhatsApp" });
  const href = await link.getAttribute("href");
  expect(href).toMatch(/^https:\/\/wa\.me\/62895806567230\?text=/);
  expect(decodeURIComponent(href!.split("text=")[1])).toContain("saya mau pesan Paket Dos (Rp25.000/dos)");
});

test("tablet & desktop: grid 2 kolom tanpa scroll horizontal", async ({ page }) => {
  for (const [name, width, height] of [
    ["tablet", 768, 1024],
    ["desktop", 1280, 800],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    const cards = page.getByTestId("menu-card");
    const [a, b] = [await cards.nth(0).boundingBox(), await cards.nth(1).boundingBox()];
    expect(a?.y).toBe(b?.y);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBe(0);
    await page.screenshot({ path: `test-results/layar/menu-${name}.png` });
  }
});
