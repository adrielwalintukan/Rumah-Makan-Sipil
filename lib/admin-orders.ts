import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

export type OrderType = "dine_in" | "takeaway";
export type PaymentMethod = "qris" | "cash";
export type PaymentStatus = "belum_bayar" | "menunggu_verifikasi" | "lunas";
export type OrderStatus = "baru" | "dimasak" | "siap" | "selesai" | "batal";

export type AdminOrderAction =
  | "mulai_masak"
  | "siap"
  | "selesai"
  | "batal"
  | "tandai_lunas"
  | "pembayaran_belum_masuk";

export const adminOrderActionSchema = z.object({
  action: z.enum([
    "mulai_masak",
    "siap",
    "selesai",
    "batal",
    "tandai_lunas",
    "pembayaran_belum_masuk",
  ]),
  cancel_reason: z
    .string()
    .trim()
    .max(200, "Alasan pembatalan maksimal 200 karakter.")
    .optional()
    .nullable(),
});

export type AdminOrderActionPayload = z.infer<typeof adminOrderActionSchema>;

export interface AdminOrderItemOption {
  group: string;
  name: string;
  price_delta: number;
}

export interface AdminOrderItem {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  name: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
  note: string | null;
  options: AdminOrderItemOption[] | null;
}

export interface AdminOrder {
  id: string;
  public_token: string;
  order_date: string;
  daily_number: number;
  customer_name: string;
  customer_phone: string | null;
  order_type: OrderType;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  status: OrderStatus;
  total: number;
  cancel_reason: string | null;
  created_at: string;
  paid_at: string | null;
  order_items: AdminOrderItem[];
}

/**
 * Mengembalikan tanggal hari ini dalam format YYYY-MM-DD berbasis zona waktu WITA (Asia/Makassar).
 */
export function getWitaTodayDateString(now: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now);
}

/**
 * Menghitung rentang tanggal YYYY-MM-DD untuk preset filter berbasis zona waktu WITA (Asia/Makassar).
 */
