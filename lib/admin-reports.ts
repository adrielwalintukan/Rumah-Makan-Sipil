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
        return { from, to };
      }
      return { from: todayStr, to: todayStr };
    }
    default:
      return { from: todayStr, to: todayStr };
  }
}

export const reportQuerySchema = z.object({
  preset: reportPresetEnum.default("today"),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal awal harus YYYY-MM-DD.")
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal akhir harus YYYY-MM-DD.")
    .optional(),
  limit: z.coerce.number().int().min(1).max(50).default(5),
});

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

  try {
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

    const summaryData = summaryRes.data as Record<string, unknown> | null;
    const topItemsData = topItemsRes.data as unknown;

    if (summaryRes.error) {
      console.error("RPC report_summary gagal:", summaryRes.error);
    }
    if (topItemsRes.error) {
      console.error("RPC top_items gagal:", topItemsRes.error);
    }

    let totalOrders = 0;
    let totalRevenue = 0;
    let totalCash = 0;
    let totalQris = 0;

    if (!summaryRes.error && summaryData) {
      totalOrders = Number(summaryData.totalOrders ?? 0) || 0;
      totalRevenue = Number(summaryData.totalRevenue ?? 0) || 0;
      totalCash = Number(summaryData.totalCash ?? 0) || 0;
      totalQris = Number(summaryData.totalQris ?? 0) || 0;
    }

    const averageOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
    const cashPercentage = totalRevenue > 0 ? Math.round((totalCash / totalRevenue) * 100) : 0;
    const qrisPercentage = totalRevenue > 0 ? 100 - cashPercentage : 0;

    let topItems: TopItem[] = [];
    if (!topItemsRes.error && Array.isArray(topItemsData)) {
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
        averageOrderValue,
        cashPercentage,
        qrisPercentage,
      },
      topItems,
    };
  } catch (err) {
    console.error("Eksepsi getSalesReport:", err);
    return {
      period: {
        preset,
        from,
        to,
      },
      summary: {
        totalOrders: 0,
        totalRevenue: 0,
        totalCash: 0,
        totalQris: 0,
        averageOrderValue: 0,
        cashPercentage: 0,
        qrisPercentage: 0,
      },
      topItems: [],
    };
  }
}
