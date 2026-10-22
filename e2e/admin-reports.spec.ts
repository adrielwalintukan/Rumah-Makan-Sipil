import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { getWitaTodayDateString, getWitaMonthRange } from "@/lib/admin-reports";
import { formatRupiah } from "@/lib/format";

// Pengujian End-to-End (E2E) Laporan Penjualan Admin (M5: Issue #21)
// Menguji alur lengkap pemilik:
// 1. Akses /admin/laporan dan verifikasi kartu metrik Total Omzet, Total Pesanan, Rata-rata Pesanan.
// 2. Verifikasi seksi Metode Pembayaran: perbandingan Cash vs QRIS (nominal & persentase).
// 3. Verifikasi seksi 5 Menu Terlaris (kuantitas porsi dan omzet per menu).
// 4. Verifikasi bahwa pesanan batal dan belum lunas TIDAK terhitung ke laporan omzet/menu.
// 5. Interaksi pergantian preset tanggal ke 'Bulan Ini'.
// 6. Pengujian filter kustom rentang tanggal (form custom from & to).
//
// Hanya dijalankan pada lingkungan Supabase lokal (CI), bukan hosted.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const isLocal = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url);
test.skip(!isLocal || !serviceKey, "Butuh Supabase lokal (supabase start) + SUPABASE_SERVICE_ROLE_KEY");

const db = isLocal && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false } }) : null;

const testRunId = Date.now().toString(36);
const ADMIN_EMAIL = `admin-reports-${testRunId}@test.local`;
const PASSWORD = "Password123!";

const todayStr = getWitaTodayDateString();
const monthRange = getWitaMonthRange();
const order5Date = todayStr !== monthRange.from ? monthRange.from : todayStr;

let adminUserId: string | null = null;
const createdOrderIds: string[] = [];

// Baseline data metrics
let expectedTodayOrders = 2;
let expectedTodayRevenue = 70000;
let expectedTodayCash = 30000;
let expectedTodayQris = 40000;
let expectedTodayAvg = 35000;
let expectedTodayCashPct = 43;
let expectedTodayQrisPct = 57;

let expectedMonthOrders = 3;
let expectedMonthRevenue = 100000;
let expectedMonthAvg = 33333;

