import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  adminOrderActionSchema,
  getLiveOrders,
  getOrderItems,
} from "./admin-orders";

describe("admin-orders", () => {
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
