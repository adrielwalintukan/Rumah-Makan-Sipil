import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, UtensilsCrossed } from "lucide-react";
import { PaymentCard } from "@/components/pelanggan/payment-card";
import { formatRupiah } from "@/lib/format";
import { createServiceClient } from "@/lib/supabase/service";

export const metadata: Metadata = { title: "Status Pesanan · Rumah Makan Sipil" };

export default function OrderTrackPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-4 pb-16">
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
  const [orderRes, settingsRes] = await Promise.all([
    supabase.rpc("get_order", { token: cleanToken }),
    supabase.from("settings").select("qris_image_path").eq("id", 1).single(),
  ]);

  const order = orderRes.data;
  if (orderRes.error || !order) {
    notFound();
  }

  const rawQrisPath = settingsRes.data?.qris_image_path;
  let qrisImageUrl: string | null = null;
  if (rawQrisPath) {
    if (rawQrisPath.startsWith("http://") || rawQrisPath.startsWith("https://")) {
      qrisImageUrl = rawQrisPath;
    } else {
      qrisImageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/store/${rawQrisPath}`;
    }
  }

  const dailyNum = String(order.daily_number).padStart(3, "0");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Link
          href="/"
          aria-label="Kembali ke menu"
          className="inline-flex size-11 items-center justify-center rounded-full hover:bg-accent"
        >
          <ArrowLeft className="size-5 text-ink-900" />
        </Link>
        <h1 className="font-display text-2xl font-bold text-green-900">Pesanan #{dailyNum}</h1>
      </div>

      {/* Header Nomor Antrean Besar */}
      <div className="flex flex-col items-center gap-2 rounded-lg border border-line bg-card p-6 text-center">
        <span className="text-xs font-bold tracking-wider text-ink-600 uppercase">Nomor Antrean</span>
        <span className="font-display text-5xl font-bold text-green-900 tabular-nums">#{dailyNum}</span>
        <p className="text-sm font-semibold text-ink-900">
          Atas nama: <span className="text-green-900">{order.customer_name}</span>
        </p>
        <div className="mt-2 flex items-center gap-1.5 rounded-full bg-cream-50 px-3 py-1 text-xs font-medium text-ink-600 border border-line">
          <UtensilsCrossed className="size-3.5 text-green-700" aria-hidden />
          <span>{order.order_type === "dine_in" ? "Makan di sini" : "Bungkus (Takeaway)"}</span>
        </div>
      </div>

      {/* Kartu Pembayaran: QRIS (DANA Bisnis) atau Cash */}
      <PaymentCard order={order} qrisImageUrl={qrisImageUrl} />

      {/* Rincian Item Pesanan */}
      <div className="flex flex-col gap-3 rounded-lg border border-line bg-card p-4">
        <h2 className="text-sm font-bold tracking-wide text-ink-900 border-b border-line pb-2.5">
          RINCIAN PESANAN
        </h2>
        <ul className="divide-y divide-line/60">
          {Array.isArray(order.items) &&
            order.items.map((item: {
              id: string;
              name: string;
              quantity: number;
              subtotal: number;
              options?: Array<{ name: string }>;
              note?: string;
            }) => (
              <li key={item.id} className="flex items-start justify-between py-2 text-sm">
                <div className="min-w-0 pr-2">
                  <p className="font-medium text-ink-900">
                    {item.quantity}x {item.name}
                  </p>
                  {Array.isArray(item.options) && item.options.length > 0 && (
                    <p className="text-xs text-ink-600">{item.options.map((o) => o.name).join(", ")}</p>
                  )}
                  {item.note && <p className="text-xs text-ink-600 italic">“{item.note}”</p>}
                </div>
                <span className="shrink-0 font-semibold text-ink-900 tabular-nums">
                  {formatRupiah(item.subtotal)}
                </span>
              </li>
            ))}
        </ul>

        <div className="mt-2 flex justify-between border-t border-line pt-2 text-base font-bold">
          <span className="text-ink-900">Total:</span>
          <span className="text-green-900 tabular-nums">{formatRupiah(order.total)}</span>
        </div>
      </div>
    </div>
  );
}
