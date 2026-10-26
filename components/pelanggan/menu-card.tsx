"use client";

import { useState } from "react";
import Image from "next/image";
import { Plus, X } from "lucide-react";
import { MenuPhoto } from "@/components/pelanggan/menu-photo";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { QuantityStepper } from "@/components/pelanggan/quantity-stepper";
import { addLine, lineKey, setQuantity } from "@/lib/cart";
import type { CartLine } from "@/lib/cart";
import { formatRupiah } from "@/lib/format";
import type { MenuItem } from "@/lib/menu";
import { writeCart } from "@/lib/use-cart";

/**
 * Kartu menu (design-system §6.2). Foto/placeholder mengisi penuh sisi kiri dengan lebar tetap, jadi kartu
 * dengan & tanpa foto sama tinggi. Foto bisa diketuk untuk dilihat besar.
 * Menu tanpa pilihan: tombol + langsung menambah. Menu berpilihan: buka bottom sheet.
 */
export function MenuCard({
  item,
  category,
  cart,
  canOrder,
  onOpen,
}: {
  item: MenuItem;
  category: string;
  cart: CartLine[];
  canOrder: boolean;
  onOpen: () => void;
}) {
  const hasOptions = item.option_groups.length > 0;
  const plainKey = lineKey({ menuItemId: item.id, optionIds: [], note: "" });
  const plainQty = cart.find((l) => lineKey(l) === plainKey)?.quantity ?? 0;
  const inCart = cart.filter((l) => l.menuItemId === item.id).reduce((n, l) => n + l.quantity, 0);
  const soldOut = !item.is_available;
  const summary = item.description ?? item.option_groups.map((g) => g.name).join(" · ");
  const [viewing, setViewing] = useState(false);
  const photo = (
    <MenuPhoto
      name={item.name}
      imageUrl={item.image_url}
      category={category}
      sizes="(min-width: 640px) 128px, 112px"
      className="aspect-auto h-full w-28 rounded-none sm:w-32"
    />
  );

  return (
    <article
      data-testid="menu-card"
      className={`flex overflow-hidden rounded-xl border bg-card shadow-card transition-shadow hover:shadow-md ${soldOut ? "opacity-50" : ""}`}
    >
      {item.image_url ? (
        <>
          <button
            type="button"
            onClick={() => setViewing(true)}
            aria-label={`Lihat foto ${item.name}`}
            className="shrink-0 focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:outline-none focus-visible:ring-inset"
          >
            {photo}
          </button>
          <Dialog open={viewing} onOpenChange={setViewing}>
            <DialogContent showCloseButton={false} aria-describedby={undefined} className="gap-0 overflow-hidden p-0 sm:max-w-lg">
              <div className="relative h-[min(70vh,32rem)] w-full bg-cream-100">
                {/* shortcut: unoptimized seperti MenuPhoto (foto sudah dikompres saat upload) */}
                <Image src={item.image_url} alt={item.name} fill sizes="(min-width: 640px) 512px, 100vw" unoptimized className="object-contain" />
                {/* Tombol tutup sendiri: target sentuh 44 px dan tetap terlihat di atas foto terang/gelap. */}
                <DialogClose
                  aria-label="Tutup"
                  className="absolute top-3 right-3 inline-flex size-11 items-center justify-center rounded-full bg-card/90 text-ink-900 shadow-md focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:outline-none"
                >
                  <X className="size-5" aria-hidden />
                </DialogClose>
              </div>
              <div className="flex items-baseline justify-between gap-3 p-4">
                <DialogTitle className="text-lg font-semibold text-ink-900">{item.name}</DialogTitle>
                <p className="shrink-0 font-bold text-brown-700 tabular-nums">{formatRupiah(item.price)}</p>
              </div>
            </DialogContent>
          </Dialog>
        </>
      ) : (
        photo
      )}
      <div className="flex min-w-0 flex-1 flex-col p-3">
        <h3 className="line-clamp-2 text-lg leading-6 font-semibold text-ink-900">
          {/* Nama = tombol detail (catatan, jumlah); dipisah dari tombol + agar tidak bersarang. */}
          <button type="button" onClick={onOpen} className="text-left hover:underline" disabled={soldOut}>
            {item.name}
          </button>
        </h3>
        <p className="mt-0.5 min-h-5 truncate text-sm text-ink-600">{summary}</p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div>
            <p className="font-bold text-brown-700 tabular-nums">{formatRupiah(item.price)}</p>
            {hasOptions && inCart > 0 && <p className="text-xs text-ink-600">{inCart} di keranjang</p>}
          </div>
          {soldOut ? (
            <span className="rounded-full bg-muted-status-bg px-2.5 py-1 text-xs font-medium text-muted-status">
              Habis
            </span>
          ) : !hasOptions && plainQty > 0 ? (
            <QuantityStepper
              value={plainQty}
              label={item.name}
              onChange={(q) => writeCart((lines) => setQuantity(lines, plainKey, q))}
            />
          ) : (
            <button
              type="button"
              onClick={() =>
                hasOptions
                  ? onOpen()
                  : writeCart((lines) => addLine(lines, { menuItemId: item.id, optionIds: [], note: "", quantity: 1 }))
              }
              disabled={!canOrder}
              aria-label={`Tambah ${item.name}`}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95 disabled:opacity-40"
            >
              <Plus className="size-5" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
