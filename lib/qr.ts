import QRCode from "qrcode";

export type PosterSize = "a4" | "a5" | "a6";

export interface PosterDimensions {
  width: number;
  height: number;
  ratio: number;
}

export interface PosterRenderConfig {
  size: PosterSize;
  storeName: string;
  tagline: string;
  qrDataUrl: string;
  siteUrl: string;
}

export interface StoreUrlValidation {
  isValid: boolean;
  isLocalhost: boolean;
  cleanUrl: string;
  warning?: string;
}

export interface PosterLayoutMetrics {
  width: number;
  height: number;
  outerMargin: number;
  innerMargin: number;
  contentMaxWidth: number;
  emblemY: number;
  emblemSize: number;
  storeNameY: number;
  storeNameHeight: number;
  taglineY: number;
  taglineHeight: number;
  qrCardY: number;
  qrCardWidth: number;
  qrCardHeight: number;
  stepsContainerY: number;
  stepBoxHeight: number;
  footerY: number;
  bottomSafeLimit: number;
  isSafe: boolean;
}

/**
 * Validasi URL kanonikal toko untuk target QR code.
 * Memeriksa skema protokol (http/https), format URL, dan mendeteksi host lokal (localhost).
 */
export function validateStoreUrl(rawUrl?: string): StoreUrlValidation {
  const trimmed = rawUrl?.trim() || "";
  if (!trimmed) {
    return {
      isValid: false,
      isLocalhost: false,
      cleanUrl: "http://localhost:3000",
      warning: "URL toko belum disetel.",
    };
  }

  const cleanUrl = trimmed.replace(/\/+$/, "");

  try {
    const parsed = new URL(cleanUrl);
    const isHttp = parsed.protocol === "http:" || parsed.protocol === "https:";
    const hostname = parsed.hostname.toLowerCase();
    const isLocalhost =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname.endsWith(".local");

    if (!isHttp) {
      return {
        isValid: false,
        isLocalhost: false,
        cleanUrl,
        warning: "Protokol URL harus berupa HTTP atau HTTPS.",
      };
    }

    let warning: string | undefined;
    if (isLocalhost) {
      warning =
        "URL mengarah ke localhost. Pastikan menyetel NEXT_PUBLIC_SITE_URL ke domain publik produksi agar kode QR dapat dibuka dari HP pelanggan.";
    }

    return {
      isValid: true,
      isLocalhost,
      cleanUrl,
      warning,
    };
  } catch {
    return {
      isValid: false,
      isLocalhost: false,
      cleanUrl,
      warning: "Format URL toko tidak valid.",
    };
  }
}

/**
 * Resolusi URL kanonikal toko untuk target QR code.
 * Membaca variabel NEXT_PUBLIC_SITE_URL, dengan fallback ke window.location.origin
 * atau fallbackOrigin, dan default ke http://localhost:3000.
 */
export function getStoreCanonicalUrl(fallbackOrigin?: string): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (envUrl) {
    const validated = validateStoreUrl(envUrl);
    if (validated.isValid) {
      return validated.cleanUrl;
    }
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    const origin = window.location.origin.trim();
    const validated = validateStoreUrl(origin);
    if (validated.isValid) {
      return validated.cleanUrl;
    }
  }

  if (fallbackOrigin?.trim()) {
    const validated = validateStoreUrl(fallbackOrigin);
    if (validated.isValid) {
      return validated.cleanUrl;
    }
  }

  return "http://localhost:3000";
}

/**
 * Pembangkitan data URL QR code berbasis PNG (Base64).
 */
export async function generateQrDataUrl(
  text: string,
  options?: {
    errorCorrectionLevel?: "L" | "M" | "Q" | "H";
    margin?: number;
    width?: number;
  }
): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: options?.errorCorrectionLevel ?? "M",
    margin: options?.margin ?? 2,
    width: options?.width ?? 600,
    color: {
      dark: "#1C1B18", // ink-900
      light: "#FFFFFF",
    },
  });
}

/**
 * Mendapatkan dimensi pixel untuk cetak 300 DPI berdasarkan ukuran A4 / A5 / A6.
 */
