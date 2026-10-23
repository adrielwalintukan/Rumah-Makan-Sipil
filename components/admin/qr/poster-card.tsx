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
  const isA6 = size === "a6";
  const isA5 = size === "a5";

  return (
    <div
      id="poster-print-target"
      className={`relative mx-auto flex flex-col justify-between overflow-hidden bg-[#FBF8F2] text-[#1C1B18] shadow-card aspect-[210/297] select-none ${
        isA6
          ? "rounded-xl border-2 border-[#1F3D2B] p-2.5 sm:p-3.5"
          : isA5
          ? "rounded-2xl border-[3px] border-[#1F3D2B] p-3.5 sm:p-5 md:p-6"
          : "rounded-2xl border-[3px] border-[#1F3D2B] p-4 sm:p-6 md:p-8"
      } ${className}`}
      style={{
        WebkitPrintColorAdjust: "exact",
        printColorAdjust: "exact",
      }}
    >
      {/* Garis Border Aksen Ganda di Dalam */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute rounded-lg border border-[#A86A32]/50 ${
          isA6 ? "inset-1" : isA5 ? "inset-1.5" : "inset-2 md:inset-3"
        }`}
      />

      {/* Bagian Atas: Header Toko */}
      <header
        className={`relative z-10 flex flex-col items-center text-center ${
          isA6 ? "mt-0.5 sm:mt-1" : "mt-2 sm:mt-3"
        }`}
      >
        {/* Emblem RMS */}
        <div
          className={`flex items-center justify-center font-display font-bold shadow-xs ${
            isA6
              ? "size-7 sm:size-8 rounded-lg bg-[#2E5A3F] text-[10px] sm:text-xs text-white"
              : isA5
              ? "size-9 sm:size-11 rounded-xl bg-[#2E5A3F] text-xs sm:text-sm text-white"
              : "size-11 sm:size-14 md:size-16 rounded-xl bg-[#2E5A3F] text-sm sm:text-base md:text-lg text-white"
          }`}
        >
          RMS
        </div>

        {/* Nama Toko */}
        <h2
          className={`font-display font-bold tracking-tight text-[#1F3D2B] ${
            isA6
              ? "mt-1 text-sm sm:text-base md:text-lg"
              : isA5
              ? "mt-1.5 sm:mt-2 text-lg sm:text-xl md:text-2xl"
              : "mt-2 sm:mt-3 text-xl sm:text-2xl md:text-3xl"
          }`}
        >
          {storeName || "Rumah Makan Sipil"}
        </h2>

        {/* Tagline */}
        <p
          className={`font-sans text-[#5C5A54] ${
            isA6
              ? "mt-0.5 max-w-xs text-[9px] sm:text-[10px]"
              : isA5
              ? "mt-1 max-w-xs sm:max-w-md text-xs sm:text-sm"
              : "mt-1 max-w-xs sm:max-w-md md:max-w-lg text-xs sm:text-sm md:text-base"
          }`}
        >
          {tagline || "Spesialis Masakan Rumahan & Ikan Bakar Khas Manado"}
        </p>
      </header>

      {/* Bagian Tengah: Kartu QR Code Kontras Tinggi */}
      <main className="relative z-10 my-auto flex flex-col items-center">
        <div
          className={`flex flex-col items-center border border-[#E7E1D6] bg-white shadow-sm ${
            isA6
              ? "rounded-xl p-2 sm:p-2.5"
              : isA5
              ? "rounded-2xl p-3 sm:p-4"
              : "rounded-2xl p-3.5 sm:p-5 md:p-6"
          }`}
        >
          {/* Badge SCAN UNTUK PESAN */}
          <div
            className={`inline-flex items-center rounded-full bg-[#2E5A3F] text-center font-sans font-bold tracking-wider text-white shadow-xs ${
              isA6
                ? "mb-1 px-2.5 py-0.5 text-[8px] sm:text-[9px]"
                : "mb-2 sm:mb-3 px-3 sm:px-4 py-1 text-[10px] sm:text-xs md:text-sm"
            }`}
          >
            SCAN UNTUK PESAN
          </div>

          {/* Gambar QR Code */}
          <div
            className={`relative aspect-square overflow-hidden rounded-xl bg-white p-1 ${
              isA6
                ? "w-28 sm:w-32 md:w-36"
                : isA5
                ? "w-36 sm:w-44 md:w-48"
                : "w-40 sm:w-56 md:w-64"
            }`}
          >
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

          <p
            className={`text-center font-sans font-semibold text-[#1F3D2B] ${
              isA6
                ? "mt-1 text-[9px] sm:text-[10px]"
                : "mt-2 text-[11px] sm:text-xs"
            }`}
          >
            Pesan langsung dari HP Anda
          </p>
        </div>
      </main>

      {/* Bagian Bawah: 3 Langkah Pemesanan & Footer URL */}
      <footer
        className={`relative z-10 flex flex-col items-center ${
          isA6 ? "mb-0.5 gap-1.5" : "mb-1 sm:mb-2 gap-3"
        }`}
      >
        {/* 3 Langkah Mudah */}
        <div
          className={`grid w-full grid-cols-3 text-center ${
            isA6 ? "gap-1" : "gap-1.5 sm:gap-2 md:gap-3"
          }`}
        >
          <div
            className={`flex flex-col items-center rounded-lg border border-[#E7E1D6] bg-white/90 shadow-2xs ${
              isA6 ? "p-1" : "p-1.5 sm:p-2"
            }`}
          >
            <div
              className={`flex items-center justify-center rounded-full bg-[#E3EDE5] text-[#1F3D2B] ${
                isA6 ? "mb-0.5 size-4" : "mb-1 size-5 sm:size-6"
              }`}
            >
              <Camera className={isA6 ? "size-2.5" : "size-3 sm:size-3.5"} aria-hidden />
            </div>
            <span
              className={`font-sans font-bold text-[#1C1B18] ${
                isA6 ? "text-[8px] sm:text-[9px]" : "text-[10px] sm:text-xs"
              }`}
            >
              1. Scan QR
            </span>
            <span
              className={`font-sans text-[#5C5A54] leading-tight mt-0.5 ${
                isA6 ? "text-[7px] sm:text-[8px]" : "text-[8px] sm:text-[10px]"
              }`}
            >
              Buka kamera HP
            </span>
          </div>

          <div
            className={`flex flex-col items-center rounded-lg border border-[#E7E1D6] bg-white/90 shadow-2xs ${
              isA6 ? "p-1" : "p-1.5 sm:p-2"
            }`}
          >
            <div
              className={`flex items-center justify-center rounded-full bg-[#E3EDE5] text-[#1F3D2B] ${
                isA6 ? "mb-0.5 size-4" : "mb-1 size-5 sm:size-6"
              }`}
            >
              <Utensils className={isA6 ? "size-2.5" : "size-3 sm:size-3.5"} aria-hidden />
            </div>
            <span
              className={`font-sans font-bold text-[#1C1B18] ${
                isA6 ? "text-[8px] sm:text-[9px]" : "text-[10px] sm:text-xs"
              }`}
            >
              2. Pilih Menu
            </span>
            <span
              className={`font-sans text-[#5C5A54] leading-tight mt-0.5 ${
                isA6 ? "text-[7px] sm:text-[8px]" : "text-[8px] sm:text-[10px]"
              }`}
            >
              Pesan dari meja
            </span>
          </div>

          <div
            className={`flex flex-col items-center rounded-lg border border-[#E7E1D6] bg-white/90 shadow-2xs ${
              isA6 ? "p-1" : "p-1.5 sm:p-2"
            }`}
          >
            <div
              className={`flex items-center justify-center rounded-full bg-[#E3EDE5] text-[#1F3D2B] ${
                isA6 ? "mb-0.5 size-4" : "mb-1 size-5 sm:size-6"
              }`}
            >
              <CheckCircle2 className={isA6 ? "size-2.5" : "size-3 sm:size-3.5"} aria-hidden />
            </div>
            <span
              className={`font-sans font-bold text-[#1C1B18] ${
                isA6 ? "text-[8px] sm:text-[9px]" : "text-[10px] sm:text-xs"
              }`}
            >
              3. Bayar
            </span>
            <span
              className={`font-sans text-[#5C5A54] leading-tight mt-0.5 ${
                isA6 ? "text-[7px] sm:text-[8px]" : "text-[8px] sm:text-[10px]"
              }`}
            >
              Kasir atau QRIS
            </span>
          </div>
        </div>

        {/* Teks URL Web Pemesanan */}
        <div className="text-center">
          <p
            className={`font-sans text-[#5C5A54] ${
              isA6 ? "text-[7.5px] sm:text-[8.5px]" : "text-[9px] sm:text-[11px]"
            }`}
          >
            Atau akses web pemesanan:
          </p>
          <p
            className={`font-sans font-bold text-[#2E5A3F] truncate max-w-xs sm:max-w-md ${
              isA6 ? "text-[8px] sm:text-[9px]" : "text-[10px] sm:text-xs"
            }`}
          >
            {siteUrl || "http://localhost:3000"}
          </p>
        </div>
      </footer>
    </div>
  );
}
