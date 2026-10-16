import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { formatRupiah } from "@/lib/format";
import { createServiceClient } from "@/lib/supabase/service";

export const metadata: Metadata = { title: "Status Pesanan · Rumah Makan Sipil" };

// shortcut: Layar pembayaran QRIS & halaman lacak pesanan lengkap diimplementasikan di Issue #9 & #10.
export default function OrderTrackPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-4 pb-12">
      <Suspense fallback={<div aria-busy="true" className="h-64 animate-pulse rounded-lg bg-cream-100" />}>
        <OrderTrackContent params={params} />
      </Suspense>
    </main>
  );
}

async function OrderTrackContent({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const cleanToken = token?.trim();

  if (!cleanToken) {
    notFound();
  }

  const supabase = createServiceClient();
  const { data: order, error } = await supabase.rpc("get_order", { token: cleanToken });

  if (error || !order) {
    notFound();
  }

  const dailyNum = String(order.daily_number).padStart(3, "0");

  return (
    <>
      <div className="mb-6 flex items-center gap-2">
        <Link
          href="/"
          aria-label="Kembali ke menu"
          className="inline-flex size-11 items-center justify-center rounded-full hover:bg-accent"
        >
          <ArrowLeft className="size-5 text-ink-900" />
        </Link>
        <h1 className="font-display text-2xl font-bold text-green-900">Pesanan #{dailyNum}</h1>
      </div>

      <div className="flex flex-col items-center gap-3 rounded-lg border border-line bg-card p-6 text-center">
        <CheckCircle2 className="size-12 text-success" aria-hidden />
        <h2 className="text-xl font-bold text-ink-900">Pesanan Berhasil Dibuat!</h2>
        <p className="text-sm text-ink-600">
          Nomor antrean kamu adalah <strong className="font-bold text-green-900">#{dailyNum}</strong>.
        </p>

        <div className="mt-4 w-full rounded-md bg-cream-50 p-4 text-left">
          <div className="flex justify-between py-1 text-sm">
            <span className="text-ink-600">Nama Pemesan:</span>
            <span className="font-semibold text-ink-900">{order.customer_name}</span>
          </div>
          <div className="flex justify-between py-1 text-sm">
            <span className="text-ink-600">Jenis Pesanan:</span>
            <span className="font-semibold text-ink-900">
              {order.order_type === "dine_in" ? "Makan di sini" : "Bungkus"}
            </span>
          </div>
          <div className="flex justify-between py-1 text-sm">
            <span className="text-ink-600">Metode Bayar:</span>
            <span className="font-semibold text-ink-900">
              {order.payment_method === "qris" ? "QRIS" : "Cash"}
            </span>
          </div>
          <div className="mt-2 flex justify-between border-t border-line pt-2 text-base font-bold">
            <span className="text-ink-900">Total:</span>
            <span className="text-green-900 tabular-nums">{formatRupiah(order.total)}</span>
          </div>
        </div>
      </div>
    </>
  );
}
