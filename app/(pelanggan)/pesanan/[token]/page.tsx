import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OrderTracker } from "@/components/pelanggan/order-tracker";
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

  return <OrderTracker initialOrder={order} qrisImageUrl={qrisImageUrl} />;
}
