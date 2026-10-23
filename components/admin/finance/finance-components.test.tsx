import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { FinancePeriodSelector } from "./finance-period-selector";
import { FinanceSummaryCards } from "./finance-summary-cards";
import { CashbookDailyTable } from "./cashbook-daily-table";
import { ExpenseFormDialog } from "./expense-form-dialog";
import { DeleteExpenseDialog } from "./delete-expense-dialog";
import { ExpenseListSection } from "./expense-list-section";
import type {
  CashbookSummary,
  DailyCashbookItem,
  Expense,
} from "@/lib/admin-finance";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("Finance Components", () => {
  const sampleSummary: CashbookSummary = {
    totalIncome: 150000,
    totalExpense: 60000,
    grossProfit: 90000,
    expenseByCategory: {
      bahan: 40000,
      operasional: 15000,
      lainnya: 5000,
    },
  };

  const sampleDaily: DailyCashbookItem[] = [
    {
      date: "2026-10-23",
      income: 150000,
      expense: 60000,
      grossProfit: 90000,
    },
  ];

  const sampleExpenses: Expense[] = [
    {
      id: "exp-1",
      expense_date: "2026-10-23",
      description: "Beli Telur 1 Rak",
      amount: 40000,
      category: "bahan",
      created_at: "2026-10-23T08:00:00Z",
    },
  ];

  // ------------------------------------------------------------
  // 1. FinancePeriodSelector
  // ------------------------------------------------------------
  describe("FinancePeriodSelector", () => {
    it("merender 3 pilihan preset: Hari Ini, Bulan Ini, dan Rentang Kustom", () => {
      const html = renderToString(
        <FinancePeriodSelector
          currentPreset="today"
          currentFrom="2026-10-23"
          currentTo="2026-10-23"
          todayStr="2026-10-23"
        />
      );

      expect(html).toContain("Periode Buku Kas");
      expect(html).toContain("Hari Ini");
      expect(html).toContain("Bulan Ini");
      expect(html).toContain("Rentang Kustom");
      expect(html).not.toContain("—"); // Antislop R-02
    });

    it("menandai preset aktif dengan styling kontras jelas dan aria-pressed true", () => {
      const html = renderToString(
        <FinancePeriodSelector
          currentPreset="today"
          currentFrom="2026-10-23"
          currentTo="2026-10-23"
          todayStr="2026-10-23"
        />
      );

      expect(html).toContain('aria-pressed="true"');
      expect(html).toContain("bg-green-700 text-white");
    });

    it("memiliki ukuran target sentuh interaktif minimal 44px", () => {
      const html = renderToString(
        <FinancePeriodSelector
          currentPreset="today"
          currentFrom="2026-10-23"
          currentTo="2026-10-23"
          todayStr="2026-10-23"
        />
      );

      expect(html).toContain("min-h-[44px]");
    });

    it("menampilkan input tanggal dan tombol submit saat preset custom", () => {
      const html = renderToString(
        <FinancePeriodSelector
          currentPreset="custom"
          currentFrom="2026-10-01"
          currentTo="2026-10-23"
          todayStr="2026-10-23"
        />
      );

      expect(html).toContain("Dari Tanggal");
      expect(html).toContain("Sampai Tanggal");
      expect(html).toContain('value="2026-10-01"');
      expect(html).toContain('value="2026-10-23"');
      expect(html).toContain("Terapkan Rentang");
    });
  });

  // ------------------------------------------------------------
  // 2. FinanceSummaryCards
  // ------------------------------------------------------------
  describe("FinanceSummaryCards", () => {
    it("merender nominal pemasukan, pengeluaran, dan laba kotor surplus dengan benar", () => {
      const html = renderToString(<FinanceSummaryCards summary={sampleSummary} />);

      expect(html).toContain("Total Pemasukan");
      expect(html).toContain("Rp150.000");

      expect(html).toContain("Total Pengeluaran");
      expect(html).toContain("Rp60.000");

      expect(html).toContain("Laba Kotor");
      expect(html).toContain("+Rp90.000");
      expect(html).toContain("Surplus");

      // Breakdown kategori
      expect(html).toContain("Bahan: Rp40.000");
      expect(html).toContain("Operasional: Rp15.000");
      expect(html).toContain("Lainnya: Rp5.000");
      expect(html).not.toContain("—");
    });

    it("merender badge dan tanda defisit saat laba kotor negatif", () => {
      const deficitSummary: CashbookSummary = {
        totalIncome: 30000,
        totalExpense: 80000,
        grossProfit: -50000,
        expenseByCategory: { bahan: 50000, operasional: 30000, lainnya: 0 },
      };

      const html = renderToString(<FinanceSummaryCards summary={deficitSummary} />);

      expect(html).toContain("-Rp50.000");
      expect(html).toContain("Defisit");
      expect(html).not.toContain("+");
    });

    it("merender badge impas saat laba kotor nol", () => {
      const breakEvenSummary: CashbookSummary = {
        totalIncome: 50000,
        totalExpense: 50000,
        grossProfit: 0,
        expenseByCategory: { bahan: 50000, operasional: 0, lainnya: 0 },
      };

      const html = renderToString(<FinanceSummaryCards summary={breakEvenSummary} />);

      expect(html).toContain("Rp0");
      expect(html).toContain("Impas");
    });
  });

  // ------------------------------------------------------------
  // 3. CashbookDailyTable
  // ------------------------------------------------------------
  describe("CashbookDailyTable", () => {
    it("merender rekap harian buku kas dengan format tanggal Indonesia", () => {
      const html = renderToString(<CashbookDailyTable daily={sampleDaily} />);

      expect(html).toContain("Rekap Buku Kas Harian");
      expect(html).toContain("23 Okt 2026");
      expect(html).toContain("+Rp90.000");
      expect(html).not.toContain("—");
    });

    it("menampilkan empty state saat belum ada data transaksi harian", () => {
      const html = renderToString(<CashbookDailyTable daily={[]} />);

      expect(html).toContain("Belum ada transaksi pada periode ini.");
    });
  });

  // ------------------------------------------------------------
  // 4. ExpenseListSection
  // ------------------------------------------------------------
  describe("ExpenseListSection", () => {
    it("merender daftar pengeluaran operasional dan chip filter", () => {
      const html = renderToString(
        <ExpenseListSection
          expenses={sampleExpenses}
          onAddExpense={vi.fn()}
          onEditExpense={vi.fn()}
          onDeleteExpense={vi.fn()}
        />
      );

      expect(html).toContain("Daftar Pengeluaran Operasional");
      expect(html).toContain("Beli Telur 1 Rak");
      expect(html).toContain("Rp40.000");
      expect(html).toContain("Tambah Pengeluaran");
      expect(html).toContain("semua");
      expect(html).toContain("bahan");
      expect(html).toContain("operasional");
      expect(html).toContain("lainnya");
      expect(html).toContain("min-h-[44px]");
      expect(html).not.toContain("—");
    });

    it("menampilkan empty state saat belum ada pengeluaran", () => {
      const html = renderToString(
        <ExpenseListSection
          expenses={[]}
          onAddExpense={vi.fn()}
          onEditExpense={vi.fn()}
          onDeleteExpense={vi.fn()}
        />
      );

      expect(html).toContain("Belum ada catatan pengeluaran pada kategori ini.");
    });
  });

  // ------------------------------------------------------------
  // 5. ExpenseFormDialog
  // ------------------------------------------------------------
  describe("ExpenseFormDialog", () => {
    it("tidak merender apa-apa saat isOpen=false", () => {
      const html = renderToString(
        <ExpenseFormDialog
          isOpen={false}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          todayStr="2026-10-23"
        />
      );

      expect(html).toBe("");
    });

    it("merender modal tambah pengeluaran saat isOpen=true", () => {
      const html = renderToString(
        <ExpenseFormDialog
          isOpen={true}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          todayStr="2026-10-23"
        />
      );

      expect(html).toContain("Tambah Pengeluaran");
      expect(html).toContain('role="dialog"');
      expect(html).toContain("Tanggal Transaksi");
      expect(html).toContain("Kategori Pengeluaran");
      expect(html).toContain("Nominal (Rupiah)");
      expect(html).toContain("Keterangan Pengeluaran");
      expect(html).toContain("min-h-[44px]");
      expect(html).not.toContain("—");
    });

    it("merender judul Ubah Pengeluaran dan prefilled values saat initialData disediakan", () => {
      const html = renderToString(
        <ExpenseFormDialog
          isOpen={true}
          initialData={sampleExpenses[0]}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          todayStr="2026-10-23"
        />
      );

      expect(html).toContain("Ubah Pengeluaran");
      expect(html).toContain('value="Beli Telur 1 Rak"');
      expect(html).toContain('value="40000"');
      expect(html).toContain("Simpan Perubahan");
    });
  });

  // ------------------------------------------------------------
  // 6. DeleteExpenseDialog
  // ------------------------------------------------------------
  describe("DeleteExpenseDialog", () => {
    it("tidak merender apa-apa saat isOpen=false atau expense=null", () => {
      const htmlFalse = renderToString(
        <DeleteExpenseDialog
          isOpen={false}
          expense={sampleExpenses[0]}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
        />
      );
      expect(htmlFalse).toBe("");

      const htmlNull = renderToString(
        <DeleteExpenseDialog
          isOpen={true}
          expense={null}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
        />
      );
      expect(htmlNull).toBe("");
    });

    it("merender konfirmasi hapus pengeluaran dengan nominal dan keterangan", () => {
      const html = renderToString(
        <DeleteExpenseDialog
          isOpen={true}
          expense={sampleExpenses[0]}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
        />
      );

      expect(html).toContain("Hapus Catatan Pengeluaran?");
      expect(html).toContain("Beli Telur 1 Rak");
      expect(html).toContain("Rp40.000");
      expect(html).toContain("Batal");
      expect(html).toContain("Hapus Pengeluaran");
      expect(html).toContain("min-h-[44px]");
      expect(html).not.toContain("—");
    });
  });
});
