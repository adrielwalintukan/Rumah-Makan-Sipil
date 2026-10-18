import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock server-only
vi.mock("server-only", () => ({}));

// Mock next/cache
const mockRevalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => mockRevalidatePath(path),
}));

// Mock auth
const mockGetAdminUser = vi.fn();
vi.mock("@/lib/auth", () => ({
  getAdminUser: () => mockGetAdminUser(),
}));

// Mock Supabase
const mockFrom = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    from: mockFrom,
  }),
}));

import { GET, POST, PATCH as reorderHandler } from "./route";
import {
  GET as getMenuItemHandler,
  PATCH as updateMenuItemHandler,
  DELETE as deleteMenuItemHandler,
} from "./[id]/route";

describe("Menu Items API: /api/admin/menu", () => {
  const validAdmin = { id: "admin-1", email: "owner@test.com" };
  const validMenuId = "b0000000-0000-0000-0000-000000000001";
  const validMenuId2 = "b0000000-0000-0000-0000-000000000002";
  const validCatId = "a0000000-0000-0000-0000-000000000001";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/admin/menu", () => {
    it("menolak akses jika bukan pemilik warung (401)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(null);
      const req = new Request("http://localhost/api/admin/menu");
      const res = await GET(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain("Akses ditolak");
    });

    it("mengembalikan daftar menu aktif dengan status 200", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      mockFrom.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            order: () => ({
              order: () =>
                Promise.resolve({
                  data: [
                    {
                      id: validMenuId,
                      name: "Ayam Goreng Lengkuas",
                      price: 25000,
                      is_active: true,
                      category: { id: validCatId, name: "Makanan Utama" },
                    },
                    {
                      id: validMenuId2,
                      name: "Es Teh Manis",
                      price: 5000,
                      is_active: true,
                      category: { id: validCatId, name: "Minuman" },
                    },
                  ],
                  error: null,
                }),
            }),
          }),
        }),
      });

      const req = new Request("http://localhost/api/admin/menu");
      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toHaveLength(2);
      expect(json.data[0].name).toBe("Ayam Goreng Lengkuas");
    });

    it("mendukung filter query param category_id (200)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const mockEqCategory = vi.fn().mockReturnValue({
        order: () => ({
          order: () =>
            Promise.resolve({
              data: [
                {
                  id: validMenuId,
                  name: "Ayam Goreng Lengkuas",
                  price: 25000,
                  category_id: validCatId,
                  is_active: true,
                },
              ],
              error: null,
            }),
        }),
      });

      mockFrom.mockReturnValueOnce({
        select: () => ({
          eq: vi.fn().mockImplementation((col) => {
            if (col === "is_active") {
              return {
                eq: mockEqCategory,
                order: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
              };
            }
            return {
              order: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
            };
          }),
        }),
      });

      const req = new Request(`http://localhost/api/admin/menu?category_id=${validCatId}`);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toHaveLength(1);
    });

    it("mengembalikan 403 jika RLS menolak akses", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      mockFrom.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            order: () => ({
              order: () =>
                Promise.resolve({
                  data: null,
                  error: { code: "42501", message: "permission denied" },
                }),
            }),
          }),
        }),
      });

      const req = new Request("http://localhost/api/admin/menu");
      const res = await GET(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain("hak akses pemilik");
    });

    it("mengembalikan 500 jika query Supabase gagal", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      mockFrom.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            order: () => ({
              order: () =>
                Promise.resolve({
                  data: null,
                  error: { message: "Database connection failed" },
                }),
            }),
          }),
        }),
      });

      const req = new Request("http://localhost/api/admin/menu");
      const res = await GET(req);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe("Database connection failed");
    });
  });

  describe("POST /api/admin/menu", () => {
    const validPayload = {
      category_id: validCatId,
      name: "Ayam Bakar Madu",
      description: "Ayam bakar manis gurih",
      price: 28000,
      is_available: true,
      sort_order: 0,
    };

    it("menolak akses jika bukan pemilik (401)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(null);
      const req = new Request("http://localhost/api/admin/menu", {
        method: "POST",
        body: JSON.stringify(validPayload),
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("menolak jika body bukan format JSON valid (400)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const req = new Request("http://localhost/api/admin/menu", {
        method: "POST",
        body: "invalid-json",
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("Format request body tidak valid");
    });

    it("menolak jika nama menu kosong (400)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const req = new Request("http://localhost/api/admin/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validPayload, name: "   " }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("Nama menu wajib diisi");
    });

    it("menolak jika harga negatif (400)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const req = new Request("http://localhost/api/admin/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validPayload, price: -1000 }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("Harga tidak boleh negatif");
    });

    it("menolak jika harga berupa desimal / bukan bilangan bulat (400)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const req = new Request("http://localhost/api/admin/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validPayload, price: 25000.5 }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("Harga harus berupa bilangan bulat Rupiah");
    });

    it("menolak jika category_id bukan UUID valid (400)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const req = new Request("http://localhost/api/admin/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validPayload, category_id: "not-a-uuid" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("Kategori tidak valid");
    });

    it("berhasil menambahkan menu baru dan memanggil revalidatePath (201)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const createdItem = { id: validMenuId, ...validPayload, is_active: true };

      mockFrom.mockReturnValueOnce({
        insert: (insertData: unknown) => {
          expect(insertData).toMatchObject({
            name: "Ayam Bakar Madu",
            price: 28000,
            is_active: true,
          });
          return {
            select: () => ({
              single: () => Promise.resolve({ data: createdItem, error: null }),
            }),
          };
        },
      });

      const req = new Request("http://localhost/api/admin/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validPayload),
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.name).toBe("Ayam Bakar Madu");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/menu");
    });

    it("mengembalikan 403 jika RLS menolak insert", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      mockFrom.mockReturnValueOnce({
        insert: () => ({
          select: () => ({
            single: () =>
              Promise.resolve({
                data: null,
                error: { code: "42501", message: "permission denied" },
              }),
          }),
        }),
      });

      const req = new Request("http://localhost/api/admin/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validPayload),
      });
      const res = await POST(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain("hak akses pemilik");
    });
  });

  describe("PATCH /api/admin/menu (reorder)", () => {
    it("menolak akses jika bukan pemilik (401)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(null);
      const req = new Request("http://localhost/api/admin/menu", {
        method: "PATCH",
        body: JSON.stringify({ items: [{ id: validMenuId, sort_order: 1 }] }),
      });
      const res = await reorderHandler(req);
      expect(res.status).toBe(401);
    });

    it("menolak jika format JSON tidak valid (400)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const req = new Request("http://localhost/api/admin/menu", {
        method: "PATCH",
        body: "invalid-json",
      });
      const res = await reorderHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("Format request body tidak valid");
    });

    it("menolak jika daftar items kosong (400)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const req = new Request("http://localhost/api/admin/menu", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [] }),
      });
      const res = await reorderHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("Daftar urutan tidak boleh kosong");
    });

    it("berhasil memperbarui urutan menu secara batch dan revalidate (200)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);

      mockFrom
        .mockReturnValueOnce({
          update: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        })
        .mockReturnValueOnce({
          update: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        });

      const req = new Request("http://localhost/api/admin/menu", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            { id: validMenuId, sort_order: 1 },
            { id: validMenuId2, sort_order: 0 },
          ],
        }),
      });
      const res = await reorderHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/menu");
    });
  });

  describe("GET /api/admin/menu/[id]", () => {
    it("menolak akses jika bukan pemilik (401)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(null);
      const res = await getMenuItemHandler(new Request(`http://localhost/api/admin/menu/${validMenuId}`), {
        params: Promise.resolve({ id: validMenuId }),
      });
      expect(res.status).toBe(401);
    });

    it("menolak jika ID menu bukan UUID valid (400)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const res = await getMenuItemHandler(new Request("http://localhost/api/admin/menu/invalid-id"), {
        params: Promise.resolve({ id: "invalid-id" }),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("ID menu tidak valid");
    });

    it("mengembalikan 404 jika menu tidak ditemukan atau tidak aktif", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      mockFrom.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        }),
      });

      const res = await getMenuItemHandler(new Request(`http://localhost/api/admin/menu/${validMenuId}`), {
        params: Promise.resolve({ id: validMenuId }),
      });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toContain("Menu tidak ditemukan");
    });

    it("berhasil mengambil detail menu aktif (200)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const item = {
        id: validMenuId,
        name: "Ayam Penyet",
        price: 24000,
        is_active: true,
        category: { id: validCatId, name: "Makanan" },
      };

      mockFrom.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: item, error: null }),
            }),
          }),
        }),
      });

      const res = await getMenuItemHandler(new Request(`http://localhost/api/admin/menu/${validMenuId}`), {
        params: Promise.resolve({ id: validMenuId }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.name).toBe("Ayam Penyet");
    });
  });

  describe("PATCH /api/admin/menu/[id]", () => {
    it("menolak akses jika bukan pemilik (401)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(null);
      const req = new Request(`http://localhost/api/admin/menu/${validMenuId}`, {
        method: "PATCH",
        body: JSON.stringify({ is_available: false }),
      });
      const res = await updateMenuItemHandler(req, {
        params: Promise.resolve({ id: validMenuId }),
      });
      expect(res.status).toBe(401);
    });

    it("menolak jika ID menu bukan UUID valid (400)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const req = new Request("http://localhost/api/admin/menu/invalid-uuid", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_available: false }),
      });
      const res = await updateMenuItemHandler(req, {
        params: Promise.resolve({ id: "invalid-uuid" }),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("ID menu tidak valid");
    });

    it("menolak jika payload update kosong (400)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const req = new Request(`http://localhost/api/admin/menu/${validMenuId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const res = await updateMenuItemHandler(req, {
        params: Promise.resolve({ id: validMenuId }),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("Tidak ada data yang diperbarui");
    });

    it("berhasil melakukan toggle ketersediaan cepat is_available (200)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const updatedItem = { id: validMenuId, name: "Ayam Goreng", is_available: false };

      mockFrom.mockReturnValueOnce({
        update: (updatePayload: unknown) => {
          expect(updatePayload).toEqual({ is_available: false });
          return {
            eq: () => ({
              eq: () => ({
                select: () => ({
                  maybeSingle: () => Promise.resolve({ data: updatedItem, error: null }),
                }),
              }),
            }),
          };
        },
      });

      const req = new Request(`http://localhost/api/admin/menu/${validMenuId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_available: false }),
      });
      const res = await updateMenuItemHandler(req, {
        params: Promise.resolve({ id: validMenuId }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.is_available).toBe(false);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/menu");
    });

    it("berhasil update sebagian field (nama, harga) tanpa menimpa field lain dengan default Zod (200)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const updatedItem = {
        id: validMenuId,
        name: "Ayam Bakar Pedas Manis",
        price: 30000,
        description: "Deskripsi lama",
        is_available: true,
        sort_order: 3,
      };

      mockFrom.mockReturnValueOnce({
        update: (updatePayload: Record<string, unknown>) => {
          expect(updatePayload).toEqual({
            name: "Ayam Bakar Pedas Manis",
            price: 30000,
          });
          // Pastikan tidak ada default Zod yang tidak diinginkan seperti description = "" atau sort_order = 0
          expect(updatePayload.description).toBeUndefined();
          expect(updatePayload.sort_order).toBeUndefined();
          return {
            eq: () => ({
              eq: () => ({
                select: () => ({
                  maybeSingle: () => Promise.resolve({ data: updatedItem, error: null }),
                }),
              }),
            }),
          };
        },
      });

      const req = new Request(`http://localhost/api/admin/menu/${validMenuId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Ayam Bakar Pedas Manis",
          price: 30000,
        }),
      });
      const res = await updateMenuItemHandler(req, {
        params: Promise.resolve({ id: validMenuId }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.price).toBe(30000);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/menu");
    });

    it("menolak update jika harga negatif (400)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const req = new Request(`http://localhost/api/admin/menu/${validMenuId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price: -500 }),
      });
      const res = await updateMenuItemHandler(req, {
        params: Promise.resolve({ id: validMenuId }),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("Harga tidak boleh negatif");
    });

    it("mengembalikan 404 jika menu tidak ditemukan saat update", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      mockFrom.mockReturnValueOnce({
        update: () => ({
          eq: () => ({
            eq: () => ({
              select: () => ({
                maybeSingle: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
          }),
        }),
      });

      const req = new Request(`http://localhost/api/admin/menu/${validMenuId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_available: true }),
      });
      const res = await updateMenuItemHandler(req, {
        params: Promise.resolve({ id: validMenuId }),
      });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toContain("Menu tidak ditemukan");
    });
  });

  describe("DELETE /api/admin/menu/[id] (Soft Delete)", () => {
    it("menolak akses jika bukan pemilik (401)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(null);
      const res = await deleteMenuItemHandler(new Request(`http://localhost/api/admin/menu/${validMenuId}`, { method: "DELETE" }), {
        params: Promise.resolve({ id: validMenuId }),
      });
      expect(res.status).toBe(401);
    });

    it("menolak jika ID bukan UUID valid (400)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const res = await deleteMenuItemHandler(new Request("http://localhost/api/admin/menu/bukan-uuid", { method: "DELETE" }), {
        params: Promise.resolve({ id: "bukan-uuid" }),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("ID menu tidak valid");
    });

    it("melakukan HAPUS LUNAK (update is_active = false) dan BUKAN hard delete (200)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);

      let updateCalledWith: unknown = null;
      let deleteCalled = false;

      mockFrom.mockReturnValueOnce({
        delete: () => {
          deleteCalled = true;
          return { eq: () => Promise.resolve({ error: null }) };
        },
        update: (payload: unknown) => {
          updateCalledWith = payload;
          return {
            eq: () => ({
              eq: () => ({
                select: () => ({
                  maybeSingle: () => Promise.resolve({ data: { id: validMenuId }, error: null }),
                }),
              }),
            }),
          };
        },
      });

      const res = await deleteMenuItemHandler(new Request(`http://localhost/api/admin/menu/${validMenuId}`, { method: "DELETE" }), {
        params: Promise.resolve({ id: validMenuId }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);

      // Verifikasi bahwa update is_active: false dipanggil dan delete TIDAK dipanggil
      expect(deleteCalled).toBe(false);
      expect(updateCalledWith).toEqual({ is_active: false });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/menu");
    });

    it("mengembalikan 404 jika menu tidak ditemukan atau sudah tidak aktif", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      mockFrom.mockReturnValueOnce({
        update: () => ({
          eq: () => ({
            eq: () => ({
              select: () => ({
                maybeSingle: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
          }),
        }),
      });

      const res = await deleteMenuItemHandler(new Request(`http://localhost/api/admin/menu/${validMenuId}`, { method: "DELETE" }), {
        params: Promise.resolve({ id: validMenuId }),
      });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toContain("Menu tidak ditemukan");
    });
  });
});
