import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getStoreCanonicalUrl,
  generateQrDataUrl,
  getPosterDimensions,
  validateStoreUrl,
  drawWrappedText,
} from "./qr";

describe("lib/qr: Modul Utilitas QR & Poster Kanonikal", () => {
  const originalEnv = process.env.NEXT_PUBLIC_SITE_URL;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = originalEnv;
  });

  describe("validateStoreUrl()", () => {
    it("memvalidasi URL HTTPS domain publik dengan benar", () => {
      const res = validateStoreUrl("https://rumah-makan-sipil.vercel.app/");
      expect(res.isValid).toBe(true);
      expect(res.isLocalhost).toBe(false);
      expect(res.cleanUrl).toBe("https://rumah-makan-sipil.vercel.app");
      expect(res.warning).toBeUndefined();
    });

    it("mendeteksi URL localhost dan memberikan peringatan yang jelas", () => {
      const res = validateStoreUrl("http://localhost:3000");
      expect(res.isValid).toBe(true);
      expect(res.isLocalhost).toBe(true);
      expect(res.cleanUrl).toBe("http://localhost:3000");
      expect(res.warning).toContain("localhost");
    });

    it("mendeteksi IP loopback 127.0.0.1 sebagai localhost", () => {
      const res = validateStoreUrl("http://127.0.0.1:3000");
      expect(res.isValid).toBe(true);
      expect(res.isLocalhost).toBe(true);
    });

    it("menolak protokol non-HTTP seperti ftp atau javascript", () => {
      const res = validateStoreUrl("ftp://warung.sipil/menu");
      expect(res.isValid).toBe(false);
      expect(res.warning).toContain("HTTP atau HTTPS");
    });

    it("menangani string kosong dengan fallback aman", () => {
      const res = validateStoreUrl("");
      expect(res.isValid).toBe(false);
      expect(res.cleanUrl).toBe("http://localhost:3000");
    });
  });

  describe("getStoreCanonicalUrl()", () => {
    it("mengembalikan nilai NEXT_PUBLIC_SITE_URL jika disetel dan membersihkan trailing slash", () => {
      process.env.NEXT_PUBLIC_SITE_URL = "https://rumah-makan-sipil.vercel.app/";
      expect(getStoreCanonicalUrl()).toBe("https://rumah-makan-sipil.vercel.app");
    });

    it("menggunakan fallbackOrigin jika NEXT_PUBLIC_SITE_URL tidak disetel", () => {
      delete process.env.NEXT_PUBLIC_SITE_URL;
      expect(getStoreCanonicalUrl("https://warung-sipil.local/")).toBe("https://warung-sipil.local");
    });

    it("mengembalikan http://localhost:3000 jika semua fallback kosong di server", () => {
      delete process.env.NEXT_PUBLIC_SITE_URL;
      expect(getStoreCanonicalUrl()).toBe("http://localhost:3000");
    });

    it("membersihkan spasi ekstra dan format URL dengan benar", () => {
      process.env.NEXT_PUBLIC_SITE_URL = "   https://sipil.example.com///  ";
      expect(getStoreCanonicalUrl()).toBe("https://sipil.example.com");
    });
  });

  describe("generateQrDataUrl()", () => {
    it("menghasilkan data URL PNG valid dari teks URL", async () => {
      const url = "https://rumah-makan-sipil.vercel.app";
      const dataUrl = await generateQrDataUrl(url);

      expect(typeof dataUrl).toBe("string");
      expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
    });

    it("menerima opsi kustom errorCorrectionLevel dan width", async () => {
      const url = "https://rumah-makan-sipil.vercel.app";
      const dataUrl = await generateQrDataUrl(url, {
        errorCorrectionLevel: "H",
        width: 800,
        margin: 1,
      });

      expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
    });
  });

  describe("getPosterDimensions()", () => {
    it("mengembalikan resolusi 300 DPI untuk ukuran A4 (2480 x 3508 px)", () => {
      const dim = getPosterDimensions("a4");
      expect(dim.width).toBe(2480);
      expect(dim.height).toBe(3508);
      expect(dim.ratio).toBeCloseTo(1 / 1.414, 2);
    });

    it("mengembalikan resolusi 300 DPI untuk ukuran A5 (1748 x 2480 px)", () => {
      const dim = getPosterDimensions("a5");
      expect(dim.width).toBe(1748);
      expect(dim.height).toBe(2480);
      expect(dim.ratio).toBeCloseTo(1 / 1.414, 2);
    });
  });

  describe("drawWrappedText()", () => {
    it("membungkus teks panjang dan memanggil fillText dengan batas maxWidth", () => {
      const mockFillText = vi.fn();
      const mockMeasureText = vi.fn().mockImplementation((str: string) => ({
        width: str.length * 10,
      }));

      const fakeCtx = {
        fillText: mockFillText,
        measureText: mockMeasureText,
      } as unknown as CanvasRenderingContext2D;

      const longText = "Rumah Makan Sipil Spesialis Masakan Rumahan Khas Manado Super Sedap";
      const height = drawWrappedText(fakeCtx, longText, 100, 50, 200, 30, 2);

      expect(height).toBeGreaterThan(0);
      expect(mockFillText).toHaveBeenCalled();
    });

    it("mengembalikan 0 untuk teks kosong", () => {
      const fakeCtx = {
        fillText: vi.fn(),
        measureText: vi.fn().mockReturnValue({ width: 0 }),
      } as unknown as CanvasRenderingContext2D;

      const height = drawWrappedText(fakeCtx, "", 100, 50, 200, 30, 2);
      expect(height).toBe(0);
    });
  });
});
