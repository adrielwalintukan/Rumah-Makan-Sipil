import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Tes ini memverifikasi polish visual, panel keranjang desktop, responsive overflow, dan halaman 404 (Issue #24).
// Skenario yang berinteraksi dengan menu/toko membutuhkan Supabase lokal (CI) agar aman dan toko dapat dibuka jika sedang tutup.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const isLocal = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url);

const db = isLocal && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false } }) : null;

async function setStoreOpen(isOpen: boolean) {
  if (!db) return;
  const { error } = await db.from("settings").update({ is_open: isOpen }).eq("id", 1);
  expect(error).toBeNull();
}

let originalIsOpen: boolean | null = null;

test.describe("M6 Polish: Desktop Cart Panel, Mobile Viewport & 404", () => {
  test.beforeAll(async () => {
    if (db) {
      const { data, error } = await db
        .from("settings")
        .select("is_open")
        .eq("id", 1)
        .maybeSingle();
      if (!error && data) {
        originalIsOpen = Boolean(data.is_open);
      }
      await setStoreOpen(true);
    }
  });

  test.afterAll(async () => {
    if (db && originalIsOpen !== null) {
      await setStoreOpen(originalIsOpen);
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
    });
  });

  test("Skenario 1: Desktop Cart Panel terlihat di kanan dan CartBar tersembunyi", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");

    // 1. Verifikasi header menu pelanggan
    await expect(page.getByRole("heading", { level: 1, name: "SIPIL" })).toBeVisible();

    // 2. Verifikasi panel keranjang desktop (aside) terlihat di sisi kanan
    const desktopPanel = page.locator("aside");
    await expect(desktopPanel).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Pesanan Kamu" })).toBeVisible();
    await expect(page.getByText("Keranjang masih kosong")).toBeVisible();

    // 3. Verifikasi floating CartBar bawah tersembunyi di desktop
    const cartBar = page.getByRole("link", { name: /Lihat keranjang/ });
    await expect(cartBar).not.toBeVisible();

    // 4. Tambah item menu ke keranjang
    const aquaCard = page.getByTestId("menu-card").filter({ hasText: "Aqua" });
    await aquaCard.getByRole("button", { name: "Tambah Aqua" }).click();

    // 5. Verifikasi item langsung tertera di dalam panel keranjang desktop beserta subtotalnya
    await expect(page.getByTestId("desktop-cart-list")).toBeVisible();
    const cartLine = page.getByTestId("desktop-cart-line");
    await expect(cartLine).toContainText("Aqua");
    await expect(cartLine).toContainText("Rp5.000");
    await expect(page.getByTestId("desktop-cart-total")).toContainText("Rp5.000");
    await expect(page.getByTestId("desktop-cart-count-badge")).toHaveText("1 item");

    // 6. Verifikasi floating CartBar tetap tersembunyi di desktop setelah item bertambah
    await expect(cartBar).not.toBeVisible();
  });

  test("Skenario 2: Mobile Viewport tanpa horizontal overflow dan CartBar muncul saat ada item", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");

    // 1. Verifikasi header menu pelanggan
    await expect(page.getByRole("heading", { level: 1, name: "SIPIL" })).toBeVisible();

    // 2. Verifikasi panel desktop tersembunyi di mobile
    await expect(page.locator("aside")).toBeHidden();

    // 3. Verifikasi tidak ada horizontal overflow
    const hasNoOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    );
    expect(hasNoOverflow).toBe(true);

    // 4. Verifikasi floating CartBar belum muncul saat keranjang kosong
    const cartBar = page.getByRole("link", { name: /Lihat keranjang/ });
    await expect(cartBar).not.toBeVisible();

    // 5. Tambah item menu
    const aquaCard = page.getByTestId("menu-card").filter({ hasText: "Aqua" });
    await aquaCard.getByRole("button", { name: "Tambah Aqua" }).click();

    // 6. Verifikasi floating CartBar bawah muncul beserta jumlah item dan total harga
    await expect(cartBar).toBeVisible();
    await expect(cartBar).toContainText("1 item · Rp5.000");
  });

  test("Skenario 3: Halaman 404 Not Found Bermerek menampilkan pesan ramah dan navigasi ke menu", async ({ page }) => {
    await page.goto("/rute-tidak-ditemukan-xyz");

    // 1. Verifikasi judul Halaman Tidak Ditemukan tampil di layar
    await expect(page.getByRole("heading", { level: 1, name: "Halaman Tidak Ditemukan" })).toBeVisible();

    // 2. Verifikasi pesan ramah dan tombol Lihat Menu
    await expect(page.getByText(/Sepertinya halaman yang kamu tuju tidak ada/i)).toBeVisible();
    const lihatMenuBtn = page.getByRole("link", { name: "Lihat Menu" });
    await expect(lihatMenuBtn).toBeVisible();

    // 3. Klik tombol Lihat Menu dan verifikasi navigasi kembali ke beranda
    await lihatMenuBtn.click();
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { level: 1, name: "SIPIL" })).toBeVisible();
  });
});
