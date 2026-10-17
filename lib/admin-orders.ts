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
