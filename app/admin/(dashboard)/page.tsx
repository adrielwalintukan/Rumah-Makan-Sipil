import type { Metadata } from "next";
import { Utensils } from "lucide-react";

export const metadata: Metadata = {
  title: "Pesanan Live · Dashboard Rumah Makan Sipil",
};

export default function AdminOrdersPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-line pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-green-900">
            Pesanan Live
          </h1>
          <p className="text-sm text-ink-600">
            Pantau dan proses pesanan yang masuk secara real-time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-green-700/20 bg-green-50 px-3 py-1 text-xs font-semibold text-green-800">
            <span className="size-2 rounded-full bg-green-700 animate-pulse" />
            Terhubung
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-card p-8 text-center shadow-xs">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-cream-100 text-green-800 mb-3">
          <Utensils className="size-6" aria-hidden />
        </div>
        <h2 className="font-display text-lg font-bold text-ink-900">
          Papan Pesanan Live
        </h2>
        <p className="mt-1 text-sm text-ink-600 max-w-md mx-auto">
          Fitur kanban pesanan real-time dengan bunyi notifikasi dan aksi status masak akan aktif di Issue #12.
        </p>
      </div>
    </div>
  );
}
