import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getStoreCanonicalUrl,
  generateQrDataUrl,
  getPosterDimensions,
} from "./qr";

describe("lib/qr: Modul Utilitas QR & Poster Kanonikal", () => {
  const originalEnv = process.env.NEXT_PUBLIC_SITE_URL;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = originalEnv;
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
});
