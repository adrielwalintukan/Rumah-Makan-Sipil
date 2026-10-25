"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { formatRupiah } from "@/lib/format";
import type {
  Expense,
  ExpenseCategory,
  ExpensePayload,
} from "@/lib/admin-finance";

interface ExpenseFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ExpensePayload) => Promise<void>;
  initialData?: Expense | null;
  todayStr: string;
}

export function ExpenseFormDialog({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  todayStr,
}: ExpenseFormDialogProps) {
  const [expenseDate, setExpenseDate] = useState(
    initialData?.expense_date ?? todayStr
  );
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [amount, setAmount] = useState(
    initialData?.amount != null ? initialData.amount.toString() : ""
  );
  const [category, setCategory] = useState<ExpenseCategory>(
    initialData?.category ?? "bahan"
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [prevInitialData, setPrevInitialData] = useState(initialData);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  if (prevInitialData !== initialData || prevIsOpen !== isOpen) {
    setPrevInitialData(initialData);
    setPrevIsOpen(isOpen);
    if (initialData) {
      setExpenseDate(initialData.expense_date);
      setDescription(initialData.description);
      setAmount(initialData.amount.toString());
      setCategory(initialData.category);
    } else {
      setExpenseDate(todayStr);
      setDescription("");
      setAmount("");
      setCategory("bahan");
    }
    setErrorMsg(null);
  }

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedDesc = description.trim();
    if (!trimmedDesc) {
      setErrorMsg("Keterangan pengeluaran wajib diisi.");
      return;
    }
    if (trimmedDesc.length > 100) {
      setErrorMsg("Keterangan pengeluaran maksimal 100 karakter.");
      return;
    }

    const numAmount = parseInt(amount, 10);
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMsg("Nominal pengeluaran harus berupa bilangan bulat positif.");
      return;
    }

    if (expenseDate > todayStr) {
      setErrorMsg("Tanggal pengeluaran tidak boleh melebihi tanggal hari ini.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        expense_date: expenseDate,
        description: trimmedDesc,
        amount: numAmount,
        category,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan pengeluaran.";
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-900/40 p-0 sm:p-4 backdrop-blur-xs transition-opacity"
      role="dialog"
      aria-modal="true"
      aria-labelledby="expense-dialog-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl sm:rounded-2xl border border-line bg-card shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 id="expense-dialog-title" className="font-display text-lg font-bold text-ink-900">
            {initialData ? "Ubah Pengeluaran" : "Tambah Pengeluaran"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-ink-600 hover:bg-cream-100 hover:text-ink-900 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-green-700"
            aria-label="Tutup form pengeluaran"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5 overflow-y-auto">
          {errorMsg && (
            <div className="rounded-lg bg-danger-bg p-3 text-xs font-medium text-danger" role="alert">
              {errorMsg}
            </div>
          )}

          {/* Tanggal */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="expense-date" className="text-xs font-semibold text-ink-900">
              Tanggal Transaksi
            </label>
            <input
              id="expense-date"
              type="date"
              value={expenseDate}
              max={todayStr}
              onChange={(e) => setExpenseDate(e.target.value)}
              className="min-h-[44px] rounded-lg border border-line bg-card px-3 py-2 text-base sm:text-sm text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700"
              required
            />
          </div>

          {/* Kategori */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="expense-category" className="text-xs font-semibold text-ink-900">
              Kategori Pengeluaran
            </label>
            <select
              id="expense-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              className="min-h-[44px] rounded-lg border border-line bg-card px-3 py-2 text-base sm:text-sm text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700"
            >
              <option value="bahan">Bahan (Belanja Dapur / Mentah)</option>
              <option value="operasional">Operasional (Gas, Sabun, Listrik, Kebersihan)</option>
              <option value="lainnya">Lainnya (Parkir, Transportasi, dsb)</option>
            </select>
          </div>

          {/* Nominal */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="expense-amount" className="text-xs font-semibold text-ink-900">
              Nominal (Rupiah)
            </label>
            <input
              id="expense-amount"
              type="number"
              min="1"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Contoh: 50000"
              className="min-h-[44px] rounded-lg border border-line bg-card px-3 py-2 text-base sm:text-sm text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700"
              required
            />
            {amount && !isNaN(parseInt(amount, 10)) && parseInt(amount, 10) > 0 && (
              <span className="text-xs text-ink-600">
                Terbaca: {formatRupiah(parseInt(amount, 10))}
              </span>
            )}
          </div>

          {/* Keterangan */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="expense-description" className="text-xs font-semibold text-ink-900">
              Keterangan Pengeluaran (Maks 100 Karakter)
            </label>
            <input
              id="expense-description"
              type="text"
              maxLength={100}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contoh: Beli Beras 5kg"
              className="min-h-[44px] rounded-lg border border-line bg-card px-3 py-2 text-base sm:text-sm text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700"
              required
            />
            <span className="text-right text-[11px] text-ink-600">
              {description.length}/100
            </span>
          </div>

          {/* Footer Actions */}
          <div className="mt-2 flex items-center justify-end gap-2 pt-3 border-t border-line">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="min-h-[44px] min-w-[44px] rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink-600 hover:bg-cream-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-green-700"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="min-h-[44px] min-w-[44px] rounded-lg bg-green-700 px-5 py-2 text-sm font-semibold text-white shadow-xs hover:bg-green-600 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-green-700 disabled:opacity-50"
            >
              {isSubmitting ? "Menyimpan..." : initialData ? "Simpan Perubahan" : "Tambah Pengeluaran"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
