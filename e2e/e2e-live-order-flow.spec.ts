import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Tes ini menguji alur end-to-end lengkap multi-context (Issue #15):
// HP A (Pelanggan) memesan -> HP B (Pemilik) menerima di dashboard live -> Tandai Lunas -> Mulai Masak -> Siap -> HP A otomatis menampilkan status Siap.
// Hanya boleh dijalankan ke Supabase lokal (CI), bukan hosted.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const isLocal = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url);
test.skip(!isLocal || !serviceKey, "Butuh Supabase lokal (supabase start) + SUPABASE_SERVICE_ROLE_KEY");

const db = isLocal && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false } }) : null;

const ADMIN_EMAIL = `owner-m3flow-${Date.now()}@test.local`;
const PASSWORD = "Password123!";

let adminUserId: string | null = null;
let initialIsOpen: boolean | null = null;
let createdOrderId: string | null = null;
let createdOrderToken: string | null = null;

test.beforeAll(async () => {
  if (!db) return;

  // 1. Simpan status awal toko dan pastikan toko buka di pengaturan
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

  // 1. Bersihkan HANYA data pesanan yang dibuat oleh skenario pengujian ini
  if (createdOrderId) {
    await db.from("order_items").delete().eq("order_id", createdOrderId);
    await db.from("orders").delete().eq("id", createdOrderId);
  } else if (createdOrderToken) {
    const { data: orderData } = await db
      .from("orders")
      .select("id")
      .eq("public_token", createdOrderToken)
      .maybeSingle();
    if (orderData?.id) {
      await db.from("order_items").delete().eq("order_id", orderData.id);
      await db.from("orders").delete().eq("id", orderData.id);
    }
  }

  // 2. Bersihkan akun admin
  if (adminUserId) {
    await db.from("admins").delete().eq("user_id", adminUserId);
    await db.auth.admin.deleteUser(adminUserId);
  }

  // 3. Pulihkan status toko ke kondisi awal sebelum pengujian
  if (initialIsOpen !== null) {
    await db.from("settings").update({ is_open: initialIsOpen }).eq("id", 1);
  }
});

