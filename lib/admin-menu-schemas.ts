import { z } from "zod";
import { UUID_REGEX } from "./schemas";

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Nama kategori wajib diisi").max(50, "Nama kategori maksimal 50 karakter"),
  sort_order: z.number().int().min(0).optional(),
}).strict();

export type CategoryInput = z.infer<typeof categorySchema>;

export type AdminCategory = {
  id: string;
  name: string;
  sort_order: number;
};

export const menuItemSchema = z.object({
  category_id: z.string().regex(UUID_REGEX, "Kategori tidak valid"),
  name: z.string().trim().min(1, "Nama menu wajib diisi").max(100, "Nama menu maksimal 100 karakter"),
  description: z.string().trim().max(500, "Deskripsi maksimal 500 karakter").optional().default(""),
  price: z
    .number("Harga harus berupa angka")
    .int("Harga harus berupa bilangan bulat Rupiah")
    .min(0, "Harga tidak boleh negatif"),
  image_path: z
    .string()
    .trim()
    .max(255)
    .nullable()
    .optional()
    .transform((val) => (val === "" ? null : val)),
  is_available: z.boolean().default(true),
  sort_order: z.number().int().min(0).optional(),
}).strict();

export type MenuItemInput = z.infer<typeof menuItemSchema>;
export type AdminMenuItemInput = MenuItemInput;

export const quickToggleAvailabilitySchema = z.object({
  is_available: z.boolean(),
}).strict();

export const reorderSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().regex(UUID_REGEX, "ID tidak valid"),
      sort_order: z.number().int().min(0),
    }).strict()
  ).min(1, "Daftar urutan tidak boleh kosong"),
}).strict();

export type ReorderInput = z.infer<typeof reorderSchema>;
