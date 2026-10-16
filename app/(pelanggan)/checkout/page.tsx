import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { CheckoutForm } from "@/components/pelanggan/checkout-form";
import { getMenu } from "@/lib/menu";

export const metadata: Metadata = { title: "Checkout · Rumah Makan Sipil" };

export default function CheckoutPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-4 pb-12">
      <div className="mb-6 flex items-center gap-2">
        <Link
          href="/keranjang"
          aria-label="Kembali ke keranjang"
          className="inline-flex size-11 items-center justify-center rounded-full hover:bg-accent"
        >
          <ArrowLeft className="size-5 text-ink-900" />
        </Link>
        <h1 className="font-display text-2xl font-bold text-green-900">Checkout Pesanan</h1>
      </div>

      <Suspense fallback={<div aria-busy="true" className="h-64 animate-pulse rounded-lg bg-cream-100" />}>
        <Checkout />
      </Suspense>
    </main>
  );
}

async function Checkout() {
  const { categories, settings } = await getMenu();
  return <CheckoutForm categories={categories} isOpen={settings.is_open} />;
}