test("alur lengkap M3: Pelanggan pesan di HP A -> Pemilik proses di HP B (Lunas, Masak, Siap) -> HP A otomatis menampilkan Siap", async ({
  browser,
}) => {
  // Context 1: HP B (Pemilik Warung / Dashboard)
  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();

  // Context 2: HP A (Pelanggan)
  const customerContext = await browser.newContext();
  const customerPage = await customerContext.newPage();

  try {
    // Pasang pengawas pemutaran Web Audio pada browser pemilik
    await ownerPage.addInitScript(() => {
      (window as unknown as { __audioPlayedCount: number }).__audioPlayedCount = 0;
      const originalCreateOsc = window.AudioContext?.prototype.createOscillator;
      if (originalCreateOsc) {
        window.AudioContext.prototype.createOscillator = function (...args) {
          const win = window as unknown as { __audioPlayedCount: number };
          win.__audioPlayedCount = (win.__audioPlayedCount || 0) + 1;
          return originalCreateOsc.apply(this, args);
        };
      }
    });

    // 1. Pemilik login dan bersiap di Dashboard Pesanan Live (/admin)
    await ownerPage.goto("/admin/login");
    await ownerPage.getByLabel(/Email Pemilik/i).fill(ADMIN_EMAIL);
    await ownerPage.getByLabel(/Kata Sandi/i).fill(PASSWORD);
    await ownerPage.getByRole("button", { name: "Masuk ke Dashboard" }).click();
    await expect(ownerPage).toHaveURL(/\/admin/);

    await expect(
      ownerPage.getByRole("heading", { level: 1, name: "Pesanan Live" })
    ).toBeVisible();

    // Aktifkan suara di dashboard pemilik jika tombol tersedia
    const soundBtn = ownerPage.getByRole("button", { name: /Aktifkan Suara/i });
    if (await soundBtn.isVisible()) {
      await soundBtn.click();
    }

    // 2. Pelanggan membuka website di HP A, memilih menu, dan checkout dengan QRIS
    await customerPage.goto("/");
    await expect(customerPage.getByText(/Maaf, toko sedang tutup/i)).not.toBeVisible();

    const menuCard = customerPage.getByTestId("menu-card").filter({ hasText: "Nasi Telur" });
    await expect(menuCard).toBeVisible();
    await menuCard.getByRole("button", { name: "Tambah Nasi Telur" }).click();

    await customerPage.goto("/checkout");
    await customerPage.getByLabel(/NAMA PEMESAN/).fill("Rian Pelanggan M3");
    await customerPage.getByRole("radio", { name: /QRIS/ }).click();

    const orderBtn = customerPage.getByRole("button", { name: /Pesan Sekarang/ });
    await orderBtn.click();

    // Pelanggan tiba di halaman lacak pesanan
    await expect(customerPage).toHaveURL(/\/pesanan\/[a-zA-Z0-9_-]+/);
    const token = customerPage.url().split("/pesanan/")[1];
    expect(token).toBeTruthy();
    createdOrderToken = token;

    if (db) {
      const { data: orderRow } = await db
        .from("orders")
        .select("id")
        .eq("public_token", token)
        .maybeSingle();
      if (orderRow?.id) {
        createdOrderId = orderRow.id;
      }
    }

    // Verifikasi status awal pelanggan di HP A
    const statusRegion = customerPage.getByRole("status");
    await expect(statusRegion).toBeVisible();
    await expect(statusRegion.getByText("Menunggu Dimasak")).toBeVisible();
    await expect(customerPage.getByText("Belum Bayar")).toBeVisible();

    // Pelanggan mengonfirmasi sudah bayar QRIS
    const claimPaidBtn = customerPage.getByRole("button", { name: "Saya sudah bayar" });
    await expect(claimPaidBtn).toBeVisible();
    await claimPaidBtn.click();

    // Status bayar pelanggan menjadi Menunggu Verifikasi
    await expect(customerPage.getByText("Menunggu Verifikasi", { exact: true })).toBeVisible();

    // 3. Verifikasi pesanan baru masuk ke Live Board Pemilik (HP B) dan audio notifikasi berbunyi
    await expect(ownerPage.getByText("Rian Pelanggan M3")).toBeVisible({ timeout: 15000 });
    const orderCard = ownerPage.getByTestId("admin-order-card").filter({ hasText: "Rian Pelanggan M3" });
    await expect(orderCard).toBeVisible();
    await expect(orderCard.getByText("Perlu Verifikasi")).toBeVisible();

    // Pastikan pemutaran notifikasi suara terbukti terpanggil di browser pemilik
    await expect
      .poll(async () => {
        return await ownerPage.evaluate(
          () => (window as unknown as { __audioPlayedCount?: number }).__audioPlayedCount ?? 0
        );
      }, { timeout: 10000 })
      .toBeGreaterThan(0);

    // 4. Pemilik menandai pesanan Lunas
    const lunasBtn = orderCard.getByRole("button", { name: "Tandai Lunas" });
    await expect(lunasBtn).toBeVisible();
    await lunasBtn.click();

    // Badge pembayaran di dashboard pemilik berganti menjadi Lunas
    await expect(orderCard.getByText("Lunas")).toBeVisible();

    // 5. Pemilik menekan tombol "Mulai Masak"
    const cookBtn = orderCard.getByRole("button", { name: "Mulai Masak" });
    await expect(cookBtn).toBeVisible();
    await cookBtn.click();

    // 6. Verifikasi di HP A (Pelanggan) otomatis mendeteksi status "Sedang Dimasak" via polling (<= 5 detik)
    await expect(statusRegion.getByText("Sedang Dimasak")).toBeVisible({ timeout: 12000 });

    // 7. Pemilik menekan tombol "Siap Diambil"
    const readyBtn = orderCard.getByRole("button", { name: "Siap Diambil" });
    await expect(readyBtn).toBeVisible();
    await readyBtn.click();

    // 8. Verifikasi di HP A (Pelanggan) otomatis menampilkan banner "Pesanan kamu siap!"
    const readyBanner = customerPage.getByTestId("order-ready-banner");
    await expect(readyBanner).toBeVisible({ timeout: 12000 });
    await expect(
      readyBanner.getByText("Pesanan kamu siap! Silakan ambil di kasir.")
    ).toBeVisible();

    // 9. Pemilik menekan tombol "Selesai" setelah pesanan diserahkan
    const finishBtn = orderCard.getByRole("button", { name: "Selesai" });
    await expect(finishBtn).toBeVisible();
    await finishBtn.click();

    // Pesanan keluar dari live board pemilik
    await expect(ownerPage.getByText("Rian Pelanggan M3")).not.toBeVisible();

    // 10. Verifikasi di HP A (Pelanggan) status akhir menjadi "Selesai"
    await expect(statusRegion.getByText("Selesai")).toBeVisible({ timeout: 12000 });
  } finally {
    await customerContext.close();
    await ownerContext.close();
  }
});
