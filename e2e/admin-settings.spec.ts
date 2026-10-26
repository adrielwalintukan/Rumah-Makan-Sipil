import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { STORE_BUCKET } from "@/lib/storage";

// Pengujian End-to-End (E2E) Pengaturan Toko & Keamanan Akun (M4: Issue #19):
// Menguji alur lengkap pemilik:
// 1. Login admin -> navigasi ke /admin/pengaturan.
// 2. Memastikan kedua kartu tampil: Profil & Pengaturan Toko serta Keamanan Akun.
// 3. Mengubah nama toko, tagline, nomor WhatsApp, dan harga Paket Dos -> Simpan -> Verifikasi feedback sukses.
// 4. Mengunggah gambar QRIS sintetis -> Verifikasi pratinjau natural aspect ratio (object-contain) -> Simpan.
// 5. Validasi form ganti password: pesan error jika password < 8 karakter atau konfirmasi tidak cocok.
// 6. Mengunjungi halaman publik (/) dan memastikan nama toko dan harga Dos terefleksi dengan benar.
// 7. Cleanup di afterAll: memulihkan settings id = 1, membersihkan file QRIS di storage bucket store, dan menghapus akun admin sintetis.
//
// Hanya dijalankan pada lingkungan Supabase lokal (CI), bukan hosted.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const isLocal = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url);
test.skip(!isLocal || !serviceKey, "Butuh Supabase lokal (supabase start) + SUPABASE_SERVICE_ROLE_KEY");

const db = isLocal && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false } }) : null;

const testRunId = Date.now().toString(36);
const ADMIN_EMAIL = `admin-settings-${testRunId}@test.local`;
const PASSWORD = "Password123!";

const NEW_STORE_NAME = `RM Sipil E2E ${testRunId}`;
const NEW_TAGLINE = `Spesialis Menu Khas E2E ${testRunId}`;
const NEW_WHATSAPP = "6289512345678";
const NEW_DOS_PRICE_NUM = 3500;
const NEW_DOS_PRICE_STR = String(NEW_DOS_PRICE_NUM);

let adminUserId: string | null = null;
let initialSettings: {
  is_open: boolean;
  store_name: string;
  tagline: string | null;
  qris_image_path: string | null;
  whatsapp_number: string;
  dos_price: number;
} | null = null;
let uploadedQrisPath: string | null = null;

