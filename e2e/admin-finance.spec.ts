import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const isLocal = supabaseUrl.includes("127.0.0.1") || supabaseUrl.includes("localhost");

test.describe("Admin Finance & Cashbook (E2E)", () => {
  test.skip(!isLocal || !serviceRoleKey, "Butuh Supabase lokal (supabase start) + SUPABASE_SERVICE_ROLE_KEY");

  const adminClient = isLocal && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

  const testEmail = `admin-finance-test-${Date.now()}@warung.local`;
  const testPassword = "PasswordTest123!";
  let userId: string;

  test.beforeAll(async () => {
    if (!adminClient) return;

    // 1. Buat user admin sintetis
    const { data: userRes, error: userErr } = await adminClient.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
    });
    if (userErr || !userRes.user) throw userErr;
    userId = userRes.user.id;

    // 2. Daftarkan ke tabel public.admins
    const { error: adminErr } = await adminClient
      .from("admins")
      .insert({ user_id: userId });
    if (adminErr) throw adminErr;
  });

  test.afterAll(async () => {
    if (!adminClient) return;

    // Teardown sintetis
    if (userId) {
      await adminClient.from("expenses").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await adminClient.from("admins").delete().eq("user_id", userId);
      await adminClient.auth.admin.deleteUser(userId);
    }
  });

  test("alur lengkap keuangan: login, cek buku kas, tambah, ubah, dan hapus pengeluaran", async ({ page }) => {
    // 1. Login admin
    await page.goto("/admin/login");
    await page.getByLabel(/Email Pemilik/i).fill(testEmail);
    await page.getByLabel(/Kata Sandi/i).fill(testPassword);
    await page.getByRole("button", { name: "Masuk ke Dashboard" }).click();

    await expect(page).toHaveURL(/\/admin(?!\/login)/);
    await expect(page.getByRole("heading", { level: 1, name: "Pesanan Live" })).toBeVisible();

    // 2. Navigasi ke Catatan Keuangan
    await page.goto("/admin/keuangan");
    await expect(page).toHaveURL(/\/admin\/keuangan/);
    await expect(page.getByRole("heading", { level: 1, name: "Catatan Keuangan" })).toBeVisible();

    // 3. Verifikasi Tiga Kartu Metrik
    await expect(page.getByText("Total Pemasukan")).toBeVisible();
    await expect(page.getByText("Total Pengeluaran")).toBeVisible();
    await expect(page.getByText("Laba Kotor", { exact: true }).first()).toBeVisible();

    // 4. Tambah Pengeluaran Baru
    await page.getByRole("button", { name: /tambah pengeluaran/i }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.locator("#expense-description").fill("Beli Telur Ayam 2 Rak");
    await dialog.locator("#expense-amount").fill("110000");
    await dialog.locator("#expense-category").selectOption("bahan");

    await dialog.getByRole("button", { name: "Tambah Pengeluaran" }).click();
    await expect(dialog).toBeHidden();

    // 5. Verifikasi pengeluaran muncul di daftar
    const expenseItem = page.locator("div.sm\\:hidden > div, tbody tr").filter({ hasText: "Beli Telur Ayam 2 Rak" }).locator("visible=true");
    await expect(expenseItem).toBeVisible();
    await expect(expenseItem.getByText("Rp110.000")).toBeVisible();

    // 6. Ubah Pengeluaran
    await expenseItem.getByLabel("Ubah pengeluaran Beli Telur Ayam 2 Rak").click();
    await expect(dialog).toBeVisible();

    await dialog.locator("#expense-amount").fill("115000");
    await dialog.getByRole("button", { name: "Simpan Perubahan" }).click();
    await expect(dialog).toBeHidden();

    await expect(expenseItem.getByText("Rp115.000")).toBeVisible();

    // 7. Hapus Pengeluaran
    await expenseItem.getByLabel("Hapus pengeluaran Beli Telur Ayam 2 Rak").click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Hapus Catatan Pengeluaran?")).toBeVisible();

    await dialog.getByRole("button", { name: "Hapus Pengeluaran" }).click();
    await expect(dialog).toBeHidden();

    // 8. Verifikasi pengeluaran terhapus dari daftar
    await expect(page.getByText("Beli Telur Ayam 2 Rak")).toHaveCount(0);
  });
});
