import * as React from "react";
import { Camera, Utensils, CheckCircle2 } from "lucide-react";
import type { PosterSize } from "@/lib/qr";

export interface PosterCardProps {
  size: PosterSize;
  storeName: string;
  tagline: string;
  qrDataUrl: string;
  siteUrl: string;
  className?: string;
}

export function PosterCard({
  size,
  storeName,
  tagline,
  qrDataUrl,
  siteUrl,
  className = "",
}: PosterCardProps) {
  const isA5 = size === "a5";

  return (
    <div
      id="poster-print-target"
      className={`relative mx-auto flex flex-col justify-between overflow-hidden bg-[#FBF8F2] text-[#1C1B18] shadow-card aspect-[210/297] rounded-2xl border-[3px] border-[#1F3D2B] p-4 sm:p-6 md:p-8 select-none ${className}`}
      style={{
        WebkitPrintColorAdjust: "exact",
        printColorAdjust: "exact",
      }}
    >
      {/* Garis Border Aksen Ganda di Dalam */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-1.5 sm:inset-2 md:inset-3 rounded-xl border border-[#A86A32]/50"
      />

      {/* Bagian Atas: Header Toko */}
      <header className="relative z-10 flex flex-col items-center text-center mt-2 sm:mt-3">
        {/* Emblem RMS */}
        <div
          className={`flex items-center justify-center rounded-xl bg-[#2E5A3F] text-white font-display font-bold shadow-xs ${
            isA5
              ? "size-9 sm:size-11 text-xs sm:text-sm"
              : "size-11 sm:size-14 text-sm sm:text-base"
          }`}
        >
          RMS
        </div>

        {/* Nama Toko */}
        <h2
          className={`font-display font-bold tracking-tight text-[#1F3D2B] mt-2 sm:mt-3 ${
            isA5
              ? "text-lg sm:text-xl md:text-2xl"
              : "text-xl sm:text-2xl md:text-3xl"
          }`}
        >
          {storeName || "Rumah Makan Sipil"}
        </h2>

        {/* Tagline */}
        <p
          className={`font-sans text-[#5C5A54] mt-1 max-w-xs sm:max-w-md ${
            isA5 ? "text-xs sm:text-sm" : "text-xs sm:text-base"
          }`}
        >
          {tagline || "Spesialis Masakan Rumahan & Ikan Bakar Khas Manado"}
        </p>
      </header>

      {/* Bagian Tengah: Kartu QR Code Kontras Tinggi */}
      <main className="relative z-10 my-auto flex flex-col items-center">
        <div className="flex flex-col items-center rounded-2xl border border-[#E7E1D6] bg-white p-3 sm:p-5 md:p-6 shadow-sm">
          {/* Badge SCAN UNTUK PESAN */}
          <div className="mb-2 sm:mb-3 inline-flex items-center rounded-full bg-[#2E5A3F] px-3 sm:px-4 py-1 text-center font-sans text-[10px] sm:text-xs md:text-sm font-bold tracking-wider text-white shadow-xs">
            SCAN UNTUK PESAN
          </div>

          {/* Gambar QR Code */}
          <div className="relative aspect-square w-36 sm:w-48 md:w-60 overflow-hidden rounded-xl bg-white p-1">
            {qrDataUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={qrDataUrl}
                alt="QR Code Pemesanan Rumah Makan Sipil"
                className="size-full object-contain"
                width={240}
                height={240}
              />
            ) : (
              <div className="flex size-full items-center justify-center bg-[#F4EEE3] text-xs text-[#9A978F]">
                Membuat QR...
              </div>
            )}
          </div>

          <p className="mt-2 text-center font-sans text-[11px] sm:text-xs font-semibold text-[#1F3D2B]">
            Pesan langsung dari HP Anda
          </p>
        </div>
      </main>

      {/* Bagian Bawah: 3 Langkah Pemesanan & Footer URL */}
      <footer className="relative z-10 mb-1 sm:mb-2 flex flex-col items-center gap-3">
        {/* 3 Langkah Mudah */}
        <div className="grid w-full grid-cols-3 gap-1.5 sm:gap-2 md:gap-3 text-center">
          <div className="flex flex-col items-center rounded-lg border border-[#E7E1D6] bg-white/90 p-1.5 sm:p-2 shadow-2xs">
            <div className="mb-1 flex size-5 sm:size-6 items-center justify-center rounded-full bg-[#E3EDE5] text-[#1F3D2B]">
              <Camera className="size-3 sm:size-3.5" aria-hidden />
            </div>
            <span className="font-sans text-[10px] sm:text-xs font-bold text-[#1C1B18]">
              1. Scan QR
            </span>
            <span className="font-sans text-[8px] sm:text-[10px] text-[#5C5A54] leading-tight mt-0.5">
              Buka kamera HP
            </span>
          </div>

          <div className="flex flex-col items-center rounded-lg border border-[#E7E1D6] bg-white/90 p-1.5 sm:p-2 shadow-2xs">
            <div className="mb-1 flex size-5 sm:size-6 items-center justify-center rounded-full bg-[#E3EDE5] text-[#1F3D2B]">
              <Utensils className="size-3 sm:size-3.5" aria-hidden />
            </div>
            <span className="font-sans text-[10px] sm:text-xs font-bold text-[#1C1B18]">
              2. Pilih Menu
            </span>
            <span className="font-sans text-[8px] sm:text-[10px] text-[#5C5A54] leading-tight mt-0.5">
              Pesan dari meja
            </span>
          </div>

          <div className="flex flex-col items-center rounded-lg border border-[#E7E1D6] bg-white/90 p-1.5 sm:p-2 shadow-2xs">
            <div className="mb-1 flex size-5 sm:size-6 items-center justify-center rounded-full bg-[#E3EDE5] text-[#1F3D2B]">
              <CheckCircle2 className="size-3 sm:size-3.5" aria-hidden />
            </div>
            <span className="font-sans text-[10px] sm:text-xs font-bold text-[#1C1B18]">
              3. Bayar
            </span>
            <span className="font-sans text-[8px] sm:text-[10px] text-[#5C5A54] leading-tight mt-0.5">
              Kasir atau QRIS
            </span>
          </div>
        </div>

        {/* Teks URL Web Pemesanan */}
        <div className="text-center">
          <p className="font-sans text-[9px] sm:text-[11px] text-[#5C5A54]">
            Atau akses web pemesanan:
          </p>
          <p className="font-sans text-[10px] sm:text-xs font-bold text-[#2E5A3F] truncate max-w-xs sm:max-w-md">
            {siteUrl || "http://localhost:3000"}
          </p>
        </div>
      </footer>
    </div>
  );
}
