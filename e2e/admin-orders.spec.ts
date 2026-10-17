import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const isLocal = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url);
test.skip(!isLocal || !serviceKey, "Butuh Supabase lokal (supabase start) + SUPABASE_SERVICE_ROLE_KEY");

const db = isLocal && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false } }) : null;

const ADMIN_EMAIL = `owner-orders-${Date.now()}@test.local`;
const PASSWORD = "Password123!";

let adminUserId: string | null = null;
let testOrderId: string | null = null;
let realtimeOrderId: string | null = null;
let cancelOrderId: string | null = null;

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

  // 2. Buat pesanan awal untuk pengujian live board
  const { data: orderData, error: orderErr } = await db
    .from("orders")
    .insert({
      public_token: `tokentest${Date.now()}01`,
      order_date: new Date().toISOString().slice(0, 10),
      daily_number: 1,
      customer_name: "Budi Santoso",
      order_type: "dine_in",
      payment_method: "qris",
      payment_status: "menunggu_verifikasi",
      status: "baru",
      total: 25000,
      device_id: "device-e2e-order",
      ip_hash: "hash-e2e-order",
      idempotency_key: `idem-${Date.now()}-01`,
    })
    .select("id")
    .single();

  expect(orderErr).toBeNull();
  testOrderId = orderData!.id;

  // Insert item pesanan
  const { error: itemErr } = await db.from("order_items").insert({
    order_id: testOrderId,
    name: "Nasi Campur",
    unit_price: 25000,
    quantity: 1,
    subtotal: 25000,
    note: "sambal dipisah ya",
    options: [{ group: "Pilihan", name: "Pedas Sedang", price_delta: 0 }],
  });
  expect(itemErr).toBeNull();

  // 3. Buat pesanan untuk pengujian pembatalan
  const { data: cancelOrderData, error: cancelErr } = await db
    .from("orders")
    .insert({
      public_token: `tokentest${Date.now()}03`,
      order_date: new Date().toISOString().slice(0, 10),
      daily_number: 3,
      customer_name: "Dewi Lestari",
      order_type: "takeaway",
      payment_method: "cash",
      payment_status: "belum_bayar",
      status: "baru",
      total: 15000,
      device_id: "device-e2e-order-3",
      ip_hash: "hash-e2e-order-3",
      idempotency_key: `idem-${Date.now()}-03`,
    })
    .select("id")
    .single();

  expect(cancelErr).toBeNull();
  cancelOrderId = cancelOrderData!.id;

  const { error: cancelItemErr } = await db.from("order_items").insert({
    order_id: cancelOrderId,
    name: "Mie Kuah",
    unit_price: 15000,
    quantity: 1,
    subtotal: 15000,
  });
  expect(cancelItemErr).toBeNull();
});

test.afterAll(async () => {
  if (!db) return;
  if (testOrderId) {
    await db.from("order_items").delete().eq("order_id", testOrderId);
    await db.from("orders").delete().eq("id", testOrderId);
  }
  if (realtimeOrderId) {
    await db.from("order_items").delete().eq("order_id", realtimeOrderId);
    await db.from("orders").delete().eq("id", realtimeOrderId);
  }
  if (cancelOrderId) {
    await db.from("order_items").delete().eq("order_id", cancelOrderId);
    await db.from("orders").delete().eq("id", cancelOrderId);
  }
  if (adminUserId) {
    await db.from("admins").delete().eq("user_id", adminUserId);
    await db.auth.admin.deleteUser(adminUserId);
  }
});

async function loginAsAdmin(page: import("@playwright/test").Page) {
  await page.goto("/admin/login");
  await page.getByLabel(/Email Pemilik/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/Kata Sandi/i).fill(PASSWORD);
  await page.getByRole("button", { name: "Masuk ke Dashboard" }).click();
  await expect(page).toHaveURL(/\/admin/);
}

test("dashboard pesanan live menampilkan detail pesanan awal dengan benar", async ({ page }) => {
  await loginAsAdmin(page);

  // Verifikasi judul dan nomor antrean
  await expect(page.getByRole("heading", { level: 1, name: "Pesanan Live" })).toBeVisible();
  await expect(page.getByText("#001")).toBeVisible();
  await expect(page.getByText("Budi Santoso")).toBeVisible();
  await expect(page.getByText("Makan di sini")).toBeVisible();

  // Verifikasi rincian menu dan catatan
  await expect(page.getByText("Nasi Campur")).toBeVisible();
  await expect(page.getByText(/sambal dipisah ya/i)).toBeVisible();
  await expect(page.getByText("Rp25.000").first()).toBeVisible();
  await expect(page.getByText("QRIS")).toBeVisible();
  await expect(page.getByText("Perlu Verifikasi")).toBeVisible();
});

test("kontrol suara notifikasi dapat diaktifkan oleh pemilik", async ({ page }) => {
  await loginAsAdmin(page);

  const soundBtn = page.getByRole("button", { name: /Aktifkan Suara/i });
  await expect(soundBtn).toBeVisible();
  await soundBtn.click();

  // Setelah diklik, status berubah menjadi 'Suara Aktif'
  await expect(page.getByRole("button", { name: /Suara Aktif/i })).toBeVisible();
});

