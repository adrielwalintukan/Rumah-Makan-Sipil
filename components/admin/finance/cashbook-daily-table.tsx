import { formatRupiah } from "@/lib/format";
import type { DailyCashbookItem } from "@/lib/admin-finance";

interface CashbookDailyTableProps {
  daily: DailyCashbookItem[];
}

function formatDateIndo(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split("-").map(Number);
    const months = [
      "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
      "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
    ];
    return `${day} ${months[month - 1]} ${year}`;
  } catch {
    return dateStr;
  }
}

export function CashbookDailyTable({ daily }: CashbookDailyTableProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4 sm:p-5 shadow-xs">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-base sm:text-lg font-bold text-ink-900">
            Rekap Buku Kas Harian
          </h2>
          <p className="text-xs text-ink-600">
            Pemasukan, pengeluaran, dan laba kotor per tanggal transaksi
          </p>
        </div>
      </div>

      {daily.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line bg-cream-50 p-6 text-center">
          <p className="text-sm text-ink-600">
            Belum ada transaksi pada periode ini.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table (>= 640px) */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-cream-50 text-xs font-semibold uppercase tracking-wider text-ink-700">
                <tr>
                  <th scope="col" className="px-4 py-3">Tanggal</th>
                  <th scope="col" className="px-4 py-3 text-right">Pemasukan</th>
                  <th scope="col" className="px-4 py-3 text-right">Pengeluaran</th>
                  <th scope="col" className="px-4 py-3 text-right">Laba Kotor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {daily.map((item) => {
                  const isPositive = item.grossProfit > 0;
                  const isNegative = item.grossProfit < 0;

                  return (
                    <tr key={item.date} className="hover:bg-cream-50/60 transition-colors">
                      <td className="px-4 py-3 font-medium text-ink-900">
                        {formatDateIndo(item.date)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-green-800 tabular-nums">
                        {formatRupiah(item.income)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-red-800 tabular-nums">
                        {formatRupiah(item.expense)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-bold tabular-nums ${
                          isPositive
                            ? "text-green-800"
                            : isNegative
                            ? "text-red-800"
                            : "text-ink-700"
                        }`}
                      >
                        {isPositive ? `+${formatRupiah(item.grossProfit)}` : formatRupiah(item.grossProfit)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards (< 640px) */}
          <div className="sm:hidden flex flex-col gap-2.5">
            {daily.map((item) => {
              const isPositive = item.grossProfit > 0;
              const isNegative = item.grossProfit < 0;

              return (
                <div
                  key={item.date}
                  className="flex flex-col gap-2 rounded-lg border border-line bg-cream-50/50 p-3"
                >
                  <div className="flex items-center justify-between border-b border-line pb-1.5">
                    <span className="text-xs font-semibold text-ink-900">
                      {formatDateIndo(item.date)}
                    </span>
                    <span
                      className={`text-xs font-bold tabular-nums ${
                        isPositive
                          ? "text-green-800"
                          : isNegative
                          ? "text-red-800"
                          : "text-ink-700"
                      }`}
                    >
                      {isPositive ? `+${formatRupiah(item.grossProfit)}` : formatRupiah(item.grossProfit)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-ink-500">Pemasukan: </span>
                      <span className="font-semibold text-green-800 tabular-nums">
                        {formatRupiah(item.income)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-ink-500">Pengeluaran: </span>
                      <span className="font-semibold text-red-800 tabular-nums">
                        {formatRupiah(item.expense)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
