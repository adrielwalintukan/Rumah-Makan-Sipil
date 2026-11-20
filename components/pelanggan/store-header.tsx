import { ShoppingBag, Smartphone, Sparkles, UtensilsCrossed } from "lucide-react";
import { Hero3DStage } from "@/components/pelanggan/hero-3d-stage";
import { STORE_HERO_ID, StickyStoreBar } from "@/components/pelanggan/sticky-store-bar";
import type { StoreSettings } from "@/lib/menu";

/** Hero toko interaktif 3D: status, judul, panggung hidangan 3D WebGL, dan chip info (design-system §6.8). */
export function StoreHeader({ settings }: { settings: StoreSettings }) {
  const chips = [
    { Icon: UtensilsCrossed, label: "Makan di sini" },
    { Icon: ShoppingBag, label: "Bungkus" },
    { Icon: Smartphone, label: "Pesan dari HP" },
  ];
  return (
    <header className="mb-2 lg:mb-4">
      <StickyStoreBar isOpen={settings.is_open} />
      <div
        id={STORE_HERO_ID}
        className="relative -mx-4 overflow-hidden rounded-b-[2rem] bg-gradient-to-br from-green-900 via-green-800 to-green-900 px-5 pt-7 pb-6 shadow-lg lg:mx-0 lg:mt-4 lg:rounded-2xl lg:px-10 lg:pt-8 lg:pb-8"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgb(255_255_255/0.07)_1.5px,transparent_1.5px)] [background-size:18px_18px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-28 -left-20 size-72 rounded-full bg-green-600/45 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -bottom-24 size-80 rounded-full bg-brown-500/35 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-6 -right-12 size-56 rounded-full border-[10px] border-white/5 bg-green-800/70 lg:top-6 lg:right-14 lg:size-72"
        />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <p
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold shadow-sm ${
                  settings.is_open ? "bg-success-bg text-success" : "bg-danger-bg text-danger"
                }`}
              >
                <span aria-hidden className="relative flex size-2">
                  {settings.is_open && (
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60 motion-reduce:animate-none" />
                  )}
                  <span
                    className={`relative inline-flex size-2 rounded-full ${
                      settings.is_open ? "bg-success" : "bg-danger"
                    }`}
                  />
                </span>
                {settings.is_open ? "Buka" : "Tutup"}
              </p>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-brown-100 ring-1 ring-white/15 backdrop-blur-sm">
                <Sparkles className="size-3" aria-hidden />
                Menu 3D Interaktif
              </span>
            </div>

            <p className="text-xs font-semibold tracking-[0.3em] text-green-100 lg:text-sm">
              RUMAH MAKAN
            </p>
            <h1 className="font-display text-5xl leading-none font-extrabold tracking-wide text-cream-50 sm:text-6xl lg:text-8xl">
              SIPIL
            </h1>
            {settings.tagline && (
              <p className="mt-2 max-w-md text-sm font-medium text-brown-100 lg:text-base">
                {settings.tagline}
              </p>
            )}

            <ul aria-label="Layanan" className="relative mt-4 flex flex-wrap gap-2">
              {chips.map(({ Icon, label }) => (
                <li
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-cream-50 ring-1 ring-white/15 backdrop-blur-sm transition-colors hover:bg-white/15"
                >
                  <Icon className="size-3.5 text-brown-100" aria-hidden />
                  {label}
                </li>
              ))}
            </ul>
          </div>

          <Hero3DStage />
        </div>
      </div>

      {!settings.is_open && (
        <p
          role="status"
          className="mx-auto mt-4 max-w-md rounded-md bg-danger-bg px-4 py-3 text-center text-sm text-danger"
        >
          Maaf, toko sedang tutup. Kamu tetap bisa melihat menu, dan pemesanan dibuka lagi saat toko buka.
        </p>
      )}
    </header>
  );
}