test("filter tab status di mobile menyaring kartu sesuai status pesanan", async ({ page }) => {
  await loginAsAdmin(page);

  // Tab 'Semua' menampilkan pesanan
  await expect(page.getByText("#001")).toBeVisible();

  // Klik tab 'Dimasak' -> pesanan baru tidak muncul di sini
  await page.getByRole("button", { name: /Dimasak \(/i }).click();
  await expect(page.getByText("#001")).not.toBeVisible();
  await expect(page.getByText("Belum ada pesanan aktif")).toBeVisible();

  // Klik tab 'Baru' -> pesanan baru kembali muncul
  await page.getByRole("button", { name: /Baru \(/i }).click();
  await expect(page.getByText("#001")).toBeVisible();
});

test("pesanan baru muncul secara live di dashboard tanpa reload halaman", async ({ page }) => {
  await loginAsAdmin(page);

  // Pastikan pesanan awal terlihat
  await expect(page.getByText("#001")).toBeVisible();
  await expect(page.getByText("#002")).not.toBeVisible();

  // Pastikan status realtime sudah terhubung sebelum pesanan baru dibuat di DB
  await expect(page.getByText("Terhubung")).toBeVisible({ timeout: 15000 });

  // Buat pesanan kedua langsung di database
  const { data: newOrder, error: newOrderErr } = await db!
    .from("orders")
    .insert({
      public_token: `tokentest${Date.now()}02`,
      order_date: new Date().toISOString().slice(0, 10),
      daily_number: 2,
      customer_name: "Siti Rahma",
      order_type: "takeaway",
      payment_method: "cash",
      payment_status: "belum_bayar",
      status: "baru",
      total: 18000,
      device_id: "device-e2e-order-2",
      ip_hash: "hash-e2e-order-2",
      idempotency_key: `idem-${Date.now()}-02`,
    })
    .select("id")
    .single();

  expect(newOrderErr).toBeNull();
  realtimeOrderId = newOrder!.id;

  await db!.from("order_items").insert({
    order_id: realtimeOrderId,
    name: "Ayam Lalapan",
    unit_price: 18000,
    quantity: 1,
    subtotal: 18000,
  });

  // Pesanan #002 harus muncul secara otomatis tanpa reload (maks ±10 detik)
  await expect(page.getByText("#002")).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("Siti Rahma")).toBeVisible();
  await expect(page.getByText("Bungkus")).toBeVisible();
  await expect(page.getByText("Rp18.000").first()).toBeVisible();
});

test("pemilik dapat menolak pembayaran belum masuk dan menandai lunas", async ({ page }) => {
  await loginAsAdmin(page);

  const card001 = page.locator("div.rounded-xl").filter({ hasText: "#001" });
  await expect(card001).toBeVisible();

  // Pesanan #001 awal berstatus menunggu_verifikasi, tombol 'Belum Masuk' tersedia
  const rejectBtn = card001.getByRole("button", { name: "Belum Masuk" });
  await expect(rejectBtn).toBeVisible();
  await rejectBtn.click();

  // Status bayar berubah jadi 'Belum Bayar' dan tombol 'Belum Masuk' menghilang
  await expect(card001.getByText("Belum Bayar")).toBeVisible();
  await expect(rejectBtn).not.toBeVisible();

  // Pemilik menandai pesanan lunas
  const payBtn = card001.getByRole("button", { name: "Tandai Lunas" });
  await expect(payBtn).toBeVisible();
  await payBtn.click();

  // Status bayar berubah jadi 'Lunas' dan tombol 'Tandai Lunas' menghilang
  await expect(card001.getByText("Lunas")).toBeVisible();
  await expect(payBtn).not.toBeVisible();
});

test("pemilik dapat memajukan alur masak dari Mulai Masak -> Siap Diambil -> Selesai", async ({ page }) => {
  await loginAsAdmin(page);

  const card001 = page.locator("div.rounded-xl").filter({ hasText: "#001" });
  await expect(card001).toBeVisible();

  // 1. Mulai Masak (baru -> dimasak)
  const cookBtn = card001.getByRole("button", { name: /Mulai Masak/i });
  await expect(cookBtn).toBeVisible();
  await cookBtn.click();

  // Tombol berganti jadi 'Siap Diambil'
  const readyBtn = card001.getByRole("button", { name: /Siap Diambil/i });
  await expect(readyBtn).toBeVisible();

  // 2. Siap Diambil (dimasak -> siap)
  await readyBtn.click();

  // Tombol berganti jadi 'Selesai'
  const finishBtn = card001.getByRole("button", { name: /^Selesai$/i });
  await expect(finishBtn).toBeVisible();

  // 3. Selesai (siap -> selesai)
  // Karena pesanan #001 sudah lunas pada pengujian sebelumnya, pesanan selesai + lunas keluar dari live board
  await finishBtn.click();

  // Pesanan #001 keluar dari live board
  await expect(page.getByText("#001")).not.toBeVisible();
});

test("pemilik dapat membatalkan pesanan dengan konfirmasi dan alasan", async ({ page }) => {
  await loginAsAdmin(page);

  // Pastikan pesanan #003 terlihat di papan
  const card003 = page.locator("div.rounded-xl").filter({ hasText: "#003" });
  await expect(card003).toBeVisible();

  // Klik tombol Batal
  const cancelBtn = card003.getByRole("button", { name: "Batal" });
  await expect(cancelBtn).toBeVisible();
  await cancelBtn.click();

  // Dialog konfirmasi pembatalan terbuka
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/Batalkan Pesanan #003\?/i)).toBeVisible();

  // Pilih preset alasan "Bahan habis"
  await dialog.getByRole("button", { name: "Bahan habis" }).click();

  // Konfirmasi pembatalan
  await dialog.getByRole("button", { name: /Ya, Batalkan Pesanan/i }).click();

  // Dialog tertutup dan pesanan #003 keluar dari live board
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText("#003")).not.toBeVisible();
});


