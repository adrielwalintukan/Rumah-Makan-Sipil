"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FinancePeriodSelector } from "./finance-period-selector";
import { FinanceSummaryCards } from "./finance-summary-cards";
import { CashbookDailyTable } from "./cashbook-daily-table";
import { ExpenseListSection } from "./expense-list-section";
import { ExpenseFormDialog } from "./expense-form-dialog";
import { DeleteExpenseDialog } from "./delete-expense-dialog";
import { toast } from "@/components/ui/toast";
import type { FinanceData, FinancePreset, Expense, ExpensePayload } from "@/lib/admin-finance";

interface FinanceDashboardClientProps {
  initialData: FinanceData;
  preset: FinancePreset;
  from: string;
  to: string;
  todayStr: string;
}

export function FinanceDashboardClient({
  initialData,
  preset,
  from,
  to,
  todayStr,
}: FinanceDashboardClientProps) {
  const router = useRouter();
  const [data, setData] = useState<FinanceData>(initialData);
  const [prevInitialData, setPrevInitialData] = useState(initialData);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);

  if (prevInitialData !== initialData) {
    setPrevInitialData(initialData);
    setData(initialData);
  }

  const handleCreateOrUpdateExpense = async (payload: ExpensePayload) => {
    if (editingExpense) {
      const res = await fetch(`/api/admin/expenses/${editingExpense.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Gagal memperbarui pengeluaran.");
      }
      toast({
        title: "Pengeluaran diperbarui",
        description: "Catatan pengeluaran berhasil diperbarui.",
        variant: "success",
      });
    } else {
      const res = await fetch("/api/admin/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Gagal menambahkan pengeluaran.");
      }
      toast({
        title: "Pengeluaran ditambahkan",
        description: "Catatan pengeluaran baru berhasil disimpan.",
        variant: "success",
      });
    }

    router.refresh();
  };

  const handleDeleteExpense = async (id: string) => {
    const res = await fetch(`/api/admin/expenses/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || "Gagal menghapus pengeluaran.");
    }

    toast({
      title: "Pengeluaran dihapus",
      description: "Catatan pengeluaran berhasil dihapus.",
      variant: "success",
    });

    router.refresh();
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Period Selector */}
      <FinancePeriodSelector
        currentPreset={preset}
        currentFrom={from}
        currentTo={to}
        todayStr={todayStr}
      />

      {/* 2. Three Metric Cards */}
      <FinanceSummaryCards summary={data.cashbook.summary} />

      {/* 3. Daily Cashbook Table */}
      <CashbookDailyTable daily={data.cashbook.dailyBreakdown} />

      {/* 4. Expense List Section */}
      <ExpenseListSection
        expenses={data.expenses}
        onAddExpense={() => {
          setEditingExpense(null);
          setIsFormOpen(true);
        }}
        onEditExpense={(expense) => {
          setEditingExpense(expense);
          setIsFormOpen(true);
        }}
        onDeleteExpense={(expense) => {
          setDeletingExpense(expense);
        }}
      />

      {/* Form Dialog (Create / Edit) */}
      <ExpenseFormDialog
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingExpense(null);
        }}
        onSubmit={handleCreateOrUpdateExpense}
        initialData={editingExpense}
        todayStr={todayStr}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteExpenseDialog
        isOpen={Boolean(deletingExpense)}
        expense={deletingExpense}
        onClose={() => setDeletingExpense(null)}
        onConfirm={handleDeleteExpense}
      />
    </div>
  );
}
