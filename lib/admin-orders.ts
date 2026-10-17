import type { SupabaseClient } from "@supabase/supabase-js";

export type OrderType = "dine_in" | "takeaway";
export type PaymentMethod = "qris" | "cash";
export type PaymentStatus = "belum_bayar" | "menunggu_verifikasi" | "lunas";
export type OrderStatus = "baru" | "dimasak" | "siap" | "selesai" | "batal";

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
  notes: string | null;
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
  notes: string | null;
  created_at: string;
  updated_at: string;
  order_items: AdminOrderItem[];
}

/**
 * Mengambil seluruh pesanan aktif (baru, dimasak, siap) beserta item-itemnya.
 */
export async function getLiveOrders(supabase: SupabaseClient): Promise<AdminOrder[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(`
      *,
      order_items (*)
    `)
    .in("status", ["baru", "dimasak", "siap"])
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
