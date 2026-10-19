import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  calculateCrop4x3,
  calculateMaxOffset,
  clampCropTransform,
  compressAndCropMenuPhoto,
  MAX_IMAGE_FILE_SIZE,
  MAX_OUTPUT_HEIGHT,
  MAX_OUTPUT_WIDTH,
  renderImageToCanvas,
  TARGET_ASPECT_RATIO,
  validateImageFile,
} from "./image-compression";

describe("image-compression", () => {
  describe("konstanta", () => {
    it("memiliki nilai konstanta yang sesuai spesifikasi", () => {
      expect(MAX_IMAGE_FILE_SIZE).toBe(5 * 1024 * 1024);
      expect(ALLOWED_IMAGE_MIME_TYPES).toEqual([
        "image/jpeg",
        "image/png",
        "image/webp",
      ]);
      expect(MAX_OUTPUT_WIDTH).toBe(1200);
      expect(MAX_OUTPUT_HEIGHT).toBe(900);
      expect(TARGET_ASPECT_RATIO).toBeCloseTo(4 / 3, 5);
    });
  });

  describe("validateImageFile", () => {
    it("menerima file dengan MIME type jpeg, png, atau webp dalam batas ukuran 5 MB", () => {
      const validJpeg = new File(["dummy content"], "menu.jpg", {
        type: "image/jpeg",
      });
      const validPng = new File(["dummy content"], "menu.png", {
        type: "image/png",
      });
      const validWebp = new File(["dummy content"], "menu.webp", {
        type: "image/webp",
      });

      expect(validateImageFile(validJpeg)).toEqual({ valid: true });
      expect(validateImageFile(validPng)).toEqual({ valid: true });
      expect(validateImageFile(validWebp)).toEqual({ valid: true });
    });

    it("menolak file dengan MIME type selain JPG, PNG, atau WebP", () => {
      const invalidGif = new File(["dummy content"], "menu.gif", {
        type: "image/gif",
      });
      const invalidPdf = new File(["dummy content"], "document.pdf", {
        type: "application/pdf",
      });
      const invalidText = new File(["dummy content"], "note.txt", {
        type: "text/plain",
      });

      expect(validateImageFile(invalidGif)).toEqual({
        valid: false,
        error: "Format file harus JPG, PNG, atau WebP.",
      });
      expect(validateImageFile(invalidPdf)).toEqual({
        valid: false,
        error: "Format file harus JPG, PNG, atau WebP.",
      });
      expect(validateImageFile(invalidText)).toEqual({
        valid: false,
        error: "Format file harus JPG, PNG, atau WebP.",
      });
    });

    it("menolak file yang ukurannya melebihi 5 MB", () => {
      // 5 MB + 1 byte
      const oversizedFile = new File(["a"], "big.jpg", {
        type: "image/jpeg",
      });
      Object.defineProperty(oversizedFile, "size", {
        value: 5 * 1024 * 1024 + 1,
      });

      expect(validateImageFile(oversizedFile)).toEqual({
        valid: false,
        error: "Ukuran file maksimal 5 MB.",
      });
    });

    it("menerima file yang ukurannya tepat 5 MB", () => {
      const exact5MbFile = new File(["a"], "exact.jpg", {
        type: "image/jpeg",
      });
      Object.defineProperty(exact5MbFile, "size", {
        value: 5 * 1024 * 1024,
      });

      expect(validateImageFile(exact5MbFile)).toEqual({ valid: true });
    });
  });

  describe("calculateCrop4x3", () => {
    it("memotong landscape 16:9 secara horizontal di tengah", () => {
      // 1600x900 -> sw: 1200, sx: 200, sh: 900, sy: 0, outWidth: 1200, outHeight: 900
      const result = calculateCrop4x3(1600, 900);
      expect(result).toEqual({
        sx: 200,
        sy: 0,
        sw: 1200,
        sh: 900,
        outWidth: 1200,
        outHeight: 900,
      });
    });

    it("memotong portrait 900x1600 secara vertikal di tengah", () => {
      // 900x1600 -> sw: 900, sx: 0, sh: 675, sy: 463, outWidth: 900, outHeight: 675
      const result = calculateCrop4x3(900, 1600);
      expect(result).toEqual({
        sx: 0,
        sy: 463,
        sw: 900,
        sh: 675,
        outWidth: 900,
        outHeight: 675,
      });
    });

    it("mengecilkan (downscale) gambar 4:3 berukuran besar ke maksimal 1200x900", () => {
      // 2400x1800 (sudah 4:3) -> downscale ke 1200x900
      const result = calculateCrop4x3(2400, 1800);
      expect(result).toEqual({
        sx: 0,
        sy: 0,
        sw: 2400,
        sh: 1800,
        outWidth: 1200,
        outHeight: 900,
      });
    });

    it("mempertahankan dimensi gambar 4:3 yang ukurannya di bawah 1200x900", () => {
      // 800x600 (sudah 4:3) -> tetap 800x600
      const result = calculateCrop4x3(800, 600);
      expect(result).toEqual({
        sx: 0,
        sy: 0,
        sw: 800,
        sh: 600,
        outWidth: 800,
        outHeight: 600,
      });
    });

    it("memotong dan mendownscale gambar ultra-wide besar", () => {
      // 3000x1000 -> ratio 3 > 4/3 -> sw = 1333, sx = (3000 - 1333)/2 = 834, sh = 1000
      // sw > 1200 -> outWidth = 1200, outHeight = Math.round(1000 * (1200 / 1333)) = 900
      const result = calculateCrop4x3(3000, 1000);
      expect(result.outWidth).toBe(1200);
      expect(result.outHeight).toBe(900);
      expect(result.sw).toBe(1333);
      expect(result.sh).toBe(1000);
      expect(result.sx).toBe(834);
      expect(result.sy).toBe(0);
    });

    it("memotong gambar bujur sangkar (1:1) di tengah vertikal", () => {
      // 1000x1000 -> ratio 1 < 4/3 -> sh = 750, sy = (1000 - 750)/2 = 125, sw = 1000, sx = 0
      const result = calculateCrop4x3(1000, 1000);
      expect(result).toEqual({
        sx: 0,
        sy: 125,
        sw: 1000,
        sh: 750,
        outWidth: 1000,
        outHeight: 750,
      });
    });

    it("melempar error jika dimensi gambar tidak valid atau nol/negatif", () => {
      expect(() => calculateCrop4x3(0, 500)).toThrow(
        "Dimensi gambar harus angka positif yang valid."
      );
      expect(() => calculateCrop4x3(500, -10)).toThrow(
        "Dimensi gambar harus angka positif yang valid."
      );
      expect(() => calculateCrop4x3(Number.NaN, 500)).toThrow(
        "Dimensi gambar harus angka positif yang valid."
      );
    });
  });

  describe("compressAndCropMenuPhoto", () => {
    let originalWindow: typeof globalThis.window;
    let originalDocument: typeof globalThis.document;
    let originalImage: typeof globalThis.Image;
    let originalCreateObjectURL: typeof URL.createObjectURL;
    let originalRevokeObjectURL: typeof URL.revokeObjectURL;

    let mockCanvas: {
      width: number;
      height: number;
      getContext: ReturnType<typeof vi.fn>;
      toBlob: ReturnType<typeof vi.fn>;
    };
    let drawImageMock: ReturnType<typeof vi.fn>;
    let fillRectMock: ReturnType<typeof vi.fn>;
    let saveMock: ReturnType<typeof vi.fn>;
    let restoreMock: ReturnType<typeof vi.fn>;
    let toBlobMock: ReturnType<typeof vi.fn>;
    let createObjectURLMock: ReturnType<typeof vi.fn>;
    let revokeObjectURLMock: ReturnType<typeof vi.fn>;

    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 1600;
      naturalHeight = 900;
      width = 1600;
      height = 900;
      private _src = "";

      get src() {
        return this._src;
      }
      set src(value: string) {
        this._src = value;
        setTimeout(() => {
          if (value.includes("corrupt")) {
            this.onerror?.();
          } else {
            this.onload?.();
          }
        }, 0);
      }
    }

    beforeEach(() => {
      originalWindow = globalThis.window;
      originalDocument = globalThis.document;
      originalImage = globalThis.Image;
      originalCreateObjectURL = URL.createObjectURL;
      originalRevokeObjectURL = URL.revokeObjectURL;

      drawImageMock = vi.fn();
      toBlobMock = vi.fn(
        (callback: (blob: Blob | null) => void) => {
          callback(new Blob(["compressed-webp"], { type: "image/webp" }));
        }
      );

      fillRectMock = vi.fn();
      saveMock = vi.fn();
      restoreMock = vi.fn();

      mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue({
          drawImage: drawImageMock,
          fillRect: fillRectMock,
          save: saveMock,
          restore: restoreMock,
          fillStyle: "",
        }),
        toBlob: toBlobMock,
      };

      createObjectURLMock = vi.fn().mockReturnValue("blob:http://localhost/test-uuid");
      revokeObjectURLMock = vi.fn();
      URL.createObjectURL = createObjectURLMock as unknown as typeof URL.createObjectURL;
      URL.revokeObjectURL = revokeObjectURLMock as unknown as typeof URL.revokeObjectURL;

      // Mock DOM environment
      globalThis.window = {} as unknown as Window & typeof globalThis;
      globalThis.document = {
        createElement: vi.fn((tag: string) => {
          if (tag === "canvas") return mockCanvas;
          return {};
        }),
      } as unknown as Document;
      globalThis.Image = MockImage as unknown as typeof Image;
    });

    afterEach(() => {
      globalThis.window = originalWindow;
      globalThis.document = originalDocument;
      globalThis.Image = originalImage;
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      vi.restoreAllMocks();
    });

    it("menolak dan melempar error sebelum proses jika file tidak valid", async () => {
      const invalidFile = new File(["dummy"], "file.txt", {
        type: "text/plain",
      });

      await expect(compressAndCropMenuPhoto(invalidFile)).rejects.toThrow(
        "Format file harus JPG, PNG, atau WebP."
      );
      expect(createObjectURLMock).not.toHaveBeenCalled();
    });

    it("berhasil memuat gambar, memotong ke 4:3, menggambar ke canvas, dan menghasilkan blob WebP", async () => {
      const validFile = new File(["photo-bytes"], "photo.jpg", {
        type: "image/jpeg",
      });

      const result = await compressAndCropMenuPhoto(validFile);

      expect(createObjectURLMock).toHaveBeenCalledWith(validFile);
      expect(mockCanvas.width).toBe(1200);
      expect(mockCanvas.height).toBe(900);
      expect(drawImageMock).toHaveBeenCalledWith(
        expect.any(MockImage),
        200, // sx
        0,   // sy
        1200,// sw
        900, // sh
        0,   // dx
        0,   // dy
        1200,// dWidth
        900  // dHeight
      );
      expect(toBlobMock).toHaveBeenCalledWith(
        expect.any(Function),
        "image/webp",
        0.8
      );
      expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:http://localhost/test-uuid");

      expect(result.width).toBe(1200);
      expect(result.height).toBe(900);
      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.blob.type).toBe("image/webp");
    });

    it("membersihkan object URL dan melempar error jika gambar korup/gagal dimuat", async () => {
      createObjectURLMock.mockReturnValue("blob:http://localhost/corrupt-image");
      const corruptFile = new File(["bad data"], "corrupt.jpg", {
        type: "image/jpeg",
      });

      await expect(compressAndCropMenuPhoto(corruptFile)).rejects.toThrow(
        "Gagal memuat gambar. Pastikan file gambar tidak korup."
      );
      expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:http://localhost/corrupt-image");
    });

    it("melempar error jika getContext canvas mengembalikan null", async () => {
      mockCanvas.getContext.mockReturnValue(null);
      const validFile = new File(["photo-bytes"], "photo.png", {
        type: "image/png",
      });

      await expect(compressAndCropMenuPhoto(validFile)).rejects.toThrow(
        "Gagal menginisialisasi canvas 2D context."
      );
      expect(revokeObjectURLMock).toHaveBeenCalled();
    });

    it("melempar error jika canvas toBlob menghasilkan null", async () => {
      toBlobMock.mockImplementation((callback: (blob: Blob | null) => void) => {
        callback(null);
      });
      const validFile = new File(["photo-bytes"], "photo.webp", {
        type: "image/webp",
      });

      await expect(compressAndCropMenuPhoto(validFile)).rejects.toThrow(
        "Gagal mengonversi canvas ke blob WebP."
      );
      expect(revokeObjectURLMock).toHaveBeenCalled();
    });

    it("melempar error jika dipanggil di luar browser (SSR)", async () => {
      // @ts-expect-error simulasi environment SSR
      delete globalThis.window;
      const validFile = new File(["photo-bytes"], "photo.jpg", {
        type: "image/jpeg",
      });

      await expect(compressAndCropMenuPhoto(validFile)).rejects.toThrow(
        "compressAndCropMenuPhoto hanya dapat dijalankan di lingkungan browser."
      );
    });

    it("mendukung transform kustom (zoom dan offset) via renderImageToCanvas", async () => {
      const validFile = new File(["photo-bytes"], "photo.jpg", {
        type: "image/jpeg",
      });

      const result = await compressAndCropMenuPhoto(validFile, {
        zoom: 1.5,
        offsetX: 50,
        offsetY: -30,
      });

      expect(mockCanvas.width).toBe(1200);
      expect(mockCanvas.height).toBe(900);
      expect(fillRectMock).toHaveBeenCalledWith(0, 0, 1200, 900);
      expect(drawImageMock).toHaveBeenCalled();
      expect(result.width).toBe(1200);
      expect(result.height).toBe(900);
    });
  });

  describe("calculateMaxOffset", () => {
    it("mengembalikan 0 jika dimensi gambar sama persis dengan dimensi kanvas", () => {
      expect(calculateMaxOffset(1200, 1200)).toBe(0);
      expect(calculateMaxOffset(900, 900)).toBe(0);
    });

    it("mengembalikan setengah selisih jika dimensi gambar lebih besar dari kanvas", () => {
      expect(calculateMaxOffset(1600, 1200)).toBe(200);
      expect(calculateMaxOffset(2400, 1200)).toBe(600);
      expect(calculateMaxOffset(1800, 900)).toBe(450);
    });

    it("mengembalikan setengah selisih jika dimensi gambar lebih kecil dari kanvas (zoom out)", () => {
      expect(calculateMaxOffset(800, 1200)).toBe(200);
      expect(calculateMaxOffset(600, 900)).toBe(150);
    });

    it("mengembalikan 0 untuk input non-finite atau non-positif", () => {
      expect(calculateMaxOffset(0, 1200)).toBe(0);
      expect(calculateMaxOffset(-100, 1200)).toBe(0);
      expect(calculateMaxOffset(Number.NaN, 1200)).toBe(0);
      expect(calculateMaxOffset(1200, 0)).toBe(0);
      expect(calculateMaxOffset(Number.POSITIVE_INFINITY, 1200)).toBe(0);
    });
  });

  describe("clampCropTransform", () => {
    it("membatasi offset horizontal pada gambar landscape 16:9", () => {
      // 1600x900 pada canvas 1200x900, zoom 1
      // baseScale = 1.0, drawWidth = 1600, drawHeight = 900
      // maxOffsetX = 200, maxOffsetY = 0
      const clamped = clampCropTransform(
        { zoom: 1, offsetX: 500, offsetY: 100 },
        1600,
        900,
        1200,
        900
      );
      expect(clamped).toEqual({ zoom: 1, offsetX: 200, offsetY: 0 });

      const clampedNeg = clampCropTransform(
        { zoom: 1, offsetX: -500, offsetY: -100 },
        1600,
        900,
        1200,
        900
      );
      expect(clampedNeg).toEqual({ zoom: 1, offsetX: -200, offsetY: 0 });
    });

    it("membatasi offset vertikal pada gambar portrait 900x1600", () => {
      // 900x1600 pada canvas 1200x900, zoom 1
      // baseScale = max(1200/900, 900/1600) = 4/3 = 1.3333333333
      // drawWidth = 1200, drawHeight = 2133.3333
      // maxOffsetX = 0, maxOffsetY = Math.round((2133.3333 - 900) / 2) = 617
      const clamped = clampCropTransform(
        { zoom: 1, offsetX: 50, offsetY: 2000 },
        900,
        1600,
        1200,
        900
      );
      expect(clamped).toEqual({ zoom: 1, offsetX: 0, offsetY: 617 });

      const clampedNeg = clampCropTransform(
        { zoom: 1, offsetX: -50, offsetY: -2000 },
        900,
        1600,
        1200,
        900
      );
      expect(clampedNeg).toEqual({ zoom: 1, offsetX: 0, offsetY: -617 });
    });

    it("membatasi kedua sumbu saat zoom in (zoom > 1)", () => {
      // 1200x900 pada canvas 1200x900, zoom 2.0
      // baseScale = 1.0, drawWidth = 2400, drawHeight = 1800
      // maxOffsetX = 600, maxOffsetY = 450
      const clamped = clampCropTransform(
        { zoom: 2.0, offsetX: 1000, offsetY: -1000 },
        1200,
        900,
        1200,
        900
      );
      expect(clamped).toEqual({ zoom: 2.0, offsetX: 600, offsetY: -450 });
    });

    it("menjaga gambar tetap berada di dalam kanvas saat zoom out (zoom < 1)", () => {
      // 1200x900 pada canvas 1200x900, zoom 0.5
      // baseScale = 1.0, drawWidth = 600, drawHeight = 450
      // maxOffsetX = (1200 - 600)/2 = 300, maxOffsetY = (900 - 450)/2 = 225
      const clamped = clampCropTransform(
        { zoom: 0.5, offsetX: 800, offsetY: -800 },
        1200,
        900,
        1200,
        900
      );
      expect(clamped).toEqual({ zoom: 0.5, offsetX: 300, offsetY: -225 });
    });

    it("mempertahankan offset jika masih berada dalam batas toleransi", () => {
      // 1600x900 pada canvas 1200x900, zoom 1.0
      // maxOffsetX = 200, maxOffsetY = 0
      const clamped = clampCropTransform(
        { zoom: 1.0, offsetX: 150, offsetY: 0 },
        1600,
        900,
        1200,
        900
      );
      expect(clamped).toEqual({ zoom: 1.0, offsetX: 150, offsetY: 0 });
    });

    it("mengembalikan default aman jika dimensi gambar tidak valid", () => {
      expect(
        clampCropTransform({ zoom: 1, offsetX: 100, offsetY: 100 }, 0, 900)
      ).toEqual({ zoom: 1, offsetX: 0, offsetY: 0 });
      expect(
        clampCropTransform({ zoom: 1, offsetX: 100, offsetY: 100 }, 1200, -10)
      ).toEqual({ zoom: 1, offsetX: 0, offsetY: 0 });
    });
  });

  describe("renderImageToCanvas", () => {
    it("menggambar gambar ke canvas dengan background putih bersih dan koordinat yang sesuai", () => {
      const drawMock = vi.fn();
      const fillMock = vi.fn();
      const saveFn = vi.fn();
      const restoreFn = vi.fn();

      const canvas = {
        width: 1200,
        height: 900,
        getContext: vi.fn().mockReturnValue({
          drawImage: drawMock,
          fillRect: fillMock,
          save: saveFn,
          restore: restoreFn,
          fillStyle: "",
        }),
      } as unknown as HTMLCanvasElement;

      const img = {
        naturalWidth: 1000,
        naturalHeight: 2000,
      } as unknown as HTMLImageElement;

      // Base scale = max(1200/1000, 900/2000) = 1.2
      // Zoom 1.2 -> currentScale = 1.44
      // drawWidth = 1440, drawHeight = 2880
      // maxOffsetX = (1440 - 1200)/2 = 120
      // maxOffsetY = (2880 - 900)/2 = 990
      // drawX = (1200 - 1440)/2 + 20 = -120 + 20 = -100
      // drawY = (900 - 2880)/2 - 50 = -990 - 50 = -1040
      renderImageToCanvas(canvas, img, { zoom: 1.2, offsetX: 20, offsetY: -50 }, "#FFFFFF");

      expect(fillMock).toHaveBeenCalledWith(0, 0, 1200, 900);
      expect(drawMock).toHaveBeenCalledWith(img, -100, -1040, 1440, 2880);
    });

    it("mendukung zoom out untuk memuat seluruh gambar tinggi (fit)", () => {
      const drawMock = vi.fn();
      const fillMock = vi.fn();

      const canvas = {
        width: 1200,
        height: 900,
        getContext: vi.fn().mockReturnValue({
          drawImage: drawMock,
          fillRect: fillMock,
          save: vi.fn(),
          restore: vi.fn(),
          fillStyle: "",
        }),
      } as unknown as HTMLCanvasElement;

      const img = {
        naturalWidth: 1000,
        naturalHeight: 2000,
      } as unknown as HTMLImageElement;

      // Base scale = 1.2.
      // Jika zoom = 0.375 (fit): currentScale = 1.2 * 0.375 = 0.45
      // drawWidth = 1000 * 0.45 = 450, drawHeight = 2000 * 0.45 = 900
      // drawX = (1200 - 450)/2 = 375, drawY = (900 - 900)/2 = 0
      renderImageToCanvas(canvas, img, { zoom: 0.375, offsetX: 0, offsetY: 0 });

      expect(drawMock).toHaveBeenCalledWith(img, 375, 0, 450, 900);
    });

    it("membatasi (clamp) offset agar gambar tidak pernah digeser keluar kanvas", () => {
      const drawMock = vi.fn();
      const fillMock = vi.fn();

      const canvas = {
        width: 1200,
        height: 900,
        getContext: vi.fn().mockReturnValue({
          drawImage: drawMock,
          fillRect: fillMock,
          save: vi.fn(),
          restore: vi.fn(),
          fillStyle: "",
        }),
      } as unknown as HTMLCanvasElement;

      const img = {
        naturalWidth: 1600,
        naturalHeight: 900,
      } as unknown as HTMLImageElement;

      // Base scale = max(1200/1600, 900/900) = 1.0
      // drawWidth = 1600, drawHeight = 900
      // maxOffsetX = (1600 - 1200)/2 = 200, maxOffsetY = 0
      // Kirim offset ekstrim yang jauh melebihi batas kanvas
      renderImageToCanvas(canvas, img, { zoom: 1.0, offsetX: 99999, offsetY: -88888 });

      // Harus di-clamp ke maxOffsetX: 200 dan maxOffsetY: 0
      // drawX = (1200 - 1600)/2 + 200 = 0
      // drawY = (900 - 900)/2 + 0 = 0
      expect(drawMock).toHaveBeenCalledWith(img, 0, 0, 1600, 900);
    });
  });
});