test.beforeAll(async () => {
  if (!db) return;

  // 1. Simpan backup nilai settings awal dari database id = 1 agar dapat dipulihkan secara bersih di teardown
  const { data: storeSetting, error: storeGetErr } = await db
    .from("settings")
    .select("is_open, store_name, tagline, qris_image_path, whatsapp_number, dos_price")
    .eq("id", 1)
    .single();
  expect(storeGetErr).toBeNull();
  expect(storeSetting).toBeTruthy();
  initialSettings = storeSetting;

  // Pastikan toko buka di pengaturan agar menu dan paket dos dapat dilihat di tampilan pelanggan
  if (!storeSetting?.is_open) {
    const { error: openStoreErr } = await db.from("settings").update({ is_open: true }).eq("id", 1);
    expect(openStoreErr).toBeNull();
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

  // 1. Bersihkan file gambar QRIS tes dari storage bucket store jika ada file yang diunggah
  const { data: currentSettings } = await db
    .from("settings")
    .select("qris_image_path")
    .eq("id", 1)
    .maybeSingle();

  if (currentSettings?.qris_image_path && currentSettings.qris_image_path !== initialSettings?.qris_image_path) {
    const { error: delStorageErr } = await db.storage
      .from(STORE_BUCKET)
      .remove([currentSettings.qris_image_path]);
    expect(delStorageErr).toBeNull();
  }

  if (
    uploadedQrisPath &&
    uploadedQrisPath !== currentSettings?.qris_image_path &&
    uploadedQrisPath !== initialSettings?.qris_image_path
  ) {
    const { error: delTrackedErr } = await db.storage
      .from(STORE_BUCKET)
      .remove([uploadedQrisPath]);
    expect(delTrackedErr).toBeNull();
  }

  // 2. Pulihkan baris settings id = 1 ke nilai awal
  if (initialSettings) {
    const { error: restoreStoreErr } = await db
      .from("settings")
      .update(initialSettings)
      .eq("id", 1);
    expect(restoreStoreErr).toBeNull();
  }

  // 3. Bersihkan akun admin
  if (adminUserId) {
    const { error: delAdminRowErr } = await db
      .from("admins")
      .delete()
      .eq("user_id", adminUserId);
    expect(delAdminRowErr).toBeNull();

    const { error: delAuthErr } = await db.auth.admin.deleteUser(adminUserId);
    expect(delAuthErr).toBeNull();
  }
});

test("alur pengaturan toko: ubah profil, upload QRIS natural ratio, validasi ganti password, refleksi publik", async ({
  page,
}) => {
  // -------------------------------------------------------------
  // 1. Otentikasi Admin & Buka Halaman Pengaturan
  // -------------------------------------------------------------
  await page.goto("/admin/login");
  await page.getByLabel(/Email Pemilik/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/Kata Sandi/i).fill(PASSWORD);
  await page.getByRole("button", { name: "Masuk ke Dashboard" }).click();

  await expect(page).toHaveURL(/\/admin/);
  await expect(page.getByRole("heading", { level: 1, name: "Pesanan Live" })).toBeVisible();

  // Di HP, Riwayat/Laporan/Poster QR/Pengaturan dibuka lewat panel "Lainnya" di tab bawah
  await page.getByRole("button", { name: "Lainnya" }).click();
  const moreSheet = page.getByRole("dialog", { name: "Menu lainnya" });
  for (const label of ["Riwayat Pesanan", "Laporan", "Poster QR"]) {
    await expect(moreSheet.getByRole("link", { name: label })).toBeVisible();
  }
  await moreSheet.getByRole("link", { name: "Pengaturan Toko" }).click();
  await expect(page).toHaveURL(/\/admin\/pengaturan$/);
  await expect(page.getByRole("heading", { level: 1, name: "Pengaturan Toko" })).toBeVisible();

  // -------------------------------------------------------------
  // 2. Memastikan Kedua Kartu Tampil
  // -------------------------------------------------------------
  const storeProfileCardHeading = page.getByRole("heading", {
    level: 2,
    name: "Profil & Pengaturan Toko",
  });
  const securityCardHeading = page.getByRole("heading", {
    level: 2,
    name: "Keamanan Akun",
  });
  await expect(storeProfileCardHeading).toBeVisible();
  await expect(securityCardHeading).toBeVisible();

  // -------------------------------------------------------------
  // 3. Ubah Nilai Nama Toko, Tagline, Nomor WhatsApp, dan Harga Paket Dos
  // -------------------------------------------------------------
  const storeNameInput = page.getByLabel(/Nama Toko/i);
  const taglineInput = page.getByLabel(/Tagline Toko/i);
  const whatsappInput = page.getByLabel(/Nomor WhatsApp/i);
  const dosPriceInput = page.getByLabel(/Harga Paket Dos/i);

  await storeNameInput.fill(NEW_STORE_NAME);
  await taglineInput.fill(NEW_TAGLINE);
  await whatsappInput.fill(NEW_WHATSAPP);
  await dosPriceInput.fill(NEW_DOS_PRICE_STR);

  // Verifikasi pratinjau format Rupiah dinamis muncul (Rp3.500)
  await expect(page.getByText("Rp3.500")).toBeVisible();

  // Simpan pengaturan profil
  await page.getByRole("button", { name: "Simpan Pengaturan" }).click();

  // Verifikasi feedback sukses tampil
  const successFeedback = page.getByRole("status").filter({
    hasText: "Pengaturan toko berhasil disimpan.",
  });
  await expect(successFeedback).toBeVisible();

  // -------------------------------------------------------------
  // 4. Unggah File Gambar QRIS Sintetis & Simpan
  // -------------------------------------------------------------
  // 1x1 transparent PNG buffer valid
  const sampleQrisBuffer = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64"
  );

  await page.setInputFiles("#qris-image-input, input[type='file']", {
    name: "test-qris.png",
    mimeType: "image/png",
    buffer: sampleQrisBuffer,
  });

  // Verifikasi pratinjau natural aspect ratio (object-contain)
  const qrisPreviewImg = page.locator("img[alt='Pratinjau gambar QRIS pembayaran']");
  await expect(qrisPreviewImg).toBeVisible();
  await expect(qrisPreviewImg).toHaveClass(/object-contain/);

  // Verifikasi tombol Hapus Gambar dan label Ganti Gambar muncul
  await expect(page.getByRole("button", { name: "Hapus Gambar" })).toBeVisible();
  await expect(page.locator("label[for='qris-image-input']").filter({ hasText: "Ganti Gambar" })).toBeVisible();

  // Simpan kembali pengaturan beserta foto QRIS
  await page.getByRole("button", { name: "Simpan Pengaturan" }).click();
  await expect(successFeedback).toBeVisible();

  // Ambil path gambar QRIS baru yang tersimpan di DB untuk tracking cleanup
  if (db) {
    const { data: updatedDb } = await db
      .from("settings")
      .select("qris_image_path")
      .eq("id", 1)
      .single();
    if (updatedDb?.qris_image_path) {
      uploadedQrisPath = updatedDb.qris_image_path;
    }
  }

  // -------------------------------------------------------------
  // 5. Validasi Form Ganti Password
  // -------------------------------------------------------------
  const newPasswordInput = page.getByLabel(/^Password Baru/i);
  const confirmPasswordInput = page.getByLabel(/^Konfirmasi Password Baru/i);
  const changePasswordBtn = page.getByRole("button", { name: "Ganti Password" });

  // Skenario A: Password < 8 karakter
  await newPasswordInput.fill("pendek");
  await confirmPasswordInput.fill("pendek");
  await changePasswordBtn.click();

  const minLengthError = page.locator("#new-password-error");
  await expect(minLengthError).toBeVisible();
  await expect(minLengthError).toHaveText("Password baru minimal 8 karakter.");

  // Skenario B: Konfirmasi tidak cocok
  await newPasswordInput.fill("PasswordBaru123!");
  await confirmPasswordInput.fill("PasswordBeda456!");
  await changePasswordBtn.click();

  const mismatchError = page.locator("#confirm-password-error");
  await expect(mismatchError).toBeVisible();
  await expect(mismatchError).toHaveText("Konfirmasi password tidak cocok.");

  // -------------------------------------------------------------
  // 6. Mengunjungi Halaman Publik (/) dan Memastikan Pengaturan Terefleksi
  // -------------------------------------------------------------
  await page.goto("/");
  await expect(page).toHaveURL("/");

  // Verifikasi tagline baru di header toko
  await expect(page.getByText(NEW_TAGLINE)).toBeVisible();

  // Verifikasi slide Paket Dos di banner geser merefleksikan harga baru (Rp3.500 / dos)
  const paketDosSection = page.getByRole("listitem", { name: /Paket Makanan Dos/ });
  await expect(paketDosSection).toBeVisible();
  await expect(paketDosSection.getByText(/Rp3\.500 \/ dos/)).toBeVisible();

  // Verifikasi tautan WhatsApp paket dos memuat nomor WhatsApp baru, nama toko baru, dan harga baru
  const waOrderLink = paketDosSection.getByRole("link", { name: /Pesan via WhatsApp/i });
  await expect(waOrderLink).toBeVisible();

  const waHref = await waOrderLink.getAttribute("href");
  expect(waHref).not.toBeNull();
  expect(waHref).toContain(NEW_WHATSAPP);
  expect(waHref).toContain(encodeURIComponent(NEW_STORE_NAME));
  expect(waHref).toContain(encodeURIComponent("Rp3.500"));
});
