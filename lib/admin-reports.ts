import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getWitaTodayDateString } from "./admin-orders";

export { getWitaTodayDateString };

/**
 * Menghitung rentang tanggal bulan berjalan (awal bulan s.d. hari ini) dalam zona waktu WITA (Asia/Makassar).
 */
export function getWitaMonthRange(now: Date = new Date()): { from: string; to: string } {
  const todayStr = getWitaTodayDateString(now);
  const [year, month] = todayStr.split("-");
  return {
    from: `${year}-${month}-01`,
    to: todayStr,
  };
}

export const reportPresetEnum = z.enum(["today", "this_month", "custom"]);
export type ReportPreset = z.infer<typeof reportPresetEnum>;

/**
 * Memvalidasi apakah string berformat YYYY-MM-DD merupakan tanggal kalender yang valid,
 * termasuk jumlah hari per bulan dan tahun kabisat.
 */
export function isValidCalendarDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (month < 1 || month > 12) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

const calendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD.")
  .refine(isValidCalendarDate, "Tanggal kalender tidak valid.");

/**
 * Menghitung tanggal awal dan akhir (YYYY-MM-DD) berdasarkan preset atau tanggal kustom.
 */
export function getReportDateRange(
  preset: ReportPreset,
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

/**
 * Membuat skema validasi query laporan dengan basis tanggal hari ini (WITA).
 * Menolak tanggal from/to yang berada di masa depan atau rentang terbalik.
 */
export function createReportQuerySchema(now: Date = new Date()) {
  const todayStr = getWitaTodayDateString(now);

  return z
    .object({
      preset: reportPresetEnum.default("today"),
      from: calendarDateSchema.optional(),
      to: calendarDateSchema.optional(),
      limit: z.coerce.number().int().min(1).max(50).default(5),
    })
    .refine(
      (data) => {
        if (data.from && data.from > todayStr) {
          return false;
        }
        return true;
      },
      {
        message: "Tanggal awal (from) tidak boleh melebihi tanggal hari ini (WITA).",
        path: ["from"],
      }
    )
    .refine(
      (data) => {
        if (data.to && data.to > todayStr) {
          return false;
        }
        return true;
      },
      {
        message: "Tanggal akhir (to) tidak boleh melebihi tanggal hari ini (WITA).",
        path: ["to"],
      }
    )
    .refine(
      (data) => {
        if (data.from && data.to) {
          return data.from <= data.to;
        }
        return true;
      },
      {
        message: "Tanggal awal (from) tidak boleh lebih besar dari tanggal akhir (to).",
        path: ["from"],
      }
    );
}

export const reportQuerySchema = z
  .object({
    preset: reportPresetEnum.default("today"),
    from: calendarDateSchema.optional(),
    to: calendarDateSchema.optional(),
    limit: z.coerce.number().int().min(1).max(50).default(5),
  })
  .refine(
    (data) => {
      const todayStr = getWitaTodayDateString();
      if (data.from && data.from > todayStr) {
        return false;
      }
      return true;
    },
    {
      message: "Tanggal awal (from) tidak boleh melebihi tanggal hari ini (WITA).",
      path: ["from"],
    }
  )
  .refine(
    (data) => {
      const todayStr = getWitaTodayDateString();
      if (data.to && data.to > todayStr) {
        return false;
      }
      return true;
    },
    {
      message: "Tanggal akhir (to) tidak boleh melebihi tanggal hari ini (WITA).",
      path: ["to"],
    }
  )
  .refine(
    (data) => {
      if (data.from && data.to) {
        return data.from <= data.to;
      }
      return true;
    },
    {
      message: "Tanggal awal (from) tidak boleh lebih besar dari tanggal akhir (to).",
      path: ["from"],
    }
  );

export type ReportQuery = z.infer<typeof reportQuerySchema>;

export interface ReportPeriod {
  preset: ReportPreset;
  from: string;
  to: string;
}

export interface ReportSummary {
  totalOrders: number;
  totalRevenue: number;
  totalCash: number;
  totalQris: number;
  cashOrders: number;
  qrisOrders: number;
  averageOrderValue: number;
  cashPercentage: number;
  qrisPercentage: number;
}

export interface TopItem {
  name: string;
  total_quantity: number;
  total_revenue: number;
}

export interface SalesReportResult {
  period: ReportPeriod;
  summary: ReportSummary;
  topItems: TopItem[];
}

/**
 * Mengambil ringkasan laporan penjualan dan menu terlaris via fungsi RPC database.
 * Melakukan kalkulasi turunan rata-rata nilai pesanan dan persentase Cash vs QRIS secara aman.
 */
export async function getSalesReport(
  supabase: SupabaseClient,
  query: ReportQuery,
  now: Date = new Date()
): Promise<SalesReportResult> {
  const preset = query.preset ?? "today";
  const { from, to } = getReportDateRange(preset, query.from, query.to, now);
  const limit = query.limit ?? 5;

  const [summaryRes, topItemsRes] = await Promise.all([
    supabase.rpc("report_summary", {
      p_from_date: from,
      p_to_date: to,
    }),
    supabase.rpc("top_items", {
      p_from_date: from,
      p_to_date: to,
      p_limit: limit,
    }),
  ]);

  if (summaryRes.error) {
    console.error("RPC report_summary gagal:", summaryRes.error);
    throw new Error(`Gagal memuat ringkasan laporan: ${summaryRes.error.message}`);
  }
  if (topItemsRes.error) {
    console.error("RPC top_items gagal:", topItemsRes.error);
    throw new Error(`Gagal memuat menu terlaris: ${topItemsRes.error.message}`);
  }

  const summaryData = summaryRes.data as Record<string, unknown> | null;
  const topItemsData = topItemsRes.data as unknown;

  const totalOrders = Number(summaryData?.totalOrders ?? 0) || 0;
  const totalRevenue = Number(summaryData?.totalRevenue ?? 0) || 0;
  const totalCash = Number(summaryData?.totalCash ?? 0) || 0;
  const totalQris = Number(summaryData?.totalQris ?? 0) || 0;
  const cashOrders = Number(summaryData?.cashOrders ?? 0) || 0;
  const qrisOrders = Number(summaryData?.qrisOrders ?? 0) || 0;

  const averageOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
  const cashPercentage = totalRevenue > 0 ? Math.round((totalCash / totalRevenue) * 100) : 0;
  const qrisPercentage = totalRevenue > 0 ? 100 - cashPercentage : 0;

  let topItems: TopItem[] = [];
  if (Array.isArray(topItemsData)) {
    topItems = (topItemsData as Record<string, unknown>[]).map((item) => ({
      name: typeof item.name === "string" ? item.name : String(item.name ?? ""),
      total_quantity: Number(item.total_quantity ?? 0) || 0,
      total_revenue: Number(item.total_revenue ?? 0) || 0,
    }));
  }

  return {
    period: {
      preset,
      from,
      to,
    },
    summary: {
      totalOrders,
      totalRevenue,
      totalCash,
      totalQris,
      cashOrders,
      qrisOrders,
      averageOrderValue,
      cashPercentage,
      qrisPercentage,
    },
    topItems,
  };
}
