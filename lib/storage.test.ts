import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getMenuPhotoUrl,
  MENU_PHOTOS_BUCKET,
  getQrisImageUrl,
  saveMenuItemWithPhotoCleanup,
  saveStoreSettingsWithQrisCleanup,
  STORE_BUCKET,
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

  it("mengekspor STORE_BUCKET yang benar", () => {
    expect(STORE_BUCKET).toBe("store");
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

  describe("getQrisImageUrl", () => {
    it("mengembalikan null untuk null, undefined, string kosong, atau spasi saja", () => {
      expect(getQrisImageUrl(null)).toBeNull();
      expect(getQrisImageUrl(undefined)).toBeNull();
      expect(getQrisImageUrl("")).toBeNull();
      expect(getQrisImageUrl("   ")).toBeNull();
    });

    it("mengembalikan URL publik Supabase Storage lengkap untuk path relatif", () => {
      const url = getQrisImageUrl("qris/dana-2026.webp");
      expect(url).toBe(
        "https://example.supabase.co/storage/v1/object/public/store/qris/dana-2026.webp"
      );
    });

    it("menghapus whitespace di awal dan akhir path relatif", () => {
      const url = getQrisImageUrl("   qris/dana-2026.webp   ");
      expect(url).toBe(
        "https://example.supabase.co/storage/v1/object/public/store/qris/dana-2026.webp"
      );
    });

    it("menangani trailing slash pada NEXT_PUBLIC_SUPABASE_URL", () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co/";
      const url = getQrisImageUrl("qris/dana-2026.webp");
      expect(url).toBe(
        "https://example.supabase.co/storage/v1/object/public/store/qris/dana-2026.webp"
      );
    });

    it("mengembalikan path apa adanya jika sudah diawali http://, https://, atau /", () => {
      expect(getQrisImageUrl("https://images.example.com/qris.jpg")).toBe(
        "https://images.example.com/qris.jpg"
      );
      expect(getQrisImageUrl("http://images.example.com/qris.jpg")).toBe(
        "http://images.example.com/qris.jpg"
      );
      expect(getQrisImageUrl("/custom/static/qris.webp")).toBe(
        "/custom/static/qris.webp"
      );
    });

    it("mengembalikan fallback path jika NEXT_PUBLIC_SUPABASE_URL tidak didefinisikan", () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      const url = getQrisImageUrl("qris/dana-2026.webp");
      expect(url).toBe("/store/qris/dana-2026.webp");
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

    it("tidak menghapus foto baru jika server commit sukses tetapi respons fetch gagal/hilang (isReferenced bernilai true)", async () => {
      const mockUpload = vi.fn().mockResolvedValue({ error: null });
      const mockRemove = vi.fn().mockResolvedValue({ error: null });
      const mockStorage = {
        from: vi.fn().mockReturnValue({
          upload: mockUpload,
          remove: mockRemove,
        }),
      };

      // Simulasi: mutasi di server berhasil commit, tetapi respons fetch terputus di jaringan
      const mockFetcher = vi.fn().mockRejectedValue(new Error("Network connection dropped"));
      // isReferenced memverifikasi bahwa menu sudah tercatat di database dengan image_path tersebut
      const mockIsReferenced = vi.fn().mockResolvedValue(true);

      const res = await saveMenuItemWithPhotoCleanup({
        storage: mockStorage,
        processedBlob: dummyBlob,
        payload: dummyPayload,
        endpoint: "/api/admin/menu",
        method: "POST",
        fetcher: mockFetcher as unknown as typeof fetch,
        isReferenced: mockIsReferenced,
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe("Network connection dropped");
      expect(mockUpload).toHaveBeenCalledTimes(1);
      const uploadedPath = mockUpload.mock.calls[0][0];
      expect(mockIsReferenced).toHaveBeenCalledWith(uploadedPath);
      // Memastikan file foto TIDAK dihapus karena sudah aktif direferensikan oleh menu di database
      expect(mockRemove).not.toHaveBeenCalled();
    });

    it("melakukan pembersihan file baru jika pemanggilan fetch API melempar error network dan foto dipastikan belum direferensikan (isReferenced bernilai false)", async () => {
      const mockUpload = vi.fn().mockResolvedValue({ error: null });
      const mockRemove = vi.fn().mockResolvedValue({ error: null });
      const mockStorage = {
        from: vi.fn().mockReturnValue({
          upload: mockUpload,
          remove: mockRemove,
        }),
      };

      const mockFetcher = vi.fn().mockRejectedValue(new Error("Network connection dropped"));
      // isReferenced mengonfirmasi foto belum tersimpan di tabel menu manapun
      const mockIsReferenced = vi.fn().mockResolvedValue(false);

      const res = await saveMenuItemWithPhotoCleanup({
        storage: mockStorage,
        processedBlob: dummyBlob,
        payload: dummyPayload,
        endpoint: "/api/admin/menu",
        method: "POST",
        fetcher: mockFetcher as unknown as typeof fetch,
        isReferenced: mockIsReferenced,
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe("Network connection dropped");
      const uploadedPath = mockUpload.mock.calls[0][0];
      expect(mockIsReferenced).toHaveBeenCalledWith(uploadedPath);
      // File baru yang belum tersimpan aman dibersihkan
      expect(mockRemove).toHaveBeenCalledWith([uploadedPath]);
    });

    it("tidak menghapus foto baru jika terjadi error network ambigu tanpa fungsi isReferenced", async () => {
      const mockUpload = vi.fn().mockResolvedValue({ error: null });
      const mockRemove = vi.fn().mockResolvedValue({ error: null });
      const mockStorage = {
        from: vi.fn().mockReturnValue({
          upload: mockUpload,
          remove: mockRemove,
        }),
      };

      const mockFetcher = vi.fn().mockRejectedValue(new Error("Connection reset by peer"));

      const res = await saveMenuItemWithPhotoCleanup({
        storage: mockStorage,
        processedBlob: dummyBlob,
        payload: dummyPayload,
        endpoint: "/api/admin/menu",
        method: "POST",
        fetcher: mockFetcher as unknown as typeof fetch,
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe("Connection reset by peer");
      // Karena status mutasi server ambigu dan tidak ada verifikasi referensi, jangan hapus foto
      expect(mockRemove).not.toHaveBeenCalled();
    });

    it("tidak menghapus foto baru jika pengecekan referensi gagal saat terjadi network error", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const mockUpload = vi.fn().mockResolvedValue({ error: null });
      const mockRemove = vi.fn().mockResolvedValue({ error: null });
      const mockStorage = {
        from: vi.fn().mockReturnValue({
          upload: mockUpload,
          remove: mockRemove,
        }),
      };

      const mockFetcher = vi.fn().mockRejectedValue(new Error("Network timeout"));
      const mockIsReferenced = vi.fn().mockRejectedValue(new Error("Database check failed"));

      const res = await saveMenuItemWithPhotoCleanup({
        storage: mockStorage,
        processedBlob: dummyBlob,
        payload: dummyPayload,
        endpoint: "/api/admin/menu",
        method: "POST",
        fetcher: mockFetcher as unknown as typeof fetch,
        isReferenced: mockIsReferenced,
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe("Network timeout");
      expect(mockRemove).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Gagal memeriksa referensi foto setelah network error:",
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
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

  describe("saveStoreSettingsWithQrisCleanup", () => {
    const dummyBlob = new Blob(["fake-qris-image"], { type: "image/webp" });
    const dummyPayload = {
      store_name: "Warung Berkah",
      tagline: "Enak dan Murah",
      whatsapp_number: "6281234567890",
      dos_price: 3000,
      qris_image_path: null,
    };

    it("berhasil mengunggah file QRIS baru ke bucket store dan mengirim PATCH ke /api/admin/settings", async () => {
      const mockUpload = vi.fn().mockResolvedValue({ error: null });
      const mockRemove = vi.fn();
      const mockStorage = {
        from: vi.fn().mockReturnValue({
          upload: mockUpload,
          remove: mockRemove,
        }),
      };

      const mockFetcher = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as unknown as Response);

      const res = await saveStoreSettingsWithQrisCleanup({
        storage: mockStorage,
        compressedBlob: dummyBlob,
        payload: dummyPayload,
        fetcher: mockFetcher as unknown as typeof fetch,
      });

      expect(res.success).toBe(true);
      expect(mockUpload).toHaveBeenCalledTimes(1);
      const uploadedPath = mockUpload.mock.calls[0][0];
      expect(uploadedPath).toMatch(/^qris\/[a-zA-Z0-9-]+\.webp$/);
      expect(res.uploadedPath).toBe(uploadedPath);
      expect(mockFetcher).toHaveBeenCalledTimes(1);
      const fetchArgs = mockFetcher.mock.calls[0];
      expect(fetchArgs[0]).toBe("/api/admin/settings");
      expect(fetchArgs[1].method).toBe("PATCH");
      const parsedBody = JSON.parse(fetchArgs[1].body);
      expect(parsedBody.qris_image_path).toBe(uploadedPath);
      expect(mockRemove).not.toHaveBeenCalled();
    });

    it("melakukan pembersihan (remove) file QRIS baru jika request API merespons dengan HTTP error (4xx/5xx)", async () => {
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

      const res = await saveStoreSettingsWithQrisCleanup({
        storage: mockStorage,
        compressedBlob: dummyBlob,
        payload: dummyPayload,
        fetcher: mockFetcher as unknown as typeof fetch,
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe("Validasi database gagal");
      expect(mockUpload).toHaveBeenCalledTimes(1);
      const uploadedPath = mockUpload.mock.calls[0][0];
      expect(mockRemove).toHaveBeenCalledWith([uploadedPath]);
    });

    it("TIDAK menghapus file QRIS baru jika request fetch melempar network error tetapi server sudah menyimpan path baru (isReferenced bernilai true)", async () => {
      const mockUpload = vi.fn().mockResolvedValue({ error: null });
      const mockRemove = vi.fn().mockResolvedValue({ error: null });
      const mockStorage = {
        from: vi.fn().mockReturnValue({
          upload: mockUpload,
          remove: mockRemove,
        }),
      };

      // Mutasi di server berhasil commit, tetapi respons terputus pada jaringan klien
      const mockFetcher = vi.fn().mockRejectedValue(new Error("Network connection dropped"));
      const mockIsReferenced = vi.fn().mockResolvedValue(true);

      const res = await saveStoreSettingsWithQrisCleanup({
        storage: mockStorage,
        compressedBlob: dummyBlob,
        payload: dummyPayload,
        fetcher: mockFetcher as unknown as typeof fetch,
        isReferenced: mockIsReferenced,
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe("Network connection dropped");
      expect(mockUpload).toHaveBeenCalledTimes(1);
      const uploadedPath = mockUpload.mock.calls[0][0];
      expect(mockIsReferenced).toHaveBeenCalledWith(uploadedPath);
      // Memastikan file QRIS TIDAK dihapus dari storage karena sudah aktif direferensikan oleh database
      expect(mockRemove).not.toHaveBeenCalled();
    });

    it("melakukan pembersihan file QRIS baru jika fetch melempar network error dan file dipastikan belum direferensikan (isReferenced bernilai false)", async () => {
      const mockUpload = vi.fn().mockResolvedValue({ error: null });
      const mockRemove = vi.fn().mockResolvedValue({ error: null });
      const mockStorage = {
        from: vi.fn().mockReturnValue({
          upload: mockUpload,
          remove: mockRemove,
        }),
      };

      const mockFetcher = vi.fn().mockRejectedValue(new Error("Network connection dropped"));
      const mockIsReferenced = vi.fn().mockResolvedValue(false);

      const res = await saveStoreSettingsWithQrisCleanup({
        storage: mockStorage,
        compressedBlob: dummyBlob,
        payload: dummyPayload,
        fetcher: mockFetcher as unknown as typeof fetch,
        isReferenced: mockIsReferenced,
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe("Network connection dropped");
      expect(mockUpload).toHaveBeenCalledTimes(1);
      const uploadedPath = mockUpload.mock.calls[0][0];
      expect(mockIsReferenced).toHaveBeenCalledWith(uploadedPath);
      expect(mockRemove).toHaveBeenCalledWith([uploadedPath]);
    });

    it("TIDAK menghapus file QRIS jika fetch melempar network error dan pemeriksaan isReferenced melempar error (fallback aman)", async () => {
      const mockUpload = vi.fn().mockResolvedValue({ error: null });
      const mockRemove = vi.fn().mockResolvedValue({ error: null });
      const mockStorage = {
        from: vi.fn().mockReturnValue({
          upload: mockUpload,
          remove: mockRemove,
        }),
      };

      const mockFetcher = vi.fn().mockRejectedValue(new Error("Network connection dropped"));
      const mockIsReferenced = vi.fn().mockRejectedValue(new Error("Database offline"));

      const res = await saveStoreSettingsWithQrisCleanup({
        storage: mockStorage,
        compressedBlob: dummyBlob,
        payload: dummyPayload,
        fetcher: mockFetcher as unknown as typeof fetch,
        isReferenced: mockIsReferenced,
      });

      expect(res.success).toBe(false);
      expect(mockRemove).not.toHaveBeenCalled();
    });

    it("langsung menyimpan pengaturan tanpa upload storage jika compressedBlob bernilai null", async () => {
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
        json: async () => ({ success: true }),
      } as unknown as Response);

      const res = await saveStoreSettingsWithQrisCleanup({
        storage: mockStorage,
        compressedBlob: null,
        payload: dummyPayload,
        fetcher: mockFetcher as unknown as typeof fetch,
      });

      expect(res.success).toBe(true);
      expect(mockUpload).not.toHaveBeenCalled();
      expect(mockRemove).not.toHaveBeenCalled();
      expect(mockFetcher).toHaveBeenCalledTimes(1);
    });

    it("mengembalikan error jika upload storage gagal sebelum memanggil API (dan tidak memanggil remove)", async () => {
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

      const res = await saveStoreSettingsWithQrisCleanup({
        storage: mockStorage,
        compressedBlob: dummyBlob,
        payload: dummyPayload,
        fetcher: mockFetcher as unknown as typeof fetch,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Storage quota exceeded");
      expect(mockFetcher).not.toHaveBeenCalled();
      expect(mockRemove).not.toHaveBeenCalled();
    });
  });
});
