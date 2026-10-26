import { z } from "zod";

/** Format nomor telepon Indonesia: (+62, 62, 08 dilanjutkan 7-12 digit). */
export const PHONE_REGEX = /^(\+62|62|0)8[0-9]{7,12}$/;
export const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export const checkoutItemSchema = z.object({
  menu_item_id: z.string().regex(UUID_REGEX, "ID menu tidak valid"),
  option_ids: z.array(z.string().regex(UUID_REGEX, "ID opsi tidak valid")).default([]),
  quantity: z
    .number()
    .int("Kuantitas harus bilangan bulat")
    .min(1, "Kuantitas minimal 1")
    .max(20, "Kuantitas maksimal 20"),
  note: z
    .string()
    .max(100, "Catatan maksimal 100 karakter")
    .default("")
    .transform((val) => val.trim()),
});

export const checkoutPayloadSchema = z.object({
  customer_name: z
    .string()
    .trim()
    .min(2, "Nama pemesan minimal 2 karakter")
    .max(30, "Nama pemesan maksimal 30 karakter"),
  customer_phone: z
    .string()
    .trim()
    .regex(PHONE_REGEX, "Nomor HP harus berformat Indonesia (+62/62/08...)")
    .nullable()
    .optional()
    .or(z.literal(""))
    .transform((val) => (val && val.trim() !== "" ? val.trim() : null)),
  order_type: z.enum(["dine_in", "takeaway"], {
    message: "Jenis pesanan harus Makan di sini atau Bungkus",
  }),
  payment_method: z.enum(["qris", "cash"], {
    message: "Metode pembayaran harus QRIS atau Cash",
  }),
  idempotency_key: z
    .string()
    .trim()
    .min(1, "Idempotency key wajib diisi"),
  device_id: z
    .string()
    .trim()
    .min(1, "Device ID wajib diisi"),
  items: z
    .array(checkoutItemSchema)
    .min(1, "Keranjang pesanan tidak boleh kosong")
    .max(30, "Maksimal 30 baris item"),
});

export type CheckoutItem = z.infer<typeof checkoutItemSchema>;
export type CheckoutPayload = z.infer<typeof checkoutPayloadSchema>;
