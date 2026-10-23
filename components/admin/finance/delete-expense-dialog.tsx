"use client";

import { useState } from "react";
import { formatRupiah } from "@/lib/format";
import type { Expense } from "@/lib/admin-finance";

interface DeleteExpenseDialogProps {
  expense: Expense | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (id: string) => Promise<void>;
}

export function DeleteExpenseDialog({
  expense,
  isOpen,
  onClose,
  onConfirm,
}: DeleteExpenseDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !expense) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    setErrorMsg(null);
    try {
      await onConfirm(expense.id);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menghapus pengeluaran.";
      setErrorMsg(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/40 p-4 backdrop-blur-xs transition-opacity"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-line bg-card p-5 shadow-xl">
        <h2 id="delete-dialog-title" className="font-display text-lg font-bold text-ink-900">
          Hapus Catatan Pengeluaran?
        </h2>
        <p className="mt-2 text-sm text-ink-600">
          Apakah Anda yakin ingin menghapus catatan pengeluaran{" "}
          <strong className="text-ink-900">&quot;{expense.description}&quot;</strong> sebesar{" "}
          <strong className="text-red-700">{formatRupiah(expense.amount)}</strong>?
        </p>

        {errorMsg && (
          <div className="mt-3 rounded-lg bg-red-50 p-2.5 text-xs text-red-800" role="alert">
            {errorMsg}
          </div>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="min-h-[44px] min-w-[44px] rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-cream-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-green-700"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="min-h-[44px] min-w-[44px] rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-red-800 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-red-700 disabled:opacity-50"
          >
            {isDeleting ? "Menghapus..." : "Hapus Pengeluaran"}
          </button>
        </div>
      </div>
    </div>
  );
}
