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
  calculateCrc32,
  embedPngDpi,
  extractPngDpi,
  exportPosterToPngBlob,
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

    it("menjalankan renderPosterToCanvas aktual dan memverifikasi seluruh bounding box elemen berada di dalam batas kanvas untuk A4, A5, dan A6", async () => {
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
          interface BoundingBoxRecord {
            type: "fillText" | "drawImage" | "roundRect" | "strokeRect" | "fillRect";
            text?: string;
            left: number;
            right: number;
            top: number;
            bottom: number;
            width: number;
            height: number;
          }
          const recordedBoxes: BoundingBoxRecord[] = [];

          globalThis.document = {
            createElement: (tag: string) => {
              if (tag === "canvas") {
                const canvasObj = {
                  width: 0,
                  height: 0,
                  getContext: () => {
                    const ctxState = {
                      fillStyle: "",
                      strokeStyle: "",
                      lineWidth: 0,
                      font: 'bold 20px "Plus Jakarta Sans"',
                      textAlign: "center" as CanvasTextAlign,
                      textBaseline: "alphabetic" as CanvasTextBaseline,
                      shadowColor: "",
                      shadowBlur: 0,
                      shadowOffsetY: 0,
                      beginPath: vi.fn(),
                      fill: vi.fn(),
                      stroke: vi.fn(),
                      arc: vi.fn(),
                      getFontSize: () => {
                        const match = ctxState.font.match(/(\d+(?:\.\d+)?)px/);
                        return match ? parseFloat(match[1]) : 20;
                      },
                      measureText: (text: string) => {
                        const fontSize = ctxState.getFontSize();
                        // Estimasi lebar rata-rata karakter proporsional (0.55 * fontSize)
                        const width = text.length * fontSize * 0.55;
                        return { width } as TextMetrics;
                      },
                      fillText: (text: string, x: number, y: number, maxWidth?: number) => {
                        const fontSize = ctxState.getFontSize();
                        const measured = ctxState.measureText(text).width;
                        const renderedWidth =
                          typeof maxWidth === "number" && maxWidth > 0
                            ? Math.min(measured, maxWidth)
                            : measured;

                        let left = x;
                        if (ctxState.textAlign === "center") {
                          left = x - renderedWidth / 2;
                        } else if (ctxState.textAlign === "right") {
                          left = x - renderedWidth;
                        }
                        const right = left + renderedWidth;

                        let top = y;
                        if (ctxState.textBaseline === "middle") {
                          top = y - fontSize / 2;
                        } else if (ctxState.textBaseline === "bottom") {
                          top = y - fontSize;
                        }
                        const bottom = top + fontSize;

                        recordedBoxes.push({
                          type: "fillText",
                          text,
                          left,
                          right,
                          top,
                          bottom,
                          width: renderedWidth,
                          height: fontSize,
                        });
                      },
                      drawImage: (_img: unknown, x: number, y: number, w: number, h: number) => {
                        recordedBoxes.push({
                          type: "drawImage",
                          left: x,
                          right: x + w,
                          top: y,
                          bottom: y + h,
                          width: w,
                          height: h,
                        });
                      },
                      roundRect: (x: number, y: number, w: number, h: number) => {
                        recordedBoxes.push({
                          type: "roundRect",
                          left: x,
                          right: x + w,
                          top: y,
                          bottom: y + h,
                          width: w,
                          height: h,
                        });
                      },
                      strokeRect: (x: number, y: number, w: number, h: number) => {
                        recordedBoxes.push({
                          type: "strokeRect",
                          left: x,
                          right: x + w,
                          top: y,
                          bottom: y + h,
                          width: w,
                          height: h,
                        });
                      },
                      fillRect: (x: number, y: number, w: number, h: number) => {
                        recordedBoxes.push({
                          type: "fillRect",
                          left: x,
                          right: x + w,
                          top: y,
                          bottom: y + h,
                          width: w,
                          height: h,
                        });
                      },
                    };
                    return ctxState;
                  },
                };
                return canvasObj as unknown as HTMLCanvasElement;
              }
              return {} as HTMLElement;
            },
          } as unknown as Document;

          const canvas = await renderPosterToCanvas({ ...extremeConfig, size });
          expect(canvas.width).toBeGreaterThan(0);
          expect(canvas.height).toBeGreaterThan(0);

          // 1. Verifikasi batas horizontal dan vertikal setiap elemen teks (fillText)
          const textBoxes = recordedBoxes.filter((b) => b.type === "fillText");
          expect(textBoxes.length).toBeGreaterThan(5);
          for (const tb of textBoxes) {
            expect(tb.left).toBeGreaterThanOrEqual(0);
            expect(tb.right).toBeLessThanOrEqual(canvas.width);
            expect(tb.top).toBeGreaterThanOrEqual(0);
            expect(tb.bottom).toBeLessThanOrEqual(canvas.height);
          }

          // 2. Verifikasi batas horizontal dan vertikal gambar QR Code (drawImage)
          const qrImageBox = recordedBoxes.find((b) => b.type === "drawImage");
          expect(qrImageBox).toBeDefined();
          expect(qrImageBox!.left).toBeGreaterThanOrEqual(0);
          expect(qrImageBox!.right).toBeLessThanOrEqual(canvas.width);
          expect(qrImageBox!.top).toBeGreaterThanOrEqual(0);
          expect(qrImageBox!.bottom).toBeLessThanOrEqual(canvas.height);
          // QR Code terpusat secara horizontal di tengah kanvas
          expect(
            Math.abs((qrImageBox!.left + qrImageBox!.right) / 2 - canvas.width / 2)
          ).toBeLessThan(2);

          // 3. Verifikasi bounding box wadah QR dan kartu 3 langkah pemesanan
          const roundRectBoxes = recordedBoxes.filter((b) => b.type === "roundRect");
          // roundRect: 1 wadah QR + 1 badge scan + 3 kartu langkah
          expect(roundRectBoxes.length).toBeGreaterThanOrEqual(4);
          for (const box of roundRectBoxes) {
            expect(box.left).toBeGreaterThanOrEqual(0);
            expect(box.right).toBeLessThanOrEqual(canvas.width);
            expect(box.top).toBeGreaterThanOrEqual(0);
            expect(box.bottom).toBeLessThanOrEqual(canvas.height);
          }

          // Tiga kartu langkah pemesanan berada di bawah QR Code dan di atas teks footer
          const stepCards = roundRectBoxes.slice(-3);
          const footerText = textBoxes.find((t) => t.text?.includes("browser:"));
          expect(footerText).toBeDefined();

          for (const step of stepCards) {
            expect(step.top).toBeGreaterThan(qrImageBox!.bottom);
            expect(step.bottom).toBeLessThan(footerText!.top);
          }

          // 4. Verifikasi teks footer terakhir berada rapi di atas tepi bawah kanvas
          const lastTextBox = textBoxes[textBoxes.length - 1];
          expect(lastTextBox.left).toBeGreaterThanOrEqual(0);
          expect(lastTextBox.right).toBeLessThanOrEqual(canvas.width);
          expect(lastTextBox.bottom).toBeLessThanOrEqual(canvas.height);
        }
      } finally {
        globalThis.document = originalDocument;
        (globalThis as unknown as { Image: unknown }).Image = originalImage;
      }
    });
  });

  describe("Metadata Resolusi PNG 300 DPI (chunk pHYs)", () => {
    it("menghitung CRC-32 secara presisi untuk data chunk pHYs", () => {
      // Type 'pHYs' + 11811 px/m X + 11811 px/m Y + unit meter (0x01)
      const chunkData = new Uint8Array([
        0x70, 0x48, 0x59, 0x73, 0x00, 0x00, 0x2e, 0x23, 0x00, 0x00, 0x2e, 0x23, 0x01,
      ]);
      const crc = calculateCrc32(chunkData);
      expect(crc).toBe(0x78a53f76);
    });

    it("menyematkan chunk pHYs 300 DPI ke dalam file PNG valid", async () => {
      // 1x1 piksel PNG dasar
      const minimalPngBase64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      const binaryString = atob(minimalPngBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const rawBlob = new Blob([bytes], { type: "image/png" });

      // Sebelum disematkan, tidak ada chunk pHYs
      const initialDpi = await extractPngDpi(rawBlob);
      expect(initialDpi).toBeNull();

      // Sematkan 300 DPI
      const dpiBlob = await embedPngDpi(rawBlob, 300);
      expect(dpiBlob).toBeInstanceOf(Blob);
      expect(dpiBlob.size).toBe(rawBlob.size + 21); // Tambahan persis 21 byte chunk pHYs

      // Ekstraksi kembali dan pastikan nilainya 300 DPI
      const extractedDpi = await extractPngDpi(dpiBlob);
      expect(extractedDpi).toBe(300);
    });

    it("exportPosterToPngBlob menghasilkan blob PNG yang memiliki metadata 300 DPI", async () => {
      const originalDocument = globalThis.document;
      const originalImage = (globalThis as unknown as { Image: unknown }).Image;

      // 1x1 piksel PNG dasar untuk toBlob mock
      const minimalPngBase64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      const binaryString = atob(minimalPngBase64);
      const rawBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        rawBytes[i] = binaryString.charCodeAt(i);
      }

      globalThis.document = {
        createElement: (tag: string) => {
          if (tag === "canvas") {
            return {
              width: 100,
              height: 100,
              toBlob: (cb: (b: Blob) => void) => {
                cb(new Blob([rawBytes], { type: "image/png" }));
              },
              getContext: () => ({
                fillStyle: "",
                strokeStyle: "",
                lineWidth: 0,
                font: "",
                textAlign: "",
                textBaseline: "",
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
        const pngBlob = await exportPosterToPngBlob({
          size: "a6",
          storeName: "Rumah Makan Sipil",
          tagline: "Spesialis Masakan Rumahan",
          qrDataUrl: "data:image/png;base64,dummy",
          siteUrl: "https://rumah-makan-sipil.vercel.app",
        });

        expect(pngBlob).toBeInstanceOf(Blob);
        expect(pngBlob.type).toBe("image/png");

        const detectedDpi = await extractPngDpi(pngBlob);
        expect(detectedDpi).toBe(300);
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