export function getPosterDimensions(size: PosterSize): PosterDimensions {
  if (size === "a6") {
    // A6: 105 x 148 mm -> ~1240 x 1748 px pada 300 DPI
    return {
      width: 1240,
      height: 1748,
      ratio: 1240 / 1748,
    };
  }

  if (size === "a5") {
    // A5: 148 x 210 mm -> ~1748 x 2480 px pada 300 DPI
    return {
      width: 1748,
      height: 2480,
      ratio: 1748 / 2480,
    };
  }

  // A4: 210 x 297 mm -> ~2480 x 3508 px pada 300 DPI
  return {
    width: 2480,
    height: 3508,
    ratio: 2480 / 3508,
  };
}

/**
 * Memotong URL panjang secara rapi jika melebihi batas karakter agar tidak dipipihkan secara jelek di canvas.
 */
export function truncateUrl(url: string, maxLength: number = 42): string {
  const clean = url.trim();
  if (clean.length <= maxLength) return clean;

  const keepStart = Math.floor((maxLength - 3) * 0.65);
  const keepEnd = maxLength - 3 - keepStart;
  return `${clean.slice(0, keepStart)}...${clean.slice(-keepEnd)}`;
}

/**
 * Memecah dan merender teks multi-baris pada Canvas dengan batas lebar (maxWidth)
 * dan batas jumlah baris (maxLines). Jika teks melebihi batas, baris terakhir diberi ellipsis (...).
 * Mengembalikan total tinggi teks yang dirender.
 */
export function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  startY: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number = 2
): number {
  const clean = text.trim();
  if (!clean) return 0;

  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const testLine = `${currentLine} ${words[i]}`;
    const metrics = ctx.measureText(testLine);
    if (metrics.width <= maxWidth) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = words[i];
      if (lines.length >= maxLines - 1) {
        const remaining = words.slice(i + 1).join(" ");
        if (remaining) {
          currentLine = `${currentLine} ${remaining}`;
        }
        break;
      }
    }
  }
  lines.push(currentLine);

  const renderLines = lines.slice(0, maxLines);
  const lastIndex = renderLines.length - 1;
  let lastLine = renderLines[lastIndex];

  if (ctx.measureText(lastLine).width > maxWidth || lines.length > maxLines) {
    while (
      ctx.measureText(`${lastLine}...`).width > maxWidth &&
      lastLine.length > 0
    ) {
      lastLine = lastLine.slice(0, -1).trim();
    }
    renderLines[lastIndex] = `${lastLine}...`;
  }

  renderLines.forEach((line, idx) => {
    ctx.fillText(line, x, startY + idx * lineHeight, maxWidth);
  });

  return renderLines.length * lineHeight;
}

/**
 * Menghitung tata letak vertikal poster secara proporsional dan terukur.
 * Menjamin semua elemen muat di dalam batas margin tanpa bertabrakan atau terpotong.
 */
export function calculatePosterLayout(
  config: PosterRenderConfig
): PosterLayoutMetrics {
  const { width, height } = getPosterDimensions(config.size);
  const outerMargin = width * 0.04;
  const innerMargin = width * 0.048;
  const contentMaxWidth = width - innerMargin * 2 - width * 0.06;

  // Header Emblem
  const emblemSize = width * 0.105;
  const emblemY = height * 0.06;

  // Nama Toko
  const storeNameY = emblemY + emblemSize + height * 0.02;
  const isLongStoreName = (config.storeName || "").length > 28;
  const storeFontSize = isLongStoreName ? width * 0.045 : width * 0.052;
  const storeLineHeight = storeFontSize * 1.25;
  const estimatedStoreLines = isLongStoreName ? 2 : 1;
  const storeNameHeight = estimatedStoreLines * storeLineHeight;

  // Tagline
  const taglineY = storeNameY + storeNameHeight + height * 0.01;
  const isLongTagline = (config.tagline || "").length > 45;
  const tagFontSize = isLongTagline ? width * 0.023 : width * 0.026;
  const tagLineHeight = tagFontSize * 1.35;
  const estimatedTagLines = isLongTagline ? 2 : 1;
  const taglineHeight = estimatedTagLines * tagLineHeight;

  // Kartu QR (ukuran proporsional)
  const qrCardWidth = width * 0.60;
  const qrCardHeight = width * 0.64;
  const qrCardY = taglineY + taglineHeight + height * 0.022;

  // 3 Langkah Pemesanan
  const stepsContainerY = qrCardY + qrCardHeight + height * 0.022;
  const stepBoxHeight = height * 0.075;

  // Footer URL
  const footerY = height - outerMargin - height * 0.035;
  const bottomSafeLimit = height - innerMargin;

  const lastElementBottom = stepsContainerY + stepBoxHeight;
  const isSafe = lastElementBottom < footerY - height * 0.04 && footerY + height * 0.02 <= bottomSafeLimit;

  return {
    width,
    height,
    outerMargin,
    innerMargin,
    contentMaxWidth,
    emblemY,
    emblemSize,
    storeNameY,
    storeNameHeight,
    taglineY,
    taglineHeight,
    qrCardY,
    qrCardWidth,
    qrCardHeight,
    stepsContainerY,
    stepBoxHeight,
    footerY,
    bottomSafeLimit,
    isSafe,
  };
}

