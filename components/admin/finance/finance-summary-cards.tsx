import { TrendingUp, TrendingDown, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { formatRupiah } from "@/lib/format";
import type { CashbookSummary } from "@/lib/admin-finance";

interface FinanceSummaryCardsProps {
  summary: CashbookSummary;
}

export function FinanceSummaryCards({ summary }: FinanceSummaryCardsProps) {
  const isSurplus = summary.grossProfit > 0;
  const isDeficit = summary.grossProfit < 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* 1. Total Pemasukan */}
      <div className="flex flex-col justify-between rounded-xl border border-green-200 bg-green-50/80 p-5 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-green-900">
            Total Pemasukan
          </span>
          <div className="flex size-9 items-center justify-center rounded-full bg-green-200/60 text-green-800">
            <ArrowUpRight className="size-5" aria-hidden="true" />
          </div>
        </div>
        <div className="mt-3">
          <div className="font-display text-2xl sm:text-3xl font-bold text-green-900 tabular-nums">
            {formatRupiah(summary.totalIncome)}
          </div>
          <p className="mt-1 text-xs text-green-800">
            Omzet pesanan lunas non-batal
          </p>
        </div>
      </div>

      {/* 2. Total Pengeluaran */}
      <div className="flex flex-col justify-between rounded-xl border border-danger/30 bg-danger-bg/80 p-5 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-danger">
            Total Pengeluaran
          </span>
          <div className="flex size-9 items-center justify-center rounded-full bg-danger/30 text-danger">
            <ArrowDownRight className="size-5" aria-hidden="true" />
          </div>
        </div>
        <div className="mt-3">
          <div className="font-display text-2xl sm:text-3xl font-bold text-danger tabular-nums">
            {formatRupiah(summary.totalExpense)}
          </div>
          {/* Breakdown Kategori */}
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-danger">
            <span className="rounded-md bg-danger-bg px-2 py-0.5">
              {`Bahan: ${formatRupiah(summary.expenseByCategory.bahan)}`}
            </span>
            <span className="rounded-md bg-danger-bg px-2 py-0.5">
              {`Operasional: ${formatRupiah(summary.expenseByCategory.operasional)}`}
            </span>
            <span className="rounded-md bg-danger-bg px-2 py-0.5">
              {`Lainnya: ${formatRupiah(summary.expenseByCategory.lainnya)}`}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Laba Kotor */}
      <div className="flex flex-col justify-between rounded-xl border border-line bg-card p-5 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-600">
            Laba Kotor
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              isSurplus
                ? "bg-green-100 text-green-800"
                : isDeficit
                ? "bg-danger-bg text-danger"
                : "bg-cream-200 text-ink-600"
            }`}
          >
            {isSurplus ? (
              <>
                <TrendingUp className="size-3.5" aria-hidden="true" />
                <span>Surplus</span>
              </>
            ) : isDeficit ? (
              <>
                <TrendingDown className="size-3.5" aria-hidden="true" />
                <span>Defisit</span>
              </>
            ) : (
              <span>Impas</span>
            )}
          </span>
        </div>
        <div className="mt-3">
          <div
            className={`font-display text-2xl sm:text-3xl font-bold tabular-nums ${
              isSurplus
                ? "text-green-800"
                : isDeficit
                ? "text-danger"
                : "text-ink-900"
            }`}
          >
            {isSurplus
              ? `+${formatRupiah(summary.grossProfit)}`
              : formatRupiah(summary.grossProfit)}
          </div>
          <p className="mt-1 text-xs text-ink-600">
            Pemasukan dikurangi pengeluaran operasional
          </p>
        </div>
      </div>
    </div>
  );
}
