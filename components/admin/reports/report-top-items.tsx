import type { TopItem } from "@/lib/admin-reports";
import { formatRupiah } from "@/lib/format";
import { Trophy } from "lucide-react";

export interface ReportTopItemsProps {
  topItems: TopItem[];
}

export function ReportTopItems({ topItems }: ReportTopItemsProps) {
  const hasItems = topItems && topItems.length > 0;

  return (
    <div className="rounded-xl border border-line bg-card p-4 sm:p-5 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-ink-900">
            5 Menu Terlaris
          </h3>
          <p className="mt-0.5 text-xs text-ink-600">
            Berdasarkan kuantitas porsi pesanan lunas
          </p>
        </div>
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-700">
          <Trophy className="size-4" aria-hidden />
        </div>
      </div>

      {!hasItems ? (
        <div className="mt-4 rounded-lg border border-dashed border-line bg-cream-50/50 p-6 text-center">
          <p className="text-sm text-ink-600">
            Belum ada data menu terjual pada periode ini.
          </p>
        </div>
      ) : (
        <ol className="mt-4 space-y-2 sm:space-y-3">
          {topItems.map((item, index) => {
            const rank = index + 1;
            const isRank1 = rank === 1;

            return (
              <li
                key={`${item.name}-${index}`}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-line bg-surface"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Badge Peringkat */}
                  <div
                    className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs ${
                      isRank1
                        ? "bg-warning-bg text-warning font-bold border border-warning/30"
                        : "bg-cream-100 text-ink-600 font-medium"
                    }`}
                  >
                    {rank}
                  </div>

                  {/* Info Menu */}
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-ink-900 truncate">
                      {item.name}
                    </p>
                    <p className="text-xs text-ink-600">
                      {`${item.total_quantity} porsi`}
                    </p>
                  </div>
                </div>

                {/* Total Omzet */}
                <div className="text-right shrink-0">
                  <p className="font-medium text-sm text-ink-900 tabular-nums">
                    {formatRupiah(item.total_revenue)}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
