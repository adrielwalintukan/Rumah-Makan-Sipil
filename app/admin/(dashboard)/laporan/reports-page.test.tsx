import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import type { SalesReportResult } from "@/lib/admin-reports";

// Mock server-only
vi.mock("server-only", () => ({}));

// Mock connection
vi.mock("next/server", () => ({
  connection: vi.fn(),
}));

// Mock auth
const mockGetAdminUser = vi.fn();
vi.mock("@/lib/auth", () => ({
  getAdminUser: () => mockGetAdminUser(),
}));

// Mock redirect & navigation
const mockRedirect = vi.fn().mockImplementation((url: string) => {
  const err = new Error(`NEXT_REDIRECT: ${url}`);
  (err as unknown as { digest: string }).digest = `NEXT_REDIRECT;replace;${url};307;`;
  throw err;
});
vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => mockRedirect(...args),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/admin/laporan",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Supabase
const mockSupabase = { rpc: vi.fn() };
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => mockSupabase,
}));

// Mock getSalesReport but preserve other functions
const mockGetSalesReport = vi.fn();
vi.mock("@/lib/admin-reports", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin-reports")>();
  return {
    ...actual,
    getSalesReport: (...args: unknown[]) => mockGetSalesReport(...args),
  };
});

import { ReportsDataLoader } from "./page";

describe("ReportsDataLoader (/admin/laporan)", () => {
  const validAdmin = { id: "admin-1", email: "admin@test.com" };

  const sampleReport: SalesReportResult = {
    period: {
      preset: "today",
      from: "2026-10-22",
      to: "2026-10-22",
    },
    summary: {
      totalOrders: 10,
      totalRevenue: 250000,
      totalCash: 100000,
      totalQris: 150000,
      cashOrders: 4,
      qrisOrders: 6,
      averageOrderValue: 25000,
      cashPercentage: 40,
      qrisPercentage: 60,
    },
    topItems: [
      { name: "Ayam Bakar", total_quantity: 8, total_revenue: 200000 },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAdminUser.mockReset();
    mockGetSalesReport.mockReset();
    mockRedirect.mockImplementation((url: string) => {
      const err = new Error(`NEXT_REDIRECT: ${url}`);
      (err as unknown as { digest: string }).digest = `NEXT_REDIRECT;replace;${url};307;`;
      throw err;
    });
  });

  it("melakukan redirect ke /admin/login jika sesi admin tidak valid", async () => {
    mockGetAdminUser.mockResolvedValue(null);

    await expect(
      ReportsDataLoader({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow("NEXT_REDIRECT: /admin/login");

    expect(mockRedirect).toHaveBeenCalledWith("/admin/login");
    expect(mockGetSalesReport).not.toHaveBeenCalled();
  });

  it("merender data laporan lengkap jika pemanggilan getSalesReport sukses", async () => {
    mockGetAdminUser.mockResolvedValue(validAdmin);
    mockGetSalesReport.mockResolvedValue(sampleReport);

    const element = await ReportsDataLoader({ searchParams: Promise.resolve({}) });
    const html = renderToString(element);

    expect(html).toContain("Laporan Penjualan");
    expect(html).toContain("Rp250.000");
    expect(html).toContain("Total Pesanan");
    expect(html).toContain("10");
    expect(html).toContain("4 pesanan");
    expect(html).toContain("6 pesanan");
    expect(html).toContain("Ayam Bakar");
    expect(html).not.toContain("Gagal Memuat Laporan Penjualan");
  });

  it("TIDAK membocorkan pesan error database mentah ke UI dan menampilkan pesan generik aman", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetAdminUser.mockResolvedValue(validAdmin);

    const rawDbError =
      "relation public.orders does not exist; detail: query failed at table internal_secret_store with code 42P01";
    mockGetSalesReport.mockRejectedValue(new Error(rawDbError));

    const element = await ReportsDataLoader({ searchParams: Promise.resolve({}) });
    const html = renderToString(element);

    // Memverifikasi pesan generik aman tampil
    expect(html).toContain("Gagal Memuat Laporan Penjualan");
    expect(html).toContain(
      "Terjadi kendala teknis saat memuat laporan. Silakan coba lagi."
    );
    expect(html).toContain("Muat Ulang Halaman");

    // MEMVERIFIKASI BAHWA PESAN ERROR DATABASE INTERNAL TIDAK PERNAH MUNCUL DI HTML
    expect(html).not.toContain(rawDbError);
    expect(html).not.toContain("relation public.orders");
    expect(html).not.toContain("internal_secret_store");
    expect(html).not.toContain("42P01");

    // Memverifikasi detail error internal dicatat ke log server
    expect(consoleSpy).toHaveBeenCalledWith(
      "Gagal memuat laporan penjualan di Server Component:",
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });
});