export interface ActualPosterCoordinates {
  width: number;
  height: number;
  emblemBottom: number;
  storeNameY: number;
  taglineY: number;
  qrCardY: number;
  qrCardBottom: number;
  stepsContainerY: number;
  stepsBottom: number;
  footerTop: number;
  footerBottom: number;
  isWithinBounds: boolean;
}

/**
 * Menghitung koordinat vertikal aktual pasca-render untuk seluruh elemen poster
 * termasuk saat nama toko dan tagline panjang dirender secara multi-baris.
 */
export function computeActualPosterCoordinates(
  config: PosterRenderConfig,
  actualStoreLines: number = 2,
  actualTagLines: number = 2
): ActualPosterCoordinates {
  const layout = calculatePosterLayout(config);
  const { width, height } = layout;

  const isLongStoreName = (config.storeName || "").length > 28;
  const storeFontSize = isLongStoreName ? width * 0.045 : width * 0.052;
  const storeLineHeight = storeFontSize * 1.25;
  const storeHeight = actualStoreLines * storeLineHeight;

  const taglineY = layout.storeNameY + storeHeight + height * 0.01;
  const isLongTagline = (config.tagline || "").length > 45;
  const tagFontSize = isLongTagline ? width * 0.023 : width * 0.026;
  const tagLineHeight = tagFontSize * 1.35;
  const tagHeight = actualTagLines * tagLineHeight;

  const qrCardY = taglineY + tagHeight + height * 0.022;
  const qrCardBottom = qrCardY + layout.qrCardHeight;

  const stepsContainerY = qrCardBottom + height * 0.022;
  const stepsBottom = stepsContainerY + layout.stepBoxHeight;

  const footerTop = layout.footerY - width * 0.022;
  const footerBottom = layout.footerY + width * 0.02;

  const isWithinBounds =
    stepsBottom < footerTop &&
    footerBottom <= height - layout.innerMargin;

  return {
    width,
    height,
    emblemBottom: layout.emblemY + layout.emblemSize,
    storeNameY: layout.storeNameY,
    taglineY,
    qrCardY,
    qrCardBottom,
    stepsContainerY,
    stepsBottom,
    footerTop,
    footerBottom,
    isWithinBounds,
  };
}

/**
 * Render poster ke HTML Canvas offscreen beresolusi cetak tinggi (300 DPI).
 */
