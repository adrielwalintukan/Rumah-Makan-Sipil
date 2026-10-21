import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  adminOrderActionSchema,
  getLiveOrders,
  getOrderItems,
  getWitaDateRange,
  getWitaTodayDateString,
  orderHistoryPresetEnum,
  orderHistoryQuerySchema,
  orderHistoryStatusFilterEnum,
} from "./admin-orders";

describe("admin-orders", () => {
  describe("WITA Date Helpers & orderHistoryQuerySchema", () => {
    it("menghasilkan tanggal hari ini dalam format YYYY-MM-DD zona waktu WITA", () => {
      const today = getWitaTodayDateString();
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // Verifikasi perpindahan hari pada boundary UTC vs WITA (UTC+8)
      const beforeMidnightWita = new Date("2026-10-20T15:59:59Z"); // 23:59:59 WITA
      const afterMidnightWita = new Date("2026-10-20T16:00:00Z"); // 00:00:00 WITA (21 Okt)

      expect(getWitaTodayDateString(beforeMidnightWita)).toBe("2026-10-20");
      expect(getWitaTodayDateString(afterMidnightWita)).toBe("2026-10-21");
    });

    it("menghitung rentang tanggal yang tepat untuk preset today, yesterday, last7days, dan last30days", () => {
      // 2026-10-21 04:00:00 UTC = 2026-10-21 12:00:00 WITA (UTC+8)
      const fixedDate = new Date("2026-10-21T04:00:00Z");

      const todayRange = getWitaDateRange("today", fixedDate);
      expect(todayRange).toEqual({ from: "2026-10-21", to: "2026-10-21" });

      const yesterdayRange = getWitaDateRange("yesterday", fixedDate);
      expect(yesterdayRange).toEqual({ from: "2026-10-20", to: "2026-10-20" });

      const last7daysRange = getWitaDateRange("last7days", fixedDate);
      expect(last7daysRange).toEqual({ from: "2026-10-15", to: "2026-10-21" });

      const last30daysRange = getWitaDateRange("last30days", fixedDate);
      expect(last30daysRange).toEqual({ from: "2026-09-22", to: "2026-10-21" });
    });

    it("memvalidasi enum preset dan filter status", () => {
      expect(orderHistoryPresetEnum.options).toEqual([
        "today",
        "yesterday",
        "last7days",
        "last30days",
        "custom",
      ]);
      expect(orderHistoryStatusFilterEnum.options).toEqual([
        "all",
        "selesai",
        "batal",
      ]);
    });

    it("memvalidasi query params riwayat pesanan dengan nilai default yang benar", () => {
      const parsed = orderHistoryQuerySchema.parse({});
      expect(parsed.preset).toBe("today");
      expect(parsed.status).toBe("all");
      expect(parsed.page).toBe(1);
      expect(parsed.limit).toBe(50);
      expect(parsed.from).toBeUndefined();
      expect(parsed.to).toBeUndefined();
      expect(parsed.search).toBeUndefined();
    });

    it("menerima preset kustom dengan rentang tanggal from dan to yang valid", () => {
      const parsed = orderHistoryQuerySchema.parse({
        preset: "custom",
        from: "2026-10-01",
        to: "2026-10-15",
        status: "selesai",
        search: "  budi  ",
        page: "2",
        limit: "25",
      });
      expect(parsed.preset).toBe("custom");
      expect(parsed.from).toBe("2026-10-01");
      expect(parsed.to).toBe("2026-10-15");
      expect(parsed.status).toBe("selesai");
      expect(parsed.search).toBe("budi");
      expect(parsed.page).toBe(2);
      expect(parsed.limit).toBe(25);
    });

    it("menolak tanggal kustom yang tidak sesuai format YYYY-MM-DD", () => {
      expect(() =>
        orderHistoryQuerySchema.parse({
          preset: "custom",
          from: "01-10-2026",
        })
      ).toThrow();

      expect(() =>
        orderHistoryQuerySchema.parse({
          preset: "custom",
          to: "2026/10/15",
        })
      ).toThrow();
    });

    it("menolak nilai status yang tidak valid", () => {
      expect(() =>
        orderHistoryQuerySchema.parse({
          status: "pending",
        })
      ).toThrow();
    });

    it("menolak limit di luar batas 1 sampai 100", () => {
      expect(() =>
        orderHistoryQuerySchema.parse({
          limit: 0,
        })
      ).toThrow();

      expect(() =>
        orderHistoryQuerySchema.parse({
          limit: 101,
        })
      ).toThrow();
    });

    it("menolak search lebih dari 50 karakter", () => {
      expect(() =>
        orderHistoryQuerySchema.parse({
          search: "x".repeat(51),
        })
      ).toThrow();
    });
  });

  describe("adminOrderActionSchema", () => {
    it("memvalidasi aksi pesanan yang sah", () => {
      const validActions = [
        { action: "mulai_masak" },
        { action: "siap" },
        { action: "selesai" },
        { action: "batal", cancel_reason: "Bahan habis" },
        { action: "tandai_lunas" },
        { action: "pembayaran_belum_masuk" },
      ];

      for (const item of validActions) {
        const parsed = adminOrderActionSchema.safeParse(item);
        expect(parsed.success).toBe(true);
      }
    });

    it("menolak aksi yang tidak dikenal", () => {
      const invalid = adminOrderActionSchema.safeParse({ action: "ngawur" });
      expect(invalid.success).toBe(false);
    });

    it("menolak alasan pembatalan melebihi 200 karakter", () => {
      const tooLong = adminOrderActionSchema.safeParse({
        action: "batal",
        cancel_reason: "a".repeat(201),
      });
      expect(tooLong.success).toBe(false);
    });
  });

  describe("getLiveOrders", () => {
    it("mengambil pesanan aktif dengan klausa .or", async () => {
      const mockOrders = [
        {
          id: "order-1",
          daily_number: 1,
          customer_name: "Budi",
          status: "baru",
          order_items: [],
        },
      ];

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockOrders, error: null }),
            }),
          }),
        }),
      } as unknown as SupabaseClient;

      const result = await getLiveOrders(mockSupabase);

      expect(mockSupabase.from).toHaveBeenCalledWith("orders");
      expect(result).toEqual(mockOrders);
    });

    it("mengembalikan array kosong jika query gagal", async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: null, error: new Error("DB Error") }),
            }),
          }),
        }),
      } as unknown as SupabaseClient;

      const result = await getLiveOrders(mockSupabase);
      expect(result).toEqual([]);
    });
  });

  describe("getOrderItems", () => {
    it("mengambil item pesanan berdasarkan order_id", async () => {
      const mockItems = [
        { id: "item-1", order_id: "order-1", name: "Mie Goreng", quantity: 2 },
      ];

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockItems, error: null }),
            }),
          }),
        }),
      } as unknown as SupabaseClient;

      const result = await getOrderItems(mockSupabase, "order-1");

      expect(mockSupabase.from).toHaveBeenCalledWith("order_items");
      expect(result).toEqual(mockItems);
    });
  });
});
