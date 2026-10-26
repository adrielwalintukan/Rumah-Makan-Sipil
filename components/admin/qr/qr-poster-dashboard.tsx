"use client";

import * as React from "react";
import {
  Printer,
  Download,
  FileText,
  Loader2,
  Sparkles,
  AlertTriangle,
  AlertOctagon,
} from "lucide-react";
import {
  type PosterSize,
  exportPosterToPngBlob,
  exportPosterToWordDoc,
  triggerDownload,
  validateStoreUrl,
} from "@/lib/qr";
import { PosterCard } from "./poster-card";

export interface QrPosterDashboardProps {
  initialStoreName: string;
  initialTagline: string;
  initialQrDataUrl: string;
  siteUrl: string;
  isProduction?: boolean;
}

export function QrPosterDashboard({
  initialStoreName,
  initialTagline,
  initialQrDataUrl,
  siteUrl,
  isProduction = false,
}: QrPosterDashboardProps) {
  const [size, setSize] = React.useState<PosterSize>("a4");
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [isDownloadingWord, setIsDownloadingWord] = React.useState(false);
  const [downloadError, setDownloadError] = React.useState<string | null>(null);

  const urlValidation = React.useMemo(() => validateStoreUrl(siteUrl), [siteUrl]);

  // Di production, blokir cetak & unduh jika URL masih localhost atau tidak valid
  const isBlockedInProduction = Boolean(
    isProduction && (urlValidation.isLocalhost || !urlValidation.isValid)
  );

  const handlePrint = () => {
    if (isBlockedInProduction) return;
    window.print();
  };

  const handleDownload = async () => {
    if (isBlockedInProduction) return;

    setIsDownloading(true);
    setDownloadError(null);

    try {
      const blob = await exportPosterToPngBlob({
        size,
        storeName: initialStoreName,
        tagline: initialTagline,
        qrDataUrl: initialQrDataUrl,
        siteUrl,
      });

      const filename = `poster-rumah-makan-sipil-${size}.png`;
      triggerDownload(blob, filename);
    } catch (err) {
      setDownloadError(
        err instanceof Error
          ? err.message
          : "Gagal memproses gambar poster untuk diunduh."
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadWord = async () => {
    if (isBlockedInProduction) return;

    setIsDownloadingWord(true);
    setDownloadError(null);

    try {
      const blob = await exportPosterToWordDoc({
        size,
        storeName: initialStoreName,
        tagline: initialTagline,
        qrDataUrl: initialQrDataUrl,
        siteUrl,
      });

      const filename = `poster-rumah-makan-sipil-${size}.doc`;
      triggerDownload(blob, filename);
    } catch (err) {
      setDownloadError(
        err instanceof Error
          ? err.message
          : "Gagal memproses dokumen Word untuk diunduh."
      );
    } finally {
      setIsDownloadingWord(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Dynamic @page size and poster sizing for browser print dialog */}
      <style>{`
        @media print {
          @page {
            size: ${
              size === "a6"
                ? "105mm 148mm"
                : size === "a5"
                ? "148mm 210mm"
                : "210mm 297mm"
            };
            margin: 0;
          }
          #poster-print-target {
            width: ${
              size === "a6" ? "105mm" : size === "a5" ? "148mm" : "210mm"
            } !important;
            height: ${
              size === "a6" ? "148mm" : size === "a5" ? "210mm" : "297mm"
            } !important;
            max-width: ${
              size === "a6" ? "105mm" : size === "a5" ? "148mm" : "210mm"
            } !important;
            max-height: ${
              size === "a6" ? "148mm" : size === "a5" ? "210mm" : "297mm"
            } !important;
            padding: ${
              size === "a6" ? "3.5mm 4mm" : size === "a5" ? "5.5mm 6mm" : "8mm 9mm"
            } !important;
            border-width: ${size === "a6" ? "2px" : "3px"} !important;
          }
          #poster-print-target header,
          #poster-print-target footer {
            display: flex !important;
            visibility: visible !important;
          }
          #poster-print-target main {
            display: flex !important;
            visibility: visible !important;
            height: auto !important;
            min-height: 0 !important;
            width: 100% !important;
          }
          #poster-print-target * {
            visibility: visible !important;
          }
        }
      `}</style>

      {/* Toolbar Kontrol & Aksi (Disembunyikan saat cetak) */}
      <div className="no-print flex flex-col gap-4 rounded-xl border border-line bg-card p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Pemilih Ukuran Poster (Segmented Control) */}
          <div className="flex flex-col gap-1.5">
            <span className="font-sans text-xs font-semibold text-ink-600">
              Pilihan Ukuran Cetak:
            </span>
            <div
              role="group"
              aria-label="Pilihan ukuran cetak poster"
              className="inline-flex flex-wrap rounded-lg border border-line bg-cream-50 p-1 gap-1"
            >
              <button
                type="button"
                onClick={() => setSize("a4")}
                aria-pressed={size === "a4"}
                className={`inline-flex min-h-[44px] items-center justify-center rounded-md px-3 sm:px-4 text-xs sm:text-sm font-semibold transition active:scale-95 ${
                  size === "a4"
                    ? "bg-green-700 text-white shadow-xs"
                    : "text-ink-600 hover:text-ink-900 hover:bg-cream-100"
                }`}
              >
                Ukuran A4 (Dinding / Kasir)
              </button>
              <button
                type="button"
                onClick={() => setSize("a5")}
                aria-pressed={size === "a5"}
                className={`inline-flex min-h-[44px] items-center justify-center rounded-md px-3 sm:px-4 text-xs sm:text-sm font-semibold transition active:scale-95 ${
                  size === "a5"
                    ? "bg-green-700 text-white shadow-xs"
                    : "text-ink-600 hover:text-ink-900 hover:bg-cream-100"
                }`}
              >
                Ukuran A5 (Meja Sedang)
              </button>
              <button
                type="button"
                onClick={() => setSize("a6")}
                aria-pressed={size === "a6"}
                className={`inline-flex min-h-[44px] items-center justify-center rounded-md px-3 sm:px-4 text-xs sm:text-sm font-semibold transition active:scale-95 ${
                  size === "a6"
                    ? "bg-green-700 text-white shadow-xs"
                    : "text-ink-600 hover:text-ink-900 hover:bg-cream-100"
                }`}
              >
                Ukuran A6 (Tenda Meja Kecil)
              </button>
            </div>
          </div>

          {/* Tombol Aksi: Cetak, Unduh Word, & Unduh PNG */}
          <div className="flex flex-wrap items-center gap-2 sm:self-end">
            <button
              type="button"
              onClick={handlePrint}
              disabled={isBlockedInProduction}
              aria-disabled={isBlockedInProduction}
              title={
                isBlockedInProduction
                  ? "Cetak dinonaktifkan di production karena URL masih localhost"
                  : "Cetak poster"
              }
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-green-700 bg-white px-4 py-2.5 font-sans text-sm font-semibold text-green-700 shadow-2xs hover:bg-green-50 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Printer className="size-4" aria-hidden />
              <span>Cetak Poster</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadWord}
              disabled={isDownloadingWord || isBlockedInProduction}
              aria-disabled={isBlockedInProduction}
              title={
                isBlockedInProduction
                  ? "Unduh Word dinonaktifkan di production karena URL masih localhost"
                  : "Unduh Dokumen Word"
              }
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-2.5 font-sans text-sm font-semibold text-ink-900 shadow-2xs hover:bg-cream-50 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDownloadingWord ? (
                <>
                  <Loader2 className="size-4 animate-spin text-ink-600" aria-hidden />
                  <span>Membuat Word...</span>
                </>
              ) : (
                <>
                  <FileText className="size-4 text-ink-600" aria-hidden />
                  <span>Unduh Dokumen Word</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading || isBlockedInProduction}
              aria-disabled={isBlockedInProduction}
              title={
                isBlockedInProduction
                  ? "Unduh dinonaktifkan di production karena URL masih localhost"
                  : "Unduh PNG"
              }
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-green-700 px-5 py-2.5 font-sans text-sm font-semibold text-white shadow-2xs hover:bg-green-600 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  <span>Membuat PNG...</span>
                </>
              ) : (
                <>
                  <Download className="size-4" aria-hidden />
                  <span>Unduh PNG (300 DPI)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error Blokir di Production jika URL Masih Localhost */}
        {isBlockedInProduction && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-danger/40 bg-danger-bg p-3 text-xs text-danger"
          >
            <AlertOctagon className="size-4 shrink-0 text-danger mt-0.5" aria-hidden />
            <p className="leading-relaxed">
              <strong className="font-semibold">Aksi Cetak & Unduh Dinonaktifkan:</strong>{" "}
              Di lingkungan produksi, kode QR tidak boleh menunjuk ke localhost (<code>{urlValidation.cleanUrl}</code>). Silakan setel variabel <code>NEXT_PUBLIC_SITE_URL</code> ke domain publik toko di pengaturan deployment Vercel agar pelanggan dapat memesan dari HP.
            </p>
          </div>
        )}

        {/* Peringatan Informatif jika URL Localhost di Non-Production */}
        {urlValidation.isLocalhost && !isBlockedInProduction && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning-bg p-3 text-xs text-warning"
          >
            <AlertTriangle className="size-4 shrink-0 text-warning mt-0.5" aria-hidden />
            <p className="leading-relaxed">
              <strong className="font-semibold text-ink-900">Perhatian URL Localhost:</strong>{" "}
              Kode QR saat ini mengarah ke <code>{urlValidation.cleanUrl}</code>. Di lingkungan produksi, pastikan menyetel variabel <code>NEXT_PUBLIC_SITE_URL</code> ke domain publik toko agar kode QR dapat dibuka dari kamera HP pelanggan.
            </p>
          </div>
        )}

        {downloadError && (
          <div
            role="alert"
            className="rounded-lg border border-danger/30 bg-danger-bg p-3 text-xs text-danger"
          >
            {downloadError}
          </div>
        )}

        {/* Tips Cetak */}
        <div className="flex items-start gap-2 rounded-lg bg-cream-100/70 p-3 text-xs text-ink-600">
          <Sparkles className="size-4 shrink-0 text-brown-500 mt-0.5" aria-hidden />
          <p>
            <strong className="text-ink-900 font-semibold">Tips Cetak & Pengaturan:</strong>{" "}
            Untuk meja makan, gunakan ukuran <strong>A6 (Tenda Meja Kecil, ~10x15 cm)</strong> agar pas dan ringkas di atas meja. Jika ingin mencetak beberapa kartu sekaligus (mis. 2 atau 4 kartu per lembar HVS) atau mengatur posisi dan ukurannya secara bebas, gunakan tombol <strong>Unduh Dokumen Word</strong>.
          </p>
        </div>
      </div>

      {/* Area Pratinjau Poster */}
      <div className="poster-preview-wrapper flex flex-col items-center justify-center rounded-2xl border border-line bg-cream-100/40 p-4 sm:p-8">
        <div
          className={`w-full transition-all duration-300 ${
            size === "a6"
              ? "max-w-[260px] sm:max-w-[280px]"
              : size === "a5"
              ? "max-w-xs sm:max-w-sm md:max-w-md"
              : "max-w-sm sm:max-w-md md:max-w-lg"
          }`}
        >
          <PosterCard
            size={size}
            storeName={initialStoreName}
            tagline={initialTagline}
            qrDataUrl={initialQrDataUrl}
            siteUrl={siteUrl}
          />
        </div>
      </div>
    </div>
  );
}
