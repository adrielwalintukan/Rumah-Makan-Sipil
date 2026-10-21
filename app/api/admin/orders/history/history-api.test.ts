import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock server-only
vi.mock("server-only", () => ({}));

// Mock auth
const mockGetAdminUser = vi.fn();
vi.mock("@/lib/auth", () => ({
  getAdminUser: () => mockGetAdminUser(),
}));

// Mock Supabase
const mockSupabase = { from: vi.fn() };
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => mockSupabase,
}));

// Mock getOrderHistory but keep actual schemas from @/lib/admin-orders
const mockGetOrderHistory = vi.fn();
vi.mock("@/lib/admin-orders", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin-orders")>();
  return {
    ...actual,
    getOrderHistory: (...args: unknown[]) => mockGetOrderHistory(...args),
  };
});

import { GET } from "./route";

describe("GET /api/admin/orders/history", () => {
  const validAdmin = { id: "admin-1", email: "admin@test.com" };

  const sampleResult = {
    orders: [
      {
        id: "order-1",
        public_token: "token-abc-1234567890123",
        order_date: "2026-10-21",
        daily_number: 1,
        customer_name: "Budi Santoso",
        customer_phone: "08123456789",
        order_type: "dine_in",
        payment_method: "cash",
        payment_status: "lunas",
        status: "selesai",
        total: 50000,
        cancel_reason: null,
        created_at: "2026-10-21T02:00:00Z",
        paid_at: "2026-10-21T02:05:00Z",
        order_items: [],
      },
    ],
    totalCount: 1,
    summary: {
      totalOrders: 1,
      totalRevenue: 50000,
      totalCash: 50000,
      totalQris: 0,
    },
    page: 1,
    totalPages: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAdminUser.mockReset();
    mockGetOrderHistory.mockReset();
  });

  it("mengembalikan 401 Unauthorized jika pemanggil tidak memiliki sesi admin", async () => {
    mockGetAdminUser.mockResolvedValue(null);

    const req = new Request("http://localhost/api/admin/orders/history");
    const res = await GET(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
    expect(mockGetOrderHistory).not.toHaveBeenCalled();
  });

  describe("validasi parameter query (400)", () => {
    beforeEach(() => {
      mockGetAdminUser.mockResolvedValue(validAdmin);
    });

    it("mengembalikan 400 jika preset tidak valid", async () => {
      const req = new Request("http://localhost/api/admin/orders/history?preset=invalid_preset");
      const res = await GET(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBeDefined();
      expect(mockGetOrderHistory).not.toHaveBeenCalled();
    });

    it("mengembalikan 400 jika tanggal 'from' tidak berformat YYYY-MM-DD", async () => {
      const req = new Request("http://localhost/api/admin/orders/history?preset=custom&from=invalid-date");
      const res = await GET(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Format tanggal awal harus YYYY-MM-DD.");
      expect(mockGetOrderHistory).not.toHaveBeenCalled();
    });

    it("mengembalikan 400 jika tanggal 'to' tidak berformat YYYY-MM-DD", async () => {
      const req = new Request("http://localhost/api/admin/orders/history?preset=custom&to=21-10-2026");
      const res = await GET(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Format tanggal akhir harus YYYY-MM-DD.");
      expect(mockGetOrderHistory).not.toHaveBeenCalled();
    });

    it("mengembalikan 400 jika status filter tidak valid", async () => {
      const req = new Request("http://localhost/api/admin/orders/history?status=dimasak");
      const res = await GET(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBeDefined();
      expect(mockGetOrderHistory).not.toHaveBeenCalled();
    });

    it("mengembalikan 400 jika kata kunci search lebih dari 50 karakter", async () => {
      const longSearch = "a".repeat(51);
      const req = new Request(`http://localhost/api/admin/orders/history?search=${longSearch}`);
      const res = await GET(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Kata kunci pencarian maksimal 50 karakter.");
      expect(mockGetOrderHistory).not.toHaveBeenCalled();
    });

    it("mengembalikan 400 jika page kurang dari 1", async () => {
      const req = new Request("http://localhost/api/admin/orders/history?page=0");
      const res = await GET(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBeDefined();
      expect(mockGetOrderHistory).not.toHaveBeenCalled();
    });

    it("mengembalikan 400 jika limit lebih dari 100", async () => {
      const req = new Request("http://localhost/api/admin/orders/history?limit=101");
      const res = await GET(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBeDefined();
      expect(mockGetOrderHistory).not.toHaveBeenCalled();
    });
  });

  describe("berhasil mengambil riwayat pesanan (200)", () => {
    beforeEach(() => {
      mockGetAdminUser.mockResolvedValue(validAdmin);
      mockGetOrderHistory.mockResolvedValue(sampleResult);
    });

    it("menggunakan nilai default saat tidak ada query parameter", async () => {
      const req = new Request("http://localhost/api/admin/orders/history");
      const res = await GET(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual(sampleResult);

      expect(mockGetOrderHistory).toHaveBeenCalledTimes(1);
      expect(mockGetOrderHistory).toHaveBeenCalledWith(mockSupabase, {
        preset: "today",
        status: "all",
        page: 1,
        limit: 50,
      });
    });

    it("mem-parsing parameter query yang valid dengan benar", async () => {
      const req = new Request(
        "http://localhost/api/admin/orders/history?preset=last7days&status=selesai&page=2&limit=25&search=budi"
      );
      const res = await GET(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual(sampleResult);

      expect(mockGetOrderHistory).toHaveBeenCalledWith(mockSupabase, {
        preset: "last7days",
        status: "selesai",
        page: 2,
        limit: 25,
        search: "budi",
      });
    });

    it("mengabaikan query param bernilai string kosong", async () => {
      const req = new Request(
        "http://localhost/api/admin/orders/history?preset=custom&from=&to=&search="
      );
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(mockGetOrderHistory).toHaveBeenCalledWith(mockSupabase, {
        preset: "custom",
        status: "all",
        page: 1,
        limit: 50,
      });
    });
  });

  it("mengembalikan 500 jika terjadi kesalahan tak terduga pada server", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetAdminUser.mockResolvedValue(validAdmin);
    mockGetOrderHistory.mockRejectedValue(new Error("Database connection failed"));

    const req = new Request("http://localhost/api/admin/orders/history");
    const res = await GET(req);

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Gagal mengambil riwayat pesanan.");
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
