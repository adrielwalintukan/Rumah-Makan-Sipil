"use client";

import * as React from "react";
import { Printer, Download, Loader2, Sparkles } from "lucide-react";
import {
  type PosterSize,
  exportPosterToPngBlob,
  triggerDownload,
} from "@/lib/qr";
import { PosterCard } from "./poster-card";

export interface QrPosterDashboardProps {
  initialStoreName: string;
  initialTagline: string;
  initialQrDataUrl: string;
  siteUrl: string;
}

export function QrPosterDashboard({
  initialStoreName,
  initialTagline,
  initialQrDataUrl,
  siteUrl,
}: QrPosterDashboardProps) {
  const [size, setSize] = React.useState<PosterSize>("a4");
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [downloadError, setDownloadError] = React.useState<string | null>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
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

  return (
    <div className="flex flex-col gap-6">
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
              className="inline-flex rounded-lg border border-line bg-cream-50 p-1"
            >
              <button
                type="button"
                onClick={() => setSize("a4")}
                aria-pressed={size === "a4"}
                className={`inline-flex min-h-[44px] items-center justify-center rounded-md px-4 text-xs sm:text-sm font-semibold transition active:scale-95 ${
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
                className={`inline-flex min-h-[44px] items-center justify-center rounded-md px-4 text-xs sm:text-sm font-semibold transition active:scale-95 ${
                  size === "a5"
                    ? "bg-green-700 text-white shadow-xs"
                    : "text-ink-600 hover:text-ink-900 hover:bg-cream-100"
                }`}
              >
                Ukuran A5 (Tenda Meja)
              </button>
            </div>
          </div>

          {/* Tombol Aksi: Cetak & Unduh */}
          <div className="flex flex-wrap items-center gap-2 sm:self-end">
            <button
              type="button"
              onClick={handlePrint}
              aria-label="Cetak poster sekarang"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-green-700 bg-white px-4 py-2.5 font-sans text-sm font-semibold text-green-700 shadow-2xs hover:bg-green-50 active:scale-95 transition"
            >
              <Printer className="size-4" aria-hidden />
              <span>Cetak Poster</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading}
              aria-label="Unduh poster format PNG 300 DPI"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-green-700 px-5 py-2.5 font-sans text-sm font-semibold text-white shadow-2xs hover:bg-green-600 active:scale-95 transition disabled:opacity-60"
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
            <strong className="text-ink-900 font-semibold">Tips Cetak:</strong>{" "}
            Untuk meja makan, pilih ukuran <strong>A5</strong> dan gunakan kertas
            tebal (Art Paper / Linen 210–260 gsm) atau masukkan ke dalam akrilik berdiri
            agar tahan cipratan kuah masakan.
          </p>
        </div>
      </div>

      {/* Area Pratinjau Poster */}
      <div className="flex flex-col items-center justify-center rounded-2xl border border-line bg-cream-100/40 p-4 sm:p-8">
        <div className="w-full max-w-sm sm:max-w-md md:max-w-lg transition-all duration-300">
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
