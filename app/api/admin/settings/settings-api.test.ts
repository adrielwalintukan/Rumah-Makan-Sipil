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
const mockStorageRemove = vi.fn();
const mockStorageFrom = vi.fn().mockReturnValue({
  remove: (...args: unknown[]) => mockStorageRemove(...args),
});

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    from: mockFrom,
    storage: {
      from: mockStorageFrom,
    },
  }),
}));

import { STORE_BUCKET } from "@/lib/storage";
import { GET, PATCH } from "./route";

interface MockQueryChain {
  select: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
}

function createQueryChain(result: { data: unknown; error: unknown }): MockQueryChain {
  const chain: Partial<MockQueryChain> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue(result);
  return chain as MockQueryChain;
}

describe("Admin Settings API: /api/admin/settings", () => {
  const validAdmin = { id: "admin-uuid", email: "owner@rumahmakansipil.com" };

  const sampleSettings = {
    store_name: "Rumah Makan Sipil",
    tagline: "Makan Enak, Setiap Hari",
    whatsapp_number: "62895806567230",
    dos_price: 25000,
    qris_image_path: "qris/initial-qris.webp",
    is_open: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReset();
    mockStorageRemove.mockReset();
    mockStorageFrom.mockClear();
    mockStorageRemove.mockResolvedValue({ data: [], error: null });
    mockGetAdminUser.mockReset();
    mockRevalidatePath.mockReset();
  });

  describe("GET /api/admin/settings", () => {
    it("menolak akses jika bukan sesi pemilik (401)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(null);

      const res = await GET();
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe("Akses ditolak. Sesi pemilik diperlukan.");
    });

    it("mengembalikan data pengaturan toko lengkap (200)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const chain = createQueryChain({ data: sampleSettings, error: null });
      mockFrom.mockReturnValueOnce(chain);

      const res = await GET();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual(sampleSettings);
      expect(mockFrom).toHaveBeenCalledWith("settings");
      expect(chain.select).toHaveBeenCalledWith(
        "store_name, tagline, whatsapp_number, dos_price, qris_image_path, is_open"
      );
      expect(chain.eq).toHaveBeenCalledWith("id", 1);
      expect(chain.single).toHaveBeenCalled();
    });

    it("mengembalikan 500 jika query database gagal", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const chain = createQueryChain({
        data: null,
        error: { message: "Database connection failed" },
      });
      mockFrom.mockReturnValueOnce(chain);

      const res = await GET();
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe("Database connection failed");
    });
  });

  describe("PATCH /api/admin/settings", () => {
    it("menolak akses jika bukan sesi pemilik (401)", async () => {
      mockGetAdminUser.mockResolvedValueOnce(null);
      const req = new Request("http://localhost/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_open: false }),
      });

      const res = await PATCH(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe("Akses ditolak. Sesi pemilik diperlukan.");
    });

    it("mengembalikan 400 jika body bukan format JSON valid", async () => {
      mockGetAdminUser.mockResolvedValueOnce(validAdmin);
      const req = new Request("http://localhost/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "invalid json string {",
      });

      const res = await PATCH(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Format request body tidak valid.");
    });

    describe("Validasi Zod (400)", () => {
      it("menolak jika nama toko kosong", async () => {
        mockGetAdminUser.mockResolvedValueOnce(validAdmin);
        const req = new Request("http://localhost/api/admin/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            store_name: "   ",
            whatsapp_number: "62895806567230",
            dos_price: 25000,
          }),
        });

        const res = await PATCH(req);
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error).toBe("Nama toko wajib diisi");
      });

      it("menolak jika format nomor WhatsApp tidak valid", async () => {
        mockGetAdminUser.mockResolvedValueOnce(validAdmin);
        const req = new Request("http://localhost/api/admin/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            store_name: "Rumah Makan Sipil",
            whatsapp_number: "081234567890", // tidak diawali 62
            dos_price: 25000,
          }),
        });

        const res = await PATCH(req);
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error).toContain("Nomor WhatsApp harus diawali 62");
      });

      it("menolak jika harga paket dos negatif", async () => {
        mockGetAdminUser.mockResolvedValueOnce(validAdmin);
        const req = new Request("http://localhost/api/admin/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            store_name: "Rumah Makan Sipil",
            whatsapp_number: "62895806567230",
            dos_price: -1000,
          }),
        });

        const res = await PATCH(req);
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error).toBe("Harga Paket Dos tidak boleh negatif");
      });

      it("menolak jika format path QRIS tidak valid", async () => {
        mockGetAdminUser.mockResolvedValueOnce(validAdmin);
        const req = new Request("http://localhost/api/admin/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            store_name: "Rumah Makan Sipil",
            whatsapp_number: "62895806567230",
            dos_price: 25000,
            qris_image_path: "invalid/file.exe",
          }),
        });

        const res = await PATCH(req);
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error).toContain("Format path QRIS tidak valid");
      });
    });

    describe("Backward Compatibility Toggle Status Toko", () => {
      it("mengembalikan 200 dan revalidasi saat toggle status { is_open: false }", async () => {
        mockGetAdminUser.mockResolvedValueOnce(validAdmin);
        const chain = createQueryChain({
          data: { is_open: false },
          error: null,
        });
        mockFrom.mockReturnValueOnce(chain);

        const req = new Request("http://localhost/api/admin/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_open: false }),
        });

        const res = await PATCH(req);
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json).toEqual({ is_open: false });

        expect(chain.update).toHaveBeenCalledWith({ is_open: false });
        expect(chain.eq).toHaveBeenCalledWith("id", 1);
        expect(mockStorageRemove).not.toHaveBeenCalled();

        expect(mockRevalidatePath).toHaveBeenCalledWith("/");
        expect(mockRevalidatePath).toHaveBeenCalledWith("/admin");
        expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/pengaturan");
      });
    });

    describe("Pembaruan Pengaturan Toko Lengkap", () => {
      it("mengembalikan 200 tanpa memanggil storage remove jika qris_image_path tidak berubah", async () => {
        mockGetAdminUser.mockResolvedValueOnce(validAdmin);

        // Fetch current settings
        const fetchChain = createQueryChain({
          data: { qris_image_path: "qris/same-qris.webp" },
          error: null,
        });
        // Update settings
        const updateChain = createQueryChain({
          data: {
            ...sampleSettings,
            store_name: "RM Sipil Cabang 1",
            qris_image_path: "qris/same-qris.webp",
          },
          error: null,
        });

        mockFrom.mockReturnValueOnce(fetchChain).mockReturnValueOnce(updateChain);

        const req = new Request("http://localhost/api/admin/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            store_name: "RM Sipil Cabang 1",
            tagline: "Makan Enak, Setiap Hari",
            whatsapp_number: "62895806567230",
            dos_price: 25000,
            qris_image_path: "qris/same-qris.webp",
          }),
        });

        const res = await PATCH(req);
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.store_name).toBe("RM Sipil Cabang 1");

        expect(mockStorageRemove).not.toHaveBeenCalled();
        expect(mockRevalidatePath).toHaveBeenCalledWith("/");
        expect(mockRevalidatePath).toHaveBeenCalledWith("/admin");
        expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/pengaturan");
      });

      it("mengembalikan 200 dan menghapus foto QRIS lama saat ada foto QRIS baru", async () => {
        mockGetAdminUser.mockResolvedValueOnce(validAdmin);

        const fetchChain = createQueryChain({
          data: { qris_image_path: "qris/old-qris.webp" },
          error: null,
        });
        const updateChain = createQueryChain({
          data: {
            ...sampleSettings,
            qris_image_path: "qris/new-qris.webp",
          },
          error: null,
        });

        mockFrom.mockReturnValueOnce(fetchChain).mockReturnValueOnce(updateChain);

        const req = new Request("http://localhost/api/admin/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            store_name: "Rumah Makan Sipil",
            tagline: "Makan Enak, Setiap Hari",
            whatsapp_number: "62895806567230",
            dos_price: 25000,
            qris_image_path: "qris/new-qris.webp",
          }),
        });

        const res = await PATCH(req);
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.qris_image_path).toBe("qris/new-qris.webp");

        expect(mockStorageFrom).toHaveBeenCalledWith(STORE_BUCKET);
        expect(mockStorageRemove).toHaveBeenCalledWith(["qris/old-qris.webp"]);
      });

      it("mengembalikan 200 dan menghapus foto QRIS lama saat qris_image_path diset null", async () => {
        mockGetAdminUser.mockResolvedValueOnce(validAdmin);

        const fetchChain = createQueryChain({
          data: { qris_image_path: "qris/old-qris.webp" },
          error: null,
        });
        const updateChain = createQueryChain({
          data: {
            ...sampleSettings,
            qris_image_path: null,
          },
          error: null,
        });

        mockFrom.mockReturnValueOnce(fetchChain).mockReturnValueOnce(updateChain);

        const req = new Request("http://localhost/api/admin/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            store_name: "Rumah Makan Sipil",
            tagline: "Makan Enak, Setiap Hari",
            whatsapp_number: "62895806567230",
            dos_price: 25000,
            qris_image_path: null,
          }),
        });

        const res = await PATCH(req);
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.qris_image_path).toBeNull();

        expect(mockStorageFrom).toHaveBeenCalledWith(STORE_BUCKET);
        expect(mockStorageRemove).toHaveBeenCalledWith(["qris/old-qris.webp"]);
      });

      it("mempertahankan qris_image_path dan tidak memanggil storage remove jika field qris_image_path tidak dikirim", async () => {
        mockGetAdminUser.mockResolvedValueOnce(validAdmin);

        const fetchChain = createQueryChain({
          data: { qris_image_path: "qris/old-qris.webp" },
          error: null,
        });
        const updateChain = createQueryChain({
          data: {
            ...sampleSettings,
            store_name: "Nama Toko Baru",
            qris_image_path: "qris/old-qris.webp",
          },
          error: null,
        });

        mockFrom.mockReturnValueOnce(fetchChain).mockReturnValueOnce(updateChain);

        const req = new Request("http://localhost/api/admin/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            store_name: "Nama Toko Baru",
            whatsapp_number: "62895806567230",
            dos_price: 25000,
          }),
        });

        const res = await PATCH(req);
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.store_name).toBe("Nama Toko Baru");
        expect(json.qris_image_path).toBe("qris/old-qris.webp");

        // Memastikan updatePayload tidak memasukkan kolom qris_image_path
        expect(updateChain.update).toHaveBeenCalledWith({
          store_name: "Nama Toko Baru",
          whatsapp_number: "62895806567230",
          dos_price: 25000,
        });
        expect(mockStorageRemove).not.toHaveBeenCalled();
      });

      it("tetap sukses (200) jika pembersihan storage gagal (defensive cleanup)", async () => {
        const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        mockGetAdminUser.mockResolvedValueOnce(validAdmin);

        const fetchChain = createQueryChain({
          data: { qris_image_path: "qris/old-qris.webp" },
          error: null,
        });
        const updateChain = createQueryChain({
          data: {
            ...sampleSettings,
            qris_image_path: "qris/new-qris.webp",
          },
          error: null,
        });

        mockFrom.mockReturnValueOnce(fetchChain).mockReturnValueOnce(updateChain);
        mockStorageRemove.mockRejectedValueOnce(new Error("Storage service unavailable"));

        const req = new Request("http://localhost/api/admin/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            store_name: "Rumah Makan Sipil",
            tagline: "Makan Enak, Setiap Hari",
            whatsapp_number: "62895806567230",
            dos_price: 25000,
            qris_image_path: "qris/new-qris.webp",
          }),
        });

        const res = await PATCH(req);
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.qris_image_path).toBe("qris/new-qris.webp");

        expect(consoleErrorSpy).toHaveBeenCalled();
        consoleErrorSpy.mockRestore();
      });

      it("mengembalikan 403 jika error database berkode 42501 (RLS bukan pemilik)", async () => {
        mockGetAdminUser.mockResolvedValueOnce(validAdmin);

        const fetchChain = createQueryChain({
          data: { qris_image_path: "qris/old-qris.webp" },
          error: null,
        });
        const updateChain = createQueryChain({
          data: null,
          error: { code: "42501", message: "permission denied for table settings" },
        });

        mockFrom.mockReturnValueOnce(fetchChain).mockReturnValueOnce(updateChain);

        const req = new Request("http://localhost/api/admin/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            store_name: "Rumah Makan Sipil",
            whatsapp_number: "62895806567230",
            dos_price: 25000,
          }),
        });

        const res = await PATCH(req);
        expect(res.status).toBe(403);
        const json = await res.json();
        expect(json.error).toBe("Akun ini tidak memiliki hak akses pemilik.");
      });

      it("mengembalikan 500 jika error database umum", async () => {
        mockGetAdminUser.mockResolvedValueOnce(validAdmin);

        const fetchChain = createQueryChain({
          data: { qris_image_path: "qris/old-qris.webp" },
          error: null,
        });
        const updateChain = createQueryChain({
          data: null,
          error: { code: "50000", message: "Database update error" },
        });

        mockFrom.mockReturnValueOnce(fetchChain).mockReturnValueOnce(updateChain);

        const req = new Request("http://localhost/api/admin/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            store_name: "Rumah Makan Sipil",
            whatsapp_number: "62895806567230",
            dos_price: 25000,
          }),
        });

        const res = await PATCH(req);
        expect(res.status).toBe(500);
        const json = await res.json();
        expect(json.error).toBe("Database update error");
      });
    });
  });
});
