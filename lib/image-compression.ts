/**
 * Modul kompresi & auto center-crop rasio 4:3 foto menu di browser.
 * Menggunakan HTML5 Canvas standar tanpa dependensi library eksternal.
 */

export const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024; // 5 MB (5.242.880 bytes)

export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

export const MAX_OUTPUT_WIDTH = 1200;
export const MAX_OUTPUT_HEIGHT = 900;
export const TARGET_ASPECT_RATIO = 4 / 3;

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

export interface CropResult {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  outWidth: number;
  outHeight: number;
}

export interface CompressResult {
  blob: Blob;
  width: number;
  height: number;
}

/**
 * Validasi MIME type dan ukuran file gambar sebelum diproses.
 */
export function validateImageFile(file: File): ImageValidationResult {
  if (
    !ALLOWED_IMAGE_MIME_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_MIME_TYPES)[number])
  ) {
    return {
      valid: false,
      error: "Format file harus JPG, PNG, atau WebP.",
    };
  }

  if (file.size > MAX_IMAGE_FILE_SIZE) {
    return {
      valid: false,
      error: "Ukuran file maksimal 5 MB.",
    };
  }

  return { valid: true };
}

/**
 * Menghitung koordinat sumber crop tengah (sx, sy, sw, sh) dengan rasio target 4:3
 * dan dimensi target output (outWidth, outHeight) maksimal 1200x900.
 */
export function calculateCrop4x3(width: number, height: number): CropResult {
  if (width <= 0 || height <= 0 || !Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error("Dimensi gambar harus angka positif yang valid.");
  }

  const currentRatio = width / height;
  const diff = currentRatio - TARGET_ASPECT_RATIO;

  let sw: number;
  let sh: number;
  let sx: number;
  let sy: number;

  if (Math.abs(diff) < 1e-4) {
    // Sudah tepat rasio 4:3
    sw = width;
    sh = height;
    sx = 0;
    sy = 0;
  } else if (currentRatio > TARGET_ASPECT_RATIO) {
    // Gambar terlalu lebar (landscape lebar) -> potong horizontal di tengah
    sw = Math.round(height * TARGET_ASPECT_RATIO);
    sx = Math.round((width - sw) / 2);
    sh = height;
    sy = 0;
  } else {
    // Gambar terlalu tinggi (portrait / kotak) -> potong vertikal di tengah
    sh = Math.round(width / TARGET_ASPECT_RATIO);
    sy = Math.round((height - sh) / 2);
    sw = width;
    sx = 0;
  }

  let outWidth: number;
  let outHeight: number;

  if (sw > MAX_OUTPUT_WIDTH) {
    const scale = MAX_OUTPUT_WIDTH / sw;
    outWidth = MAX_OUTPUT_WIDTH;
    outHeight = Math.round(sh * scale);
  } else {
    outWidth = sw;
    outHeight = sh;
  }

  return { sx, sy, sw, sh, outWidth, outHeight };
}

/**
 * Melakukan auto center-crop 4:3, downscaling maksimal 1200x900,
 * dan kompresi WebP 80% pada file foto menu di browser via HTML5 Canvas.
 */
export async function compressAndCropMenuPhoto(file: File): Promise<CompressResult> {
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error || "File gambar tidak valid.");
  }

  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error(
      "compressAndCropMenuPhoto hanya dapat dijalankan di lingkungan browser."
    );
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () =>
        reject(
          new Error("Gagal memuat gambar. Pastikan file gambar tidak korup.")
        );
      image.src = objectUrl;
    });

    const { sx, sy, sw, sh, outWidth, outHeight } = calculateCrop4x3(
      img.naturalWidth || img.width,
      img.naturalHeight || img.height
    );

    const canvas = document.createElement("canvas");
    canvas.width = outWidth;
    canvas.height = outHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Gagal menginisialisasi canvas 2D context.");
    }

    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outWidth, outHeight);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) {
            resolve(b);
          } else {
            reject(new Error("Gagal mengonversi canvas ke blob WebP."));
          }
        },
        "image/webp",
        0.8
      );
    });

    return {
      blob,
      width: outWidth,
      height: outHeight,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
