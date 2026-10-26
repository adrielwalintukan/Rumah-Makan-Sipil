import type { ReportSummary } from "@/lib/admin-reports";
import { formatRupiah } from "@/lib/format";
import { WalletCards } from "lucide-react";

export interface ReportPaymentMethodsProps {
  summary: ReportSummary;
}

export function ReportPaymentMethods({ summary }: ReportPaymentMethodsProps) {
  const totalRevenue = summary?.totalRevenue ?? 0;
  const totalCash = summary?.totalCash ?? 0;
  const totalQris = summary?.totalQris ?? 0;
  const cashOrders = summary?.cashOrders ?? 0;
  const qrisOrders = summary?.qrisOrders ?? 0;
  const cashPercentage = summary?.cashPercentage ?? 0;
  const qrisPercentage = summary?.qrisPercentage ?? 0;

  const hasTransactions = totalRevenue > 0;

  return (
    <div className="rounded-xl border border-line bg-card p-4 sm:p-5 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-ink-900">
            Metode Pembayaran
          </h3>
          <p className="mt-0.5 text-xs text-ink-600">
            Perbandingan pembayaran Tunai vs QRIS
          </p>
        </div>
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-700">
          <WalletCards className="size-4" aria-hidden />
        </div>
      </div>

      {!hasTransactions ? (
        <div className="mt-4 rounded-lg border border-dashed border-line bg-cream-50/50 p-6 text-center">
          <p className="text-sm text-ink-600">
            Belum ada transaksi pembayaran lunas pada periode ini
          </p>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {/* Visual Horizontal Bar */}
          <div
            className="h-4 w-full overflow-hidden rounded-full bg-cream-100 flex"
            role="progressbar"
            aria-valuenow={cashPercentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Perbandingan metode pembayaran: Tunai ${cashPercentage}%, QRIS ${qrisPercentage}%`}
          >
            {cashPercentage > 0 && (
              <div
                className="bg-green-700 transition-all"
                style={{ width: `${cashPercentage}%` }}
                title={`Tunai: ${cashPercentage}%`}
              />
            )}
            {qrisPercentage > 0 && (
              <div
                className="bg-warning transition-all"
                style={{ width: `${qrisPercentage}%` }}
                title={`QRIS: ${qrisPercentage}%`}
              />
            )}
          </div>

          {/* Kolom Breakdown Cash vs QRIS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Cash */}
            <div className="rounded-lg border border-line bg-surface p-3 sm:p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="size-3 shrink-0 rounded-full bg-green-700"
                    aria-hidden
                  />
                  <span className="text-xs font-semibold text-ink-600">
                    Tunai (Cash)
                  </span>
                </div>
                <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full tabular-nums">
                  {cashPercentage}%
                </span>
              </div>
              <p className="mt-2 font-display text-xl font-bold text-ink-900 tabular-nums">
                {formatRupiah(totalCash)}
              </p>
              <p className="mt-1 text-xs text-ink-600 tabular-nums">
                {`${cashOrders} pesanan`}
              </p>
            </div>

            {/* QRIS */}
            <div className="rounded-lg border border-line bg-surface p-3 sm:p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="size-3 shrink-0 rounded-full bg-warning"
                    aria-hidden
                  />
                  <span className="text-xs font-semibold text-ink-600">
                    QRIS (DANA Bisnis)
                  </span>
                </div>
                <span className="text-xs font-bold text-warning bg-warning-bg px-2 py-0.5 rounded-full tabular-nums">
                  {qrisPercentage}%
                </span>
              </div>
              <p className="mt-2 font-display text-xl font-bold text-ink-900 tabular-nums">
                {formatRupiah(totalQris)}
              </p>
              <p className="mt-1 text-xs text-ink-600 tabular-nums">
                {`${qrisOrders} pesanan`}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
