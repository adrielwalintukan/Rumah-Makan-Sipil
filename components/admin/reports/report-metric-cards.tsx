import type { ReportSummary } from "@/lib/admin-reports";
import { formatRupiah } from "@/lib/format";
import { Banknote, Receipt, TrendingUp } from "lucide-react";

export interface ReportMetricCardsProps {
  summary: ReportSummary;
}

export function ReportMetricCards({ summary }: ReportMetricCardsProps) {
  const totalOrdersFormatted = (summary?.totalOrders ?? 0).toLocaleString("id-ID");
  const totalRevenueFormatted = formatRupiah(summary?.totalRevenue ?? 0);
  const averageOrderFormatted = formatRupiah(summary?.averageOrderValue ?? 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {/* Kartu 1: Total Omzet */}
      <div className="flex flex-col justify-between rounded-xl border border-line bg-card p-4 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-600">
            Total Omzet
          </span>
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-700">
            <Banknote className="size-4" aria-hidden />
          </div>
        </div>
        <div className="mt-3">
          <p className="font-display text-2xl font-bold text-ink-900 tabular-nums">
            {totalRevenueFormatted}
          </p>
          <p className="mt-1 text-xs text-ink-600">Omzet Lunas (bukan batal)</p>
        </div>
      </div>

      {/* Kartu 2: Total Pesanan */}
      <div className="flex flex-col justify-between rounded-xl border border-line bg-card p-4 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-600">
            Total Pesanan
          </span>
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-700">
            <Receipt className="size-4" aria-hidden />
          </div>
        </div>
        <div className="mt-3">
          <p className="font-display text-2xl font-bold text-ink-900 tabular-nums">
            {totalOrdersFormatted}
          </p>
          <p className="mt-1 text-xs text-ink-600">Pesanan Berhasil</p>
        </div>
      </div>

      {/* Kartu 3: Rata-rata Pesanan */}
      <div className="flex flex-col justify-between rounded-xl border border-line bg-card p-4 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-600">
            Rata-rata Pesanan
          </span>
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-700">
            <TrendingUp className="size-4" aria-hidden />
          </div>
        </div>
        <div className="mt-3">
          <p className="font-display text-2xl font-bold text-ink-900 tabular-nums">
            {averageOrderFormatted}
          </p>
          <p className="mt-1 text-xs text-ink-600">Nilai rata-rata per pesanan</p>
        </div>
      </div>
    </div>
  );
}
