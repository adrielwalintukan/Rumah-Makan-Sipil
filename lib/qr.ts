import QRCode from "qrcode";

export type PosterSize = "a4" | "a5";

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

/**
 * Resolusi URL kanonikal toko untuk target QR code.
 * Membaca variabel NEXT_PUBLIC_SITE_URL, dengan fallback ke window.location.origin
 * atau fallbackOrigin, dan default ke http://localhost:3000.
 */
export function getStoreCanonicalUrl(fallbackOrigin?: string): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (envUrl) {
    return envUrl.replace(/\/+$/, "");
  }

  if (fallbackOrigin?.trim()) {
    return fallbackOrigin.trim().replace(/\/+$/, "");
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, "");
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
 * Mendapatkan dimensi pixel untuk cetak 300 DPI berdasarkan ukuran A4 / A5.
 */
export function getPosterDimensions(size: PosterSize): PosterDimensions {
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
 * Render poster ke HTML Canvas offscreen beresolusi cetak tinggi (300 DPI).
 */
export async function renderPosterToCanvas(
  config: PosterRenderConfig
): Promise<HTMLCanvasElement> {
  const { width, height } = getPosterDimensions(config.size);
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
  const outerMargin = width * 0.04;
  const innerMargin = width * 0.048;

  // Outer Border (green-900)
  ctx.strokeStyle = "#1F3D2B";
  ctx.lineWidth = width * 0.008;
  ctx.strokeRect(
    outerMargin,
    outerMargin,
    width - outerMargin * 2,
    height - outerMargin * 2
  );

  // Inner Border Aksen (brown-500)
  ctx.strokeStyle = "#A86A32";
  ctx.lineWidth = width * 0.003;
  ctx.strokeRect(
    innerMargin,
    innerMargin,
    width - innerMargin * 2,
    height - innerMargin * 2
  );

  // 3. Header: Monogram Emblem RMS
  const emblemSize = width * 0.12;
  const emblemX = width / 2 - emblemSize / 2;
  const emblemY = height * 0.08;

  ctx.fillStyle = "#2E5A3F"; // green-700
  ctx.beginPath();
  ctx.roundRect(emblemX, emblemY, emblemSize, emblemSize, emblemSize * 0.22);
  ctx.fill();

  ctx.fillStyle = "#FFFFFF";
  ctx.font = `bold ${emblemSize * 0.45}px "Fraunces", serif, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("RMS", width / 2, emblemY + emblemSize / 2);

  // 4. Nama Toko & Tagline
  const storeNameY = emblemY + emblemSize + height * 0.04;
  ctx.fillStyle = "#1F3D2B"; // green-900
  ctx.font = `bold ${width * 0.065}px "Fraunces", serif, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(config.storeName || "Rumah Makan Sipil", width / 2, storeNameY);

  const taglineY = storeNameY + width * 0.085;
  ctx.fillStyle = "#5C5A54"; // ink-600
  ctx.font = `500 ${width * 0.03}px "Plus Jakarta Sans", sans-serif`;
  ctx.fillText(
    config.tagline || "Spesialis Masakan Rumahan & Ikan Bakar Khas Manado",
    width / 2,
    taglineY
  );

  // 5. Container Kartu QR (Putih Bersih)
  const qrCardWidth = width * 0.68;
  const qrCardHeight = width * 0.72;
  const qrCardX = width / 2 - qrCardWidth / 2;
  const qrCardY = taglineY + height * 0.035;

  ctx.fillStyle = "#FFFFFF";
  ctx.shadowColor = "rgba(31, 61, 43, 0.08)";
  ctx.shadowBlur = width * 0.02;
  ctx.shadowOffsetY = width * 0.01;
  ctx.beginPath();
  ctx.roundRect(
    qrCardX,
    qrCardY,
    qrCardWidth,
    qrCardHeight,
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
  const badgeWidth = qrCardWidth * 0.62;
  const badgeHeight = width * 0.065;
  const badgeX = width / 2 - badgeWidth / 2;
  const badgeY = qrCardY + width * 0.035;

  ctx.fillStyle = "#2E5A3F"; // green-700
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, badgeHeight / 2);
  ctx.fill();

  ctx.fillStyle = "#FFFFFF";
  ctx.font = `bold ${badgeHeight * 0.48}px "Plus Jakarta Sans", sans-serif`;
  ctx.textBaseline = "middle";
  ctx.fillText("SCAN UNTUK PESAN", width / 2, badgeY + badgeHeight / 2);

  // 6. Draw QR Image ke dalam kartu
  if (config.qrDataUrl) {
    const qrImg = await loadImage(config.qrDataUrl);
    const qrImageSize = qrCardWidth * 0.76;
    const qrImageX = width / 2 - qrImageSize / 2;
    const qrImageY = badgeY + badgeHeight + width * 0.025;
    ctx.drawImage(qrImg, qrImageX, qrImageY, qrImageSize, qrImageSize);
  }

  // 7. 3 Langkah Pemesanan
  const stepsContainerY = qrCardY + qrCardHeight + height * 0.035;
  const stepBoxWidth = width * 0.25;
  const stepBoxHeight = height * 0.085;
  const stepSpacing = width * 0.04;
  const totalStepsWidth = stepBoxWidth * 3 + stepSpacing * 2;
  const stepsStartX = width / 2 - totalStepsWidth / 2;

  const stepsData = [
    { num: "1", title: "Scan QR", desc: "Buka kamera HP" },
    { num: "2", title: "Pilih Menu", desc: "Pesan dari meja" },
    { num: "3", title: "Bayar & Nikmati", desc: "Kasir / QRIS" },
  ];

  for (let i = 0; i < 3; i++) {
    const sX = stepsStartX + i * (stepBoxWidth + stepSpacing);
    const step = stepsData[i];

    // Card background
    ctx.fillStyle = "#FFFFFF";
    ctx.strokeStyle = "#E7E1D6";
    ctx.lineWidth = width * 0.002;
    ctx.beginPath();
    ctx.roundRect(sX, stepsContainerY, stepBoxWidth, stepBoxHeight, width * 0.02);
    ctx.fill();
    ctx.stroke();

    // Circle number badge
    const circleSize = width * 0.045;
    const circleX = sX + stepBoxWidth / 2;
    const circleY = stepsContainerY + stepBoxHeight * 0.28;

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
    ctx.font = `bold ${width * 0.022}px "Plus Jakarta Sans", sans-serif`;
    ctx.textBaseline = "top";
    ctx.fillText(step.title, circleX, stepsContainerY + stepBoxHeight * 0.52);

    ctx.fillStyle = "#5C5A54"; // ink-600
    ctx.font = `500 ${width * 0.018}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillText(step.desc, circleX, stepsContainerY + stepBoxHeight * 0.72);
  }

  // 8. Footer URL
  const footerY = height - outerMargin - height * 0.035;
  ctx.fillStyle = "#5C5A54"; // ink-600
  ctx.font = `500 ${width * 0.022}px "Plus Jakarta Sans", sans-serif`;
  ctx.textBaseline = "middle";
  ctx.fillText("Atau akses langsung melalui browser:", width / 2, footerY - width * 0.025);

  ctx.fillStyle = "#2E5A3F"; // green-700
  ctx.font = `bold ${width * 0.025}px "Plus Jakarta Sans", sans-serif`;
  ctx.fillText(config.siteUrl || "http://localhost:3000", width / 2, footerY + width * 0.01);

  return canvas;
}

/**
 * Ekspor poster ke PNG Blob untuk download file.
 */
export async function exportPosterToPngBlob(
  config: PosterRenderConfig
): Promise<Blob> {
  const canvas = await renderPosterToCanvas(config);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Gagal mengonversi canvas ke Blob"));
      }
    }, "image/png");
  });
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
