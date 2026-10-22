import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SalesReportResult } from "@/lib/admin-reports";

// Mock server-only
vi.mock("server-only", () => ({}));

// Mock auth
const mockGetAdminUser = vi.fn();
vi.mock("@/lib/auth", () => ({
  getAdminUser: () => mockGetAdminUser(),
}));

// Mock Supabase
const mockSupabase = { rpc: vi.fn() };
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => mockSupabase,
}));

// Mock getSalesReport but keep schemas from @/lib/admin-reports
const mockGetSalesReport = vi.fn();
vi.mock("@/lib/admin-reports", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin-reports")>();
  return {
    ...actual,
    getSalesReport: (...args: unknown[]) => mockGetSalesReport(...args),
  };
});

import { GET } from "./route";

describe("GET /api/admin/reports", () => {
  const validAdmin = { id: "admin-1", email: "admin@test.com" };

  const sampleReport: SalesReportResult = {
    period: {
      preset: "today",
      from: "2026-10-22",
      to: "2026-10-22",
    },
    summary: {
      totalOrders: 15,
      totalRevenue: 375000,
      totalCash: 175000,
      totalQris: 200000,
      averageOrderValue: 25000,
      cashPercentage: 47,
      qrisPercentage: 53,
    },
    topItems: [
      { name: "Nasi Ayam Bakar", total_quantity: 10, total_revenue: 250000 },
      { name: "Es Teh Manis", total_quantity: 12, total_revenue: 60000 },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAdminUser.mockReset();
    mockGetSalesReport.mockReset();
  });

  it("mengembalikan 401 UNAUTHORIZED jika pemanggil tidak memiliki sesi admin", async () => {
    mockGetAdminUser.mockResolvedValue(null);

    const req = new Request("http://localhost/api/admin/reports");
    const res = await GET(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toEqual({
      error: "UNAUTHORIZED",
      message: "Akses ditolak: sesi admin diperlukan.",
    });
    expect(mockGetSalesReport).not.toHaveBeenCalled();
  });

  describe("validasi parameter query (400 BAD_REQUEST)", () => {
    beforeEach(() => {
      mockGetAdminUser.mockResolvedValue(validAdmin);
    });

    it("mengembalikan 400 jika preset tidak valid", async () => {
      const req = new Request("http://localhost/api/admin/reports?preset=yearly");
      const res = await GET(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("BAD_REQUEST");
      expect(json.message).toBe("Parameter query tidak valid.");
      expect(json.details).toBeDefined();
      expect(mockGetSalesReport).not.toHaveBeenCalled();
    });

    it("mengembalikan 400 jika tanggal 'from' tidak berformat YYYY-MM-DD", async () => {
      const req = new Request("http://localhost/api/admin/reports?preset=custom&from=invalid-date");
      const res = await GET(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("BAD_REQUEST");
      expect(json.message).toBe("Parameter query tidak valid.");
      expect(json.details).toBeDefined();
      expect(mockGetSalesReport).not.toHaveBeenCalled();
    });

    it("mengembalikan 400 jika tanggal 'to' tidak berformat YYYY-MM-DD", async () => {
      const req = new Request("http://localhost/api/admin/reports?preset=custom&to=22-10-2026");
      const res = await GET(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("BAD_REQUEST");
      expect(json.message).toBe("Parameter query tidak valid.");
      expect(json.details).toBeDefined();
      expect(mockGetSalesReport).not.toHaveBeenCalled();
    });

    it("mengembalikan 400 jika tanggal kalender tidak valid (misal 2026-02-31 atau 2026-99-99)", async () => {
      const req = new Request("http://localhost/api/admin/reports?preset=custom&from=2026-02-31&to=2026-03-05");
      const res = await GET(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("BAD_REQUEST");
      expect(json.message).toBe("Parameter query tidak valid.");
      expect(json.details).toBeDefined();
      expect(mockGetSalesReport).not.toHaveBeenCalled();
    });

    it("mengembalikan 400 jika rentang tanggal kustom terbalik (from > to)", async () => {
      const req = new Request("http://localhost/api/admin/reports?preset=custom&from=2026-10-25&to=2026-10-10");
      const res = await GET(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("BAD_REQUEST");
      expect(json.message).toBe("Parameter query tidak valid.");
      expect(json.details).toBeDefined();
      expect(mockGetSalesReport).not.toHaveBeenCalled();
    });

    it("mengembalikan 400 jika limit bukan angka", async () => {
      const req = new Request("http://localhost/api/admin/reports?limit=abc");
      const res = await GET(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("BAD_REQUEST");
      expect(json.message).toBe("Parameter query tidak valid.");
      expect(json.details).toBeDefined();
      expect(mockGetSalesReport).not.toHaveBeenCalled();
    });

    it("mengembalikan 400 jika limit kurang dari 1", async () => {
      const req = new Request("http://localhost/api/admin/reports?limit=0");
      const res = await GET(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("BAD_REQUEST");
      expect(json.message).toBe("Parameter query tidak valid.");
      expect(json.details).toBeDefined();
      expect(mockGetSalesReport).not.toHaveBeenCalled();
    });

    it("mengembalikan 400 jika limit lebih dari 50", async () => {
      const req = new Request("http://localhost/api/admin/reports?limit=51");
      const res = await GET(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("BAD_REQUEST");
      expect(json.message).toBe("Parameter query tidak valid.");
      expect(json.details).toBeDefined();
      expect(mockGetSalesReport).not.toHaveBeenCalled();
    });
  });

  describe("pengambilan data sukses (200 OK)", () => {
    beforeEach(() => {
      mockGetAdminUser.mockResolvedValue(validAdmin);
    });

    it("mengembalikan 200 dengan data laporan penjualan default jika tanpa parameter query", async () => {
      mockGetSalesReport.mockResolvedValue(sampleReport);

      const req = new Request("http://localhost/api/admin/reports");
      const res = await GET(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual(sampleReport);
      expect(mockGetSalesReport).toHaveBeenCalledWith(mockSupabase, {
        preset: "today",
        limit: 5,
      });
    });

    it("meneruskan parameter query yang valid ke getSalesReport", async () => {
      const customReport: SalesReportResult = {
        ...sampleReport,
        period: {
          preset: "custom",
          from: "2026-10-01",
          to: "2026-10-20",
        },
      };
      mockGetSalesReport.mockResolvedValue(customReport);

      const req = new Request(
        "http://localhost/api/admin/reports?preset=custom&from=2026-10-01&to=2026-10-20&limit=10"
      );
      const res = await GET(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual(customReport);
      expect(mockGetSalesReport).toHaveBeenCalledWith(mockSupabase, {
        preset: "custom",
        from: "2026-10-01",
        to: "2026-10-20",
        limit: 10,
      });
    });

    it("mengabaikan parameter bernilai spasi kosong dan menggunakan nilai default", async () => {
      mockGetSalesReport.mockResolvedValue(sampleReport);

      const req = new Request(
        "http://localhost/api/admin/reports?preset=%20&from=%20&to=%20&limit=%20"
      );
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(mockGetSalesReport).toHaveBeenCalledWith(mockSupabase, {
        preset: "today",
        limit: 5,
      });
    });
  });

  describe("penanganan error server (500 INTERNAL_SERVER_ERROR)", () => {
    it("mengembalikan 500 jika getSalesReport melempar error tak terduga", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockGetAdminUser.mockResolvedValue(validAdmin);
      mockGetSalesReport.mockRejectedValue(new Error("Supabase RPC connection error"));

      const req = new Request("http://localhost/api/admin/reports");
      const res = await GET(req);

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json).toEqual({
        error: "INTERNAL_SERVER_ERROR",
        message: "Gagal memproses laporan penjualan.",
      });
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("mengembalikan 500 jika getAdminUser melempar error tak terduga", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockGetAdminUser.mockRejectedValue(new Error("Auth internal failure"));

      const req = new Request("http://localhost/api/admin/reports");
      const res = await GET(req);

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json).toEqual({
        error: "INTERNAL_SERVER_ERROR",
        message: "Gagal memproses laporan penjualan.",
      });
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
