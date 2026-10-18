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
import { PATCH as updateCategoryHandler, DELETE as deleteCategoryHandler } from "./[id]/route";

describe("Categories API: /api/admin/categories", () => {
  const validAdmin = { id: "admin-1", email: "owner@test.com" };
  const validCatId = "a0000000-0000-0000-0000-000000000001";
  const validCatId2 = "a0000000-0000-0000-0000-000000000002";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/admin/categories", () => {
    it("menolak akses jika bukan pemilik warung (401)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(null);
      const res = await GET();
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain("Akses ditolak");
    });

    it("mengembalikan daftar kategori berurutan untuk pemilik (200)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      mockFrom.mockReturnValueOnce({
        select: () => ({
          order: () => ({
            order: () =>
              Promise.resolve({
                data: [
                  { id: validCatId, name: "Makanan Utama", sort_order: 0 },
                  { id: validCatId2, name: "Minuman Segar", sort_order: 1 },
                ],
                error: null,
              }),
          }),
        }),
      });

      const res = await GET();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toHaveLength(2);
      expect(json.data[0].name).toBe("Makanan Utama");
    });

    it("mengembalikan 500 jika Supabase query gagal", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      mockFrom.mockReturnValueOnce({
        select: () => ({
          order: () =>
            Promise.resolve({
              data: null,
              error: { message: "Database connection failed" },
            }),
        }),
      });

      const res = await GET();
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe("Database connection failed");
    });
  });

  describe("POST /api/admin/categories", () => {
    it("menolak akses jika bukan pemilik (401)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(null);
      const req = new Request("http://localhost/api/admin/categories", {
        method: "POST",
        body: JSON.stringify({ name: "Camilan" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("menolak jika body bukan format JSON valid (400)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const req = new Request("http://localhost/api/admin/categories", {
        method: "POST",
        body: "invalid-json",
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("Format request body tidak valid");
    });

    it("menolak jika nama kategori kosong (400)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const req = new Request("http://localhost/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "   " }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("Nama kategori wajib diisi");
    });

    it("berhasil menambahkan kategori baru dan memanggil revalidatePath (201)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const newCategory = { id: validCatId, name: "Camilan", sort_order: 2 };

      mockFrom.mockReturnValueOnce({
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: newCategory, error: null }),
          }),
        }),
      });

      const req = new Request("http://localhost/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Camilan", sort_order: 2 }),
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.name).toBe("Camilan");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/menu");
    });

    it("mengembalikan 403 jika RLS menolak operasi insert (42501)", async () => {
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

      const req = new Request("http://localhost/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Camilan" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain("hak akses pemilik");
    });
  });

  describe("PATCH /api/admin/categories (reorder)", () => {
    it("menolak akses jika bukan pemilik (401)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(null);
      const req = new Request("http://localhost/api/admin/categories", {
        method: "PATCH",
        body: JSON.stringify({ items: [{ id: validCatId, sort_order: 1 }] }),
      });
      const res = await reorderHandler(req);
      expect(res.status).toBe(401);
    });

    it("menolak jika items kosong atau tidak valid (400)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const req = new Request("http://localhost/api/admin/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [] }),
      });
      const res = await reorderHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("Daftar urutan tidak boleh kosong");
    });

    it("berhasil memperbarui urutan batch dan revalidate (200)", async () => {
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

      const req = new Request("http://localhost/api/admin/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            { id: validCatId, sort_order: 1 },
            { id: validCatId2, sort_order: 0 },
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

  describe("PATCH /api/admin/categories/[id]", () => {
    it("menolak akses jika bukan pemilik (401)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(null);
      const req = new Request(`http://localhost/api/admin/categories/${validCatId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: "Nama Baru" }),
      });
      const res = await updateCategoryHandler(req, {
        params: Promise.resolve({ id: validCatId }),
      });
      expect(res.status).toBe(401);
    });

    it("menolak jika ID kategori bukan UUID valid (400)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const req = new Request("http://localhost/api/admin/categories/invalid-id", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Nama Baru" }),
      });
      const res = await updateCategoryHandler(req, {
        params: Promise.resolve({ id: "invalid-id" }),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("ID kategori tidak valid");
    });

    it("menolak jika payload update kosong (400)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const req = new Request(`http://localhost/api/admin/categories/${validCatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const res = await updateCategoryHandler(req, {
        params: Promise.resolve({ id: validCatId }),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("Tidak ada data yang diperbarui");
    });

    it("mengembalikan 404 jika kategori tidak ditemukan", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      mockFrom.mockReturnValueOnce({
        update: () => ({
          eq: () => ({
            select: () => ({
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        }),
      });

      const req = new Request(`http://localhost/api/admin/categories/${validCatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Nama Baru" }),
      });
      const res = await updateCategoryHandler(req, {
        params: Promise.resolve({ id: validCatId }),
      });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toContain("Kategori tidak ditemukan");
    });

    it("berhasil memperbarui nama kategori (200)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const updated = { id: validCatId, name: "Makanan Favorit", sort_order: 0 };
      mockFrom.mockReturnValueOnce({
        update: () => ({
          eq: () => ({
            select: () => ({
              maybeSingle: () => Promise.resolve({ data: updated, error: null }),
            }),
          }),
        }),
      });

      const req = new Request(`http://localhost/api/admin/categories/${validCatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Makanan Favorit" }),
      });
      const res = await updateCategoryHandler(req, {
        params: Promise.resolve({ id: validCatId }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.name).toBe("Makanan Favorit");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/menu");
    });
  });

  describe("DELETE /api/admin/categories/[id]", () => {
    it("menolak akses jika bukan pemilik (401)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(null);
      const req = new Request(`http://localhost/api/admin/categories/${validCatId}`, {
        method: "DELETE",
      });
      const res = await deleteCategoryHandler(req, {
        params: Promise.resolve({ id: validCatId }),
      });
      expect(res.status).toBe(401);
    });

    it("menolak jika ID bukan UUID valid (400)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const req = new Request("http://localhost/api/admin/categories/bukan-uuid", {
        method: "DELETE",
      });
      const res = await deleteCategoryHandler(req, {
        params: Promise.resolve({ id: "bukan-uuid" }),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("ID kategori tidak valid");
    });

    it("menolak penghapusan jika kategori masih memiliki menu terkait (400)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      // Mock menu_items check finding 3 items
      mockFrom.mockReturnValueOnce({
        select: () => ({
          eq: () => Promise.resolve({ count: 3, error: null }),
        }),
      });

      const req = new Request(`http://localhost/api/admin/categories/${validCatId}`, {
        method: "DELETE",
      });
      const res = await deleteCategoryHandler(req, {
        params: Promise.resolve({ id: validCatId }),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe(
        "Kategori tidak dapat dihapus karena masih memiliki menu terkait."
      );
    });

    it("menangani foreign key violation constraint dari Postgres (code 23503 -> 400)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      // Menu items count check returns 0, but race condition occurs on delete
      mockFrom
        .mockReturnValueOnce({
          select: () => ({
            eq: () => Promise.resolve({ count: 0, error: null }),
          }),
        })
        .mockReturnValueOnce({
          delete: () => ({
            eq: () =>
              Promise.resolve({
                error: {
                  code: "23503",
                  message: 'update or delete on table "categories" violates foreign key constraint',
                },
              }),
          }),
        });

      const req = new Request(`http://localhost/api/admin/categories/${validCatId}`, {
        method: "DELETE",
      });
      const res = await deleteCategoryHandler(req, {
        params: Promise.resolve({ id: validCatId }),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe(
        "Kategori tidak dapat dihapus karena masih memiliki menu terkait."
      );
    });

    it("berhasil menghapus kategori kosong dan memanggil revalidatePath (200)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      mockFrom
        .mockReturnValueOnce({
          select: () => ({
            eq: () => Promise.resolve({ count: 0, error: null }),
          }),
        })
        .mockReturnValueOnce({
          delete: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        });

      const req = new Request(`http://localhost/api/admin/categories/${validCatId}`, {
        method: "DELETE",
      });
      const res = await deleteCategoryHandler(req, {
        params: Promise.resolve({ id: validCatId }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/menu");
    });
  });
});
