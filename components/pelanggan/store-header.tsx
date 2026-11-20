import { ArrowDown } from "lucide-react";
import { NasiArt } from "@/components/pelanggan/promo-art";
import { STORE_HERO_ID, StickyStoreBar } from "@/components/pelanggan/sticky-store-bar";
import { TiltArt } from "@/components/pelanggan/tilt-art";
import type { StoreSettings } from "@/lib/menu";

const SERVICES = ["Makan di sini", "Bungkus", "Pesan dari HP"];

/** Hero editorial: judul raksasa bertopeng yang naik saat load, ilustrasi di atas lingkaran, daftar layanan bernomor (P10, design-system §6.8). */
export function StoreHeader({ settings }: { settings: StoreSettings }) {
  return (
    <header className="mb-2 lg:mb-4">
      <StickyStoreBar isOpen={settings.is_open} />
      <div
        id={STORE_HERO_ID}
        className="relative -mx-4 flex min-h-[34rem] flex-col overflow-hidden rounded-b-[2.5rem] bg-green-900 px-5 pt-6 pb-6 text-cream-50 lg:mx-0 lg:mt-4 lg:min-h-[36rem] lg:rounded-3xl lg:px-12 lg:pt-8 lg:pb-8"
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgb(255_255_255/0.06)_1.5px,transparent_1.5px)] [background-size:18px_18px]" />
        <div aria-hidden className="pointer-events-none absolute -top-32 -left-24 size-96 rounded-full bg-green-600/40 blur-3xl" />
        {/* Lingkaran "piring" besar di belakang ilustrasi */}
        <div aria-hidden className="pointer-events-none absolute right-[-22%] bottom-[8%] size-[26rem] rounded-full bg-green-800 ring-1 ring-white/10 lg:right-[4%] lg:bottom-[-12%] lg:size-[40rem]" />
        <div aria-hidden className="pointer-events-none absolute right-[-10%] bottom-[-8%] size-72 rounded-full bg-brown-500/40 blur-3xl lg:size-[26rem]" />

        <div className="relative flex items-center justify-between gap-3">
          <p
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
              settings.is_open ? "bg-success-bg text-success" : "bg-danger-bg text-danger"
            }`}
          >
            <span aria-hidden className="relative flex size-2">
              {settings.is_open && (
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60 motion-reduce:animate-none" />
              )}
              <span className={`relative inline-flex size-2 rounded-full ${settings.is_open ? "bg-success" : "bg-danger"}`} />
            </span>
            {settings.is_open ? "Buka" : "Tutup"}
          </p>
          {settings.tagline && (
            <p className="text-right text-xs font-semibold tracking-[0.18em] text-brown-100 uppercase">{settings.tagline}</p>
          )}
        </div>

        <div className="relative mt-8 lg:mt-12">
          <p className="mask text-sm font-semibold tracking-[0.4em] text-green-100 lg:text-base">
            <span>RUMAH MAKAN</span>
          </p>
          <h1 className="mask mt-1 font-display text-[length:clamp(5.5rem,31vw,8.5rem)] leading-[0.82] font-extrabold tracking-[-0.04em] text-cream-50 lg:text-[length:min(17rem,19vw)]">
            <span style={{ "--d": "0.12s" } as React.CSSProperties}>SIPIL</span>
          </h1>
        </div>

        {/* Ilustrasi: mengambang di kanan-bawah, menimpa sebagian judul di desktop (teks di atas objek). */}
        <TiltArt className="pointer-events-auto absolute right-[-1.5rem] bottom-28 w-60 sm:right-4 sm:w-80 lg:right-6 lg:bottom-12 lg:w-[26rem]">
          <NasiArt className="w-full drop-shadow-2xl" />
        </TiltArt>

        <div className="relative mt-auto pt-10">
          <ul aria-label="Layanan" className="flex flex-col gap-1 border-t border-white/20 pt-3 text-sm font-semibold text-cream-50 lg:flex-row lg:gap-10">
            {SERVICES.map((label, i) => (
              <li key={label} className="flex items-baseline gap-2">
                <span className="text-xs text-brown-100 tabular-nums">({String(i + 1).padStart(2, "0")})</span>
                {label}
              </li>
            ))}
          </ul>
          <a
            href="#menu"
            className="mt-5 inline-flex h-12 items-center gap-2 rounded-full bg-cream-50 pr-2 pl-5 font-bold text-green-900 transition-transform hover:scale-[1.03] active:scale-95 focus-visible:ring-2 focus-visible:ring-cream-50 focus-visible:ring-offset-2 focus-visible:ring-offset-green-900 focus-visible:outline-none"
          >
            Lihat menu
            <span className="inline-flex size-8 items-center justify-center rounded-full bg-green-900 text-cream-50">
              <ArrowDown className="size-4" aria-hidden />
            </span>
          </a>
        </div>
      </div>
      {!settings.is_open && (
        <p role="status" className="mx-auto mt-4 max-w-md rounded-md bg-danger-bg px-4 py-3 text-center text-sm text-danger">
          Maaf, toko sedang tutup. Kamu tetap bisa melihat menu, dan pemesanan dibuka lagi saat toko buka.
        </p>
      )}
    </header>
  );
}
