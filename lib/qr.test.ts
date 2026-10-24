import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getStoreCanonicalUrl,
  generateQrDataUrl,
  getPosterDimensions,
  validateStoreUrl,
  drawWrappedText,
  truncateUrl,
  calculatePosterLayout,
  computeActualPosterCoordinates,
  renderPosterToCanvas,
  exportPosterToWordDoc,
  type PosterRenderConfig,
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

    it("mengembalikan resolusi 300 DPI untuk ukuran A6 (1240 x 1748 px)", () => {
      const dim = getPosterDimensions("a6");
      expect(dim.width).toBe(1240);
      expect(dim.height).toBe(1748);
      expect(dim.ratio).toBeCloseTo(1 / 1.414, 2);
    });
  });

  describe("truncateUrl()", () => {
    it("tidak memotong URL jika panjangnya masih di bawah atau sama dengan batas maksimal", () => {
      const url = "https://rumah-makan-sipil.vercel.app";
      expect(truncateUrl(url, 50)).toBe(url);
    });

    it("memotong URL panjang dengan elipsis (...) rapi", () => {
      const longUrl = "https://rumah-makan-sipil-spesialis-masakan-rumahan-khas-manado-asli.vercel.app/order";
      const truncated = truncateUrl(longUrl, 40);

      expect(truncated.length).toBeLessThanOrEqual(40);
      expect(truncated).toContain("...");
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

  describe("calculatePosterLayout() Bounding Box & Canvas Safety", () => {
    const standardConfig: PosterRenderConfig = {
      size: "a4",
      storeName: "Rumah Makan Sipil",
      tagline: "Spesialis Masakan Rumahan & Ikan Bakar Khas Manado",
      qrDataUrl: "data:image/png;base64,dummy",
      siteUrl: "https://rumah-makan-sipil.vercel.app",
    };

    it("memastikan seluruh elemen berada di dalam batas kanvas yang aman pada A4 standar", () => {
      const layout = calculatePosterLayout(standardConfig);

      expect(layout.isSafe).toBe(true);
      expect(layout.emblemY).toBeGreaterThan(layout.outerMargin);
      expect(layout.stepsContainerY + layout.stepBoxHeight).toBeLessThan(layout.footerY);
      expect(layout.footerY).toBeLessThan(layout.bottomSafeLimit);
    });

    it("memastikan seluruh elemen berada di dalam batas kanvas yang aman pada A5 standar", () => {
      const layout = calculatePosterLayout({ ...standardConfig, size: "a5" });

      expect(layout.isSafe).toBe(true);
      expect(layout.stepsContainerY + layout.stepBoxHeight).toBeLessThan(layout.footerY);
      expect(layout.footerY).toBeLessThan(layout.bottomSafeLimit);
    });

    it("memastikan seluruh elemen berada di dalam batas kanvas yang aman pada A6 standar (tenda meja kecil)", () => {
      const layout = calculatePosterLayout({ ...standardConfig, size: "a6" });

      expect(layout.isSafe).toBe(true);
      expect(layout.stepsContainerY + layout.stepBoxHeight).toBeLessThan(layout.footerY);
      expect(layout.footerY).toBeLessThan(layout.bottomSafeLimit);
    });

    it("tetap aman dan tidak bertabrakan saat nama toko, tagline, dan URL sangat panjang (kasus ekstrem)", () => {
      const extremeConfig: PosterRenderConfig = {
        size: "a4",
        storeName: "Rumah Makan Sipil Cabang Utama Manado Spesialis Ikan Bakar Sedap",
        tagline: "Menyediakan Aneka Masakan Tradisional Minahasa & Manado dengan Bumbu Rempah Asli Pilihan Keluarga Sejak 1998",
        qrDataUrl: "data:image/png;base64,dummy",
        siteUrl: "https://rumah-makan-sipil-cabang-utama-manado-sulawesi-utara.vercel.app/katalog-pesanan",
      };

      const layoutA4 = calculatePosterLayout(extremeConfig);
      expect(layoutA4.isSafe).toBe(true);
      expect(layoutA4.stepsContainerY + layoutA4.stepBoxHeight).toBeLessThan(layoutA4.footerY);

      const layoutA5 = calculatePosterLayout({ ...extremeConfig, size: "a5" });
      expect(layoutA5.isSafe).toBe(true);
      expect(layoutA5.stepsContainerY + layoutA5.stepBoxHeight).toBeLessThan(layoutA5.footerY);
    });

    it("memverifikasi koordinat aktual pasca-render pada A4, A5, dan A6 saat teks panjang bersamaan", () => {
      const extremeConfig: PosterRenderConfig = {
        size: "a4",
        storeName: "Rumah Makan Sipil Cabang Utama Manado Spesialis Ikan Bakar Sedap",
        tagline: "Menyediakan Aneka Masakan Tradisional Minahasa & Manado dengan Bumbu Rempah Asli Pilihan Keluarga Sejak 1998",
        qrDataUrl: "data:image/png;base64,dummy",
        siteUrl: "https://rumah-makan-sipil-cabang-utama-manado-sulawesi-utara.vercel.app/katalog-pesanan",
      };

      // Uji A4
      const coordsA4 = computeActualPosterCoordinates(extremeConfig, 2, 2);
      expect(coordsA4.isWithinBounds).toBe(true);
      expect(coordsA4.stepsBottom).toBeLessThan(coordsA4.footerTop);
      expect(coordsA4.footerBottom).toBeLessThanOrEqual(coordsA4.height);

      // Uji A5
      const coordsA5 = computeActualPosterCoordinates({ ...extremeConfig, size: "a5" }, 2, 2);
      expect(coordsA5.isWithinBounds).toBe(true);
      expect(coordsA5.stepsBottom).toBeLessThan(coordsA5.footerTop);
      expect(coordsA5.footerBottom).toBeLessThanOrEqual(coordsA5.height);

      // Uji A6
      const coordsA6 = computeActualPosterCoordinates({ ...extremeConfig, size: "a6" }, 2, 2);
      expect(coordsA6.isWithinBounds).toBe(true);
      expect(coordsA6.stepsBottom).toBeLessThan(coordsA6.footerTop);
      expect(coordsA6.footerBottom).toBeLessThanOrEqual(coordsA6.height);
    });

    it("menjalankan renderPosterToCanvas aktual dan memverifikasi seluruh elemen berada di dalam batas kanvas untuk A4, A5, dan A6", async () => {
      const originalDocument = globalThis.document;
      const originalImage = (globalThis as unknown as { Image: unknown }).Image;

      class MockImage {
        crossOrigin = "";
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        private _src = "";
        set src(val: string) {
          this._src = val;
          setTimeout(() => {
            if (this.onload) this.onload();
          }, 0);
        }
        get src() {
          return this._src;
        }
      }
      (globalThis as unknown as { Image: unknown }).Image = MockImage;

      const extremeConfig: PosterRenderConfig = {
        size: "a4",
        storeName: "Rumah Makan Sipil Cabang Utama Manado Spesialis Ikan Bakar Sedap",
        tagline: "Menyediakan Aneka Masakan Tradisional Minahasa & Manado dengan Bumbu Rempah Asli Pilihan Keluarga Sejak 1998",
        qrDataUrl: "data:image/png;base64,dummy",
        siteUrl: "https://rumah-makan-sipil-cabang-utama-manado-sulawesi-utara.vercel.app/katalog-pesanan",
      };

      try {
        for (const size of ["a4", "a5", "a6"] as const) {
          interface RenderRecord {
            type: string;
            text?: string;
            x?: number;
            y?: number;
            w?: number;
            h?: number;
          }
          const records: RenderRecord[] = [];

          globalThis.document = {
            createElement: (tag: string) => {
              if (tag === "canvas") {
                const canvasObj = {
                  width: 0,
                  height: 0,
                  getContext: () => ({
                    fillStyle: "",
                    strokeStyle: "",
                    lineWidth: 0,
                    font: "",
                    textAlign: "",
                    textBaseline: "",
                    fillRect: (x: number, y: number, w: number, h: number) => {
                      records.push({ type: "fillRect", x, y, w, h });
                    },
                    strokeRect: (x: number, y: number, w: number, h: number) => {
                      records.push({ type: "strokeRect", x, y, w, h });
                    },
                    beginPath: vi.fn(),
                    roundRect: (x: number, y: number, w: number, h: number) => {
                      records.push({ type: "roundRect", x, y, w, h });
                    },
                    fill: vi.fn(),
                    stroke: vi.fn(),
                    fillText: (text: string, x: number, y: number) => {
                      records.push({ type: "fillText", text, x, y });
                    },
                    arc: (x: number, y: number) => {
                      records.push({ type: "arc", x, y });
                    },
                    drawImage: (_img: unknown, x: number, y: number, w: number, h: number) => {
                      records.push({ type: "drawImage", x, y, w, h });
                    },
                    measureText: (text: string) => ({
                      width: text.length * 15,
                    }),
                  }),
                };
                return canvasObj as unknown as HTMLCanvasElement;
              }
              return {} as HTMLElement;
            },
          } as unknown as Document;

          const canvas = await renderPosterToCanvas({ ...extremeConfig, size });
          expect(canvas.width).toBeGreaterThan(0);
          expect(canvas.height).toBeGreaterThan(0);

          // 1. Verifikasi seluruh pemanggilan fillText berada dalam batas kanvas
          const textRecords = records.filter((r) => r.type === "fillText");
          expect(textRecords.length).toBeGreaterThan(5);
          for (const t of textRecords) {
            expect(t.y).toBeGreaterThanOrEqual(0);
            expect(t.y).toBeLessThanOrEqual(canvas.height);
            expect(t.x).toBeGreaterThanOrEqual(0);
            expect(t.x).toBeLessThanOrEqual(canvas.width);
          }

          // 2. Verifikasi posisi gambar QR Code berada di dalam batas kanvas
          const qrImageRecord = records.find((r) => r.type === "drawImage");
          expect(qrImageRecord).toBeDefined();
          expect(qrImageRecord!.y).toBeGreaterThan(0);
          expect(qrImageRecord!.y! + qrImageRecord!.h!).toBeLessThan(canvas.height);

          // 3. Verifikasi posisi elemen langkah berada di bawah QR dan di atas footer
          const stepRecords = records.filter((r) => r.type === "roundRect");
          expect(stepRecords.length).toBeGreaterThanOrEqual(4);
          const stepCards = stepRecords.slice(-3);
          const footerText = textRecords.find((t) => t.text?.includes("browser:"));
          expect(footerText).toBeDefined();

          for (const step of stepCards) {
            const stepBottom = step.y! + step.h!;
            expect(stepBottom).toBeLessThan(footerText!.y!);
            expect(stepBottom).toBeLessThan(canvas.height);
          }

          // 4. Verifikasi teks footer terakhir tidak melebihi kanvas
          const lastText = textRecords[textRecords.length - 1];
          expect(lastText.y).toBeLessThan(canvas.height);
        }
      } finally {
        globalThis.document = originalDocument;
        (globalThis as unknown as { Image: unknown }).Image = originalImage;
      }
    });
  });

  describe("exportPosterToWordDoc()", () => {
    it("menghasilkan Blob dokumen Word (.doc) berbasis MHTML yang valid", async () => {
      const originalDocument = globalThis.document;
      const originalImage = (globalThis as unknown as { Image: unknown }).Image;

      globalThis.document = {
        createElement: (tag: string) => {
          if (tag === "canvas") {
            return {
              width: 100,
              height: 100,
              toDataURL: () => "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
              getContext: () => ({
                fillRect: vi.fn(),
                strokeRect: vi.fn(),
                beginPath: vi.fn(),
                roundRect: vi.fn(),
                fill: vi.fn(),
                stroke: vi.fn(),
                fillText: vi.fn(),
                arc: vi.fn(),
                drawImage: vi.fn(),
                measureText: () => ({ width: 50 }),
              }),
            } as unknown as HTMLCanvasElement;
          }
          return {} as HTMLElement;
        },
      } as unknown as Document;

      class MockImage {
        crossOrigin = "";
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        private _src = "";
        set src(val: string) {
          this._src = val;
          setTimeout(() => {
            if (this.onload) this.onload();
          }, 0);
        }
        get src() {
          return this._src;
        }
      }
      (globalThis as unknown as { Image: unknown }).Image = MockImage;

      try {
        const blob = await exportPosterToWordDoc({
          size: "a6",
          storeName: "Rumah Makan Sipil",
          tagline: "Makan Enak, Setiap Hari",
          qrDataUrl: "data:image/png;base64,dummy",
          siteUrl: "https://rumah-makan-sipil.vercel.app",
        });

        expect(blob).toBeInstanceOf(Blob);
        expect(blob.type).toBe("application/msword;charset=utf-8");

        const text = await blob.text();
        expect(text).toContain("MIME-Version: 1.0");
        expect(text).toContain("multipart/related");
        expect(text).toContain("w:WordDocument");
        expect(text).toContain("<w:View>Print</w:View>");
        expect(text).toContain("poster-rms.png");
      } finally {
        globalThis.document = originalDocument;
        (globalThis as unknown as { Image: unknown }).Image = originalImage;
      }
    });
  });
});
