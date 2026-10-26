"use client";

import { Plus } from "lucide-react";
import { MenuPhoto } from "@/components/pelanggan/menu-photo";
import { QuantityStepper } from "@/components/pelanggan/quantity-stepper";
import { addLine, lineKey, setQuantity } from "@/lib/cart";
import type { CartLine } from "@/lib/cart";
import { formatRupiah } from "@/lib/format";
import type { MenuItem } from "@/lib/menu";
import { writeCart } from "@/lib/use-cart";

/**
 * Kartu menu (design-system §6.2). Ukuran foto dikunci 4:3, jadi kartu dengan & tanpa foto sama tinggi.
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

  return (
    <article
      data-testid="menu-card"
      className={`flex gap-3.5 rounded-xl border bg-card p-3 shadow-card transition-shadow hover:shadow-md ${soldOut ? "opacity-50" : ""}`}
    >
      <MenuPhoto
        name={item.name}
        imageUrl={item.image_url}
        category={category}
        sizes="(min-width: 640px) 112px, 96px"
        className="w-24 self-start rounded-md sm:w-28"
      />
      <div className="flex min-w-0 flex-1 flex-col">
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
