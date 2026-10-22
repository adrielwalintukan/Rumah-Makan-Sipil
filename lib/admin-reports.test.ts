import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getReportDateRange,
  getSalesReport,
  getWitaMonthRange,
  getWitaTodayDateString,
  reportPresetEnum,
  reportQuerySchema,
  type ReportQuery,
} from "./admin-reports";

describe("admin-reports", () => {
  describe("WITA Date Helpers", () => {
    it("menghasilkan tanggal hari ini dalam format YYYY-MM-DD zona waktu WITA (UTC+8)", () => {
      const today = getWitaTodayDateString();
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // Verifikasi boundary pergantian hari antara UTC dan WITA (UTC+8)
      const beforeMidnightWita = new Date("2026-10-21T15:59:59Z"); // 23:59:59 WITA
      const afterMidnightWita = new Date("2026-10-21T16:00:00Z"); // 00:00:00 WITA (22 Okt)

      expect(getWitaTodayDateString(beforeMidnightWita)).toBe("2026-10-21");
      expect(getWitaTodayDateString(afterMidnightWita)).toBe("2026-10-22");
    });

    it("menghitung rentang bulan berjalan (getWitaMonthRange) dari tanggal 1 s.d. hari ini dalam WITA", () => {
      // 22 Oktober 2026 12:00 WITA (04:00 UTC)
      const dateMidMonth = new Date("2026-10-22T04:00:00Z");
      expect(getWitaMonthRange(dateMidMonth)).toEqual({
        from: "2026-10-01",
        to: "2026-10-22",
      });

      // 1 November 2026 09:00 WITA (01:00 UTC) - awal bulan
      const dateStartMonth = new Date("2026-11-01T01:00:00Z");
      expect(getWitaMonthRange(dateStartMonth)).toEqual({
        from: "2026-11-01",
        to: "2026-11-01",
      });

      // 28 Februari 2026 12:00 WITA
      const dateFeb = new Date("2026-02-28T04:00:00Z");
      expect(getWitaMonthRange(dateFeb)).toEqual({
        from: "2026-02-01",
        to: "2026-02-28",
      });
    });

    it("menghitung rentang tanggal getReportDateRange untuk preset today dan this_month", () => {
      const fixedDate = new Date("2026-10-22T04:00:00Z"); // 22 Okt 2026 WITA

      const todayRange = getReportDateRange("today", undefined, undefined, fixedDate);
      expect(todayRange).toEqual({
        from: "2026-10-22",
        to: "2026-10-22",
      });

      const monthRange = getReportDateRange("this_month", undefined, undefined, fixedDate);
      expect(monthRange).toEqual({
        from: "2026-10-01",
        to: "2026-10-22",
      });
    });

    it("menghitung rentang tanggal getReportDateRange untuk preset custom dengan validasi dan swap", () => {
      const fixedDate = new Date("2026-10-22T04:00:00Z");

      // Custom valid urut
      const validCustom = getReportDateRange("custom", "2026-10-05", "2026-10-15", fixedDate);
      expect(validCustom).toEqual({
        from: "2026-10-05",
        to: "2026-10-15",
      });

      // Custom terbalik: from > to otomatis di-swap
      const invertedCustom = getReportDateRange("custom", "2026-10-20", "2026-10-10", fixedDate);
      expect(invertedCustom).toEqual({
        from: "2026-10-10",
        to: "2026-10-20",
      });

      // Custom tidak lengkap (hanya from): fallback ke today
      const missingTo = getReportDateRange("custom", "2026-10-05", undefined, fixedDate);
      expect(missingTo).toEqual({
        from: "2026-10-22",
        to: "2026-10-22",
      });

      // Custom tidak lengkap (hanya to): fallback ke today
      const missingFrom = getReportDateRange("custom", undefined, "2026-10-15", fixedDate);
      expect(missingFrom).toEqual({
        from: "2026-10-22",
        to: "2026-10-22",
      });
    });
  });

  describe("reportQuerySchema & reportPresetEnum", () => {
    it("memvalidasi opsi preset yang didukung", () => {
      expect(reportPresetEnum.options).toEqual(["today", "this_month", "custom"]);
    });

    it("memvalidasi query default dengan preset today dan limit 5", () => {
      const parsed = reportQuerySchema.parse({});
      expect(parsed.preset).toBe("today");
      expect(parsed.limit).toBe(5);
      expect(parsed.from).toBeUndefined();
      expect(parsed.to).toBeUndefined();
    });

    it("menerima preset this_month dan kustom limit numerik", () => {
      const parsed = reportQuerySchema.parse({
        preset: "this_month",
        limit: "10",
      });
      expect(parsed.preset).toBe("this_month");
      expect(parsed.limit).toBe(10);
    });

    it("menerima preset custom dengan format tanggal YYYY-MM-DD yang benar", () => {
      const parsed = reportQuerySchema.parse({
        preset: "custom",
        from: "2026-10-01",
        to: "2026-10-15",
        limit: 20,
      });
      expect(parsed.preset).toBe("custom");
      expect(parsed.from).toBe("2026-10-01");
      expect(parsed.to).toBe("2026-10-15");
      expect(parsed.limit).toBe(20);
    });

    it("menolak format tanggal yang tidak valid (bukan YYYY-MM-DD)", () => {
      expect(() =>
        reportQuerySchema.parse({
          preset: "custom",
          from: "01-10-2026",
          to: "2026-10-15",
        })
      ).toThrow("Format tanggal awal harus YYYY-MM-DD.");

      expect(() =>
        reportQuerySchema.parse({
          preset: "custom",
          from: "2026-10-01",
          to: "2026/10/15",
        })
      ).toThrow("Format tanggal akhir harus YYYY-MM-DD.");
    });

    it("menolak nilai limit di luar batas min 1 dan max 50", () => {
      expect(() =>
        reportQuerySchema.parse({
          limit: 0,
        })
      ).toThrow();

      expect(() =>
        reportQuerySchema.parse({
          limit: 51,
        })
      ).toThrow();
    });
  });

  describe("getSalesReport", () => {
    function createMockSupabase(params: {
      summaryResult?: { data: unknown; error: unknown };
      topItemsResult?: { data: unknown; error: unknown };
    }) {
      const rpcMock = vi.fn().mockImplementation((fnName: string) => {
        if (fnName === "report_summary") {
          return Promise.resolve(
            params.summaryResult ?? {
              data: {
                totalOrders: 10,
                totalRevenue: 500000,
                totalCash: 200000,
                totalQris: 300000,
              },
              error: null,
            }
          );
        }
        if (fnName === "top_items") {
          return Promise.resolve(
            params.topItemsResult ?? {
              data: [
                { name: "Ayam Goreng Lengkuas", total_quantity: 15, total_revenue: 375000 },
                { name: "Es Teh Manis", total_quantity: 12, total_revenue: 60000 },
              ],
              error: null,
            }
          );
        }
        return Promise.resolve({ data: null, error: new Error(`Unknown RPC ${fnName}`) });
      });

      return {
        client: { rpc: rpcMock } as unknown as SupabaseClient,
        rpcMock,
      };
    }

    it("memanggil RPC report_summary dan top_items dengan parameter tanggal yang benar", async () => {
      const { client, rpcMock } = createMockSupabase({});
      const fixedDate = new Date("2026-10-22T04:00:00Z");

      const query: ReportQuery = {
        preset: "today",
        limit: 5,
      };

      const result = await getSalesReport(client, query, fixedDate);

      expect(rpcMock).toHaveBeenCalledTimes(2);
      expect(rpcMock).toHaveBeenCalledWith("report_summary", {
        p_from_date: "2026-10-22",
        p_to_date: "2026-10-22",
      });
      expect(rpcMock).toHaveBeenCalledWith("top_items", {
        p_from_date: "2026-10-22",
        p_to_date: "2026-10-22",
        p_limit: 5,
      });

      expect(result.period).toEqual({
        preset: "today",
        from: "2026-10-22",
        to: "2026-10-22",
      });
    });

    it("menghitung averageOrderValue, cashPercentage, dan qrisPercentage dengan benar", async () => {
      const { client } = createMockSupabase({
        summaryResult: {
          data: {
            totalOrders: 8,
            totalRevenue: 240000,
            totalCash: 80000,
            totalQris: 160000,
          },
          error: null,
        },
      });

      const result = await getSalesReport(client, { preset: "today", limit: 5 });

      expect(result.summary.totalOrders).toBe(8);
      expect(result.summary.totalRevenue).toBe(240000);
      expect(result.summary.totalCash).toBe(80000);
      expect(result.summary.totalQris).toBe(160000);
      // averageOrderValue = 240000 / 8 = 30000
      expect(result.summary.averageOrderValue).toBe(30000);
      // cashPercentage = (80000 / 240000) * 100 = 33% (round)
      expect(result.summary.cashPercentage).toBe(33);
      // qrisPercentage = 100 - 33 = 67%
      expect(result.summary.qrisPercentage).toBe(67);
      expect(result.summary.cashPercentage + result.summary.qrisPercentage).toBe(100);
    });

    it("menghindari pembagian dengan nol saat 0 pesanan / 0 omzet", async () => {
      const { client } = createMockSupabase({
        summaryResult: {
          data: {
            totalOrders: 0,
            totalRevenue: 0,
            totalCash: 0,
            totalQris: 0,
          },
          error: null,
        },
        topItemsResult: {
          data: [],
          error: null,
        },
      });

      const result = await getSalesReport(client, { preset: "today", limit: 5 });

      expect(result.summary.totalOrders).toBe(0);
      expect(result.summary.totalRevenue).toBe(0);
      expect(result.summary.averageOrderValue).toBe(0);
      expect(result.summary.cashPercentage).toBe(0);
      expect(result.summary.qrisPercentage).toBe(0);
      expect(result.topItems).toEqual([]);
    });

    it("memetakan daftar topItems dengan aman", async () => {
      const { client } = createMockSupabase({
        topItemsResult: {
          data: [
            { name: "Paket Nasi Kuning", total_quantity: 25, total_revenue: 500000 },
            { name: "Kopi Susu Gula Aren", total_quantity: 18, total_revenue: 270000 },
          ],
          error: null,
        },
      });

      const result = await getSalesReport(client, { preset: "this_month", limit: 5 });

      expect(result.topItems).toHaveLength(2);
      expect(result.topItems[0]).toEqual({
        name: "Paket Nasi Kuning",
        total_quantity: 25,
        total_revenue: 500000,
      });
      expect(result.topItems[1]).toEqual({
        name: "Kopi Susu Gula Aren",
        total_quantity: 18,
        total_revenue: 270000,
      });
    });

    it("menangani error RPC summary secara defensif tanpa melempar unhandled exception", async () => {
      const { client } = createMockSupabase({
        summaryResult: {
          data: null,
          error: { message: "Database connection failed", code: "PGRST000" },
        },
      });

      const result = await getSalesReport(client, { preset: "today", limit: 5 });

      expect(result.summary).toEqual({
        totalOrders: 0,
        totalRevenue: 0,
        totalCash: 0,
        totalQris: 0,
        averageOrderValue: 0,
        cashPercentage: 0,
        qrisPercentage: 0,
      });
    });

    it("menangani error RPC top_items secara defensif tanpa melempar unhandled exception", async () => {
      const { client } = createMockSupabase({
        topItemsResult: {
          data: null,
          error: { message: "Function top_items not found", code: "42883" },
        },
      });

      const result = await getSalesReport(client, { preset: "today", limit: 5 });

      expect(result.topItems).toEqual([]);
      // summary tetap dihitung jika summary berhasil
      expect(result.summary.totalOrders).toBe(10);
    });

    it("menangani exception unhandled/rejected promise dari RPC secara aman", async () => {
      const rpcThrowing = vi.fn().mockRejectedValue(new Error("Network timeout"));
      const throwingClient = { rpc: rpcThrowing } as unknown as SupabaseClient;

      const result = await getSalesReport(throwingClient, { preset: "today", limit: 5 });

      expect(result.summary).toEqual({
        totalOrders: 0,
        totalRevenue: 0,
        totalCash: 0,
        totalQris: 0,
        averageOrderValue: 0,
        cashPercentage: 0,
        qrisPercentage: 0,
      });
      expect(result.topItems).toEqual([]);
    });
  });
});
