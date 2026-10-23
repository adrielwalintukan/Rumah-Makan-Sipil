import { describe, it, expect, vi } from "vitest";
import {
  expenseCategoryEnum,
  expensePayloadSchema,
  financePresetEnum,
  createFinanceQuerySchema,
  createExpensesQuerySchema,
  getFinanceDateRange,
  getFinanceData,
} from "./admin-finance";

describe("admin-finance", () => {
  const fixedNow = new Date("2026-10-23T14:30:00+08:00"); // WITA: 2026-10-23

  describe("expenseCategoryEnum", () => {
    it("menerima kategori yang sah", () => {
      expect(expenseCategoryEnum.safeParse("bahan").success).toBe(true);
      expect(expenseCategoryEnum.safeParse("operasional").success).toBe(true);
      expect(expenseCategoryEnum.safeParse("lainnya").success).toBe(true);
    });

    it("menolak kategori asing", () => {
      expect(expenseCategoryEnum.safeParse("investasi").success).toBe(false);
      expect(expenseCategoryEnum.safeParse("").success).toBe(false);
    });
  });

  describe("financePresetEnum", () => {
    it("menerima preset yang sah", () => {
      expect(financePresetEnum.safeParse("today").success).toBe(true);
      expect(financePresetEnum.safeParse("this_month").success).toBe(true);
      expect(financePresetEnum.safeParse("custom").success).toBe(true);
    });

    it("menolak preset asing", () => {
      expect(financePresetEnum.safeParse("last_year").success).toBe(false);
      expect(financePresetEnum.safeParse("").success).toBe(false);
    });
  });

  describe("expensePayloadSchema", () => {
    it("memvalidasi payload pengeluaran yang benar", () => {
      const result = expensePayloadSchema.safeParse({
        expense_date: "2026-10-23",
        description: "Beli Telur 1 Rak",
        amount: 60000,
        category: "bahan",
      });
      expect(result.success).toBe(true);
    });

    it("menolak nominal negatif atau nol", () => {
      const zero = expensePayloadSchema.safeParse({
        expense_date: "2026-10-23",
        description: "Beli Telur",
        amount: 0,
        category: "bahan",
      });
      expect(zero.success).toBe(false);

      const negative = expensePayloadSchema.safeParse({
        expense_date: "2026-10-23",
        description: "Beli Telur",
        amount: -5000,
        category: "bahan",
      });
      expect(negative.success).toBe(false);
    });

    it("menolak nominal bukan bilangan bulat", () => {
      const floatAmount = expensePayloadSchema.safeParse({
        expense_date: "2026-10-23",
        description: "Beli Telur",
        amount: 10000.5,
        category: "bahan",
      });
      expect(floatAmount.success).toBe(false);
    });

    it("menolak deskripsi kosong atau lebih dari 100 karakter", () => {
      const empty = expensePayloadSchema.safeParse({
        expense_date: "2026-10-23",
        description: "   ",
        amount: 10000,
        category: "operasional",
      });
      expect(empty.success).toBe(false);

      const tooLong = expensePayloadSchema.safeParse({
        expense_date: "2026-10-23",
        description: "A".repeat(101),
        amount: 10000,
        category: "operasional",
      });
      expect(tooLong.success).toBe(false);
    });

    it("menolak tanggal tidak valid atau format salah", () => {
      const invalidCal = expensePayloadSchema.safeParse({
        expense_date: "2026-02-31",
        description: "Beli Telur",
        amount: 10000,
        category: "bahan",
      });
      expect(invalidCal.success).toBe(false);
    });

    it("menolak tanggal pengeluaran di masa depan", () => {
      const future = expensePayloadSchema.safeParse({
        expense_date: "2099-01-01",
        description: "Beli Telur",
        amount: 10000,
        category: "bahan",
      });
      expect(future.success).toBe(false);
    });
  });

  describe("createFinanceQuerySchema", () => {
    const schema = createFinanceQuerySchema(fixedNow);

    it("menggunakan default preset today saat query kosong", () => {
      const result = schema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.preset).toBe("today");
      }
    });

    it("menolak tanggal awal atau akhir yang melebihi hari ini", () => {
      const futureFrom = schema.safeParse({
        preset: "custom",
        from: "2026-10-25",
        to: "2026-10-25",
      });
      expect(futureFrom.success).toBe(false);

      const futureTo = schema.safeParse({
        preset: "custom",
        from: "2026-10-20",
        to: "2026-10-25",
      });
      expect(futureTo.success).toBe(false);
    });

    it("menolak tanggal awal yang lebih besar dari tanggal akhir", () => {
      const reversed = schema.safeParse({
        preset: "custom",
        from: "2026-10-20",
        to: "2026-10-15",
      });
      expect(reversed.success).toBe(false);
    });
  });

  describe("createExpensesQuerySchema", () => {
    const expensesSchema = createExpensesQuerySchema(fixedNow);

    it("menerima query valid dengan kategori opsional", () => {
      const res = expensesSchema.safeParse({
        preset: "today",
        category: "bahan",
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.category).toBe("bahan");
      }
    });

    it("menerima query tanpa kategori", () => {
      const res = expensesSchema.safeParse({
        preset: "this_month",
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.category).toBeUndefined();
      }
    });

    it("menolak query jika kategori tidak valid", () => {
      const res = expensesSchema.safeParse({
        preset: "today",
        category: "investasi",
      });
      expect(res.success).toBe(false);
    });

    it("menolak rentang tanggal custom yang tidak valid", () => {
      const res = expensesSchema.safeParse({
        preset: "custom",
        from: "2026-02-30",
        to: "2026-10-23",
      });
      expect(res.success).toBe(false);
    });
  });

  describe("getFinanceDateRange", () => {
    it("menghitung rentang today", () => {
      const range = getFinanceDateRange("today", undefined, undefined, fixedNow);
      expect(range).toEqual({ from: "2026-10-23", to: "2026-10-23" });
    });

    it("menghitung rentang this_month", () => {
      const range = getFinanceDateRange("this_month", undefined, undefined, fixedNow);
      expect(range).toEqual({ from: "2026-10-01", to: "2026-10-23" });
    });

    it("menghitung rentang custom valid", () => {
      const range = getFinanceDateRange("custom", "2026-10-10", "2026-10-20", fixedNow);
      expect(range).toEqual({ from: "2026-10-10", to: "2026-10-20" });
    });

    it("mengatur batas atas rentang custom ke today jika melebihi hari ini", () => {
      const range = getFinanceDateRange("custom", "2026-10-10", "2026-10-30", fixedNow);
      expect(range).toEqual({ from: "2026-10-10", to: "2026-10-23" });
    });

    it("menukar rentang custom jika from > to", () => {
      const reversed = getFinanceDateRange("custom", "2026-10-20", "2026-10-10", fixedNow);
      expect(reversed).toEqual({ from: "2026-10-10", to: "2026-10-20" });
    });

    it("menangani preset default atau custom tanpa parameter tanggal", () => {
      const fallbackRange = getFinanceDateRange("custom", undefined, undefined, fixedNow);
      expect(fallbackRange).toEqual({ from: "2026-10-23", to: "2026-10-23" });

      // @ts-expect-error test unknown preset
      const unknownRange = getFinanceDateRange("unknown", undefined, undefined, fixedNow);
      expect(unknownRange).toEqual({ from: "2026-10-23", to: "2026-10-23" });
    });
  });

  describe("getFinanceData", () => {
    it("mengambil data cashbook via rpc dan daftar expenses via query", async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: {
          period: { from: "2026-10-23", to: "2026-10-23" },
          summary: {
            totalIncome: 100000,
            totalExpense: 40000,
            grossProfit: 60000,
            expenseByCategory: { bahan: 25000, operasional: 15000, lainnya: 0 },
          },
          dailyBreakdown: [
            { date: "2026-10-23", income: 100000, expense: 40000, grossProfit: 60000 },
          ],
        },
        error: null,
      });

      const mockOrderCreated = vi.fn().mockResolvedValue({
        data: [
          {
            id: "exp-1",
            expense_date: "2026-10-23",
            description: "Beli Beras",
            amount: 25000,
            category: "bahan",
            created_at: "2026-10-23T10:00:00Z",
          },
        ],
        error: null,
      });

      const mockOrderDate = vi.fn().mockReturnValue({ order: mockOrderCreated });
      const mockLte = vi.fn().mockReturnValue({ order: mockOrderDate });
      const mockGte = vi.fn().mockReturnValue({ lte: mockLte });
      const mockSelect = vi.fn().mockReturnValue({ gte: mockGte });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

      const mockSupabase = {
        rpc: mockRpc,
        from: mockFrom,
      } as unknown as Parameters<typeof getFinanceData>[0];

      const result = await getFinanceData(
        mockSupabase,
        { preset: "today" },
        fixedNow
      );

      expect(mockRpc).toHaveBeenCalledWith("cashbook", {
        p_from_date: "2026-10-23",
        p_to_date: "2026-10-23",
      });
      expect(mockFrom).toHaveBeenCalledWith("expenses");
      expect(result.cashbook.summary.grossProfit).toBe(60000);
      expect(result.expenses).toHaveLength(1);
      expect(result.expenses[0].description).toBe("Beli Beras");
    });

    it("melempar error jika RPC cashbook gagal dan tidak menyamarkannya sebagai angka nol", async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({ data: null, error: new Error("RPC Failure") }),
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          }),
        }),
      } as unknown as Parameters<typeof getFinanceData>[0];

      await expect(
        getFinanceData(mockSupabase, { preset: "today" }, fixedNow)
      ).rejects.toThrow("Gagal memuat buku kas: RPC Failure");
    });

    it("melempar error jika query expenses gagal dan tidak mengembalikan data parsial", async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: {
            period: { from: "2026-10-23", to: "2026-10-23" },
            summary: {
              totalIncome: 100000,
              totalExpense: 0,
              grossProfit: 100000,
              expenseByCategory: { bahan: 0, operasional: 0, lainnya: 0 },
            },
            dailyBreakdown: [],
          },
          error: null,
        }),
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: null, error: new Error("Table Locked") }),
                }),
              }),
            }),
          }),
        }),
      } as unknown as Parameters<typeof getFinanceData>[0];

      await expect(
        getFinanceData(mockSupabase, { preset: "today" }, fixedNow)
      ).rejects.toThrow("Gagal memuat daftar pengeluaran: Table Locked");
    });

    it("melempar error tak terduga (misal network crash) tanpa menelannya", async () => {
      const mockSupabase = {
        rpc: vi.fn().mockRejectedValue(new Error("Network Crash")),
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          }),
        }),
      } as unknown as Parameters<typeof getFinanceData>[0];

      await expect(
        getFinanceData(mockSupabase, { preset: "today" }, fixedNow)
      ).rejects.toThrow("Network Crash");
    });
  });
});
