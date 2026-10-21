import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { getWitaTodayDateString, getWitaDateRange } from "@/lib/admin-orders";
import { formatRupiah } from "@/lib/format";

// Pengujian End-to-End (E2E) Riwayat Pesanan Admin (M5: Issue #20)
// Menguji alur lengkap pemilik:
// 1. Akses /admin/riwayat, verifikasi kartu ringkasan Total Pesanan dan Omzet Lunas awal.
// 2. Filter preset tanggal (Kemarin, 7 Hari) dan status (Batal) beserta alasan pembatalan.
// 3. Pencarian teks cepat berdasarkan nama pelanggan dan nomor antrean (#...).
// 4. Buka detail pesanan (OrderDetailSheet) dan aksi koreksi "Tandai Lunas" yang reaktif.
//
// Hanya dijalankan pada lingkungan Supabase lokal (CI), bukan hosted.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const isLocal = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url);
test.skip(!isLocal || !serviceKey, "Butuh Supabase lokal (supabase start) + SUPABASE_SERVICE_ROLE_KEY");

const db = isLocal && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false } }) : null;

const testRunId = Date.now().toString(36);
const ADMIN_EMAIL = `admin-history-${testRunId}@test.local`;
const PASSWORD = "Password123!";

const todayStr = getWitaTodayDateString();
const yesterdayStr = getWitaDateRange("yesterday").from;

let adminUserId: string | null = null;
let order1Id: string | null = null;
let order2Id: string | null = null;
let order3Id: string | null = null;

let initialExpectedOrdersCount = 2;
let initialExpectedRevenue = 50000;
let finalExpectedRevenue = 85000;

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

  // 2. Bersihkan sisa order E2E sebelumnya jika ada
  await db.from("orders").delete().ilike("customer_name", "E2E Pelanggan%");

  // Hitung baseline data hari ini agar assertion ringkasan resilient terhadap data yang sudah ada
  const { data: existingToday } = await db
    .from("orders")
    .select("total, payment_status, status")
    .eq("order_date", todayStr);

  const existingRevenue = (existingToday ?? [])
    .filter((r) => r.payment_status === "lunas" && r.status !== "batal")
    .reduce((sum, r) => sum + (r.total || 0), 0);

  const existingOrdersCount = (existingToday ?? []).length;
  initialExpectedOrdersCount = existingOrdersCount + 2;
  initialExpectedRevenue = existingRevenue + 50000;
  finalExpectedRevenue = initialExpectedRevenue + 35000;

  // 3. Pesanan 1 (Hari ini, selesai, cash, belum_bayar, total 35.000, pemesan "E2E Pelanggan Satu")
  const { data: o1, error: e1 } = await db
    .from("orders")
    .insert({
      public_token: `tokentest${Date.now()}h1`,
      order_date: todayStr,
      daily_number: 901,
      customer_name: "E2E Pelanggan Satu",
      customer_phone: "081234567890",
      order_type: "dine_in",
      payment_method: "cash",
      payment_status: "belum_bayar",
      status: "selesai",
      total: 35000,
      device_id: "device-e2e-h1",
      ip_hash: "hash-e2e-h1",
      idempotency_key: `idem-${Date.now()}-h1`,
    })
    .select("id")
    .single();
  expect(e1).toBeNull();
  order1Id = o1!.id;

  const { error: itemErr1 } = await db.from("order_items").insert({
    order_id: order1Id,
    name: "Cotto Ayam (Mie)",
    unit_price: 35000,
    quantity: 1,
    subtotal: 35000,
    note: "banyak kuah",
    options: [{ group: "Pilihan", name: "Mie", price_delta: 0 }],
  });
  expect(itemErr1).toBeNull();

  // 4. Pesanan 2 (Hari ini, selesai, qris, lunas, total 50.000, pemesan "E2E Pelanggan Dua")
  const { data: o2, error: e2 } = await db
    .from("orders")
    .insert({
      public_token: `tokentest${Date.now()}h2`,
      order_date: todayStr,
      daily_number: 902,
      customer_name: "E2E Pelanggan Dua",
      customer_phone: null,
      order_type: "takeaway",
      payment_method: "qris",
      payment_status: "lunas",
      status: "selesai",
      total: 50000,
      paid_at: new Date().toISOString(),
      device_id: "device-e2e-h2",
      ip_hash: "hash-e2e-h2",
      idempotency_key: `idem-${Date.now()}-h2`,
    })
    .select("id")
    .single();
  expect(e2).toBeNull();
  order2Id = o2!.id;

  const { error: itemErr2 } = await db.from("order_items").insert({
    order_id: order2Id,
    name: "Nasi Campur Spesial",
    unit_price: 50000,
    quantity: 1,
    subtotal: 50000,
  });
  expect(itemErr2).toBeNull();

  // 5. Pesanan 3 (Kemarin, batal, cash, belum_bayar, total 25.000, cancel_reason "Stok habis", pemesan "E2E Pelanggan Tiga")
  const { data: o3, error: e3 } = await db
    .from("orders")
    .insert({
      public_token: `tokentest${Date.now()}h3`,
      order_date: yesterdayStr,
      daily_number: 903,
      customer_name: "E2E Pelanggan Tiga",
      customer_phone: "089876543210",
      order_type: "dine_in",
      payment_method: "cash",
      payment_status: "belum_bayar",
      status: "batal",
      cancel_reason: "Stok habis",
      total: 25000,
      device_id: "device-e2e-h3",
      ip_hash: "hash-e2e-h3",
      idempotency_key: `idem-${Date.now()}-h3`,
    })
    .select("id")
    .single();
  expect(e3).toBeNull();
  order3Id = o3!.id;

  const { error: itemErr3 } = await db.from("order_items").insert({
    order_id: order3Id,
    name: "Es Teh Manis",
    unit_price: 25000,
    quantity: 1,
    subtotal: 25000,
  });
  expect(itemErr3).toBeNull();
});

