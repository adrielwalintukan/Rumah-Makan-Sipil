import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const isLocal = supabaseUrl.includes("127.0.0.1") || supabaseUrl.includes("localhost");

test.describe("Admin QR Poster (E2E)", () => {
  test.skip(!isLocal || !serviceRoleKey, "Butuh Supabase lokal (supabase start) + SUPABASE_SERVICE_ROLE_KEY");

  const adminClient = isLocal && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

  const testEmail = `admin-qr-test-${Date.now()}@warung.local`;
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

    // Teardown admin sintetis
    if (userId) {
      await adminClient.from("admins").delete().eq("user_id", userId);
      await adminClient.auth.admin.deleteUser(userId);
    }
  });

  test("alur poster QR: autentikasi, render kartu poster, toggle ukuran, dan tombol aksi", async ({ page }) => {
    // 1. Akses langsung saat belum login -> redirect ke /admin/login
    await page.goto("/admin/qr");
    await expect(page).toHaveURL(/\/admin\/login/);

    // 2. Login admin
    await page.getByLabel(/Email Pemilik/i).fill(testEmail);
    await page.getByLabel(/Kata Sandi/i).fill(testPassword);
    await page.getByRole("button", { name: "Masuk ke Dashboard" }).click();

    await expect(page).toHaveURL(/\/admin(?!\/login)/);

    // 3. Navigasi ke halaman Poster QR
    await page.goto("/admin/qr");
    await expect(page).toHaveURL(/\/admin\/qr/);

    // 4. Verifikasi heading dan deskripsi
    await expect(
      page.getByRole("heading", { level: 1, name: "Poster QR Pemesanan" })
    ).toBeVisible();

    // 5. Verifikasi komponen kartu poster
    const posterTarget = page.locator("#poster-print-target");
    await expect(posterTarget).toBeVisible();
    await expect(posterTarget.getByText("RMS")).toBeVisible();
    await expect(posterTarget.getByText("Rumah Makan Sipil")).toBeVisible();
    await expect(posterTarget.getByText("SCAN UNTUK PESAN")).toBeVisible();
    await expect(
      posterTarget.getByAltText("QR Code Pemesanan Rumah Makan Sipil")
    ).toBeVisible();
    await expect(posterTarget.getByText("1. Scan QR")).toBeVisible();
    await expect(posterTarget.getByText("2. Pilih Menu")).toBeVisible();
    await expect(posterTarget.getByText("3. Bayar")).toBeVisible();

    // 6. Verifikasi kontrol toggle ukuran A4, A5, dan A6
    const btnA4 = page.getByRole("button", { name: "Ukuran A4 (Dinding / Kasir)" });
    const btnA5 = page.getByRole("button", { name: "Ukuran A5 (Meja Sedang)" });
    const btnA6 = page.getByRole("button", { name: "Ukuran A6 (Tenda Meja Kecil)" });

    await expect(btnA4).toHaveAttribute("aria-pressed", "true");
    await expect(btnA5).toHaveAttribute("aria-pressed", "false");
    await expect(btnA6).toHaveAttribute("aria-pressed", "false");

    // Klik tombol A6 (Tenda Meja Kecil)
    await btnA6.click();
    await expect(btnA6).toHaveAttribute("aria-pressed", "true");
    await expect(btnA4).toHaveAttribute("aria-pressed", "false");

    // Klik tombol A5 (Meja Sedang)
    await btnA5.click();
    await expect(btnA5).toHaveAttribute("aria-pressed", "true");
    await expect(btnA6).toHaveAttribute("aria-pressed", "false");

    // 6b. Di layar HP (360 px), link web di kaki poster tidak terpotong untuk semua ukuran (Issue #68)
    const posterLink = posterTarget.locator("footer p").last();
    for (const btn of [btnA4, btnA5, btnA6]) {
      await btn.click();
      const pb = (await posterTarget.boundingBox())!;
      const lb = (await posterLink.boundingBox())!;
      expect(lb.y + lb.height).toBeLessThanOrEqual(pb.y + pb.height);
    }
    await btnA5.click();

    // 7. Verifikasi tombol aksi dan proteksi status produksi
    const btnPrint = page.getByRole("button", { name: "Cetak Poster" });
    const btnDownloadWord = page.getByRole("button", { name: /Unduh Dokumen Word/i });
    const btnDownload = page.getByRole("button", { name: /Unduh PNG/i });

    await expect(btnPrint).toBeVisible();
    await expect(btnDownloadWord).toBeVisible();
    await expect(btnDownload).toBeVisible();

    // Di lingkungan build produksi (seperti runner E2E CI) dengan URL localhost,
    // aksi cetak & unduh dinonaktifkan demi keselamatan operasional warung
    const isBlocked = await page
      .getByText(/Aksi Cetak & Unduh Dinonaktifkan/i)
      .isVisible();

    if (isBlocked) {
      await expect(btnPrint).toBeDisabled();
      await expect(btnDownloadWord).toBeDisabled();
      await expect(btnDownload).toBeDisabled();
    } else {
      await expect(btnPrint).toBeEnabled();
      await expect(btnDownloadWord).toBeEnabled();
      await expect(btnDownload).toBeEnabled();
    }

    // 8. Verifikasi isolasi cetak (@media print) satu halaman utuh tanpa overflow
    await page.emulateMedia({ media: "print" });

    // a. Toolbar admin dan elemen navigasi tersembunyi total (display: none)
    const noPrintLocators = await page.locator(".no-print").all();
    for (const el of noPrintLocators) {
      await expect(el).not.toBeVisible();
    }

    // b. Target poster dan bagian intinya (header, main, footer) tetap tampil utuh
    await expect(posterTarget).toBeVisible();
    await expect(posterTarget.locator("header")).toBeVisible();
    await expect(posterTarget.locator("main")).toBeVisible();
    await expect(posterTarget.locator("footer")).toBeVisible();
    await expect(posterTarget.getByText("Rumah Makan Sipil")).toBeVisible();
    await expect(posterTarget.getByText("1. Scan QR")).toBeVisible();
    await expect(posterTarget.getByText("Pesan langsung dari HP Anda")).toBeVisible();

    // c. Verifikasi computed display bukan none
    const headerDisplay = await posterTarget
      .locator("header")
      .evaluate((el) => window.getComputedStyle(el).display);
    expect(headerDisplay).not.toBe("none");

    const footerDisplay = await posterTarget
      .locator("footer")
      .evaluate((el) => window.getComputedStyle(el).display);
    expect(footerDisplay).not.toBe("none");

    // d. Verifikasi output cetak aktual Chromium menghasilkan tepat 1 halaman dengan ukuran CSS @page yang sesuai (A4, A5, dan A6)
    const verifySinglePagePdf = (pdfBuffer: Buffer, expectedFormat?: "a4" | "a5" | "a6") => {
      const pdfStr = pdfBuffer.toString("binary");
      const countMatch = pdfStr.match(/\/Type\s*\/Pages[^>]*\/Count\s+(\d+)/);
      expect(countMatch).not.toBeNull();
      const pageCount = parseInt(countMatch![1], 10);
      expect(pageCount).toBe(1);

      if (expectedFormat) {
        const mediaBoxMatch = pdfStr.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/);
        expect(mediaBoxMatch).not.toBeNull();
        const widthPt = parseFloat(mediaBoxMatch![1]);
        const heightPt = parseFloat(mediaBoxMatch![2]);

        if (expectedFormat === "a4") {
          // A4 portrait: ~595 x 842 pt
          expect(Math.round(widthPt)).toBe(595);
          expect(Math.round(heightPt)).toBe(842);
        } else if (expectedFormat === "a5") {
          // A5 portrait: ~420 x 595 pt
          expect(Math.round(widthPt)).toBe(420);
          expect(Math.round(heightPt)).toBe(595);
        } else if (expectedFormat === "a6") {
          // A6 portrait: ~298 x 420 pt
          expect(Math.round(widthPt)).toBe(298);
          expect(Math.round(heightPt)).toBe(420);
        }
      }
    };

    // 1) Uji ukuran aktif saat ini (A5)
    const pdfA5 = await page.pdf({ preferCSSPageSize: true });
    verifySinglePagePdf(pdfA5, "a5");

    // 2) Beralih ke screen, pilih A4, lalu uji ukuran cetak A4
    await page.emulateMedia({ media: "screen" });
    await btnA4.click();
    await expect(btnA4).toHaveAttribute("aria-pressed", "true");
    await page.emulateMedia({ media: "print" });
    // Poster cetak berada di tengah kertas (tidak tergeser max-w pratinjau) dan lebih kecil dari kertas
    const viewport = page.viewportSize()!;
    await page.setViewportSize({ width: 794, height: 1123 });
    const printBox = (await posterTarget.boundingBox())!;
    expect(Math.abs(printBox.x - (794 - printBox.width) / 2)).toBeLessThanOrEqual(2);
    expect(printBox.width).toBeLessThan(794);
    await page.setViewportSize(viewport);
    const pdfA4 = await page.pdf({ preferCSSPageSize: true });
    verifySinglePagePdf(pdfA4, "a4");

    // 3) Beralih ke screen, pilih A6, lalu uji ukuran cetak A6 (tenda meja kecil)
    await page.emulateMedia({ media: "screen" });
    await btnA6.click();
    await expect(btnA6).toHaveAttribute("aria-pressed", "true");
    await page.emulateMedia({ media: "print" });
    const pdfA6 = await page.pdf({ preferCSSPageSize: true });
    verifySinglePagePdf(pdfA6, "a6");

    await page.emulateMedia({ media: "screen" });
  });
});
