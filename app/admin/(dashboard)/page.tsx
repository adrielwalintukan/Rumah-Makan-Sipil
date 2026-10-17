import * as React from "react";
import type { Metadata } from "next";
import { getLiveOrders } from "@/lib/admin-orders";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { LiveOrdersBoard } from "@/components/admin/live-orders-board";

export const metadata: Metadata = {
  title: "Pesanan Live · Dashboard Rumah Makan Sipil",
};

async function LiveOrdersLoader() {
  const supabase = await createServerSupabaseClient();
  const initialOrders = await getLiveOrders(supabase);
  return <LiveOrdersBoard initialOrders={initialOrders} />;
}

function OrdersLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-line pb-4">
        <div>
          <div className="h-8 w-44 rounded-md bg-cream-200" />
          <div className="h-4 w-72 rounded-md bg-cream-100 mt-2" />
        </div>
        <div className="h-8 w-32 rounded-full bg-cream-100" />
      </div>

      <div className="hidden sm:grid sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((col) => (
          <div key={col} className="rounded-xl border border-line bg-cream-50 p-4 min-h-[300px]">
            <div className="h-5 w-24 rounded bg-cream-200 mb-4" />
            <div className="space-y-3">
              <div className="h-28 rounded-lg bg-card border border-line/60" />
              <div className="h-28 rounded-lg bg-card border border-line/60" />
            </div>
          </div>
        ))}
      </div>

      <div className="sm:hidden space-y-3">
        <div className="h-10 rounded-lg bg-cream-100" />
        <div className="h-32 rounded-lg bg-card border border-line" />
        <div className="h-32 rounded-lg bg-card border border-line" />
      </div>
    </div>
  );
}

export default function AdminOrdersPage() {
  return (
    <React.Suspense fallback={<OrdersLoadingSkeleton />}>
      <LiveOrdersLoader />
    </React.Suspense>
  );
}