test.afterAll(async () => {
  if (!db) return;

  const orderIds = [order1Id, order2Id, order3Id].filter(Boolean) as string[];
  if (orderIds.length > 0) {
    const { error: delItemsErr } = await db.from("order_items").delete().in("order_id", orderIds);
    expect(delItemsErr).toBeNull();

    const { error: delOrdersErr } = await db.from("orders").delete().in("id", orderIds);
    expect(delOrdersErr).toBeNull();
  }

  if (adminUserId) {
    const { error: delAdminErr } = await db.from("admins").delete().eq("user_id", adminUserId);
    expect(delAdminErr).toBeNull();

    const { error: delAuthErr } = await db.auth.admin.deleteUser(adminUserId);
    expect(delAuthErr).toBeNull();
  }
});

async function loginAsAdmin(page: import("@playwright/test").Page) {
  await page.goto("/admin/login");
  await page.getByLabel(/Email Pemilik/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/Kata Sandi/i).fill(PASSWORD);
  await page.getByRole("button", { name: "Masuk ke Dashboard" }).click();
  await expect(page).toHaveURL(/\/admin/);
}

test.describe.serial("Pengujian End-to-End Riwayat Pesanan Admin", () => {
  test("Skenario 1: Akses /admin/riwayat dan verifikasi ringkasan total pesanan serta omzet lunas", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/riwayat");
    await expect(page).toHaveURL(/\/admin\/riwayat/);

    await expect(page.getByRole("heading", { level: 1, name: "Riwayat Pesanan" })).toBeVisible();

    // Verifikasi kartu ringkasan
    const ordersSummaryCard = page.locator("div.rounded-xl").filter({ hasText: "Total Pesanan" });
    const revenueSummaryCard = page.locator("div.rounded-xl").filter({ hasText: "Omzet Lunas" });

    await expect(ordersSummaryCard).toBeVisible();
    await expect(revenueSummaryCard).toBeVisible();

    // Verifikasi angka ringkasan
    await expect(ordersSummaryCard.getByText(initialExpectedOrdersCount.toLocaleString("id-ID"))).toBeVisible();
    await expect(revenueSummaryCard.getByText(formatRupiah(initialExpectedRevenue))).toBeVisible();

    // Verifikasi kartu pesanan hari ini tampil
    await expect(page.getByText("E2E Pelanggan Satu")).toBeVisible();
    await expect(page.getByText("E2E Pelanggan Dua")).toBeVisible();

    // Pesanan kemarin tidak muncul di preset default (Hari Ini)
    await expect(page.getByText("E2E Pelanggan Tiga")).not.toBeVisible();
  });

  test("Skenario 2: Filter preset tanggal & status pesanan", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/riwayat");

    // 1. Ganti preset tanggal ke 'Kemarin'
    const yesterdayBtn = page.getByRole("button", { name: "Kemarin" });
    await expect(yesterdayBtn).toBeVisible();
    await yesterdayBtn.click();
    await expect(page).toHaveURL(/preset=yesterday/);

    // Verifikasi pesanan kemarin tampil dan pesanan hari ini tidak tampil
    await expect(page.getByText("E2E Pelanggan Tiga")).toBeVisible();
    await expect(page.getByText("E2E Pelanggan Satu")).not.toBeVisible();
    await expect(page.getByText("E2E Pelanggan Dua")).not.toBeVisible();

    // 2. Filter status: pilih 'Batal'
    const statusSelect = page.locator("#filter-status-select");
    await expect(statusSelect).toBeVisible();
    await statusSelect.selectOption("batal");
    await expect(page).toHaveURL(/status=batal/);

    // Pesanan batal tampil dengan badge Batal
    const cancelCard = page.locator("button.group").filter({ hasText: "E2E Pelanggan Tiga" });
    await expect(cancelCard).toBeVisible();
    await expect(cancelCard.getByText("Batal")).toBeVisible();

    // Klik kartu untuk membuka detail dan melihat alasan pembatalan
    await cancelCard.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Alasan Pembatalan:")).toBeVisible();
    await expect(dialog.getByText("Stok habis")).toBeVisible();

    // Tutup detail sheet
    await dialog.getByRole("button", { name: "Tutup" }).click();
    await expect(dialog).not.toBeVisible();

    // 3. Cek preset 7 Hari: pesanan hari ini dan kemarin tampil
    const last7DaysBtn = page.getByRole("button", { name: "7 Hari" });
    await expect(last7DaysBtn).toBeVisible();
    await last7DaysBtn.click();
    await expect(page).toHaveURL(/preset=last7days/);

    // Kembalikan status filter ke 'Semua Status'
    await statusSelect.selectOption("all");

    await expect(page.getByText("E2E Pelanggan Satu")).toBeVisible();
    await expect(page.getByText("E2E Pelanggan Dua")).toBeVisible();
    await expect(page.getByText("E2E Pelanggan Tiga")).toBeVisible();
  });

  test("Skenario 3: Pencarian teks berdasarkan nama pemesan dan nomor antrean", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/riwayat");

    const searchInput = page.getByPlaceholder("Cari nama / #antrean...");
    await expect(searchInput).toBeVisible();

    // 1. Cari berdasarkan nama pemesan 'E2E Pelanggan Satu'
    await searchInput.fill("E2E Pelanggan Satu");
    await searchInput.press("Enter");

    await expect(page.getByText("E2E Pelanggan Satu")).toBeVisible();
    await expect(page.getByText("E2E Pelanggan Dua")).not.toBeVisible();

    // 2. Cari berdasarkan nomor antrean '#902'
    await searchInput.fill("#902");
    await searchInput.press("Enter");

    await expect(page.getByText("E2E Pelanggan Dua")).toBeVisible();
    await expect(page.getByText("E2E Pelanggan Satu")).not.toBeVisible();

    // 3. Bersihkan pencarian lewat tombol silang (clear)
    const clearBtn = page.getByRole("button", { name: "Hapus pencarian" });
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();

    // Kedua pesanan hari ini kembali muncul
    await expect(page.getByText("E2E Pelanggan Satu")).toBeVisible();
    await expect(page.getByText("E2E Pelanggan Dua")).toBeVisible();
  });

  test("Skenario 4: Detail pesanan dan aksi koreksi Tandai Lunas", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/riwayat");

    // Pastikan nilai omzet lunas awal
    const revenueCard = page.locator("div.rounded-xl").filter({ hasText: "Omzet Lunas" });
    await expect(revenueCard.getByText(formatRupiah(initialExpectedRevenue))).toBeVisible();

    // 1. Klik pesanan yang belum lunas: 'E2E Pelanggan Satu'
    const orderCard1 = page.locator("button.group").filter({ hasText: "E2E Pelanggan Satu" });
    await expect(orderCard1).toBeVisible();
    await expect(orderCard1.getByText("Belum Bayar")).toBeVisible();
    await orderCard1.click();

    // 2. Verifikasi OrderDetailSheet terbuka (role=dialog)
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("E2E Pelanggan Satu")).toBeVisible();
    await expect(dialog.getByText("Cotto Ayam (Mie)")).toBeVisible();
    await expect(dialog.getByText("+ Mie")).toBeVisible();
    await expect(dialog.getByText(/banyak kuah/i)).toBeVisible();
    await expect(dialog.getByText("Rp35.000").first()).toBeVisible();

    // 3. Jalankan aksi koreksi 'Tandai Lunas'
    const markPaidBtn = dialog.getByRole("button", { name: "Tandai Lunas" });
    await expect(markPaidBtn).toBeVisible();
    await markPaidBtn.click();

    // 4. Verifikasi status bayar di dialog berubah jadi Lunas
    await expect(dialog.getByText("Lunas")).toBeVisible();
    await expect(markPaidBtn).not.toBeVisible();

    // 5. Tutup dialog dan verifikasi pembaruan di daftar kartu & ringkasan omzet
    await dialog.getByRole("button", { name: "Tutup" }).click();
    await expect(dialog).not.toBeVisible();

    // Badge di kartu pesanan sekarang Lunas
    await expect(orderCard1.getByText("Lunas")).toBeVisible();

    // Omzet Lunas terupdate secara reaktif
    await expect(revenueCard.getByText(formatRupiah(finalExpectedRevenue))).toBeVisible();
  });
});
