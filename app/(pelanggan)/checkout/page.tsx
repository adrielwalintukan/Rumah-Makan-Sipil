import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { CheckoutForm } from "@/components/pelanggan/checkout-form";
import { getMenu } from "@/lib/menu";

export const metadata: Metadata = { title: "Checkout · Rumah Makan Sipil" };

export function CheckoutSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Memuat formulir checkout"
      className="flex flex-col gap-6 animate-pulse"
    >
      {/* 1. Opsi jenis pesanan (Makan di sini / Bungkus) */}
      <div className="flex flex-col gap-2">
        <div className="h-4 w-28 rounded bg-cream-100" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-16 rounded-lg bg-cream-100" />
          <div className="h-16 rounded-lg bg-cream-100" />
        </div>
      </div>

      {/* 2. Kolom nama dan WhatsApp */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="h-4 w-32 rounded bg-cream-100" />
          <div className="h-3 w-48 rounded bg-cream-100" />
          <div className="h-11 w-full rounded-md bg-cream-100" />
        </div>
        <div className="flex flex-col gap-2">
          <div className="h-4 w-36 rounded bg-cream-100" />
          <div className="h-3 w-56 rounded bg-cream-100" />
          <div className="h-11 w-full rounded-md bg-cream-100" />
        </div>
      </div>

      {/* 3. Opsi metode pembayaran (QRIS / Cash) */}
      <div className="flex flex-col gap-2">
        <div className="h-4 w-40 rounded bg-cream-100" />
        <div className="flex flex-col gap-3">
          <div className="h-16 rounded-lg bg-cream-100" />
          <div className="h-16 rounded-lg bg-cream-100" />
        </div>
      </div>

      {/* 4. Rincian ringkasan */}
      <div className="flex flex-col gap-3 rounded-lg border border-line bg-card p-4">
        <div className="flex items-center justify-between border-b border-line pb-2.5">
          <div className="h-4 w-36 rounded bg-cream-100" />
          <div className="h-4 w-12 rounded bg-cream-100" />
        </div>
        <div className="flex flex-col gap-3 py-1">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="h-4 w-32 rounded bg-cream-100" />
              <div className="h-4 w-16 rounded bg-cream-100" />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-line pt-3">
          <div className="h-5 w-28 rounded bg-cream-100" />
          <div className="h-6 w-24 rounded bg-cream-100" />
        </div>
      </div>

      {/* 5. Tombol kirim pesanan */}
      <div className="h-12 w-full rounded-md bg-cream-100" />
    </div>
  );
}

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

      <Suspense fallback={<CheckoutSkeleton />}>
        <Checkout />
      </Suspense>
    </main>
  );
}

async function Checkout() {
  const { categories, settings } = await getMenu();
  return <CheckoutForm categories={categories} isOpen={settings.is_open} />;
}
