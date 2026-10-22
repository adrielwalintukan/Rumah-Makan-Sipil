import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  getWitaTodayDateString,
  getWitaMonthRange,
  isValidCalendarDate,
} from "./admin-reports";

export { getWitaTodayDateString, isValidCalendarDate };

// ------------------------------------------------------------
// 1. Kategori & Payload Pengeluaran
// ------------------------------------------------------------
export const expenseCategoryEnum = z.enum(["bahan", "operasional", "lainnya"]);
export type ExpenseCategory = z.infer<typeof expenseCategoryEnum>;

export const expensePayloadSchema = z.object({
  expense_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD.")
    .refine(isValidCalendarDate, "Tanggal kalender tidak valid.")
    .refine(
      (date) => date <= getWitaTodayDateString(),
      "Tanggal pengeluaran tidak boleh melebihi tanggal hari ini (WITA)."
    ),
  description: z
    .string()
    .trim()
    .min(1, "Keterangan pengeluaran wajib diisi.")
    .max(100, "Keterangan pengeluaran maksimal 100 karakter."),
  amount: z.coerce
    .number()
    .int("Nominal pengeluaran harus berupa bilangan bulat Rupiah.")
    .positive("Nominal pengeluaran harus lebih besar dari 0."),
  category: expenseCategoryEnum,
});

export type ExpensePayload = z.infer<typeof expensePayloadSchema>;

// ------------------------------------------------------------
// 2. Skema Validasi Query Periode Keuangan
// ------------------------------------------------------------
export const financePresetEnum = z.enum(["today", "this_month", "custom"]);
export type FinancePreset = z.infer<typeof financePresetEnum>;

const calendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD.")
  .refine(isValidCalendarDate, "Tanggal kalender tidak valid.");

export function createFinanceQuerySchema(now: Date = new Date()) {
  const todayStr = getWitaTodayDateString(now);

  return z
    .object({
      preset: financePresetEnum.default("today"),
      from: calendarDateSchema.optional(),
      to: calendarDateSchema.optional(),
    })
    .refine(
      (data) => !data.from || data.from <= todayStr,
      {
        message: "Tanggal awal (from) tidak boleh melebihi hari ini (WITA).",
        path: ["from"],
      }
    )
    .refine(
      (data) => !data.to || data.to <= todayStr,
      {
        message: "Tanggal akhir (to) tidak boleh melebihi hari ini (WITA).",
        path: ["to"],
      }
    )
    .refine(
      (data) => {
        if (data.from && data.to) return data.from <= data.to;
        return true;
      },
      {
        message: "Tanggal awal (from) tidak boleh lebih besar dari tanggal akhir (to).",
        path: ["from"],
      }
    );
}

export const financeQuerySchema = createFinanceQuerySchema();
export type FinanceQuery = z.infer<typeof financeQuerySchema>;

// ------------------------------------------------------------
// 3. Tipe Data Kontrak
// ------------------------------------------------------------
export interface Expense {
  id: string;
  expense_date: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  created_at: string;
}

export interface CashbookExpenseByCategory {
  bahan: number;
  operasional: number;
  lainnya: number;
}

export interface CashbookSummary {
  totalIncome: number;
  totalExpense: number;
  grossProfit: number;
  expenseByCategory: CashbookExpenseByCategory;
}

export interface DailyCashbookItem {
  date: string;
  income: number;
  expense: number;
  grossProfit: number;
}

export interface CashbookResult {
  period: { from: string; to: string };
  summary: CashbookSummary;
  dailyBreakdown: DailyCashbookItem[];
}

export interface FinanceData {
  cashbook: CashbookResult;
  expenses: Expense[];
}

// ------------------------------------------------------------
// 4. Perhitungan Rentang Tanggal
// ------------------------------------------------------------
export function getFinanceDateRange(
  preset: FinancePreset,
  customFrom?: string,
  customTo?: string,
  now: Date = new Date()
): { from: string; to: string } {
  const todayStr = getWitaTodayDateString(now);

  switch (preset) {
    case "today":
      return { from: todayStr, to: todayStr };
    case "this_month":
      return getWitaMonthRange(now);
    case "custom": {
      if (customFrom && customTo) {
        let from = customFrom;
        let to = customTo;
        if (from > to) {
          const temp = from;
          from = to;
          to = temp;
        }
        if (from > todayStr) from = todayStr;
        if (to > todayStr) to = todayStr;
        return { from, to };
      }
      return { from: todayStr, to: todayStr };
    }
    default:
      return { from: todayStr, to: todayStr };
  }
}

// ------------------------------------------------------------
// 5. Pengambilan Data Lengkap Keuangan (Server Helper)
// ------------------------------------------------------------
export async function getFinanceData(
  supabase: SupabaseClient,
  query: FinanceQuery,
  now: Date = new Date()
): Promise<FinanceData> {
  const { from, to } = getFinanceDateRange(query.preset, query.from, query.to, now);

  const fallbackCashbook: CashbookResult = {
    period: { from, to },
    summary: {
      totalIncome: 0,
      totalExpense: 0,
      grossProfit: 0,
      expenseByCategory: { bahan: 0, operasional: 0, lainnya: 0 },
    },
    dailyBreakdown: [],
  };

  try {
    const [cashbookRes, expensesRes] = await Promise.all([
      supabase.rpc("cashbook", { p_from_date: from, p_to_date: to }),
      supabase
        .from("expenses")
        .select("*")
        .gte("expense_date", from)
        .lte("expense_date", to)
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);

    let cashbook = fallbackCashbook;
    if (cashbookRes.data && !cashbookRes.error) {
      cashbook = cashbookRes.data as CashbookResult;
    } else if (cashbookRes.error) {
      console.error("Gagal memanggil RPC cashbook:", cashbookRes.error);
    }

    let expenses: Expense[] = [];
    if (expensesRes.data && !expensesRes.error) {
      expenses = expensesRes.data as Expense[];
    } else if (expensesRes.error) {
      console.error("Gagal mengambil data expenses:", expensesRes.error);
    }

    return { cashbook, expenses };
  } catch (err) {
    console.error("Kesalahan tak terduga saat mengambil data keuangan:", err);
    return { cashbook: fallbackCashbook, expenses: [] };
  }
}
