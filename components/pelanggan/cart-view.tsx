"use client";

import Link from "next/link";
import { ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuantityStepper } from "@/components/pelanggan/quantity-stepper";
import { resolveCart, setQuantity } from "@/lib/cart";
import { formatRupiah } from "@/lib/format";
import type { Category } from "@/lib/menu";
import { useCart, writeCart } from "@/lib/use-cart";

export function CartView({ categories, isOpen }: { categories: Category[]; isOpen: boolean }) {
  const cart = useCart();
  const { lines, total, hasUnavailable } = resolveCart(cart, categories);

  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <ShoppingBag className="size-12 text-brown-500/60" aria-hidden />
        <p className="text-lg font-semibold text-green-900">Keranjang masih kosong</p>
        <p className="text-ink-600">Yuk pilih menu dulu.</p>
        <Button asChild className="mt-2">
          <Link href="/">Lihat menu</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <ul className="divide-y divide-line rounded-lg border bg-card">
        {lines.map(({ key, line, item, options, subtotal, available }) => {
          const name = item?.name ?? "Menu tidak tersedia";
          return (
            <li key={key} data-testid="cart-line" className="flex flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-ink-900">{name}</p>
                  {options.length > 0 && <p className="text-sm text-ink-600">{options.map((o) => o.name).join(", ")}</p>}
                  {line.note && (
                    <p className="mt-1 inline-block rounded-sm bg-brown-100 px-2 py-0.5 text-sm text-ink-900 italic">
                      “{line.note}”
                    </p>
                  )}
                  {!available && (
                    <p className="mt-1 text-sm font-semibold text-danger">Habis atau berubah. Hapus dari keranjang.</p>
                  )}
                </div>
                <p className="shrink-0 font-semibold text-brown-700 tabular-nums">
                  {available ? formatRupiah(subtotal) : "–"}
                </p>
              </div>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => writeCart((l) => setQuantity(l, key, 0))}
                  className="inline-flex h-11 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-danger hover:bg-danger-bg"
                >
                  <Trash2 className="size-4" aria-hidden />
                  Hapus<span className="sr-only"> {name}</span>
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

      <div className="mt-4 flex items-center justify-between rounded-lg border bg-card p-4">
        <span className="font-semibold text-ink-900">Total</span>
        <span data-testid="cart-total" className="text-xl font-bold text-green-900 tabular-nums">
          {formatRupiah(total)}
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {!isOpen || hasUnavailable ? (
          <Button disabled className="w-full">
            {!isOpen ? "Toko sedang tutup" : "Hapus menu yang habis dulu"}
          </Button>
        ) : (
          <Button asChild className="w-full">
            <Link href="/checkout">Lanjut pesan</Link>
          </Button>
        )}
        <Button asChild variant="secondary" className="w-full">
          <Link href="/">Tambah menu lain</Link>
        </Button>
      </div>
    </>
  );
}