let expectedCustomOrders = 1;
let expectedCustomRevenue = 30000;

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

  // 2. Bersihkan sisa order E2E laporan sebelumnya jika ada
  await db.from("orders").delete().ilike("customer_name", "E2E Laporan%");

  // 3. Hitung baseline data hari ini agar assertion ringkasan resilient terhadap data yang sudah ada
  const { data: existingToday } = await db
    .from("orders")
    .select("total, payment_method, payment_status, status")
    .eq("order_date", todayStr);

  const validToday = (existingToday ?? []).filter(
    (r) => r.payment_status === "lunas" && r.status !== "batal"
  );
  const baselineTodayOrders = validToday.length;
  const baselineTodayRevenue = validToday.reduce((sum, r) => sum + (r.total || 0), 0);
  const baselineTodayCash = validToday
    .filter((r) => r.payment_method === "cash")
    .reduce((sum, r) => sum + (r.total || 0), 0);
  const baselineTodayQris = validToday
    .filter((r) => r.payment_method === "qris")
    .reduce((sum, r) => sum + (r.total || 0), 0);

  expectedTodayOrders = baselineTodayOrders + 2;
  expectedTodayRevenue = baselineTodayRevenue + 70000;
  expectedTodayCash = baselineTodayCash + 30000;
  expectedTodayQris = baselineTodayQris + 40000;
  expectedTodayAvg = expectedTodayOrders > 0 ? Math.round(expectedTodayRevenue / expectedTodayOrders) : 0;
  expectedTodayCashPct = expectedTodayRevenue > 0 ? Math.round((expectedTodayCash / expectedTodayRevenue) * 100) : 0;
  expectedTodayQrisPct = expectedTodayRevenue > 0 ? 100 - expectedTodayCashPct : 0;

  // Hitung baseline data bulan ini
  const { data: existingMonth } = await db
    .from("orders")
    .select("total, payment_method, payment_status, status")
    .gte("order_date", monthRange.from)
    .lte("order_date", monthRange.to);

  const validMonth = (existingMonth ?? []).filter(
    (r) => r.payment_status === "lunas" && r.status !== "batal"
  );
  const baselineMonthOrders = validMonth.length;
  const baselineMonthRevenue = validMonth.reduce((sum, r) => sum + (r.total || 0), 0);

  // Jika order5Date !== todayStr, ada 3 pesanan baru di bulan ini (order 1, 2, 5).
  // Jika order5Date === todayStr (misal awal bulan), order 5 dihitung pada hari ini juga.
  const additionalMonthOrders = order5Date !== todayStr ? 3 : 3;
  const additionalMonthRevenue = 100000;

  expectedMonthOrders = baselineMonthOrders + additionalMonthOrders;
  expectedMonthRevenue = baselineMonthRevenue + additionalMonthRevenue;
  expectedMonthAvg = expectedMonthOrders > 0 ? Math.round(expectedMonthRevenue / expectedMonthOrders) : 0;

  // Hitung baseline custom tanggal order5Date
  const { data: existingCustom } = await db
    .from("orders")
    .select("total, payment_method, payment_status, status")
    .eq("order_date", order5Date);

  const validCustom = (existingCustom ?? []).filter(
    (r) => r.payment_status === "lunas" && r.status !== "batal"
  );
  const baselineCustomOrders = validCustom.length;
  const baselineCustomRevenue = validCustom.reduce((sum, r) => sum + (r.total || 0), 0);

  expectedCustomOrders = baselineCustomOrders + (order5Date === todayStr ? 3 : 1);
  expectedCustomRevenue = baselineCustomRevenue + (order5Date === todayStr ? 100000 : 30000);

  // 4. Buat 5 pesanan uji sintetis
  // Pesanan 1 (Hari ini, selesai, cash, lunas, total 30.000)
  const { data: o1, error: e1 } = await db
    .from("orders")
    .insert({
      public_token: `tokentest${Date.now()}rep1`,
      order_date: todayStr,
      daily_number: 951,
      customer_name: "E2E Laporan Satu",
      order_type: "dine_in",
      payment_method: "cash",
      payment_status: "lunas",
      status: "selesai",
      total: 30000,
      paid_at: new Date().toISOString(),
      device_id: "device-e2e-rep1",
      ip_hash: "hash-e2e-rep1",
      idempotency_key: `idem-${Date.now()}-rep1`,
    })
    .select("id")
    .single();
  expect(e1).toBeNull();
  createdOrderIds.push(o1!.id);

  const { error: itemErr1 } = await db.from("order_items").insert({
    order_id: o1!.id,
    name: "Ayam Bakar",
    unit_price: 15000,
    quantity: 2,
    subtotal: 30000,
  });
  expect(itemErr1).toBeNull();

  // Pesanan 2 (Hari ini, selesai, qris, lunas, total 40.000)
  const { data: o2, error: e2 } = await db
    .from("orders")
    .insert({
      public_token: `tokentest${Date.now()}rep2`,
      order_date: todayStr,
      daily_number: 952,
      customer_name: "E2E Laporan Dua",
      order_type: "takeaway",
      payment_method: "qris",
      payment_status: "lunas",
      status: "selesai",
      total: 40000,
      paid_at: new Date().toISOString(),
      device_id: "device-e2e-rep2",
      ip_hash: "hash-e2e-rep2",
      idempotency_key: `idem-${Date.now()}-rep2`,
    })
    .select("id")
    .single();
  expect(e2).toBeNull();
  createdOrderIds.push(o2!.id);

  const { error: itemErr2 } = await db.from("order_items").insert([
    {
      order_id: o2!.id,
      name: "Es Teh Manis",
      unit_price: 5000,
      quantity: 4,
      subtotal: 20000,
    },
    {
      order_id: o2!.id,
      name: "Ayam Goreng",
      unit_price: 20000,
      quantity: 1,
      subtotal: 20000,
    },
  ]);
  expect(itemErr2).toBeNull();

  // Pesanan 3 (Hari ini, batal, cash, lunas, total 50.000 - tidak boleh terhitung omzet!)
  const { data: o3, error: e3 } = await db
    .from("orders")
    .insert({
      public_token: `tokentest${Date.now()}rep3`,
      order_date: todayStr,
      daily_number: 953,
      customer_name: "E2E Laporan Tiga Batal",
      order_type: "dine_in",
      payment_method: "cash",
      payment_status: "lunas",
      status: "batal",
      cancel_reason: "Uji coba batal",
      total: 50000,
      paid_at: new Date().toISOString(),
      device_id: "device-e2e-rep3",
      ip_hash: "hash-e2e-rep3",
      idempotency_key: `idem-${Date.now()}-rep3`,
    })
    .select("id")
    .single();
  expect(e3).toBeNull();
  createdOrderIds.push(o3!.id);

  const { error: itemErr3 } = await db.from("order_items").insert({
    order_id: o3!.id,
    name: "Bebek Goreng",
    unit_price: 50000,
    quantity: 1,
    subtotal: 50000,
  });
  expect(itemErr3).toBeNull();

  // Pesanan 4 (Hari ini, belum bayar, cash, total 25.000 - tidak boleh terhitung omzet!)
  const { data: o4, error: e4 } = await db
    .from("orders")
    .insert({
      public_token: `tokentest${Date.now()}rep4`,
      order_date: todayStr,
      daily_number: 954,
      customer_name: "E2E Laporan Empat Belum Lunas",
      order_type: "dine_in",
      payment_method: "cash",
      payment_status: "belum_bayar",
      status: "baru",
      total: 25000,
      device_id: "device-e2e-rep4",
      ip_hash: "hash-e2e-rep4",
      idempotency_key: `idem-${Date.now()}-rep4`,
    })
    .select("id")
    .single();
  expect(e4).toBeNull();
  createdOrderIds.push(o4!.id);

  const { error: itemErr4 } = await db.from("order_items").insert({
    order_id: o4!.id,
    name: "Ayam Geprek",
    unit_price: 25000,
    quantity: 1,
    subtotal: 25000,
  });
  expect(itemErr4).toBeNull();

  // Pesanan 5 (Tanggal order5Date, selesai, cash, lunas, total 30.000)
  const { data: o5, error: e5 } = await db
    .from("orders")
    .insert({
      public_token: `tokentest${Date.now()}rep5`,
      order_date: order5Date,
      daily_number: 955,
      customer_name: "E2E Laporan Lima Awal Bulan",
      order_type: "dine_in",
      payment_method: "cash",
      payment_status: "lunas",
      status: "selesai",
      total: 30000,
      paid_at: new Date().toISOString(),
      device_id: "device-e2e-rep5",
      ip_hash: "hash-e2e-rep5",
      idempotency_key: `idem-${Date.now()}-rep5`,
    })
    .select("id")
    .single();
  expect(e5).toBeNull();
  createdOrderIds.push(o5!.id);

  const { error: itemErr5 } = await db.from("order_items").insert({
    order_id: o5!.id,
    name: "Ayam Bakar",
    unit_price: 15000,
    quantity: 2,
    subtotal: 30000,
  });
  expect(itemErr5).toBeNull();
});

