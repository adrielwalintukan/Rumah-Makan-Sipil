"use client";

import Link from "next/link";
import { ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuantityStepper } from "@/components/pelanggan/quantity-stepper";
import { resolveCart, setQuantity } from "@/lib/cart";
import { formatRupiah } from "@/lib/format";
import type { Category } from "@/lib/menu";
import { useCart, writeCart } from "@/lib/use-cart";

export function DesktopCartPanel({
  categories,
  isOpen,
}: {
  categories: Category[];
  isOpen: boolean;
}) {
  const cart = useCart();
  const { lines, count, total, hasUnavailable } = resolveCart(cart, categories);

  return (
    <div className="rounded-xl border border-line bg-card p-5 shadow-card">
      <div className="flex items-center justify-between border-b border-line pb-3.5">
        <div className="flex items-center gap-2.5">
          <ShoppingBag className="size-5 text-green-900" aria-hidden />
          <h2 className="font-display text-lg font-bold text-green-900">Pesanan Kamu</h2>
        </div>
        {count > 0 && (
          <span
            data-testid="desktop-cart-count-badge"
            className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-900"
          >
            {`${count} item`}
          </span>
        )}
      </div>

      {lines.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-cream-100">
            <ShoppingBag className="size-7 text-brown-500/70" aria-hidden />
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-green-900">Keranjang masih kosong</p>
            <p className="text-xs text-ink-600">
              Pilih menu lezat di sebelah kiri untuk mulai memesan 🍲
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          <ul
            data-testid="desktop-cart-list"
            className="max-h-[calc(100vh-22rem)] divide-y divide-line overflow-y-auto pr-1"
          >
            {lines.map(({ key, line, item, options, subtotal, available }) => {
              const name = item?.name ?? "Menu tidak tersedia";
              return (
                <li key={key} data-testid="desktop-cart-line" className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink-900">{name}</p>
                      {options.length > 0 && (
                        <p className="text-xs text-ink-600">
                          {options.map((o) => o.name).join(", ")}
                        </p>
                      )}
                      {line.note && (
                        <p className="mt-1 inline-block rounded-sm bg-brown-100 px-2 py-0.5 text-xs italic text-ink-900">
                          “{line.note}”
                        </p>
                      )}
                      {!available && (
                        <p className="mt-1 text-xs font-semibold text-danger">
                          Habis atau berubah. Hapus dari keranjang.
                        </p>
                      )}
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-brown-700 tabular-nums">
                      {available ? formatRupiah(subtotal) : "-"}
                    </p>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => writeCart((l) => setQuantity(l, key, 0))}
                      className="inline-flex h-8 items-center gap-1 rounded-md px-1.5 text-xs font-medium text-danger hover:bg-danger-bg"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                      <span>Hapus</span>
                      <span className="sr-only"> {name}</span>
                    </button>
                    {available && (
                      <QuantityStepper
                        value={line.quantity}
                        label={name}
                        min={1}
                        onChange={(q) => writeCart((l) => setQuantity(l, key, q))}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="border-t border-line pt-3.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-ink-900">Total</span>
              <span
                data-testid="desktop-cart-total"
                className="text-xl font-bold text-green-900 tabular-nums"
              >
                {formatRupiah(total)}
              </span>
            </div>

            <div className="mt-4">
              {!isOpen || hasUnavailable ? (
                <Button disabled className="w-full">
                  {!isOpen ? "Toko sedang tutup" : "Hapus menu yang habis dulu"}
                </Button>
              ) : (
                <Button asChild className="w-full">
                  <Link href="/checkout">Lanjut pesan</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
