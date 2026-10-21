import type { OrderHistorySummary } from "@/lib/admin-orders";
import { formatRupiah } from "@/lib/format";
import { Receipt, Banknote } from "lucide-react";

export interface HistorySummaryCardsProps {
  summary: OrderHistorySummary;
  isLoading?: boolean;
}

export function HistorySummaryCards({
  summary,
  isLoading = false,
}: HistorySummaryCardsProps) {
  const totalOrdersFormatted = (summary?.totalOrders ?? 0).toLocaleString("id-ID");
  const totalRevenueFormatted = formatRupiah(summary?.totalRevenue ?? 0);
  const totalCashFormatted = formatRupiah(summary?.totalCash ?? 0);
  const totalQrisFormatted = formatRupiah(summary?.totalQris ?? 0);
  const hasBreakdown = (summary?.totalCash ?? 0) > 0 || (summary?.totalQris ?? 0) > 0;

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      {/* Kartu 1: Total Pesanan */}
      <div className="flex flex-col justify-between rounded-xl border border-line bg-card p-4 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-600">
            Total Pesanan
          </span>
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-700">
            <Receipt className="size-4" aria-hidden />
          </div>
        </div>
        <div className="mt-3">
          {isLoading ? (
            <div className="h-8 w-16 animate-pulse rounded bg-cream-100" />
          ) : (
            <p className="font-display text-2xl font-bold text-ink-900 tabular-nums">
              {totalOrdersFormatted}
            </p>
          )}
          <p className="mt-1 text-xs text-ink-600">Pesanan tercatat</p>
        </div>
      </div>

      {/* Kartu 2: Total Omzet Lunas */}
      <div className="flex flex-col justify-between rounded-xl border border-line bg-card p-4 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-600">
            Omzet Lunas
          </span>
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-700">
            <Banknote className="size-4" aria-hidden />
          </div>
        </div>
        <div className="mt-3">
          {isLoading ? (
            <div className="h-8 w-28 animate-pulse rounded bg-cream-100" />
          ) : (
            <>
              <p className="font-display text-2xl font-bold text-ink-900 tabular-nums">
                {totalRevenueFormatted}
              </p>
              {hasBreakdown ? (
                <p className="mt-1 text-xs text-ink-600 truncate" title={`Tunai: ${totalCashFormatted} · QRIS: ${totalQrisFormatted}`}>
                  Tunai: {totalCashFormatted} · QRIS: {totalQrisFormatted}
                </p>
              ) : (
                <p className="mt-1 text-xs text-ink-600">Total terbayar</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
