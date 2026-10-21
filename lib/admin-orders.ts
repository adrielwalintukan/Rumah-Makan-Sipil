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
 * Meng-escape karakter khusus LIKE (% dan _ dan \) agar diperlakukan sebagai literal teks.
 */
export function escapeLikePattern(pattern: string): string {
  return pattern.replace(/[\\%_]/g, "\\$&");
}

/**
 * Menyiapkan query filter ilike yang aman di PostgREST .or()
 * Meng-escape wildcard SQL LIKE (% _ \), double quotes, dan membungkus dengan tanda kutip
 * agar tanda koma atau tanda kurung tidak memecah parser grammar PostgREST.
 */
export function buildSafeOrIlikeFilter(column: string, term: string): string {
  const escapedLike = escapeLikePattern(term);
  const escapedPostgrest = escapedLike.replace(/"/g, '\\"');
  return `${column}.ilike."%${escapedPostgrest}%"`;
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

  const cleanSearch = search && search.trim().length > 0 ? search.trim() : null;

  // 1. Ambil data agregasi ringkasan via RPC SQL di database (bebas dari limit 1.000 PostgREST)
  const { data: summaryData, error: summaryError } = await supabase.rpc(
    "admin_get_order_history_summary",
    {
      p_from_date: fromDate,
      p_to_date: toDate,
      p_status: status,
      p_search: cleanSearch,
    }
  );

  if (summaryError || !summaryData) {
    return {
      orders: [],
      totalCount: 0,
      summary: { totalOrders: 0, totalRevenue: 0, totalCash: 0, totalQris: 0 },
      page,
      totalPages: 1,
    };
  }

  const summary: OrderHistorySummary = {
    totalOrders: Number(summaryData.totalOrders ?? 0),
    totalRevenue: Number(summaryData.totalRevenue ?? 0),
    totalCash: Number(summaryData.totalCash ?? 0),
    totalQris: Number(summaryData.totalQris ?? 0),
  };

  // 2. Ambil data pesanan terpaginasi beserta item-itemnya dengan count database eksak
  let ordersQuery = supabase
    .from("orders")
    .select(
      `
      *,
      order_items (*)
    `,
      { count: "exact" }
    )
    .gte("order_date", fromDate)
    .lte("order_date", toDate);

  if (status === "selesai") {
    ordersQuery = ordersQuery.eq("status", "selesai");
  } else if (status === "batal") {
    ordersQuery = ordersQuery.eq("status", "batal");
  }

  if (cleanSearch) {
    const cleanQ = cleanSearch.replace(/^#/, "");
    const isDailyNumber = /^\d+$/.test(cleanQ);
    const dailyNum = isDailyNumber ? parseInt(cleanQ, 10) : NaN;
    if (!isNaN(dailyNum) && dailyNum > 0) {
      const safeIlike = buildSafeOrIlikeFilter("customer_name", cleanSearch);
      ordersQuery = ordersQuery.or(`${safeIlike},daily_number.eq.${dailyNum}`);
    } else {
      ordersQuery = ordersQuery.ilike("customer_name", `%${escapeLikePattern(cleanSearch)}%`);
    }
  }

  const offset = (page - 1) * limit;
  const { data: ordersData, count: exactCount, error: ordersError } = await ordersQuery
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

  const totalCount = exactCount ?? summary.totalOrders;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  return {
    orders: ordersData as AdminOrder[],
    totalCount,
    summary,
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