export function getWitaDateRange(
  preset: "today" | "yesterday" | "last7days" | "last30days",
  now: Date = new Date()
): { from: string; to: string } {
  const todayStr = getWitaTodayDateString(now);
  const [year, month, day] = todayStr.split("-").map(Number);
  // Buat objek tanggal UTC tengah hari untuk perhitungan offset tanggal yang aman tanpa bias DST
  const baseDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  const formatOffset = (offsetDays: number): string => {
    const d = new Date(baseDate);
    d.setUTCDate(d.getUTCDate() + offsetDays);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dt = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${dt}`;
  };

  switch (preset) {
    case "today":
      return { from: todayStr, to: todayStr };
    case "yesterday": {
      const yesterdayStr = formatOffset(-1);
      return { from: yesterdayStr, to: yesterdayStr };
    }
    case "last7days":
      return { from: formatOffset(-6), to: todayStr };
    case "last30days":
      return { from: formatOffset(-29), to: todayStr };
  }
}

export const orderHistoryPresetEnum = z.enum([
  "today",
  "yesterday",
  "last7days",
  "last30days",
  "custom",
]);
export type OrderHistoryPreset = z.infer<typeof orderHistoryPresetEnum>;

export const orderHistoryStatusFilterEnum = z.enum(["all", "selesai", "batal"]);
export type OrderHistoryStatusFilter = z.infer<typeof orderHistoryStatusFilterEnum>;

export const orderHistoryQuerySchema = z.object({
  preset: orderHistoryPresetEnum.default("today"),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal awal harus YYYY-MM-DD.")
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal akhir harus YYYY-MM-DD.")
    .optional(),
  status: orderHistoryStatusFilterEnum.default("all"),
  search: z
    .string()
    .trim()
    .max(50, "Kata kunci pencarian maksimal 50 karakter.")
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type OrderHistoryQuery = z.infer<typeof orderHistoryQuerySchema>;

export interface OrderHistorySummary {
  totalOrders: number;
  totalRevenue: number;
  totalCash: number;
  totalQris: number;
}

export interface OrderHistoryResult {
  orders: AdminOrder[];
  totalCount: number;
  summary: OrderHistorySummary;
  page: number;
  totalPages: number;
}

/**
 * Mengambil riwayat pesanan dengan filter tanggal (WITA), status, pencarian, dan paginasi,
 * beserta agregasi metrik ringkasan (omzet lunas, cash, qris, total orders).
 */
export async function getOrderHistory(
  supabase: SupabaseClient,
  query: OrderHistoryQuery
): Promise<OrderHistoryResult> {
  const preset = query.preset ?? "today";
  const status = query.status ?? "all";
  const search = query.search;
  const page = query.page ?? 1;
  const limit = query.limit ?? 50;

  let fromDate: string;
  let toDate: string;

  if (preset === "custom" && query.from && query.to) {
    fromDate = query.from;
    toDate = query.to;
  } else if (preset === "custom" && query.from) {
    fromDate = query.from;
    toDate = query.from;
  } else if (preset === "custom" && query.to) {
    fromDate = query.to;
    toDate = query.to;
  } else {
    const range = getWitaDateRange(preset === "custom" ? "today" : preset);
    fromDate = range.from;
    toDate = range.to;
  }

  if (fromDate > toDate) {
    const temp = fromDate;
    fromDate = toDate;
    toDate = temp;
  }

  // 1. Ambil data agregasi ringkasan (seluruh dataset yang cocok dengan filter)
  let summaryQuery = supabase
    .from("orders")
    .select("payment_method, payment_status, status, total")
    .gte("order_date", fromDate)
    .lte("order_date", toDate);

  if (status === "selesai") {
    summaryQuery = summaryQuery.eq("status", "selesai");
  } else if (status === "batal") {
    summaryQuery = summaryQuery.eq("status", "batal");
  }

  if (search && search.trim().length > 0) {
    const q = search.trim();
    const cleanQ = q.replace(/^#/, "");
    const isDailyNumber = /^\d+$/.test(cleanQ);
    const dailyNum = isDailyNumber ? parseInt(cleanQ, 10) : NaN;
    if (!isNaN(dailyNum) && dailyNum > 0) {
      summaryQuery = summaryQuery.or(`customer_name.ilike.%${q}%,daily_number.eq.${dailyNum}`);
    } else {
      summaryQuery = summaryQuery.ilike("customer_name", `%${q}%`);
    }
  }

  const { data: summaryRows, error: summaryError } = await summaryQuery;

  if (summaryError || !summaryRows) {
    return {
      orders: [],
      totalCount: 0,
      summary: { totalOrders: 0, totalRevenue: 0, totalCash: 0, totalQris: 0 },
      page,
      totalPages: 1,
    };
  }

  const totalOrders = summaryRows.length;
  let totalRevenue = 0;
  let totalCash = 0;
  let totalQris = 0;

  for (const row of summaryRows) {
    if (row.payment_status === "lunas" && row.status !== "batal") {
      const amount = row.total || 0;
      totalRevenue += amount;
      if (row.payment_method === "cash") {
        totalCash += amount;
      } else if (row.payment_method === "qris") {
        totalQris += amount;
      }
    }
  }

  // 2. Ambil total count untuk paginasi
  const totalCount = totalOrders;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const offset = (page - 1) * limit;

  // 3. Ambil data pesanan terpaginasi beserta item-itemnya
  let ordersQuery = supabase
    .from("orders")
    .select(`
      *,
      order_items (*)
    `)
    .gte("order_date", fromDate)
    .lte("order_date", toDate);

  if (status === "selesai") {
    ordersQuery = ordersQuery.eq("status", "selesai");
  } else if (status === "batal") {
    ordersQuery = ordersQuery.eq("status", "batal");
  }

  if (search && search.trim().length > 0) {
    const q = search.trim();
    const cleanQ = q.replace(/^#/, "");
    const isDailyNumber = /^\d+$/.test(cleanQ);
    const dailyNum = isDailyNumber ? parseInt(cleanQ, 10) : NaN;
    if (!isNaN(dailyNum) && dailyNum > 0) {
      ordersQuery = ordersQuery.or(`customer_name.ilike.%${q}%,daily_number.eq.${dailyNum}`);
    } else {
      ordersQuery = ordersQuery.ilike("customer_name", `%${q}%`);
    }
  }

  const { data: ordersData, error: ordersError } = await ordersQuery
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (ordersError || !ordersData) {
    return {
      orders: [],
      totalCount: 0,
      summary: { totalOrders: 0, totalRevenue: 0, totalCash: 0, totalQris: 0 },
      page,
      totalPages: 1,
    };
  }

  return {
    orders: ordersData as AdminOrder[],
    totalCount,
    summary: {
      totalOrders,
      totalRevenue,
      totalCash,
      totalQris,
    },
    page,
    totalPages,
  };
}

/**
 * Mengambil seluruh pesanan aktif (baru, dimasak, siap, atau selesai tapi belum lunas) beserta item-itemnya.
 */
export async function getLiveOrders(supabase: SupabaseClient): Promise<AdminOrder[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(`
      *,
      order_items (*)
    `)
    .or("status.in.(baru,dimasak,siap),and(status.eq.selesai,payment_status.neq.lunas)")
    .order("created_at", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data as AdminOrder[];
}

/**
 * Mengambil order_items untuk satu pesanan tertentu.
 */
export async function getOrderItems(supabase: SupabaseClient, orderId: string): Promise<AdminOrderItem[]> {
  const { data, error } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data as AdminOrderItem[];
}
