"use client";

import { useState } from "react";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { formatRupiah } from "@/lib/format";
import type { Expense, ExpenseCategory } from "@/lib/admin-finance";

interface ExpenseListSectionProps {
  expenses: Expense[];
  onAddExpense: () => void;
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (expense: Expense) => void;
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

export function ExpenseListSection({
  expenses,
  onAddExpense,
  onEditExpense,
  onDeleteExpense,
}: ExpenseListSectionProps) {
  const [filterCategory, setFilterCategory] = useState<ExpenseCategory | "semua">("semua");

  const filteredExpenses = expenses.filter((e) => {
    if (filterCategory === "semua") return true;
    return e.category === filterCategory;
  });

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line bg-card p-4 sm:p-5 shadow-xs">
      {/* Header & Tombol Tambah */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base sm:text-lg font-bold text-ink-900">
            Daftar Pengeluaran Operasional
          </h2>
          <p className="text-xs text-ink-600">
            Kelola transaksi pengeluaran belanja bahan baku dan operasional
          </p>
        </div>
        <button
          type="button"
          onClick={onAddExpense}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-green-600 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-green-700"
        >
          <Plus className="size-4" aria-hidden="true" />
          <span>Tambah Pengeluaran</span>
        </button>
      </div>

      {/* Filter Kategori */}
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter kategori pengeluaran">
        {(["semua", "bahan", "operasional", "lainnya"] as const).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setFilterCategory(cat)}
            className={`min-h-[44px] min-w-[44px] rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-green-700 ${
              filterCategory === cat
                ? "bg-ink-900 text-white shadow-xs"
                : "border border-line bg-cream-100 text-ink-700 hover:bg-cream-200"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Daftar Pengeluaran */}
      {filteredExpenses.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line bg-cream-50 p-6 text-center">
          <p className="text-sm text-ink-600">
            Belum ada catatan pengeluaran pada kategori ini.
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
                  <th scope="col" className="px-4 py-3">Keterangan</th>
                  <th scope="col" className="px-4 py-3">Kategori</th>
                  <th scope="col" className="px-4 py-3 text-right">Nominal</th>
                  <th scope="col" className="px-4 py-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-cream-50/60 transition-colors">
                    <td className="px-4 py-3 font-medium text-ink-900 whitespace-nowrap">
                      {formatDateIndo(expense.expense_date)}
                    </td>
                    <td className="px-4 py-3 font-medium text-ink-900">
                      {expense.description}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-md bg-cream-200 px-2 py-0.5 text-xs font-semibold capitalize text-ink-800">
                        {expense.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-red-800 tabular-nums whitespace-nowrap">
                      {formatRupiah(expense.amount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => onEditExpense(expense)}
                          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-ink-600 hover:bg-cream-100 hover:text-ink-900 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-green-700"
                          aria-label={`Ubah pengeluaran ${expense.description}`}
                        >
                          <Edit2 className="size-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteExpense(expense)}
                          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-red-600 hover:bg-red-50 hover:text-red-800 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-red-600"
                          aria-label={`Hapus pengeluaran ${expense.description}`}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards (< 640px) */}
          <div className="sm:hidden flex flex-col gap-2.5">
            {filteredExpenses.map((expense) => (
              <div
                key={expense.id}
                className="flex flex-col gap-2 rounded-lg border border-line bg-cream-50/50 p-3"
              >
                <div className="flex items-start justify-between gap-2 border-b border-line pb-2">
                  <div>
                    <span className="text-xs text-ink-500">
                      {formatDateIndo(expense.expense_date)}
                    </span>
                    <h3 className="font-semibold text-ink-900 text-sm">
                      {expense.description}
                    </h3>
                  </div>
                  <span className="font-bold text-red-800 text-sm tabular-nums whitespace-nowrap">
                    {formatRupiah(expense.amount)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="rounded-md bg-cream-200 px-2 py-0.5 text-xs font-semibold capitalize text-ink-800">
                    {expense.category}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onEditExpense(expense)}
                      className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-ink-700 hover:bg-cream-100"
                      aria-label={`Ubah pengeluaran ${expense.description}`}
                    >
                      <Edit2 className="size-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteExpense(expense)}
                      className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
                      aria-label={`Hapus pengeluaran ${expense.description}`}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
