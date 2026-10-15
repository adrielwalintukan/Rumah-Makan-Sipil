import { MessageCircle, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatRupiah } from "@/lib/format";
import type { StoreSettings } from "@/lib/menu";

/** Paket Dos dipesan lewat WhatsApp, bukan keranjang (P9, US-07). */
export function PaketDosCard({ settings }: { settings: StoreSettings }) {
  const price = formatRupiah(settings.dos_price);
  const text = `Halo ${settings.store_name}, saya mau pesan Paket Dos (${price}/dos). Jumlah: … Tanggal: …`;
  const href = `https://wa.me/${settings.whatsapp_number}?text=${encodeURIComponent(text)}`;
  return (
    <section aria-labelledby="paket-dos" className="rounded-lg border border-brown-500/30 bg-brown-100 p-4">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-brown-500 text-white">
          <Package className="size-5" aria-hidden />
        </span>
        <div>
          <h2 id="paket-dos" className="text-lg font-semibold text-green-900">
            Paket Makanan Dos
          </h2>
          <p className="text-sm text-ink-600">
            Untuk acara atau pesanan banyak. <span className="font-semibold text-brown-700">{price} / dos</span>
          </p>
        </div>
      </div>
      <Button asChild variant="accent" className="mt-4 w-full">
        <a href={href} target="_blank" rel="noopener noreferrer">
          <MessageCircle aria-hidden />
          Pesan via WhatsApp
        </a>
      </Button>
    </section>
  );
}
