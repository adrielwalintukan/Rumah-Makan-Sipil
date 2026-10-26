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
    // Tanpa overflow-hidden: aspect-ratio A4 dipertahankan bila isi muat, dan poster memanjang (bukan
    // memotong link) di layar yang terlalu sempit. Ukuran cetak dikunci mm oleh CSS cetak.
    <div
      id="poster-print-target"
      className={`relative mx-auto flex flex-col justify-between bg-[#FBF8F2] text-[#1C1B18] shadow-card aspect-[210/297] select-none ${
        isA6
          ? "rounded-xl border-2 border-[#1F3D2B] p-2 sm:p-2.5"
          : isA5
          ? "rounded-2xl border-[3px] border-[#1F3D2B] p-3 sm:p-4 md:p-5"
          : "rounded-2xl border-[3px] border-[#1F3D2B] p-3 sm:p-6 md:p-7"
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
          isA6 ? "mt-0 sm:mt-0.5" : "mt-1 sm:mt-2"
        }`}
      >
        {/* Emblem RMS */}
        <div
          className={`flex items-center justify-center font-display font-bold shadow-xs ${
            isA6
              ? "size-6 sm:size-7 rounded-md bg-[#2E5A3F] text-[9px] sm:text-[10px] text-white"
              : isA5
              ? "size-8 sm:size-9 rounded-lg bg-[#2E5A3F] text-xs text-white"
              : "size-8 sm:size-12 md:size-14 rounded-xl bg-[#2E5A3F] text-xs sm:text-sm md:text-base text-white"
          }`}
        >
          RMS
        </div>

        {/* Nama Toko */}
        <h2
          className={`font-display font-bold tracking-tight text-[#1F3D2B] ${
            isA6
              ? "mt-0.5 text-xs sm:text-sm md:text-base"
              : isA5
              ? "mt-1 text-base sm:text-lg md:text-xl"
              : "mt-1 sm:mt-2 text-lg sm:text-2xl md:text-3xl"
          }`}
        >
          {storeName || "Rumah Makan Sipil"}
        </h2>

        {/* Tagline */}
        <p
          className={`font-sans text-[#5C5A54] ${
            isA6
              ? "mt-0.5 max-w-xs text-[8px] sm:text-[9px]"
              : isA5
              ? "mt-0.5 max-w-xs sm:max-w-md text-[10px] sm:text-xs"
              : "mt-1 max-w-xs sm:max-w-md md:max-w-lg text-xs sm:text-sm"
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
              ? "rounded-2xl p-2.5 sm:p-3.5"
              : "rounded-2xl p-3 sm:p-4.5 md:p-5"
          }`}
        >
          {/* Badge SCAN UNTUK PESAN */}
          <div
            className={`inline-flex items-center rounded-full bg-[#2E5A3F] text-center font-sans font-bold tracking-wider text-white shadow-xs ${
              isA6
                ? "mb-1 px-2.5 py-0.5 text-[8.5px] sm:text-[9.5px]"
                : "mb-1.5 sm:mb-2 px-3 sm:px-4 py-1 text-[10.5px] sm:text-xs md:text-sm"
            }`}
          >
            SCAN UNTUK PESAN
          </div>

          {/* Gambar QR Code */}
          <div
            data-poster-qr
            className={`relative aspect-square overflow-hidden rounded-xl bg-white p-1 ${
              isA6
                ? "w-32 sm:w-36 md:w-40"
                : isA5
                ? "w-32 sm:w-50 md:w-56"
                : "w-32 sm:w-64 md:w-72"
            }`}
          >
            {qrDataUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={qrDataUrl}
                alt="QR Code Pemesanan Rumah Makan Sipil"
                className="size-full object-contain"
                width={280}
                height={280}
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
                ? "mt-1 text-[9.5px] sm:text-[10.5px]"
                : "mt-1.5 text-xs sm:text-sm"
            }`}
          >
            Pesan langsung dari HP Anda
          </p>
        </div>
      </main>

      {/* Bagian Bawah: 3 Langkah Pemesanan & Footer URL */}
      <footer
        className={`relative z-10 flex flex-col items-center ${
          isA6 ? "mb-0 gap-1" : "mb-0.5 sm:mb-1.5 gap-1.5 sm:gap-2.5"
        }`}
      >
        {/* 3 Langkah Mudah */}
        <div
          className={`grid w-full grid-cols-3 text-center ${
            isA6 ? "gap-1" : "gap-1.5 sm:gap-2 md:gap-2.5"
          }`}
        >
          <div
            className={`flex flex-col items-center rounded-lg border border-[#E7E1D6] bg-white/90 shadow-2xs ${
              isA6 ? "p-1 sm:p-1.5" : "p-1.5 sm:p-2"
            }`}
          >
            <div
              className={`flex items-center justify-center rounded-full bg-[#E3EDE5] text-[#1F3D2B] ${
                isA6 ? "mb-0.5 size-4.5" : "mb-1 size-5 sm:size-6"
              }`}
            >
              <Camera className={isA6 ? "size-2.5" : "size-3 sm:size-3.5"} aria-hidden />
            </div>
            <span
              className={`font-sans font-bold text-[#1C1B18] ${
                isA6 ? "text-[8.5px] sm:text-[9.5px]" : "text-[10px] sm:text-xs"
              }`}
            >
              1. Scan QR
            </span>
            <span
              className={`font-sans text-[#5C5A54] leading-tight mt-0.5 ${
                isA6 ? "text-[7.5px] sm:text-[8.5px]" : "text-[8.5px] sm:text-[10px]"
              }`}
            >
              Buka kamera HP
            </span>
          </div>

          <div
            className={`flex flex-col items-center rounded-lg border border-[#E7E1D6] bg-white/90 shadow-2xs ${
              isA6 ? "p-1 sm:p-1.5" : "p-1.5 sm:p-2"
            }`}
          >
            <div
              className={`flex items-center justify-center rounded-full bg-[#E3EDE5] text-[#1F3D2B] ${
                isA6 ? "mb-0.5 size-4.5" : "mb-1 size-5 sm:size-6"
              }`}
            >
              <Utensils className={isA6 ? "size-2.5" : "size-3 sm:size-3.5"} aria-hidden />
            </div>
            <span
              className={`font-sans font-bold text-[#1C1B18] ${
                isA6 ? "text-[8.5px] sm:text-[9.5px]" : "text-[10px] sm:text-xs"
              }`}
            >
              2. Pilih Menu
            </span>
            <span
              className={`font-sans text-[#5C5A54] leading-tight mt-0.5 ${
                isA6 ? "text-[7.5px] sm:text-[8.5px]" : "text-[8.5px] sm:text-[10px]"
              }`}
            >
              Pesan dari meja
            </span>
          </div>

          <div
            className={`flex flex-col items-center rounded-lg border border-[#E7E1D6] bg-white/90 shadow-2xs ${
              isA6 ? "p-1 sm:p-1.5" : "p-1.5 sm:p-2"
            }`}
          >
            <div
              className={`flex items-center justify-center rounded-full bg-[#E3EDE5] text-[#1F3D2B] ${
                isA6 ? "mb-0.5 size-4.5" : "mb-1 size-5 sm:size-6"
              }`}
            >
              <CheckCircle2 className={isA6 ? "size-2.5" : "size-3 sm:size-3.5"} aria-hidden />
            </div>
            <span
              className={`font-sans font-bold text-[#1C1B18] ${
                isA6 ? "text-[8.5px] sm:text-[9.5px]" : "text-[10px] sm:text-xs"
              }`}
            >
              3. Bayar
            </span>
            <span
              className={`font-sans text-[#5C5A54] leading-tight mt-0.5 ${
                isA6 ? "text-[7.5px] sm:text-[8.5px]" : "text-[8.5px] sm:text-[10px]"
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
              isA6 ? "text-[8px] sm:text-[9px]" : "text-[9.5px] sm:text-[11px]"
            }`}
          >
            Atau akses web pemesanan:
          </p>
          <p
            className={`font-sans font-bold text-[#2E5A3F] truncate max-w-xs sm:max-w-md ${
              isA6 ? "text-[8.5px] sm:text-[9.5px]" : "text-[10.5px] sm:text-xs"
            }`}
          >
            {siteUrl || "http://localhost:3000"}
          </p>
        </div>
      </footer>
    </div>
  );
}
