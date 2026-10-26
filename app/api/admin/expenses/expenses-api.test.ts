import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as getExpenses, POST as postExpense } from "./route";
import { PATCH as patchExpense, DELETE as deleteExpense } from "./[id]/route";

vi.mock("@/lib/auth", () => ({
  getAdminUser: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(),
}));

import { getAdminUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

describe("/api/admin/expenses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/admin/expenses", () => {
    it("mengembalikan 401 pada GET jika bukan admin", async () => {
      vi.mocked(getAdminUser).mockResolvedValue(null);
      const res = await getExpenses(new Request("http://localhost/api/admin/expenses"));
      expect(res.status).toBe(401);
    });

    it("mengembalikan 200 dan daftar pengeluaran jika admin", async () => {
      vi.mocked(getAdminUser).mockResolvedValue({ id: "admin-1", email: "admin@warung.local" });

      const mockExpenses = [
        {
          id: "exp-1",
          expense_date: "2026-10-23",
          description: "Beli Beras",
          amount: 50000,
          category: "bahan",
          created_at: "2026-10-23T10:00:00Z",
        },
      ];

      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: (resolve: (val: unknown) => void) =>
          resolve({ data: mockExpenses, error: null }),
      };

      vi.mocked(createServerSupabaseClient).mockResolvedValue({
        from: vi.fn().mockReturnValue(mockQueryChain),
      } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>);

      const res = await getExpenses(new Request("http://localhost/api/admin/expenses?preset=today&category=bahan"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.expenses).toHaveLength(1);
      expect(body.expenses[0].id).toBe("exp-1");
    });

    it("mengembalikan 500 jika pengambilan pengeluaran gagal di database", async () => {
      vi.mocked(getAdminUser).mockResolvedValue({ id: "admin-1", email: "admin@warung.local" });

      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        then: (resolve: (val: unknown) => void) =>
          resolve({ data: null, error: { message: "DB error" } }),
      };

      vi.mocked(createServerSupabaseClient).mockResolvedValue({
        from: vi.fn().mockReturnValue(mockQueryChain),
      } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>);

      const res = await getExpenses(new Request("http://localhost/api/admin/expenses"));
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe("INTERNAL_SERVER_ERROR");
    });

    it("mengembalikan 400 jika preset tidak dikenal", async () => {
      vi.mocked(getAdminUser).mockResolvedValue({ id: "admin-1", email: "admin@warung.local" });
      const res = await getExpenses(new Request("http://localhost/api/admin/expenses?preset=mingguan"));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("BAD_REQUEST");
    });

    it("mengembalikan 400 jika kategori tidak valid", async () => {
      vi.mocked(getAdminUser).mockResolvedValue({ id: "admin-1", email: "admin@warung.local" });
      const res = await getExpenses(new Request("http://localhost/api/admin/expenses?category=investasi"));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("BAD_REQUEST");
    });

    it("mengembalikan 400 jika format tanggal tidak valid", async () => {
      vi.mocked(getAdminUser).mockResolvedValue({ id: "admin-1", email: "admin@warung.local" });
      const res = await getExpenses(new Request("http://localhost/api/admin/expenses?preset=custom&from=invalid&to=2026-10-23"));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("BAD_REQUEST");
    });

    it("mengembalikan 400 jika tanggal kalender tidak valid (misal 30 Februari)", async () => {
      vi.mocked(getAdminUser).mockResolvedValue({ id: "admin-1", email: "admin@warung.local" });
      const res = await getExpenses(new Request("http://localhost/api/admin/expenses?preset=custom&from=2026-02-30&to=2026-10-23"));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("BAD_REQUEST");
    });

    it("mengembalikan 400 jika rentang tanggal terbalik (from > to)", async () => {
      vi.mocked(getAdminUser).mockResolvedValue({ id: "admin-1", email: "admin@warung.local" });
      const res = await getExpenses(new Request("http://localhost/api/admin/expenses?preset=custom&from=2026-10-23&to=2026-10-20"));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("BAD_REQUEST");
    });

    it("mengembalikan 400 jika tanggal berada di masa depan", async () => {
      vi.mocked(getAdminUser).mockResolvedValue({ id: "admin-1", email: "admin@warung.local" });
      const res = await getExpenses(new Request("http://localhost/api/admin/expenses?preset=custom&from=2026-10-23&to=2099-01-01"));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("BAD_REQUEST");
    });
  });

  describe("POST /api/admin/expenses", () => {
    it("mengembalikan 401 pada POST jika bukan admin", async () => {
      vi.mocked(getAdminUser).mockResolvedValue(null);
      const req = new Request("http://localhost/api/admin/expenses", {
        method: "POST",
        body: JSON.stringify({ amount: 1000 }),
      });
      const res = await postExpense(req);
      expect(res.status).toBe(401);
    });

    it("mengembalikan 400 pada POST jika payload tidak valid", async () => {
      vi.mocked(getAdminUser).mockResolvedValue({ id: "admin-1", email: "admin@warung.local" });
      const req = new Request("http://localhost/api/admin/expenses", {
        method: "POST",
        body: JSON.stringify({ amount: -100 }),
      });
      const res = await postExpense(req);
      expect(res.status).toBe(400);
    });

    it("mengembalikan 201 pada POST jika berhasil menambahkan pengeluaran", async () => {
      vi.mocked(getAdminUser).mockResolvedValue({ id: "admin-1", email: "admin@warung.local" });

      const createdItem = {
        id: "exp-123",
        expense_date: "2026-10-23",
        description: "Beli Beras 5kg",
        amount: 75000,
        category: "bahan",
        created_at: "2026-10-23T10:00:00Z",
      };

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: createdItem, error: null }),
        }),
      });

      vi.mocked(createServerSupabaseClient).mockResolvedValue({
        from: vi.fn().mockReturnValue({ insert: mockInsert }),
      } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>);

      const req = new Request("http://localhost/api/admin/expenses", {
        method: "POST",
        body: JSON.stringify({
          expense_date: "2026-10-23",
          description: "Beli Beras 5kg",
          amount: 75000,
          category: "bahan",
        }),
      });
      const res = await postExpense(req);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.expense.id).toBe("exp-123");
    });

    it("mengembalikan 500 jika insert database gagal", async () => {
      vi.mocked(getAdminUser).mockResolvedValue({ id: "admin-1", email: "admin@warung.local" });

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } }),
        }),
      });

      vi.mocked(createServerSupabaseClient).mockResolvedValue({
        from: vi.fn().mockReturnValue({ insert: mockInsert }),
      } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>);

      const req = new Request("http://localhost/api/admin/expenses", {
        method: "POST",
        body: JSON.stringify({
          expense_date: "2026-10-23",
          description: "Beli Minyak",
          amount: 25000,
          category: "bahan",
        }),
      });
      const res = await postExpense(req);
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe("INTERNAL_SERVER_ERROR");
    });
  });

  describe("PATCH & DELETE /api/admin/expenses/[id]", () => {
    it("mengembalikan 401 pada PATCH jika bukan admin", async () => {
      vi.mocked(getAdminUser).mockResolvedValue(null);
      const req = new Request("http://localhost/api/admin/expenses/99999999-9999-9999-9999-999999999999", {
        method: "PATCH",
        body: JSON.stringify({ amount: 1000 }),
      });
      const res = await patchExpense(req, {
        params: Promise.resolve({ id: "99999999-9999-9999-9999-999999999999" }),
      });
      expect(res.status).toBe(401);
    });

    it("mengembalikan 400 pada PATCH jika format ID bukan uuid", async () => {
      vi.mocked(getAdminUser).mockResolvedValue({ id: "admin-1", email: "admin@warung.local" });
      const req = new Request("http://localhost/api/admin/expenses/invalid-uuid", {
        method: "PATCH",
        body: JSON.stringify({ amount: 1000 }),
      });
      const res = await patchExpense(req, {
        params: Promise.resolve({ id: "invalid-uuid" }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("BAD_REQUEST");
    });

    it("mengembalikan 400 pada PATCH jika body kosong", async () => {
      vi.mocked(getAdminUser).mockResolvedValue({ id: "admin-1", email: "admin@warung.local" });
      const req = new Request("http://localhost/api/admin/expenses/99999999-9999-9999-9999-999999999999", {
        method: "PATCH",
        body: JSON.stringify({}),
      });
      const res = await patchExpense(req, {
        params: Promise.resolve({ id: "99999999-9999-9999-9999-999999999999" }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("BAD_REQUEST");
    });

    it("mengembalikan 404 pada PATCH jika item tidak ditemukan", async () => {
      vi.mocked(getAdminUser).mockResolvedValue({ id: "admin-1", email: "admin@warung.local" });

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: "Not found" } }),
          }),
        }),
      });

      vi.mocked(createServerSupabaseClient).mockResolvedValue({
        from: vi.fn().mockReturnValue({ update: mockUpdate }),
      } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>);

      const req = new Request("http://localhost/api/admin/expenses/99999999-9999-9999-9999-999999999999", {
        method: "PATCH",
        body: JSON.stringify({ amount: 80000 }),
      });

      const res = await patchExpense(req, {
        params: Promise.resolve({ id: "99999999-9999-9999-9999-999999999999" }),
      });
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe("NOT_FOUND");
    });

    it("mengembalikan 200 pada PATCH jika pembaruan berhasil", async () => {
      vi.mocked(getAdminUser).mockResolvedValue({ id: "admin-1", email: "admin@warung.local" });

      const updatedItem = {
        id: "99999999-9999-9999-9999-999999999999",
        expense_date: "2026-10-23",
        description: "Beli Beras Premium 5kg",
        amount: 80000,
        category: "bahan",
        created_at: "2026-10-23T10:00:00Z",
      };

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: updatedItem, error: null }),
          }),
        }),
      });

      vi.mocked(createServerSupabaseClient).mockResolvedValue({
        from: vi.fn().mockReturnValue({ update: mockUpdate }),
      } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>);

      const req = new Request("http://localhost/api/admin/expenses/99999999-9999-9999-9999-999999999999", {
        method: "PATCH",
        body: JSON.stringify({
          description: "Beli Beras Premium 5kg",
          amount: 80000,
        }),
      });

      const res = await patchExpense(req, {
        params: Promise.resolve({ id: "99999999-9999-9999-9999-999999999999" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.expense.amount).toBe(80000);
    });

    it("mengembalikan 401 pada DELETE jika bukan admin", async () => {
      vi.mocked(getAdminUser).mockResolvedValue(null);
      const req = new Request("http://localhost/api/admin/expenses/99999999-9999-9999-9999-999999999999", {
        method: "DELETE",
      });
      const res = await deleteExpense(req, {
        params: Promise.resolve({ id: "99999999-9999-9999-9999-999999999999" }),
      });
      expect(res.status).toBe(401);
    });

    it("mengembalikan 400 pada DELETE jika format ID bukan uuid", async () => {
      vi.mocked(getAdminUser).mockResolvedValue({ id: "admin-1", email: "admin@warung.local" });
      const req = new Request("http://localhost/api/admin/expenses/invalid-uuid", {
        method: "DELETE",
      });
      const res = await deleteExpense(req, {
        params: Promise.resolve({ id: "invalid-uuid" }),
      });
      expect(res.status).toBe(400);
    });

    it("mengembalikan 200 pada DELETE jika penghapusan berhasil", async () => {
      vi.mocked(getAdminUser).mockResolvedValue({ id: "admin-1", email: "admin@warung.local" });

      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      vi.mocked(createServerSupabaseClient).mockResolvedValue({
        from: vi.fn().mockReturnValue({ delete: mockDelete }),
      } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>);

      const req = new Request("http://localhost/api/admin/expenses/99999999-9999-9999-9999-999999999999", {
        method: "DELETE",
      });

      const res = await deleteExpense(req, {
        params: Promise.resolve({ id: "99999999-9999-9999-9999-999999999999" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    it("mengembalikan 500 pada DELETE jika database error", async () => {
      vi.mocked(getAdminUser).mockResolvedValue({ id: "admin-1", email: "admin@warung.local" });

      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: "DB delete error" } }),
      });

      vi.mocked(createServerSupabaseClient).mockResolvedValue({
        from: vi.fn().mockReturnValue({ delete: mockDelete }),
      } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>);

      const req = new Request("http://localhost/api/admin/expenses/99999999-9999-9999-9999-999999999999", {
        method: "DELETE",
      });

      const res = await deleteExpense(req, {
        params: Promise.resolve({ id: "99999999-9999-9999-9999-999999999999" }),
      });
      expect(res.status).toBe(500);
    });
  });
});
