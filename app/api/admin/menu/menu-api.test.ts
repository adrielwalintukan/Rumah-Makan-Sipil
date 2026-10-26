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
const mockRpc = vi.fn();
const mockStorageRemove = vi.fn();
const mockStorageFrom = vi.fn().mockReturnValue({
  remove: mockStorageRemove,
});
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    from: mockFrom,
    rpc: mockRpc,
    storage: {
      from: mockStorageFrom,
    },
  }),
}));

import { MENU_PHOTOS_BUCKET } from "@/lib/storage";
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
    mockFrom.mockReset();
    mockRpc.mockReset();
    mockStorageRemove.mockReset();
    mockStorageFrom.mockClear();
    mockStorageRemove.mockResolvedValue({ data: [], error: null });
    mockGetAdminUser.mockReset();
    mockRevalidatePath.mockReset();
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

    it("menolak jika query param category_id bukan UUID valid (400)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      mockFrom.mockReturnValueOnce({
        select: () => ({
          eq: () => ({}),
        }),
      });
      const req = new Request("http://localhost/api/admin/menu?category_id=invalid-uuid");
      const res = await GET(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("ID kategori tidak valid");
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

      mockRpc.mockResolvedValueOnce({
        data: createdItem,
        error: null,
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
      expect(mockRpc).toHaveBeenCalledWith("save_menu_item_with_options", {
        p_menu_id: null,
        p_item: {
          category_id: validCatId,
          name: validPayload.name,
          description: validPayload.description,
          price: validPayload.price,
          image_path: null,
          is_available: true,
          sort_order: 0,
        },
        p_groups: [],
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/menu");
    });

    it("meneruskan sort_order ke RPC jika disediakan pada menu baru (201)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const payloadWithSort = {
        ...validPayload,
        sort_order: 5,
      };

      mockRpc.mockResolvedValueOnce({
        data: { id: validMenuId, ...payloadWithSort, is_active: true },
        error: null,
      });

      const req = new Request("http://localhost/api/admin/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadWithSort),
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      expect(mockRpc).toHaveBeenCalledWith("save_menu_item_with_options", {
        p_menu_id: null,
        p_item: expect.objectContaining({ sort_order: 5 }),
        p_groups: [],
      });
    });

    it("mengizinkan menu baru tanpa sort_order eksplisit (sort_order undefined ke RPC)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const payloadWithoutSortOrder = {
        category_id: validPayload.category_id,
        name: validPayload.name,
        description: validPayload.description,
        price: validPayload.price,
        is_available: validPayload.is_available,
      };

      mockRpc.mockResolvedValueOnce({
        data: { id: validMenuId, ...payloadWithoutSortOrder, sort_order: 0, is_active: true },
        error: null,
      });

      const req = new Request("http://localhost/api/admin/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadWithoutSortOrder),
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      expect(mockRpc).toHaveBeenCalledWith("save_menu_item_with_options", {
        p_menu_id: null,
        p_item: expect.objectContaining({ sort_order: undefined }),
        p_groups: [],
      });
    });

    it("mengembalikan 500 jika RPC save_menu_item_with_options gagal", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: "Database connection lost" },
      });

      const req = new Request("http://localhost/api/admin/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validPayload),
      });
      const res = await POST(req);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe("Database connection lost");
    });

    it("mengembalikan 400 jika RPC save_menu_item_with_options mengembalikan error validasi / constraint (22023)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { code: "22023", message: "Harga tidak valid" },
      });

      const req = new Request("http://localhost/api/admin/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validPayload),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Harga tidak valid");
    });

    it("mengembalikan 403 jika RPC save_menu_item_with_options ditolak hak akses pemilik (42501)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { code: "42501", message: "Akses ditolak" },
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

    it("berhasil menambahkan menu baru dengan image_path (201)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      mockRpc.mockResolvedValueOnce({
        data: {
          id: validMenuId,
          ...validPayload,
          image_path: "items/menu-ayam.webp",
          is_active: true,
        },
        error: null,
      });

      const req = new Request("http://localhost/api/admin/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...validPayload,
          image_path: "items/menu-ayam.webp",
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      expect(mockRpc).toHaveBeenCalledWith("save_menu_item_with_options", {
        p_menu_id: null,
        p_item: expect.objectContaining({
          image_path: "items/menu-ayam.webp",
        }),
        p_groups: [],
      });
    });

    it("menolak request jika image_path bukan format relatif items/ yang diizinkan (400)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const req = new Request("http://localhost/api/admin/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...validPayload,
          image_path: "https://evil.com/hack.jpg",
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("Format path foto tidak valid");
    });

    it("berhasil menambahkan menu baru dengan option_groups dan options bersarang via RPC (201)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const payloadWithOptions = {
        category_id: validCatId,
        name: "Kopi Susu Gula Aren",
        description: "Kopi susu nikmat",
        price: 18000,
        is_available: true,
        sort_order: 0,
        option_groups: [
          {
            name: "Level Manis",
            type: "single" as const,
            required: true,
            sort_order: 0,
            options: [
              { name: "Normal", price_delta: 0, is_available: true, sort_order: 0 },
              { name: "Less Sugar", price_delta: 0, is_available: true, sort_order: 1 },
            ],
          },
        ],
      };

      const createdItem = {
        id: validMenuId,
        ...payloadWithOptions,
        is_active: true,
      };

      mockRpc.mockResolvedValueOnce({
        data: createdItem,
        error: null,
      });

      const req = new Request("http://localhost/api/admin/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadWithOptions),
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.name).toBe("Kopi Susu Gula Aren");
      expect(json.data.option_groups).toHaveLength(1);
      expect(mockRpc).toHaveBeenCalledWith("save_menu_item_with_options", {
        p_menu_id: null,
        p_item: {
          category_id: validCatId,
          name: "Kopi Susu Gula Aren",
          description: "Kopi susu nikmat",
          price: 18000,
          image_path: null,
          is_available: true,
          sort_order: 0,
        },
        p_groups: payloadWithOptions.option_groups,
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/menu");
    });

    it("menolak jika grup pilihan tidak memiliki opsi pada menu baru (400)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const req = new Request("http://localhost/api/admin/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...validPayload,
          option_groups: [
            {
              name: "Suhu",
              type: "single",
              required: true,
              sort_order: 0,
              options: [],
            },
          ],
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("Setiap grup pilihan wajib memiliki minimal 1 opsi");
    });

    it("menolak jika ada nama opsi duplikat dalam satu grup pada menu baru (400)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const req = new Request("http://localhost/api/admin/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...validPayload,
          option_groups: [
            {
              name: "Suhu",
              type: "single",
              required: true,
              sort_order: 0,
              options: [
                { name: "Panas", price_delta: 0, is_available: true, sort_order: 0 },
                { name: "panas", price_delta: 0, is_available: true, sort_order: 1 },
              ],
            },
          ],
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("tidak boleh duplikat");
    });

    it("menolak jika ada nama grup duplikat dalam satu menu pada menu baru (400)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const req = new Request("http://localhost/api/admin/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...validPayload,
          option_groups: [
            {
              name: "Varian",
              type: "single",
              required: true,
              sort_order: 0,
              options: [{ name: "A", price_delta: 0, is_available: true, sort_order: 0 }],
            },
            {
              name: "varian",
              type: "single",
              required: false,
              sort_order: 1,
              options: [{ name: "B", price_delta: 0, is_available: true, sort_order: 0 }],
            },
          ],
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("tidak boleh duplikat");
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

    it("menolak jika payload reorder berisi properti tidak dikenal (400)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const req = new Request("http://localhost/api/admin/menu", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ id: validMenuId, sort_order: 1 }],
          extra_key: "forbidden",
        }),
      });
      const res = await reorderHandler(req);
      expect(res.status).toBe(400);
    });

    it("berhasil memperbarui urutan menu via RPC dan revalidate (200)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      mockRpc.mockResolvedValueOnce({ error: null });

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
      expect(mockRpc).toHaveBeenCalledWith("reorder_menu_items", {
        p_items: [
          { id: validMenuId, sort_order: 1 },
          { id: validMenuId2, sort_order: 0 },
        ],
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/menu");
    });

    it("mengembalikan 403 jika RPC reorder ditolak izin RLS (42501)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      mockRpc.mockResolvedValueOnce({
        error: { code: "42501", message: "permission denied" },
      });

      const req = new Request("http://localhost/api/admin/menu", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ id: validMenuId, sort_order: 1 }],
        }),
      });
      const res = await reorderHandler(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain("hak akses pemilik");
    });

    it("mengembalikan 404 jika ada ID menu yang tidak ditemukan atau tidak aktif (P0002)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      mockRpc.mockResolvedValueOnce({
        error: { code: "P0002", message: "Menu tidak ditemukan atau tidak aktif." },
      });

      const req = new Request("http://localhost/api/admin/menu", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ id: validMenuId, sort_order: 1 }],
        }),
      });
      const res = await reorderHandler(req);
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toContain("Menu tidak ditemukan atau tidak aktif");
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

    it("berhasil mengambil detail menu aktif beserta option_groups dan options terurut sort_order asc, name asc (200)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const item = {
        id: validMenuId,
        name: "Kopi Tubruk",
        price: 10000,
        is_active: true,
        category: { id: validCatId, name: "Minuman" },
        option_groups: [
          {
            id: "g2",
            name: "Topping",
            type: "multiple",
            required: false,
            sort_order: 1,
            options: [
              { id: "o2", name: "Jelly", price_delta: 2000, is_available: true, sort_order: 1 },
              { id: "o1", name: "Cincau", price_delta: 2000, is_available: true, sort_order: 0 },
            ],
          },
          {
            id: "g1",
            name: "Suhu",
            type: "single",
            required: true,
            sort_order: 0,
            options: [
              { id: "o4", name: "Panas", price_delta: 0, is_available: true, sort_order: 0 },
            ],
          },
        ],
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
      expect(json.data.name).toBe("Kopi Tubruk");
      expect(json.data.option_groups).toHaveLength(2);
      // Terurut: sort_order 0 (Suhu) duluan baru sort_order 1 (Topping)
      expect(json.data.option_groups[0].name).toBe("Suhu");
      expect(json.data.option_groups[1].name).toBe("Topping");
      // Di dalam Topping, Cincau (sort_order 0) duluan baru Jelly (sort_order 1)
      expect(json.data.option_groups[1].options[0].name).toBe("Cincau");
      expect(json.data.option_groups[1].options[1].name).toBe("Jelly");
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

    it("berhasil toggle menu unggulan is_featured (200)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const updatedItem = { id: validMenuId, name: "Ayam Goreng", is_featured: true };

      mockFrom.mockReturnValueOnce({
        update: (updatePayload: unknown) => {
          expect(updatePayload).toEqual({ is_featured: true });
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
        body: JSON.stringify({ is_featured: true }),
      });
      const res = await updateMenuItemHandler(req, {
        params: Promise.resolve({ id: validMenuId }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.is_featured).toBe(true);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/");
    });

    it("mengembalikan 404 saat toggle menu unggulan pada menu nonaktif/terhapus", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const isActiveFilters: unknown[] = [];

      mockFrom.mockReturnValueOnce({
        update: () => ({
          eq: () => ({
            eq: (column: string, value: unknown) => {
              isActiveFilters.push([column, value]);
              return {
                select: () => ({
                  maybeSingle: () => Promise.resolve({ data: null, error: null }),
                }),
              };
            },
          }),
        }),
      });

      const req = new Request(`http://localhost/api/admin/menu/${validMenuId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_featured: true }),
      });
      const res = await updateMenuItemHandler(req, {
        params: Promise.resolve({ id: validMenuId }),
      });
      expect(res.status).toBe(404);
      expect(isActiveFilters).toEqual([["is_active", true]]);
    });

    it("menolak toggle menu unggulan dengan nilai bukan boolean (400)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const req = new Request(`http://localhost/api/admin/menu/${validMenuId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_featured: "ya" }),
      });
      const res = await updateMenuItemHandler(req, {
        params: Promise.resolve({ id: validMenuId }),
      });
      expect(res.status).toBe(400);
      expect(mockFrom).not.toHaveBeenCalled();
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

    it("menolak update jika memuat properti asing tidak dikenal (400)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const req = new Request(`http://localhost/api/admin/menu/${validMenuId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Ayam Madu", unknown_field: "hacked" }),
      });
      const res = await updateMenuItemHandler(req, {
        params: Promise.resolve({ id: validMenuId }),
      });
      expect(res.status).toBe(400);
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

    it("menentukan sort_order otomatis di akhir kategori tujuan saat memindahkan kategori tanpa sort_order eksplisit (200)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const targetCatId = "a0000000-0000-0000-0000-000000000099";

      // 1. Ambil data menu saat ini (category_id lama)
      mockFrom.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { category_id: validCatId },
                  error: null,
                }),
            }),
          }),
        }),
      });

      // 2. Ambil max sort_order dari kategori tujuan (misal 7)
      mockFrom.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: () =>
                    Promise.resolve({
                      data: { sort_order: 7 },
                      error: null,
                    }),
                }),
              }),
            }),
          }),
        }),
      });

      // 3. Jalankan update dengan sort_order: 8
      let updatedPayload: Record<string, unknown> | null = null;
      mockFrom.mockReturnValueOnce({
        update: (payload: Record<string, unknown>) => {
          updatedPayload = payload;
          return {
            eq: () => ({
              eq: () => ({
                select: () => ({
                  maybeSingle: () =>
                    Promise.resolve({
                      data: {
                        id: validMenuId,
                        category_id: targetCatId,
                        sort_order: payload.sort_order,
                      },
                      error: null,
                    }),
                }),
              }),
            }),
          };
        },
      });

      const req = new Request(`http://localhost/api/admin/menu/${validMenuId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_id: targetCatId }),
      });
      const res = await updateMenuItemHandler(req, {
        params: Promise.resolve({ id: validMenuId }),
      });

      expect(res.status).toBe(200);
      expect(updatedPayload).toEqual({
        category_id: targetCatId,
        sort_order: 8,
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/menu");
    });

    it("mempertahankan sort_order eksplisit jika disertakan saat memindahkan kategori (200)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const targetCatId = "a0000000-0000-0000-0000-000000000099";

      let updatedPayload: Record<string, unknown> | null = null;
      mockFrom.mockReturnValueOnce({
        update: (payload: Record<string, unknown>) => {
          updatedPayload = payload;
          return {
            eq: () => ({
              eq: () => ({
                select: () => ({
                  maybeSingle: () =>
                    Promise.resolve({
                      data: {
                        id: validMenuId,
                        category_id: targetCatId,
                        sort_order: 2,
                      },
                      error: null,
                    }),
                }),
              }),
            }),
          };
        },
      });

      const req = new Request(`http://localhost/api/admin/menu/${validMenuId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_id: targetCatId, sort_order: 2 }),
      });
      const res = await updateMenuItemHandler(req, {
        params: Promise.resolve({ id: validMenuId }),
      });

      expect(res.status).toBe(200);
      expect(updatedPayload).toEqual({
        category_id: targetCatId,
        sort_order: 2,
      });
    });

    it("mengembalikan 500 jika query sort_order maksimum kategori tujuan gagal saat pindah kategori", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const targetCatId = "a0000000-0000-0000-0000-000000000099";

      // 1. Current item query
      mockFrom.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { category_id: validCatId },
                  error: null,
                }),
            }),
          }),
        }),
      });

      // 2. Max sort_order query fails
      mockFrom.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: () =>
                    Promise.resolve({
                      data: null,
                      error: { message: "Database timeout" },
                    }),
                }),
              }),
            }),
          }),
        }),
      });

      const req = new Request(`http://localhost/api/admin/menu/${validMenuId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_id: targetCatId }),
      });
      const res = await updateMenuItemHandler(req, {
        params: Promise.resolve({ id: validMenuId }),
      });

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe("Database timeout");
    });

    it("mengembalikan 403 jika query sort_order maksimum kategori tujuan ditolak RLS saat pindah kategori", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const targetCatId = "a0000000-0000-0000-0000-000000000099";

      // 1. Current item query
      mockFrom.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { category_id: validCatId },
                  error: null,
                }),
            }),
          }),
        }),
      });

      // 2. Max sort_order query RLS denied
      mockFrom.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: () =>
                    Promise.resolve({
                      data: null,
                      error: { code: "42501", message: "permission denied" },
                    }),
                }),
              }),
            }),
          }),
        }),
      });

      const req = new Request(`http://localhost/api/admin/menu/${validMenuId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_id: targetCatId }),
      });
      const res = await updateMenuItemHandler(req, {
        params: Promise.resolve({ id: validMenuId }),
      });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain("hak akses pemilik");
    });

    it("berhasil memperbarui image_path dan menghapus foto lama dari storage jika berbeda (200)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const oldImage = "items/foto-lama.webp";
      const newImage = "items/foto-baru.webp";

      // 1. Query fetch oldImagePath
      mockFrom.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { image_path: oldImage },
                  error: null,
                }),
            }),
          }),
        }),
      });

      // 2. Query update
      let updatedPayload: Record<string, unknown> | null = null;
      mockFrom.mockReturnValueOnce({
        update: (payload: Record<string, unknown>) => {
          updatedPayload = payload;
          return {
            eq: () => ({
              eq: () => ({
                select: () => ({
                  maybeSingle: () =>
                    Promise.resolve({
                      data: {
                        id: validMenuId,
                        name: "Ayam Goreng",
                        image_path: payload.image_path,
                      },
                      error: null,
                    }),
                }),
              }),
            }),
          };
        },
      });

      // 3. Query count remaining references (tidak ada menu lain yang memakai foto ini)
      mockFrom.mockReturnValueOnce({
        select: () => ({
          eq: () =>
            Promise.resolve({
              count: 0,
              error: null,
            }),
        }),
      });

      const req = new Request(`http://localhost/api/admin/menu/${validMenuId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_path: newImage }),
      });
      const res = await updateMenuItemHandler(req, {
        params: Promise.resolve({ id: validMenuId }),
      });

      expect(res.status).toBe(200);
      expect(updatedPayload).toEqual({ image_path: newImage });
      expect(mockStorageFrom).toHaveBeenCalledWith(MENU_PHOTOS_BUCKET);
      expect(mockStorageRemove).toHaveBeenCalledWith([oldImage]);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/menu");
    });

    it("berhasil menghapus foto (image_path: null) dan membersihkan file lama dari storage (200)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const oldImage = "items/foto-lama.webp";

      // 1. Query fetch oldImagePath
      mockFrom.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { image_path: oldImage },
                  error: null,
                }),
            }),
          }),
        }),
      });

      // 2. Query update
      let updatedPayload: Record<string, unknown> | null = null;
      mockFrom.mockReturnValueOnce({
        update: (payload: Record<string, unknown>) => {
          updatedPayload = payload;
          return {
            eq: () => ({
              eq: () => ({
                select: () => ({
                  maybeSingle: () =>
                    Promise.resolve({
                      data: {
                        id: validMenuId,
                        name: "Ayam Goreng",
                        image_path: payload.image_path,
                      },
                      error: null,
                    }),
                }),
              }),
            }),
          };
        },
      });

      // 3. Query count remaining references (tidak ada menu lain yang memakai foto ini)
      mockFrom.mockReturnValueOnce({
        select: () => ({
          eq: () =>
            Promise.resolve({
              count: 0,
              error: null,
            }),
        }),
      });

      const req = new Request(`http://localhost/api/admin/menu/${validMenuId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_path: null }),
      });
      const res = await updateMenuItemHandler(req, {
        params: Promise.resolve({ id: validMenuId }),
      });

      expect(res.status).toBe(200);
      expect(updatedPayload).toEqual({ image_path: null });
      expect(mockStorageFrom).toHaveBeenCalledWith(MENU_PHOTOS_BUCKET);
      expect(mockStorageRemove).toHaveBeenCalledWith([oldImage]);
    });

    it("tidak memicu penghapusan storage jika image_path tidak berubah (200)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const sameImage = "items/foto-tetap.webp";

      // 1. Query fetch oldImagePath
      mockFrom.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { image_path: sameImage },
                  error: null,
                }),
            }),
          }),
        }),
      });

      // 2. Query update
      mockFrom.mockReturnValueOnce({
        update: () => ({
          eq: () => ({
            eq: () => ({
              select: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: {
                      id: validMenuId,
                      name: "Ayam Goreng",
                      image_path: sameImage,
                    },
                    error: null,
                  }),
              }),
            }),
          }),
        }),
      });

      const req = new Request(`http://localhost/api/admin/menu/${validMenuId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_path: sameImage }),
      });
      const res = await updateMenuItemHandler(req, {
        params: Promise.resolve({ id: validMenuId }),
      });

      expect(res.status).toBe(200);
      expect(mockStorageRemove).not.toHaveBeenCalled();
    });

    it("tidak memicu penghapusan storage jika menu sebelumnya tidak memiliki foto (200)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const newImage = "items/foto-pertama.webp";

      // 1. Query fetch oldImagePath (null)
      mockFrom.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { image_path: null },
                  error: null,
                }),
            }),
          }),
        }),
      });

      // 2. Query update
      mockFrom.mockReturnValueOnce({
        update: () => ({
          eq: () => ({
            eq: () => ({
              select: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: {
                      id: validMenuId,
                      name: "Ayam Goreng",
                      image_path: newImage,
                    },
                    error: null,
                  }),
              }),
            }),
          }),
        }),
      });

      const req = new Request(`http://localhost/api/admin/menu/${validMenuId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_path: newImage }),
      });
      const res = await updateMenuItemHandler(req, {
        params: Promise.resolve({ id: validMenuId }),
      });

      expect(res.status).toBe(200);
      expect(mockStorageRemove).not.toHaveBeenCalled();
    });

    it("tetap sukses mengembalikan 200 jika storage remove gagal atau melempar error (defensive try-catch)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const oldImage = "items/foto-lama.webp";
      const newImage = "items/foto-baru.webp";

      // Storage remove melempar error
      mockStorageRemove.mockRejectedValueOnce(new Error("Storage connection timeout"));

      // 1. Query fetch oldImagePath
      mockFrom.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { image_path: oldImage },
                  error: null,
                }),
            }),
          }),
        }),
      });

      // 2. Query update
      mockFrom.mockReturnValueOnce({
        update: () => ({
          eq: () => ({
            eq: () => ({
              select: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: {
                      id: validMenuId,
                      name: "Ayam Goreng",
                      image_path: newImage,
                    },
                    error: null,
                  }),
              }),
            }),
          }),
        }),
      });

      // 3. Query count remaining references (tidak ada menu lain yang memakai foto ini)
      mockFrom.mockReturnValueOnce({
        select: () => ({
          eq: () =>
            Promise.resolve({
              count: 0,
              error: null,
            }),
        }),
      });

      const req = new Request(`http://localhost/api/admin/menu/${validMenuId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_path: newImage }),
      });
      const res = await updateMenuItemHandler(req, {
        params: Promise.resolve({ id: validMenuId }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.image_path).toBe(newImage);
      expect(mockStorageRemove).toHaveBeenCalledWith([oldImage]);
    });

    it("tidak memicu penghapusan storage jika foto lama masih direferensikan oleh menu lain (remainingCount > 0)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const oldImage = "items/foto-bersama.webp";
      const newImage = "items/foto-baru.webp";

      // 1. Query fetch oldImagePath
      mockFrom.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { image_path: oldImage },
                  error: null,
                }),
            }),
          }),
        }),
      });

      // 2. Query update
      mockFrom.mockReturnValueOnce({
        update: () => ({
          eq: () => ({
            eq: () => ({
              select: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: {
                      id: validMenuId,
                      name: "Ayam Goreng",
                      image_path: newImage,
                    },
                    error: null,
                  }),
              }),
            }),
          }),
        }),
      });

      // 3. Query count remaining references (masih ada 1 menu lain yang memakai foto ini)
      mockFrom.mockReturnValueOnce({
        select: () => ({
          eq: () =>
            Promise.resolve({
              count: 1,
              error: null,
            }),
        }),
      });

      const req = new Request(`http://localhost/api/admin/menu/${validMenuId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_path: newImage }),
      });
      const res = await updateMenuItemHandler(req, {
        params: Promise.resolve({ id: validMenuId }),
      });

      expect(res.status).toBe(200);
      // Memastikan storage.remove TIDAK dipanggil karena foto masih dipakai menu lain
      expect(mockStorageRemove).not.toHaveBeenCalled();
    });

    it("menolak request jika image_path bukan format relatif items/ yang diizinkan (400)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const req = new Request(`http://localhost/api/admin/menu/${validMenuId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_path: "items/../evil.webp" }),
      });
      const res = await updateMenuItemHandler(req, {
        params: Promise.resolve({ id: validMenuId }),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("Format path foto tidak valid");
    });

    it("berhasil memperbarui option_groups via RPC save_menu_item_with_options (200)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const groupsPayload = [
        {
          name: "Varian Rasa",
          type: "single" as const,
          required: true,
          sort_order: 0,
          options: [
            { name: "Cokelat", price_delta: 0, is_available: true, sort_order: 0 },
            { name: "Keju", price_delta: 2000, is_available: true, sort_order: 1 },
          ],
        },
      ];

      const rpcResult = {
        id: validMenuId,
        name: "Roti Bakar",
        option_groups: groupsPayload,
      };

      mockRpc.mockResolvedValueOnce({
        data: rpcResult,
        error: null,
      });

      const req = new Request(`http://localhost/api/admin/menu/${validMenuId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ option_groups: groupsPayload }),
      });
      const res = await updateMenuItemHandler(req, {
        params: Promise.resolve({ id: validMenuId }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.name).toBe("Roti Bakar");
      expect(mockRpc).toHaveBeenCalledWith("save_menu_item_with_options", {
        p_menu_id: validMenuId,
        p_item: {},
        p_groups: groupsPayload,
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/menu");
    });

    it("menolak update jika grup pilihan tidak memiliki opsi (400)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const req = new Request(`http://localhost/api/admin/menu/${validMenuId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          option_groups: [
            {
              name: "Suhu",
              type: "single",
              required: true,
              sort_order: 0,
              options: [],
            },
          ],
        }),
      });
      const res = await updateMenuItemHandler(req, {
        params: Promise.resolve({ id: validMenuId }),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("Setiap grup pilihan wajib memiliki minimal 1 opsi");
    });

    it("menolak update jika nama opsi duplikat dalam satu grup (400)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const req = new Request(`http://localhost/api/admin/menu/${validMenuId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          option_groups: [
            {
              name: "Suhu",
              type: "single",
              required: true,
              sort_order: 0,
              options: [
                { name: "Panas", price_delta: 0, is_available: true, sort_order: 0 },
                { name: "panas", price_delta: 0, is_available: true, sort_order: 1 },
              ],
            },
          ],
        }),
      });
      const res = await updateMenuItemHandler(req, {
        params: Promise.resolve({ id: validMenuId }),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("tidak boleh duplikat");
    });

    it("menolak update jika nama grup duplikat dalam menu (400)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const req = new Request(`http://localhost/api/admin/menu/${validMenuId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          option_groups: [
            {
              name: "Varian",
              type: "single",
              required: true,
              sort_order: 0,
              options: [{ name: "A", price_delta: 0, is_available: true, sort_order: 0 }],
            },
            {
              name: "varian",
              type: "single",
              required: false,
              sort_order: 1,
              options: [{ name: "B", price_delta: 0, is_available: true, sort_order: 0 }],
            },
          ],
        }),
      });
      const res = await updateMenuItemHandler(req, {
        params: Promise.resolve({ id: validMenuId }),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("tidak boleh duplikat");
    });

    it("berhasil memperbarui image_path dan option_groups sekaligus serta membersihkan foto lama dari storage (200)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const oldImage = "items/foto-lama-options.webp";
      const newImage = "items/foto-baru-options.webp";
      const groupsPayload = [
        {
          name: "Suhu",
          type: "single" as const,
          required: true,
          sort_order: 0,
          options: [
            { name: "Panas", price_delta: 0, is_available: true, sort_order: 0 },
          ],
        },
      ];

      // 1. Fetch oldImagePath
      mockFrom.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { image_path: oldImage },
                  error: null,
                }),
            }),
          }),
        }),
      });

      // 2. RPC call
      mockRpc.mockResolvedValueOnce({
        data: {
          id: validMenuId,
          name: "Kopi Baru",
          image_path: newImage,
          option_groups: groupsPayload,
        },
        error: null,
      });

      // 3. Count remaining references
      mockFrom.mockReturnValueOnce({
        select: () => ({
          eq: () =>
            Promise.resolve({
              count: 0,
              error: null,
            }),
        }),
      });

      const req = new Request(`http://localhost/api/admin/menu/${validMenuId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_path: newImage,
          option_groups: groupsPayload,
        }),
      });
      const res = await updateMenuItemHandler(req, {
        params: Promise.resolve({ id: validMenuId }),
      });

      expect(res.status).toBe(200);
      expect(mockRpc).toHaveBeenCalledWith("save_menu_item_with_options", {
        p_menu_id: validMenuId,
        p_item: { image_path: newImage },
        p_groups: groupsPayload,
      });
      expect(mockStorageFrom).toHaveBeenCalledWith(MENU_PHOTOS_BUCKET);
      expect(mockStorageRemove).toHaveBeenCalledWith([oldImage]);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/menu");
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
