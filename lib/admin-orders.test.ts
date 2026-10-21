import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  adminOrderActionSchema,
  buildSafeOrIlikeFilter,
  escapeLikePattern,
  getLiveOrders,
  getOrderHistory,
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

  describe("escapeLikePattern & buildSafeOrIlikeFilter", () => {
    it("meng-escape karakter wildcard SQL LIKE (% _ \\)", () => {
      expect(escapeLikePattern("100%")).toBe("100\\%");
      expect(escapeLikePattern("nama_user")).toBe("nama\\_user");
      expect(escapeLikePattern("c:\\folder")).toBe("c:\\\\folder");
      expect(escapeLikePattern("normal text")).toBe("normal text");
    });

    it("menghasilkan filter ilike aman yang membungkus tanda kutip dan meng-escape koma, kurung, dan tanda kutip", () => {
      // Input dengan koma (delimiter umum PostgREST or)
      const commaFilter = buildSafeOrIlikeFilter("customer_name", "Budi, Santoso");
      expect(commaFilter).toBe('customer_name.ilike."%Budi, Santoso%"');

      // Input dengan tanda kurung
      const parenFilter = buildSafeOrIlikeFilter("customer_name", "Cotto (Mie)");
      expect(parenFilter).toBe('customer_name.ilike."%Cotto (Mie)%"');

      // Input dengan tanda kutip ganda
      const quoteFilter = buildSafeOrIlikeFilter("customer_name", 'Pak "Haji"');
      expect(quoteFilter).toBe('customer_name.ilike."%Pak \\"Haji\\"%"');

      // Input dengan wildcard LIKE dan delimiter sekaligus
      const complexFilter = buildSafeOrIlikeFilter("customer_name", 'Diskon 50%, (Vip_1)');
      expect(complexFilter).toBe('customer_name.ilike."%Diskon 50\\%, (Vip\\_1)%"');
    });
  });

  describe("getOrderHistory", () => {
    function createMockSupabase(options?: {
      summaryRows?: Array<Record<string, unknown>>;
      rpcData?: Record<string, unknown>;
      summaryError?: Error | null;
      ordersData?: Array<Record<string, unknown>>;
      count?: number;
      ordersError?: Error | null;
    }) {
      const gteMock = vi.fn().mockReturnThis();
      const lteMock = vi.fn().mockReturnThis();
      const eqMock = vi.fn().mockReturnThis();
      const orMock = vi.fn().mockReturnThis();
      const ilikeMock = vi.fn().mockReturnThis();
      const orderMock = vi.fn().mockReturnThis();
      const rangeMock = vi.fn().mockReturnThis();

      let defaultRpcData = options?.rpcData;
      if (!defaultRpcData && options?.summaryRows) {
        let totalRev = 0;
        let totalCash = 0;
        let totalQris = 0;
        for (const row of options.summaryRows as Array<Record<string, unknown>>) {
          if (row.payment_status === "lunas" && row.status !== "batal") {
            const amt = Number(row.total || 0);
            totalRev += amt;
            if (row.payment_method === "cash") totalCash += amt;
            else if (row.payment_method === "qris") totalQris += amt;
          }
        }
        defaultRpcData = {
          totalOrders: options.summaryRows.length,
          totalRevenue: totalRev,
          totalCash,
          totalQris,
        };
      } else if (!defaultRpcData) {
        defaultRpcData = {
          totalOrders: 5,
          totalRevenue: 85000,
          totalCash: 50000,
          totalQris: 35000,
        };
      }

      const defaultCount =
        options?.count ??
        (options?.summaryRows
          ? options.summaryRows.length
          : options?.ordersData
          ? options.ordersData.length
          : 5);

      const rpcMock = vi.fn().mockResolvedValue({
        data: options?.summaryError ? null : defaultRpcData,
        error: options?.summaryError ?? null,
      });

      const selectMock = vi.fn(() => {
        const builder = {
          gte: gteMock,
          lte: lteMock,
          eq: eqMock,
          or: orMock,
          ilike: ilikeMock,
          order: orderMock,
          range: rangeMock,
          then: (resolve: (val: { data: unknown; count?: number; error: unknown }) => void) => {
            resolve({
              data: options?.ordersData ?? [],
              count: defaultCount,
              error: options?.ordersError ?? null,
            });
          },
        };

        gteMock.mockReturnValue(builder);
        lteMock.mockReturnValue(builder);
        eqMock.mockReturnValue(builder);
        orMock.mockReturnValue(builder);
        ilikeMock.mockReturnValue(builder);
        orderMock.mockReturnValue(builder);
        rangeMock.mockReturnValue(builder);

        return builder;
      });

      const fromMock = vi.fn().mockReturnValue({ select: selectMock });

      const client = {
        from: fromMock,
        rpc: rpcMock,
      } as unknown as SupabaseClient;

      return {
        client,
        spies: {
          from: fromMock,
          rpc: rpcMock,
          select: selectMock,
          gte: gteMock,
          lte: lteMock,
          eq: eqMock,
          or: orMock,
          ilike: ilikeMock,
          order: orderMock,
          range: rangeMock,
        },
      };
    }

    it("mengambil data pesanan dan menghitung ringkasan omzet lunas dengan tepat", async () => {
      const mockOrdersData = [
        {
          id: "order-1",
          public_token: "token-abc-1234567890123",
          order_date: "2026-10-21",
          daily_number: 1,
          customer_name: "Budi Santoso",
          customer_phone: "08123456789",
          order_type: "dine_in",
          payment_method: "cash",
          payment_status: "lunas",
          status: "selesai",
          total: 50000,
          cancel_reason: null,
          created_at: "2026-10-21T02:00:00Z",
          paid_at: "2026-10-21T02:05:00Z",
          order_items: [],
        },
        {
          id: "order-2",
          public_token: "token-def-1234567890123",
          order_date: "2026-10-21",
          daily_number: 2,
          customer_name: "Siti Rahma",
          customer_phone: null,
          order_type: "takeaway",
          payment_method: "qris",
          payment_status: "lunas",
          status: "selesai",
          total: 35000,
          cancel_reason: null,
          created_at: "2026-10-21T03:00:00Z",
          paid_at: "2026-10-21T03:02:00Z",
          order_items: [],
        },
      ];

      const mockSummaryRows = [
        { payment_method: "cash", payment_status: "lunas", status: "selesai", total: 50000 },
        { payment_method: "qris", payment_status: "lunas", status: "selesai", total: 35000 },
        { payment_method: "cash", payment_status: "belum_bayar", status: "batal", total: 20000 },
        // Pesanan batal meskipun status bayar lunas tidak dihitung ke omzet
        { payment_method: "qris", payment_status: "lunas", status: "batal", total: 15000 },
        // Pesanan belum lunas tidak dihitung ke omzet
        { payment_method: "cash", payment_status: "menunggu_verifikasi", status: "dimasak", total: 25000 },
      ];

      const { client, spies } = createMockSupabase({
        summaryRows: mockSummaryRows,
        ordersData: mockOrdersData,
      });

      const res = await getOrderHistory(client, {
        preset: "today",
        status: "all",
        page: 1,
        limit: 50,
      });

      expect(spies.from).toHaveBeenCalledWith("orders");
      expect(res.orders).toHaveLength(2);
      expect(res.totalCount).toBe(5);
      expect(res.totalPages).toBe(1);
      expect(res.summary.totalOrders).toBe(5);
      // Omzet lunas: hanya order lunas dan tidak batal (50.000 + 35.000 = 85.000)
      expect(res.summary.totalRevenue).toBe(85000);
      expect(res.summary.totalCash).toBe(50000);
      expect(res.summary.totalQris).toBe(35000);
    });

    it("menerapkan filter status selesai dan batal ke builder query", async () => {
      const { client, spies } = createMockSupabase();

      await getOrderHistory(client, {
        preset: "today",
        status: "selesai",
        page: 1,
        limit: 50,
      });
      expect(spies.eq).toHaveBeenCalledWith("status", "selesai");

      vi.clearAllMocks();

      await getOrderHistory(client, {
        preset: "today",
        status: "batal",
        page: 1,
        limit: 50,
      });
      expect(spies.eq).toHaveBeenCalledWith("status", "batal");

      vi.clearAllMocks();

      await getOrderHistory(client, {
        preset: "today",
        status: "all",
        page: 1,
        limit: 50,
      });
      expect(spies.eq).not.toHaveBeenCalled();
    });

    it("menerapkan pencarian nama pelanggan dan nomor antrean (angka atau diawali #)", async () => {
      const { client, spies } = createMockSupabase();

      // Pencarian berbasis teks nama biasa
      await getOrderHistory(client, {
        preset: "today",
        status: "all",
        search: "Budi",
        page: 1,
        limit: 50,
      });
      expect(spies.ilike).toHaveBeenCalledWith("customer_name", "%Budi%");
      expect(spies.or).not.toHaveBeenCalled();

      vi.clearAllMocks();

      // Pencarian angka murni (nomor antrean)
      await getOrderHistory(client, {
        preset: "today",
        status: "all",
        search: "12",
        page: 1,
        limit: 50,
      });
      expect(spies.or).toHaveBeenCalledWith('customer_name.ilike."%12%",daily_number.eq.12');

      vi.clearAllMocks();

      // Pencarian diawali karakter #
      await getOrderHistory(client, {
        preset: "today",
        status: "all",
        search: "#5",
        page: 1,
        limit: 50,
      });
      expect(spies.or).toHaveBeenCalledWith('customer_name.ilike."%#5%",daily_number.eq.5');

      vi.clearAllMocks();

      // Pencarian nama mengandung koma dan tanda kurung (karakter khusus delimiter PostgREST)
      await getOrderHistory(client, {
        preset: "today",
        status: "all",
        search: "Cotto (Mie), Spesial",
        page: 1,
        limit: 50,
      });
      expect(spies.ilike).toHaveBeenCalledWith("customer_name", "%Cotto (Mie), Spesial%");

      vi.clearAllMocks();

      // Pencarian mengandung wildcard SQL LIKE (% dan _)
      await getOrderHistory(client, {
        preset: "today",
        status: "all",
        search: "Diskon 50%_Promo",
        page: 1,
        limit: 50,
      });
      expect(spies.ilike).toHaveBeenCalledWith("customer_name", "%Diskon 50\\%\\_Promo%");

      vi.clearAllMocks();

      // Search hanya spasi tidak memanggil filter pencarian
      await getOrderHistory(client, {
        preset: "today",
        status: "all",
        search: "   ",
        page: 1,
        limit: 50,
      });
      expect(spies.ilike).not.toHaveBeenCalled();
      expect(spies.or).not.toHaveBeenCalled();
    });

    it("menentukan rentang tanggal yang benar untuk preset dan custom", async () => {
      const { client, spies } = createMockSupabase();

      // Preset kustom dengan from dan to lengkap
      await getOrderHistory(client, {
        preset: "custom",
        from: "2026-10-01",
        to: "2026-10-15",
        status: "all",
        page: 1,
        limit: 50,
      });
      expect(spies.gte).toHaveBeenCalledWith("order_date", "2026-10-01");
      expect(spies.lte).toHaveBeenCalledWith("order_date", "2026-10-15");

      vi.clearAllMocks();

      // Preset kustom hanya from
      await getOrderHistory(client, {
        preset: "custom",
        from: "2026-10-05",
        status: "all",
        page: 1,
        limit: 50,
      });
      expect(spies.gte).toHaveBeenCalledWith("order_date", "2026-10-05");
      expect(spies.lte).toHaveBeenCalledWith("order_date", "2026-10-05");

      vi.clearAllMocks();

      // Preset kustom hanya to
      await getOrderHistory(client, {
        preset: "custom",
        to: "2026-10-08",
        status: "all",
        page: 1,
        limit: 50,
      });
      expect(spies.gte).toHaveBeenCalledWith("order_date", "2026-10-08");
      expect(spies.lte).toHaveBeenCalledWith("order_date", "2026-10-08");

      vi.clearAllMocks();

      // Preset kustom tanggal terbalik (from > to) otomatis dibalik dengan aman
      await getOrderHistory(client, {
        preset: "custom",
        from: "2026-10-20",
        to: "2026-10-10",
        status: "all",
        page: 1,
        limit: 50,
      });
      expect(spies.gte).toHaveBeenCalledWith("order_date", "2026-10-10");
      expect(spies.lte).toHaveBeenCalledWith("order_date", "2026-10-20");

      vi.clearAllMocks();

      // Preset today
      await getOrderHistory(client, {
        preset: "today",
        status: "all",
        page: 1,
        limit: 50,
      });
      const todayStr = getWitaTodayDateString();
      expect(spies.gte).toHaveBeenCalledWith("order_date", todayStr);
      expect(spies.lte).toHaveBeenCalledWith("order_date", todayStr);
    });

    it("menghitung paginasi dan offset limit dengan tepat", async () => {
      // 25 pesanan, limit 10, page 2 -> offset 10..19, totalPages 3
      const mockSummaryRows = Array.from({ length: 25 }, () => ({
        payment_method: "cash",
        payment_status: "lunas",
        status: "selesai",
        total: 10000,
      }));

      const { client, spies } = createMockSupabase({
        summaryRows: mockSummaryRows,
      });

      const res = await getOrderHistory(client, {
        preset: "today",
        status: "all",
        page: 2,
        limit: 10,
      });

      expect(res.totalCount).toBe(25);
      expect(res.totalPages).toBe(3);
      expect(res.page).toBe(2);
      expect(spies.range).toHaveBeenCalledWith(10, 19);
      expect(spies.order).toHaveBeenCalledWith("created_at", { ascending: false });
    });

    it("menangani error query pesanan dan summary secara aman", async () => {
      // Kasus 1: orders error
      const { client: clientOrdersError } = createMockSupabase({
        summaryRows: [{ payment_method: "cash", payment_status: "lunas", status: "selesai", total: 10000 }],
        ordersError: new Error("DB Orders Error"),
      });

      const res1 = await getOrderHistory(clientOrdersError, {
        preset: "today",
        status: "all",
        page: 1,
        limit: 50,
      });

      expect(res1).toEqual({
        orders: [],
        totalCount: 0,
        summary: { totalOrders: 0, totalRevenue: 0, totalCash: 0, totalQris: 0 },
        page: 1,
        totalPages: 1,
      });

      // Kasus 2: summary error
      const { client: clientSummaryError } = createMockSupabase({
        summaryError: new Error("DB Summary Error"),
      });

      const res2 = await getOrderHistory(clientSummaryError, {
        preset: "today",
        status: "all",
        page: 1,
        limit: 50,
      });

      expect(res2).toEqual({
        orders: [],
        totalCount: 0,
        summary: { totalOrders: 0, totalRevenue: 0, totalCash: 0, totalQris: 0 },
        page: 1,
        totalPages: 1,
      });
    });

    it("menghitung metrik ringkasan dan paginasi secara akurat saat dataset melampaui limit bawaan 1.000 baris PostgREST", async () => {
      // Simulasi dataset 1.250 pesanan dengan omzet total 12.500.000 (melewati batas 1.000 PostgREST)
      const mockRpcLargeData = {
        totalOrders: 1250,
        totalRevenue: 12500000,
        totalCash: 7500000,
        totalQris: 5000000,
      };

      const mockPageOrders = Array.from({ length: 50 }, (_, i) => ({
        id: `order-bulk-${i}`,
        daily_number: i + 1,
        customer_name: `Pelanggan Bulk ${i + 1}`,
        total: 10000,
        status: "selesai",
        payment_status: "lunas",
      }));

      const { client, spies } = createMockSupabase({
        rpcData: mockRpcLargeData,
        ordersData: mockPageOrders,
        count: 1250,
      });

      const res = await getOrderHistory(client, {
        preset: "last30days",
        status: "all",
        page: 1,
        limit: 50,
      });

      // Verifikasi RPC dipanggil dengan parameter tanggal 30 hari
      expect(spies.rpc).toHaveBeenCalledWith("admin_get_order_history_summary", {
        p_from_date: expect.any(String),
        p_to_date: expect.any(String),
        p_status: "all",
        p_search: null,
      });

      // Verifikasi select menyertakan opsi { count: "exact" }
      expect(spies.select).toHaveBeenCalledWith(expect.any(String), { count: "exact" });

      // Verifikasi hasil tidak terpotong oleh limit 1.000:
      expect(res.orders).toHaveLength(50);
      expect(res.totalCount).toBe(1250);
      expect(res.totalPages).toBe(25); // 1250 / 50 = 25 halaman
      expect(res.summary.totalOrders).toBe(1250);
      expect(res.summary.totalRevenue).toBe(12500000);
      expect(res.summary.totalCash).toBe(7500000);
      expect(res.summary.totalQris).toBe(5000000);
    });
  });
});
