import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { CartView } from "@/components/pelanggan/cart-view";
import { getMenu } from "@/lib/menu";

export const metadata: Metadata = { title: "Keranjang · Rumah Makan Sipil" };

export function CartSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Memuat keranjang"
      className="flex flex-col gap-4 animate-pulse"
    >
      {/* 3 baris item keranjang */}
      <div className="divide-y divide-line rounded-lg border border-line bg-card">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-2 min-w-0 flex-1">
                <div className="h-5 w-40 rounded bg-cream-100" />
                <div className="h-4 w-24 rounded bg-cream-100" />
              </div>
              <div className="h-5 w-20 rounded bg-cream-100" />
            </div>
            <div className="flex items-center justify-between pt-1">
              <div className="h-8 w-16 rounded bg-cream-100" />
              <div className="h-8 w-24 rounded bg-cream-100" />
            </div>
          </div>
        ))}
      </div>

      {/* Kartu total */}
      <div className="flex items-center justify-between rounded-lg border border-line bg-card p-4">
        <div className="h-5 w-16 rounded bg-cream-100" />
        <div className="h-6 w-24 rounded bg-cream-100" />
      </div>

      {/* Tombol aksi bawah */}
      <div className="flex flex-col gap-2">
        <div className="h-11 w-full rounded-md bg-cream-100" />
        <div className="h-11 w-full rounded-md bg-cream-100" />
      </div>
    </div>
  );
}

export default function CartPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-4 pb-10">
      <div className="mb-4 flex items-center gap-2">
        <Link
          href="/"
          aria-label="Kembali ke menu"
          className="inline-flex size-11 items-center justify-center rounded-full hover:bg-accent"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="font-display text-3xl font-bold text-green-900">Keranjang</h1>
      </div>
      <Suspense fallback={<CartSkeleton />}>
        <Cart />
      </Suspense>
    </main>
  );
}

async function Cart() {
  // Harga & status Habis dicocokkan ulang dengan menu terbaru.
  const { categories, settings } = await getMenu();
  return <CartView categories={categories} isOpen={settings.is_open} />;
}
