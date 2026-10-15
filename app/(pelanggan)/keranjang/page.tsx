import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { CartView } from "@/components/pelanggan/cart-view";
import { getMenu } from "@/lib/menu";

export const metadata: Metadata = { title: "Keranjang · Rumah Makan Sipil" };

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
      <Suspense fallback={<div aria-busy="true" className="h-40 animate-pulse rounded-lg bg-cream-100" />}>
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
