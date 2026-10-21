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
  // Buat objek tanggal tengah hari dalam zona lokal untuk perhitungan offset aman
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
