import type { StoreSettings } from "@/lib/menu";

/** Header toko + status buka/tutup (P10). */
export function StoreHeader({ settings }: { settings: StoreSettings }) {
  return (
    <header className="px-4 pt-8 pb-4 text-center">
      <p className="text-xs font-semibold tracking-[0.3em] text-green-900">RUMAH MAKAN</p>
      <h1 className="font-display text-5xl font-extrabold tracking-wide text-green-900">SIPIL</h1>
      {settings.tagline && (
        <p className="mt-1 text-xs font-medium tracking-[0.2em] text-ink-600 uppercase">{settings.tagline}</p>
      )}
      <p
        className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
          settings.is_open ? "bg-success-bg text-success" : "bg-danger-bg text-danger"
        }`}
      >
        <span aria-hidden className={`size-2 rounded-full ${settings.is_open ? "bg-success" : "bg-danger"}`} />
        {settings.is_open ? "Buka" : "Tutup"}
      </p>
      {!settings.is_open && (
        <p role="status" className="mx-auto mt-3 max-w-md rounded-md bg-danger-bg px-4 py-3 text-sm text-danger">
          Maaf, toko sedang tutup. Kamu tetap bisa melihat menu, dan pemesanan dibuka lagi saat toko buka.
        </p>
      )}
    </header>
  );
}
