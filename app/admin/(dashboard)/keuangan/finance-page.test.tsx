import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import type { FinanceData } from "@/lib/admin-finance";

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
  usePathname: () => "/admin/keuangan",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Supabase
const mockSupabase = { rpc: vi.fn(), from: vi.fn() };
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => mockSupabase,
}));

// Mock getFinanceData but preserve other functions
const mockGetFinanceData = vi.fn();
vi.mock("@/lib/admin-finance", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin-finance")>();
  return {
    ...actual,
    getFinanceData: (...args: unknown[]) => mockGetFinanceData(...args),
  };
});

import { FinanceDataLoader } from "./page";

describe("FinanceDataLoader (/admin/keuangan)", () => {
  const validAdmin = { id: "admin-1", email: "admin@test.com" };

  const sampleFinanceData: FinanceData = {
    cashbook: {
      period: {
        from: "2026-10-23",
        to: "2026-10-23",
      },
      summary: {
        totalIncome: 250000,
        totalExpense: 100000,
        grossProfit: 150000,
        expenseByCategory: {
          bahan: 75000,
          operasional: 25000,
          lainnya: 0,
        },
      },
      dailyBreakdown: [
        {
          date: "2026-10-23",
          income: 250000,
          expense: 100000,
          grossProfit: 150000,
        },
      ],
    },
    expenses: [
      {
        id: "exp-1",
        expense_date: "2026-10-23",
        description: "Beli Daging Ayam",
        amount: 75000,
        category: "bahan",
        created_at: "2026-10-23T10:00:00Z",
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mengarahkan ke /admin/login jika sesi admin tidak valid", async () => {
    mockGetAdminUser.mockResolvedValue(null);

    await expect(
      FinanceDataLoader({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow("NEXT_REDIRECT: /admin/login");

    expect(mockRedirect).toHaveBeenCalledWith("/admin/login");
  });

  it("merender komponen FinanceDashboardClient dengan data lengkap jika admin valid", async () => {
    mockGetAdminUser.mockResolvedValue(validAdmin);
    mockGetFinanceData.mockResolvedValue(sampleFinanceData);

    const element = await FinanceDataLoader({
      searchParams: Promise.resolve({ preset: "today" }),
    });
    const html = renderToString(element);

    expect(html).toContain("Total Pemasukan");
    expect(html).toContain("Rp250.000");
    expect(html).toContain("Total Pengeluaran");
    expect(html).toContain("Rp100.000");
    expect(html).toContain("Laba Kotor");
    expect(html).toContain("Rp150.000");
    expect(html).toContain("Beli Daging Ayam");
    expect(html).not.toContain("Gagal Memuat Catatan Keuangan");
  });

  it("TIDAK membocorkan pesan error database mentah ke UI dan menampilkan error state aman jika getFinanceData gagal", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetAdminUser.mockResolvedValue(validAdmin);

    const rawDbError =
      "relation public.expenses does not exist; detail: query failed at table internal_secret_store with code 42P01";
    mockGetFinanceData.mockRejectedValue(new Error(rawDbError));

    const element = await FinanceDataLoader({ searchParams: Promise.resolve({}) });
    const html = renderToString(element);

    // Memverifikasi pesan generik aman tampil
    expect(html).toContain("Gagal Memuat Catatan Keuangan");
    expect(html).toContain(
      "Terjadi kendala teknis saat memuat catatan keuangan. Silakan coba lagi."
    );
    expect(html).toContain("Muat Ulang Halaman");

    // MEMVERIFIKASI BAHWA PESAN ERROR DATABASE INTERNAL TIDAK PERNAH MUNCUL DI HTML
    expect(html).not.toContain(rawDbError);
    expect(html).not.toContain("relation public.expenses");
    expect(html).not.toContain("internal_secret_store");
    expect(html).not.toContain("42P01");

    // Memverifikasi detail error internal dicatat ke log server
    expect(consoleSpy).toHaveBeenCalledWith(
      "Gagal memuat catatan keuangan di Server Component:",
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });

  it("otomatis fallback ke preset today jika parameter tanggal kustom berada di masa depan", async () => {
    mockGetAdminUser.mockResolvedValue(validAdmin);
    mockGetFinanceData.mockResolvedValue(sampleFinanceData);

    const element = await FinanceDataLoader({
      searchParams: Promise.resolve({
        preset: "custom",
        from: "2099-01-01",
        to: "2099-01-31",
      }),
    });
    const html = renderToString(element);

    expect(mockGetFinanceData).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        preset: "today",
      })
    );
    expect(html).toContain("Total Pemasukan");
    expect(html).toContain("Rp250.000");
  });
});
