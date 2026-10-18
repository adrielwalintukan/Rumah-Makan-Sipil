import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getMenuPhotoUrl,
  MENU_PHOTOS_BUCKET,
  saveMenuItemWithPhotoCleanup,
} from "./storage";

describe("storage", () => {
  const originalEnv = process.env.NEXT_PUBLIC_SUPABASE_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnv;
  });

  it("mengekspor MENU_PHOTOS_BUCKET yang benar", () => {
    expect(MENU_PHOTOS_BUCKET).toBe("menu-photos");
  });

  describe("getMenuPhotoUrl", () => {
    it("mengembalikan null untuk null, undefined, atau string kosong", () => {
      expect(getMenuPhotoUrl(null)).toBeNull();
      expect(getMenuPhotoUrl(undefined)).toBeNull();
      expect(getMenuPhotoUrl("")).toBeNull();
      expect(getMenuPhotoUrl("   ")).toBeNull();
    });

    it("mengembalikan URL publik Supabase Storage lengkap untuk path relatif", () => {
      const url = getMenuPhotoUrl("items/ayam-bakar.webp");
      expect(url).toBe(
        "https://example.supabase.co/storage/v1/object/public/menu-photos/items/ayam-bakar.webp"
      );
    });

    it("menghapus whitespace di awal dan akhir path relatif", () => {
      const url = getMenuPhotoUrl("   items/ayam-bakar.webp   ");
      expect(url).toBe(
        "https://example.supabase.co/storage/v1/object/public/menu-photos/items/ayam-bakar.webp"
      );
    });

    it("menangani trailing slash pada NEXT_PUBLIC_SUPABASE_URL dan leading slash pada path", () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co/";
      const url = getMenuPhotoUrl("items/ayam-bakar.webp");
      expect(url).toBe(
        "https://example.supabase.co/storage/v1/object/public/menu-photos/items/ayam-bakar.webp"
      );
    });

    it("mengembalikan path apa adanya jika sudah diawali http://, https://, atau /", () => {
      expect(getMenuPhotoUrl("https://images.example.com/foto.jpg")).toBe(
        "https://images.example.com/foto.jpg"
      );
      expect(getMenuPhotoUrl("http://images.example.com/foto.jpg")).toBe(
        "http://images.example.com/foto.jpg"
      );
      expect(getMenuPhotoUrl("/custom/static/path.webp")).toBe(
        "/custom/static/path.webp"
      );
    });

    it("mengembalikan fallback path jika NEXT_PUBLIC_SUPABASE_URL tidak didefinisikan", () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      const url = getMenuPhotoUrl("items/ayam-bakar.webp");
      expect(url).toBe("/menu-photos/items/ayam-bakar.webp");
    });
  });

  describe("saveMenuItemWithPhotoCleanup", () => {
    const dummyBlob = new Blob(["fake-image"], { type: "image/webp" });
    const dummyPayload = {
      category_id: "a0000000-0000-0000-0000-000000000001",
      name: "Cotto",
      price: 15000,
    };

    it("berhasil upload foto dan menyimpan menu saat API mengembalikan status 200/201 (tanpa cleanup)", async () => {
      const mockUpload = vi.fn().mockResolvedValue({ error: null });
      const mockRemove = vi.fn().mockResolvedValue({ error: null });
      const mockStorage = {
        from: vi.fn().mockReturnValue({
          upload: mockUpload,
          remove: mockRemove,
        }),
      };

      const mockFetcher = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { id: "menu-1" } }),
      } as unknown as Response);

      const res = await saveMenuItemWithPhotoCleanup({
        storage: mockStorage,
        processedBlob: dummyBlob,
        payload: dummyPayload,
        endpoint: "/api/admin/menu",
        method: "POST",
        fetcher: mockFetcher as unknown as typeof fetch,
      });

      expect(res.success).toBe(true);
      expect(mockUpload).toHaveBeenCalledTimes(1);
      const uploadedPath = mockUpload.mock.calls[0][0];
      expect(uploadedPath).toMatch(/^items\/[a-zA-Z0-9-]+\.webp$/);
      expect(mockFetcher).toHaveBeenCalledTimes(1);
      expect(mockRemove).not.toHaveBeenCalled();
    });

    it("melakukan pembersihan (remove) file baru di storage jika request API gagal (HTTP 4xx/5xx)", async () => {
      const mockUpload = vi.fn().mockResolvedValue({ error: null });
      const mockRemove = vi.fn().mockResolvedValue({ error: null });
      const mockStorage = {
        from: vi.fn().mockReturnValue({
          upload: mockUpload,
          remove: mockRemove,
        }),
      };

      const mockFetcher = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Validasi database gagal" }),
      } as unknown as Response);

      const res = await saveMenuItemWithPhotoCleanup({
        storage: mockStorage,
        processedBlob: dummyBlob,
        payload: dummyPayload,
        endpoint: "/api/admin/menu",
        method: "POST",
        fetcher: mockFetcher as unknown as typeof fetch,
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe("Validasi database gagal");
      expect(mockUpload).toHaveBeenCalledTimes(1);
      const uploadedPath = mockUpload.mock.calls[0][0];
      // Memastikan file baru yang diunggah dibersihkan agar tidak jadi orphan
      expect(mockRemove).toHaveBeenCalledWith([uploadedPath]);
    });

    it("melakukan pembersihan file baru jika pemanggilan fetch API melempar error network", async () => {
      const mockUpload = vi.fn().mockResolvedValue({ error: null });
      const mockRemove = vi.fn().mockResolvedValue({ error: null });
      const mockStorage = {
        from: vi.fn().mockReturnValue({
          upload: mockUpload,
          remove: mockRemove,
        }),
      };

      const mockFetcher = vi.fn().mockRejectedValue(new Error("Network connection dropped"));

      const res = await saveMenuItemWithPhotoCleanup({
        storage: mockStorage,
        processedBlob: dummyBlob,
        payload: dummyPayload,
        endpoint: "/api/admin/menu",
        method: "POST",
        fetcher: mockFetcher as unknown as typeof fetch,
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe("Network connection dropped");
      const uploadedPath = mockUpload.mock.calls[0][0];
      expect(mockRemove).toHaveBeenCalledWith([uploadedPath]);
    });

    it("tidak membiarkan kegagalan cleanup menutupi error utama API jika remove melempar exception", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const mockUpload = vi.fn().mockResolvedValue({ error: null });
      // Storage remove melempar error saat mencoba membersihkan
      const mockRemove = vi.fn().mockRejectedValue(new Error("Storage timeout"));
      const mockStorage = {
        from: vi.fn().mockReturnValue({
          upload: mockUpload,
          remove: mockRemove,
        }),
      };

      const mockFetcher = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Menu dengan nama tersebut sudah ada" }),
      } as unknown as Response);

      const res = await saveMenuItemWithPhotoCleanup({
        storage: mockStorage,
        processedBlob: dummyBlob,
        payload: dummyPayload,
        endpoint: "/api/admin/menu",
        method: "POST",
        fetcher: mockFetcher as unknown as typeof fetch,
      });

      expect(res.success).toBe(false);
      // Pesan error tetap merupakan error utama API, bukan error timeout cleanup
      expect(res.error).toBe("Menu dengan nama tersebut sudah ada");
      expect(mockRemove).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Gagal membersihkan foto baru dari storage:",
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it("mencatat log error dan tidak menutupi error utama jika storage remove resolve dengan error object", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const mockUpload = vi.fn().mockResolvedValue({ error: null });
      // Storage remove resolve dengan error object (bukan throw exception)
      const mockRemove = vi.fn().mockResolvedValue({
        error: { message: "Storage permission denied" },
      });
      const mockStorage = {
        from: vi.fn().mockReturnValue({
          upload: mockUpload,
          remove: mockRemove,
        }),
      };

      const mockFetcher = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Harga menu tidak valid" }),
      } as unknown as Response);

      const res = await saveMenuItemWithPhotoCleanup({
        storage: mockStorage,
        processedBlob: dummyBlob,
        payload: dummyPayload,
        endpoint: "/api/admin/menu",
        method: "POST",
        fetcher: mockFetcher as unknown as typeof fetch,
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe("Harga menu tidak valid");
      expect(mockRemove).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Gagal membersihkan foto baru dari storage:",
        { message: "Storage permission denied" }
      );

      consoleErrorSpy.mockRestore();
    });

    it("mengembalikan error jika upload foto gagal sebelum memanggil API (dan tidak memanggil remove)", async () => {
      const mockUpload = vi.fn().mockResolvedValue({
        error: { message: "Storage quota exceeded" },
      });
      const mockRemove = vi.fn();
      const mockStorage = {
        from: vi.fn().mockReturnValue({
          upload: mockUpload,
          remove: mockRemove,
        }),
      };

      const mockFetcher = vi.fn();

      const res = await saveMenuItemWithPhotoCleanup({
        storage: mockStorage,
        processedBlob: dummyBlob,
        payload: dummyPayload,
        endpoint: "/api/admin/menu",
        method: "POST",
        fetcher: mockFetcher as unknown as typeof fetch,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Storage quota exceeded");
      expect(mockFetcher).not.toHaveBeenCalled();
      expect(mockRemove).not.toHaveBeenCalled();
    });

    it("langsung menyimpan menu tanpa upload storage jika processedBlob bernilai null", async () => {
      const mockUpload = vi.fn();
      const mockRemove = vi.fn();
      const mockStorage = {
        from: vi.fn().mockReturnValue({
          upload: mockUpload,
          remove: mockRemove,
        }),
      };

      const mockFetcher = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { id: "menu-1" } }),
      } as unknown as Response);

      const res = await saveMenuItemWithPhotoCleanup({
        storage: mockStorage,
        processedBlob: null,
        payload: dummyPayload,
        endpoint: "/api/admin/menu/1",
        method: "PATCH",
        fetcher: mockFetcher as unknown as typeof fetch,
      });

      expect(res.success).toBe(true);
      expect(mockUpload).not.toHaveBeenCalled();
      expect(mockRemove).not.toHaveBeenCalled();
      expect(mockFetcher).toHaveBeenCalledTimes(1);
    });
  });
});