test.afterAll(async () => {
  if (!db) return;

  const orderIds = createdOrderIds.filter(Boolean);
  if (orderIds.length > 0) {
    await db.from("order_items").delete().in("order_id", orderIds);
    await db.from("orders").delete().in("id", orderIds);
  }

  // Bersihkan sisa order uji E2E laporan jika ada
  await db.from("orders").delete().ilike("customer_name", "E2E Laporan%");

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
  await expect(page).toHaveURL(/\/admin(?!\/login)/);
  await expect(page.getByRole("heading", { level: 1, name: "Pesanan Live" })).toBeVisible();
}

test.describe.serial("Pengujian End-to-End Laporan Penjualan Admin", () => {
  test("Skenario 1: Akses /admin/laporan dan verifikasi kartu metrik ringkasan penjualan hari ini", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/laporan");
    await expect(page).toHaveURL(/\/admin\/laporan/);

    // Verifikasi header halaman
    await expect(page.getByRole("heading", { level: 1, name: "Laporan Penjualan" })).toBeVisible();

    // Verifikasi kartu metrik utama
    const revenueCard = page.locator("div.rounded-xl").filter({ hasText: "Total Omzet" });
    const ordersCard = page.locator("div.rounded-xl").filter({ hasText: "Total Pesanan" });
    const avgCard = page.locator("div.rounded-xl").filter({ hasText: "Rata-rata Pesanan" });

    await expect(revenueCard).toBeVisible();
    await expect(ordersCard).toBeVisible();
    await expect(avgCard).toBeVisible();

    // Verifikasi nilai nominal dan format Rupiah
    await expect(revenueCard.getByText(formatRupiah(expectedTodayRevenue), { exact: true })).toBeVisible();
    await expect(ordersCard.getByText(expectedTodayOrders.toLocaleString("id-ID"), { exact: true })).toBeVisible();
    await expect(avgCard.getByText(formatRupiah(expectedTodayAvg), { exact: true })).toBeVisible();
  });

  test("Skenario 2: Verifikasi seksi perbandingan metode pembayaran (Cash vs QRIS)", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/laporan");

    await expect(page.getByRole("heading", { level: 3, name: "Metode Pembayaran" })).toBeVisible();

    // Kartu Tunai (Cash)
    const cashCard = page.locator("div.rounded-lg").filter({ hasText: "Tunai (Cash)" });
    await expect(cashCard).toBeVisible();
    await expect(cashCard.getByText(formatRupiah(expectedTodayCash), { exact: true })).toBeVisible();
    await expect(cashCard.getByText(`${expectedTodayCashPct}%`, { exact: true })).toBeVisible();

    // Kartu QRIS
    const qrisCard = page.locator("div.rounded-lg").filter({ hasText: "QRIS (DANA Bisnis)" });
    await expect(qrisCard).toBeVisible();
    await expect(qrisCard.getByText(formatRupiah(expectedTodayQris), { exact: true })).toBeVisible();
    await expect(qrisCard.getByText(`${expectedTodayQrisPct}%`, { exact: true })).toBeVisible();

    // Progressbar komparasi
    const progressbar = page.getByRole("progressbar");
    await expect(progressbar).toBeVisible();
  });

  test("Skenario 3: Verifikasi seksi 5 Menu Terlaris dan pengecualian pesanan batal/belum lunas", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/laporan");

    await expect(page.getByRole("heading", { level: 3, name: "5 Menu Terlaris" })).toBeVisible();

    // Menu pesanan lunas berhasil muncul di daftar
    await expect(page.getByText("Es Teh Manis")).toBeVisible();
    await expect(page.getByText("Ayam Bakar")).toBeVisible();
    await expect(page.getByText("Ayam Goreng")).toBeVisible();

    // Kuantitas porsi item pesanan lunas tampil
    await expect(page.getByText(/4 porsi/)).toBeVisible();

    // Bebek Goreng (pesanan batal) dan Ayam Geprek (belum bayar) TIDAK boleh tampil di menu terlaris
    await expect(page.getByText("Bebek Goreng")).not.toBeVisible();
    await expect(page.getByText("Ayam Geprek")).not.toBeVisible();
  });

  test("Skenario 4: Interaksi tombol preset 'Bulan Ini' dan pembaruan data laporan", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/laporan");

    // Klik tombol preset 'Bulan Ini'
    const thisMonthBtn = page.getByRole("button", { name: "Bulan Ini" });
    await expect(thisMonthBtn).toBeVisible();
    await thisMonthBtn.click();

    // Verifikasi URL berubah ke preset this_month
    await expect(page).toHaveURL(/preset=this_month/);

    // Verifikasi ringkasan bulan ini terbarui
    const revenueCard = page.locator("div.rounded-xl").filter({ hasText: "Total Omzet" });
    const ordersCard = page.locator("div.rounded-xl").filter({ hasText: "Total Pesanan" });
    const avgCard = page.locator("div.rounded-xl").filter({ hasText: "Rata-rata Pesanan" });

    await expect(revenueCard.getByText(formatRupiah(expectedMonthRevenue), { exact: true })).toBeVisible();
    await expect(ordersCard.getByText(expectedMonthOrders.toLocaleString("id-ID"), { exact: true })).toBeVisible();
    await expect(avgCard.getByText(formatRupiah(expectedMonthAvg), { exact: true })).toBeVisible();
  });

  test("Skenario 5: Interaksi filter Kustom rentang tanggal", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/laporan");

    // Klik tombol tab 'Kustom'
    const customBtn = page.getByRole("button", { name: "Kustom" });
    await expect(customBtn).toBeVisible();
    await customBtn.click();

    // Isi tanggal form kustom
    const fromInput = page.locator("#report-custom-from");
    const toInput = page.locator("#report-custom-to");
    await expect(fromInput).toBeVisible();
    await expect(toInput).toBeVisible();

    await fromInput.fill(order5Date);
    await toInput.fill(order5Date);

    // Klik tombol 'Terapkan'
    const applyBtn = page.getByRole("button", { name: "Terapkan" });
    await expect(applyBtn).toBeVisible();
    await applyBtn.click();

    // Verifikasi URL mencerminkan query kustom
    await expect(page).toHaveURL(new RegExp(`preset=custom&from=${order5Date}&to=${order5Date}`));

    // Verifikasi kartu metrik menampilkan data yang sesuai dengan rentang tanggal kustom
    const revenueCard = page.locator("div.rounded-xl").filter({ hasText: "Total Omzet" });
    const ordersCard = page.locator("div.rounded-xl").filter({ hasText: "Total Pesanan" });

    await expect(revenueCard.getByText(formatRupiah(expectedCustomRevenue), { exact: true })).toBeVisible();
    await expect(ordersCard.getByText(expectedCustomOrders.toLocaleString("id-ID"), { exact: true })).toBeVisible();
  });
});