export async function renderPosterToCanvas(
  config: PosterRenderConfig
): Promise<HTMLCanvasElement> {
  const layout = calculatePosterLayout(config);
  const { width, height } = layout;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Gagal menginisialisasi 2D canvas context");
  }

  // 1. Latar Belakang (cream-50)
  ctx.fillStyle = "#FBF8F2";
  ctx.fillRect(0, 0, width, height);

  // 2. Double Border Dekoratif
  // Outer Border (green-900)
  ctx.strokeStyle = "#1F3D2B";
  ctx.lineWidth = width * 0.008;
  ctx.strokeRect(
    layout.outerMargin,
    layout.outerMargin,
    width - layout.outerMargin * 2,
    height - layout.outerMargin * 2
  );

  // Inner Border Aksen (brown-500)
  ctx.strokeStyle = "#A86A32";
  ctx.lineWidth = width * 0.003;
  ctx.strokeRect(
    layout.innerMargin,
    layout.innerMargin,
    width - layout.innerMargin * 2,
    height - layout.innerMargin * 2
  );

  // 3. Header: Monogram Emblem RMS
  const emblemX = width / 2 - layout.emblemSize / 2;
  ctx.fillStyle = "#2E5A3F"; // green-700
  ctx.beginPath();
  ctx.roundRect(
    emblemX,
    layout.emblemY,
    layout.emblemSize,
    layout.emblemSize,
    layout.emblemSize * 0.22
  );
  ctx.fill();

  ctx.fillStyle = "#FFFFFF";
  ctx.font = `bold ${layout.emblemSize * 0.45}px "Fraunces", serif, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("RMS", width / 2, layout.emblemY + layout.emblemSize / 2);

  // 4. Nama Toko & Tagline dengan Text Wrapping Aman
  const isLongStoreName = (config.storeName || "").length > 28;
  const storeFontSize = isLongStoreName ? width * 0.045 : width * 0.052;
  const storeLineHeight = storeFontSize * 1.25;

  ctx.fillStyle = "#1F3D2B"; // green-900
  ctx.font = `bold ${storeFontSize}px "Fraunces", serif, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const actualStoreHeight = drawWrappedText(
    ctx,
    config.storeName || "Rumah Makan Sipil",
    width / 2,
    layout.storeNameY,
    layout.contentMaxWidth,
    storeLineHeight,
    2
  );

  const actualTaglineY = layout.storeNameY + actualStoreHeight + height * 0.01;
  const isLongTagline = (config.tagline || "").length > 45;
  const tagFontSize = isLongTagline ? width * 0.023 : width * 0.026;
  const tagLineHeight = tagFontSize * 1.35;

  ctx.fillStyle = "#5C5A54"; // ink-600
  ctx.font = `500 ${tagFontSize}px "Plus Jakarta Sans", sans-serif`;

  const actualTagHeight = drawWrappedText(
    ctx,
    config.tagline || "Spesialis Masakan Rumahan & Ikan Bakar Khas Manado",
    width / 2,
    actualTaglineY,
    layout.contentMaxWidth,
    tagLineHeight,
    2
  );

  // 5. Container Kartu QR (Putih Bersih)
  const actualQrCardY = actualTaglineY + actualTagHeight + height * 0.022;
  const qrCardX = width / 2 - layout.qrCardWidth / 2;

  ctx.fillStyle = "#FFFFFF";
  ctx.shadowColor = "rgba(31, 61, 43, 0.08)";
  ctx.shadowBlur = width * 0.02;
  ctx.shadowOffsetY = width * 0.01;
  ctx.beginPath();
  ctx.roundRect(
    qrCardX,
    actualQrCardY,
    layout.qrCardWidth,
    layout.qrCardHeight,
    width * 0.035
  );
  ctx.fill();

  // Reset shadow
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Border kartu QR
  ctx.strokeStyle = "#E7E1D6"; // line
  ctx.lineWidth = width * 0.003;
  ctx.stroke();

  // Badge "SCAN UNTUK PESAN" di atas QR
  const badgeWidth = layout.qrCardWidth * 0.64;
  const badgeHeight = width * 0.06;
  const badgeX = width / 2 - badgeWidth / 2;
  const badgeY = actualQrCardY + width * 0.03;

  ctx.fillStyle = "#2E5A3F"; // green-700
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, badgeHeight / 2);
  ctx.fill();

  ctx.fillStyle = "#FFFFFF";
  ctx.font = `bold ${badgeHeight * 0.48}px "Plus Jakarta Sans", sans-serif`;
  ctx.textBaseline = "middle";
  ctx.fillText("SCAN UNTUK PESAN", width / 2, badgeY + badgeHeight / 2, badgeWidth);

  // 6. Draw QR Image ke dalam kartu
  if (config.qrDataUrl) {
    const qrImg = await loadImage(config.qrDataUrl);
    const qrImageSize = layout.qrCardWidth * 0.72;
    const qrImageX = width / 2 - qrImageSize / 2;
    const qrImageY = badgeY + badgeHeight + width * 0.02;
    ctx.drawImage(qrImg, qrImageX, qrImageY, qrImageSize, qrImageSize);
  }

  // 7. 3 Langkah Pemesanan
  const actualStepsContainerY = actualQrCardY + layout.qrCardHeight + height * 0.022;
  const stepBoxWidth = width * 0.25;
  const stepSpacing = width * 0.04;
  const totalStepsWidth = stepBoxWidth * 3 + stepSpacing * 2;
  const stepsStartX = width / 2 - totalStepsWidth / 2;

  const stepsData = [
    { num: "1", title: "Scan QR", desc: "Buka kamera HP" },
    { num: "2", title: "Pilih Menu", desc: "Pesan dari meja" },
    { num: "3", title: "Bayar & Tunggu", desc: "Kasir / QRIS" },
  ];

  for (let i = 0; i < 3; i++) {
    const sX = stepsStartX + i * (stepBoxWidth + stepSpacing);
    const step = stepsData[i];

    // Card background
    ctx.fillStyle = "#FFFFFF";
    ctx.strokeStyle = "#E7E1D6";
    ctx.lineWidth = width * 0.002;
    ctx.beginPath();
    ctx.roundRect(
      sX,
      actualStepsContainerY,
      stepBoxWidth,
      layout.stepBoxHeight,
      width * 0.02
    );
    ctx.fill();
    ctx.stroke();

    // Circle number badge
    const circleSize = width * 0.042;
    const circleX = sX + stepBoxWidth / 2;
    const circleY = actualStepsContainerY + layout.stepBoxHeight * 0.26;

    ctx.fillStyle = "#E3EDE5"; // green-100
    ctx.beginPath();
    ctx.arc(circleX, circleY, circleSize / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#1F3D2B"; // green-900
    ctx.font = `bold ${circleSize * 0.6}px "Plus Jakarta Sans", sans-serif`;
    ctx.textBaseline = "middle";
    ctx.fillText(step.num, circleX, circleY);

    // Text title & desc
    ctx.fillStyle = "#1C1B18"; // ink-900
    ctx.font = `bold ${width * 0.02}px "Plus Jakarta Sans", sans-serif`;
    ctx.textBaseline = "top";
    ctx.fillText(
      step.title,
      circleX,
      actualStepsContainerY + layout.stepBoxHeight * 0.5,
      stepBoxWidth * 0.9
    );

    ctx.fillStyle = "#5C5A54"; // ink-600
    ctx.font = `500 ${width * 0.016}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillText(
      step.desc,
      circleX,
      actualStepsContainerY + layout.stepBoxHeight * 0.72,
      stepBoxWidth * 0.92
    );
  }

  // 8. Footer URL (dengan truncate rapi jika sangat panjang)
  const displayUrl = truncateUrl(config.siteUrl || "http://localhost:3000", 45);

  ctx.fillStyle = "#5C5A54"; // ink-600
  ctx.font = `500 ${width * 0.02}px "Plus Jakarta Sans", sans-serif`;
  ctx.textBaseline = "middle";
  ctx.fillText(
    "Atau akses langsung melalui browser:",
    width / 2,
    layout.footerY - width * 0.022,
    layout.contentMaxWidth
  );

  ctx.fillStyle = "#2E5A3F"; // green-700
  ctx.font = `bold ${width * 0.023}px "Plus Jakarta Sans", sans-serif`;
  ctx.fillText(
    displayUrl,
    width / 2,
    layout.footerY + width * 0.01,
    layout.contentMaxWidth
  );

  return canvas;
}

// Tabel CRC-32 standar IEEE 802.3 untuk kalkulasi checksum chunk PNG
let pngCrcTable: Uint32Array | null = null;
function getPngCrcTable(): Uint32Array {
  if (pngCrcTable) return pngCrcTable;
  pngCrcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) {
        c = 0xedb88320 ^ (c >>> 1);
      } else {
        c = c >>> 1;
      }
    }
    pngCrcTable[n] = c >>> 0;
  }
  return pngCrcTable;
}

/**
 * Menghitung CRC-32 standar dari buffer data.
 */
export function calculateCrc32(data: Uint8Array): number {
  const table = getPngCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Menyematkan chunk pHYs metadata resolusi fisik (default 300 DPI = 11811 pixels/meter)
 * ke dalam biner gambar PNG agar aplikasi cetak dan sistem operasi mengenali resolusi cetak fisik.
 */
export async function embedPngDpi(blob: Blob, dpi: number = 300): Promise<Blob> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Verifikasi signature PNG (8 byte awal)
  if (
    bytes.length < 33 ||
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47 ||
    bytes[4] !== 0x0d ||
    bytes[5] !== 0x0a ||
    bytes[6] !== 0x1a ||
    bytes[7] !== 0x0a
  ) {
    return blob;
  }

  // Hitung pixels per meter (1 inch = 0.0254 meter)
  // 300 DPI = 300 / 0.0254 = ~11811 px/m
  const ppm = Math.round(dpi / 0.0254);
  const ppmX = ppm;
  const ppmY = ppm;

  // Bangun Type + Data chunk pHYs (13 byte)
  const chunkData = new Uint8Array(13);
  // "pHYs"
  chunkData[0] = 0x70;
  chunkData[1] = 0x48;
  chunkData[2] = 0x59;
  chunkData[3] = 0x73;
  // ppm X (4 bytes big-endian)
  chunkData[4] = (ppmX >>> 24) & 0xff;
  chunkData[5] = (ppmX >>> 16) & 0xff;
  chunkData[6] = (ppmX >>> 8) & 0xff;
  chunkData[7] = ppmX & 0xff;
  // ppm Y (4 bytes big-endian)
  chunkData[8] = (ppmY >>> 24) & 0xff;
  chunkData[9] = (ppmY >>> 16) & 0xff;
  chunkData[10] = (ppmY >>> 8) & 0xff;
  chunkData[11] = ppmY & 0xff;
  // Unit (1 = meter)
  chunkData[12] = 0x01;

  const crc = calculateCrc32(chunkData);

  // Total chunk pHYs: Length(4) + Type(4) + Data(9) + CRC(4) = 21 bytes
  const physChunk = new Uint8Array(21);
  physChunk[0] = 0x00;
  physChunk[1] = 0x00;
  physChunk[2] = 0x00;
  physChunk[3] = 0x09;
  physChunk.set(chunkData, 4);
  physChunk[17] = (crc >>> 24) & 0xff;
  physChunk[18] = (crc >>> 16) & 0xff;
  physChunk[19] = (crc >>> 8) & 0xff;
  physChunk[20] = crc & 0xff;

  // Cari apakah chunk pHYs sudah ada sebelumnya sebelum IDAT
  let existingPhysOffset = -1;
  let existingPhysLength = 0;
  let pos = 8;

  while (pos + 8 <= bytes.length) {
    const length =
      (bytes[pos] << 24) |
      (bytes[pos + 1] << 16) |
      (bytes[pos + 2] << 8) |
      bytes[pos + 3];
    const type = String.fromCharCode(
      bytes[pos + 4],
      bytes[pos + 5],
      bytes[pos + 6],
      bytes[pos + 7]
    );

    if (type === "pHYs") {
      existingPhysOffset = pos;
      existingPhysLength = 12 + length;
      break;
    }
    if (type === "IDAT") {
      break;
    }
    pos += 12 + length;
  }

  let resultBytes: Uint8Array;
  if (existingPhysOffset !== -1) {
    resultBytes = new Uint8Array(
      bytes.length - existingPhysLength + physChunk.length
    );
    resultBytes.set(bytes.subarray(0, existingPhysOffset), 0);
    resultBytes.set(physChunk, existingPhysOffset);
    resultBytes.set(
      bytes.subarray(existingPhysOffset + existingPhysLength),
      existingPhysOffset + physChunk.length
    );
  } else {
    // Sisipkan tepat setelah IHDR (IHDR selalu berakhir di byte 33)
    const ihdrEndOffset = 33;
    resultBytes = new Uint8Array(bytes.length + physChunk.length);
    resultBytes.set(bytes.subarray(0, ihdrEndOffset), 0);
    resultBytes.set(physChunk, ihdrEndOffset);
    resultBytes.set(bytes.subarray(ihdrEndOffset), ihdrEndOffset + physChunk.length);
  }

  return new Blob([resultBytes.buffer as ArrayBuffer], { type: "image/png" });
}

/**
 * Membaca metadata resolusi (DPI) dari biner gambar PNG (chunk pHYs).
 * Mengembalikan angka DPI bulat jika ditemukan unit meter, atau null jika tidak ada.
 */
export async function extractPngDpi(blob: Blob): Promise<number | null> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  if (bytes.length < 33) return null;

  let pos = 8;
  while (pos + 8 <= bytes.length) {
    const length =
      (bytes[pos] << 24) |
      (bytes[pos + 1] << 16) |
      (bytes[pos + 2] << 8) |
      bytes[pos + 3];
    const type = String.fromCharCode(
      bytes[pos + 4],
      bytes[pos + 5],
      bytes[pos + 6],
      bytes[pos + 7]
    );

    if (type === "pHYs" && length >= 9) {
      const dataOffset = pos + 8;
      const ppmX =
        (bytes[dataOffset] << 24) |
        (bytes[dataOffset + 1] << 16) |
        (bytes[dataOffset + 2] << 8) |
        bytes[dataOffset + 3];
      const unit = bytes[dataOffset + 8];
      if (unit === 1) {
        return Math.round(ppmX * 0.0254);
      }
      return null;
    }
    if (type === "IDAT") break;
    pos += 12 + length;
  }
  return null;
}

/**
 * Ekspor poster ke PNG Blob untuk download file dengan metadata resolusi 300 DPI.
 */
export async function exportPosterToPngBlob(
  config: PosterRenderConfig
): Promise<Blob> {
  const canvas = await renderPosterToCanvas(config);
  const rawBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Gagal mengonversi canvas ke Blob"));
      }
    }, "image/png");
  });

  return embedPngDpi(rawBlob, 300);
}

/**
 * Konversi poster ke dokumen Microsoft Word (.doc) berbasis MHTML
 * dengan gambar poster beresolusi tinggi (300 DPI) tersemat di dalamnya.
 * Memungkinkan pemilik warung membuka file di Word, mengatur tata letak,
 * ukuran, atau memperbanyak kartu (mis. 2 atau 4 kartu per lembar HVS) untuk dicetak manual.
 */
export async function exportPosterToWordDoc(
  config: PosterRenderConfig
): Promise<Blob> {
  const canvas = await renderPosterToCanvas(config);
  const dataUrl = canvas.toDataURL("image/png");
  const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");

  // Tentukan dimensi tampilan gambar di Word (cm) berdasarkan pilihan ukuran
  // A6: ~9.5 cm lebar agar muat nyaman di Word A4
  // A5: ~13.5 cm lebar
  // A4: ~17.5 cm lebar (lebar proporsional halaman A4 dengan margin 1.5 cm)
  const displayWidthCm =
    config.size === "a6" ? "9.5cm" : config.size === "a5" ? "13.5cm" : "17.5cm";

  const mhtml = `MIME-Version: 1.0
Content-Type: multipart/related; boundary="----=_NextPart_RumahMakanSipil_PosterQR"

------=_NextPart_RumahMakanSipil_PosterQR
Content-Type: text/html; charset="utf-8"
Content-Transfer-Encoding: 8bit

<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<!--[if gte mso 9]>
<xml>
<w:WordDocument>
<w:View>Print</w:View>
<w:Zoom>100</w:Zoom>
<w:DoNotOptimizeForBrowser/>
</w:WordDocument>
</xml>
<![endif]-->
<style>
@page {
  size: A4 portrait;
  margin: 1.5cm 1.5cm 1.5cm 1.5cm;
  mso-page-orientation: portrait;
}
body {
  margin: 0;
  padding: 0;
  font-family: Calibri, 'Segoe UI', Arial, sans-serif;
  text-align: center;
  background-color: #ffffff;
}
.poster-container {
  text-align: center;
  margin: 0 auto;
  padding: 10px 0;
}
.poster-img {
  width: ${displayWidthCm};
  height: auto;
  border: 1px solid #1F3D2B;
}
.note {
  margin-top: 12px;
  font-size: 9pt;
  color: #5C5A54;
}
</style>
</head>
<body>
<div class="poster-container">
  <p style="text-align:center; margin: 0 0 10px 0;">
    <img class="poster-img" src="poster-rms.png" alt="Poster QR Rumah Makan Sipil" />
  </p>
  <p class="note">
    Rumah Makan Sipil &middot; Poster QR Meja / Kasir &middot; Siap Cetak dan Diatur di Word
  </p>
</div>
</body>
</html>

------=_NextPart_RumahMakanSipil_PosterQR
Content-Type: image/png
Content-Transfer-Encoding: base64
Content-Location: poster-rms.png

${base64Data}
------=_NextPart_RumahMakanSipil_PosterQR--
`;

  return new Blob([mhtml], { type: "application/msword;charset=utf-8" });
}

/**
 * Trigger download file di browser secara programatik.
 */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Helper untuk me-load data URL ke HTMLImageElement.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error("Gagal memuat gambar: " + String(e)));
    img.src = src;
  });
}
