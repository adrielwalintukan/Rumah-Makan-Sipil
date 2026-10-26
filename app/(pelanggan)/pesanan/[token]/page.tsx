import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OrderTracker } from "@/components/pelanggan/order-tracker";
import { createServiceClient } from "@/lib/supabase/service";
import { getQrisImageUrl } from "@/lib/storage";

export const metadata: Metadata = { title: "Status Pesanan · Rumah Makan Sipil" };

export function OrderTrackSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Memuat status pesanan"
      className="flex flex-col gap-5 animate-pulse"
    >
      {/* Tombol kembali & Judul */}
      <div className="flex items-center gap-2">
        <div className="size-11 rounded-full bg-cream-100" />
        <div className="h-8 w-44 rounded bg-cream-100" />
      </div>

      {/* Header Nomor Antrean Besar & Badge Status */}
      <div className="flex flex-col items-center gap-3 rounded-lg border border-line bg-card p-6 text-center">
        <div className="h-6 w-36 rounded-full bg-cream-100" />
        <div className="h-6 w-28 rounded-full bg-cream-100" />
        <div className="mt-1 h-3 w-24 rounded bg-cream-100" />
        <div className="h-12 w-32 rounded bg-cream-100" />
        <div className="h-4 w-40 rounded bg-cream-100" />
        <div className="h-6 w-28 rounded-full bg-cream-100" />
        <div className="h-3 w-64 rounded bg-cream-100" />
      </div>

      {/* Area Instruksi Pembayaran (PaymentCard) */}
      <div className="flex flex-col gap-3 rounded-lg border border-line bg-card p-4">
        <div className="flex items-center justify-between border-b border-line pb-2.5">
          <div className="h-4 w-28 rounded bg-cream-100" />
          <div className="h-6 w-24 rounded-full bg-cream-100" />
        </div>
        <div className="h-24 w-full rounded-md bg-cream-100" />
      </div>

      {/* Daftar Item Pesanan */}
      <div className="flex flex-col gap-3 rounded-lg border border-line bg-card p-4">
        <div className="h-4 w-32 rounded bg-cream-100 border-b border-line pb-2.5" />
        <div className="flex flex-col gap-3 py-1">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="h-4 w-36 rounded bg-cream-100" />
              <div className="h-4 w-16 rounded bg-cream-100" />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-line pt-2">
          <div className="h-5 w-16 rounded bg-cream-100" />
          <div className="h-6 w-24 rounded bg-cream-100" />
        </div>
      </div>
    </div>
  );
}

export default function OrderTrackPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-4 pb-16">
      <Suspense fallback={<OrderTrackSkeleton />}>
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
  const qrisImageUrl = getQrisImageUrl(rawQrisPath);

  return <OrderTracker initialOrder={order} qrisImageUrl={qrisImageUrl} />;
}
