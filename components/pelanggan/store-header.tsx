import type { StoreSettings } from "@/lib/menu";

/** Hero toko + status buka/tutup (P10, design-system §6.8). */
export function StoreHeader({ settings }: { settings: StoreSettings }) {
  return (
    <header className="mb-2 lg:mb-4">
      <div className="relative -mx-4 overflow-hidden rounded-b-[2rem] bg-green-900 px-6 pt-10 pb-9 text-center lg:mx-0 lg:mt-4 lg:rounded-xl">
        {/* Cahaya dekoratif agar hero tidak datar; aria-hidden karena murni hiasan. */}
        <div aria-hidden className="pointer-events-none absolute -top-28 -right-20 size-72 rounded-full bg-green-600/50 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-28 -left-20 size-64 rounded-full bg-brown-500/30 blur-3xl" />
        <div className="relative">
          <p className="text-xs font-semibold tracking-[0.3em] text-green-100">RUMAH MAKAN</p>
          <h1 className="font-display text-5xl font-extrabold tracking-wide text-cream-50 sm:text-6xl">SIPIL</h1>
          {settings.tagline && (
            <p className="mt-1.5 text-xs font-medium tracking-[0.2em] text-green-100 uppercase">{settings.tagline}</p>
          )}
          <p
            className={`mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
              settings.is_open ? "bg-success-bg text-success" : "bg-danger-bg text-danger"
            }`}
          >
            <span aria-hidden className={`size-2 rounded-full ${settings.is_open ? "bg-success" : "bg-danger"}`} />
            {settings.is_open ? "Buka" : "Tutup"}
          </p>
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
