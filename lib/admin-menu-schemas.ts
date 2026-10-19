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

export const MENU_PHOTO_PATH_REGEX = /^items\/[a-zA-Z0-9_-]+\.(webp|jpg|jpeg|png)$/;

export const menuItemSchema = z.object({
  category_id: z.string().regex(UUID_REGEX, "Kategori tidak valid"),
  name: z.string().trim().min(1, "Nama menu wajib diisi").max(80, "Nama menu maksimal 80 karakter"),
  description: z.string().trim().max(500, "Deskripsi maksimal 500 karakter").optional().default(""),
  price: z
    .number("Harga harus berupa angka")
    .int("Harga harus berupa bilangan bulat Rupiah")
    .min(0, "Harga tidak boleh negatif"),
  image_path: z
    .string()
    .trim()
    .max(255, "Path foto maksimal 255 karakter")
    .transform((val) => (val === "" ? null : val))
    .nullable()
    .optional()
    .refine(
      (val) => val === null || val === undefined || MENU_PHOTO_PATH_REGEX.test(val),
      {
        message: "Format path foto tidak valid. Harus berupa path relatif dalam folder items/ (mis. items/nama-file.webp)",
      }
    ),
  is_available: z.boolean().default(true),
  sort_order: z.number().int().min(0).optional(),
}).strict();

export type MenuItemInput = z.infer<typeof menuItemSchema>;
export type AdminMenuItemInput = MenuItemInput;

export const optionSchema = z.object({
  id: z.string().regex(UUID_REGEX, "ID opsi tidak valid").optional(),
  name: z.string().trim().min(1, "Nama opsi wajib diisi").max(50, "Nama opsi maksimal 50 karakter"),
  price_delta: z
    .number()
    .int("Tambahan harga harus bilangan bulat")
    .min(0, "Tambahan harga tidak boleh negatif")
    .default(0),
  is_available: z.boolean().default(true),
  sort_order: z
    .number()
    .int("Urutan harus bilangan bulat")
    .min(0, "Urutan tidak boleh negatif")
    .default(0),
}).strict();

export type OptionInput = z.infer<typeof optionSchema>;

export const optionGroupSchema = z
  .object({
    id: z.string().regex(UUID_REGEX, "ID grup tidak valid").optional(),
    name: z.string().trim().min(1, "Nama grup wajib diisi").max(50, "Nama grup maksimal 50 karakter"),
    type: z.enum(["single", "multiple"], {
      message: "Tipe grup pilihan harus single atau multiple",
    }),
    required: z.boolean().default(false),
    sort_order: z
      .number()
      .int("Urutan harus bilangan bulat")
      .min(0, "Urutan tidak boleh negatif")
      .default(0),
    options: z.array(optionSchema).min(1, "Setiap grup pilihan wajib memiliki minimal 1 opsi"),
  })
  .strict()
  .superRefine((group, ctx) => {
    if (!Array.isArray(group.options)) {
      return;
    }
    const seenNames = new Set<string>();
    for (let i = 0; i < group.options.length; i++) {
      const opt = group.options[i];
      if (typeof opt?.name !== "string") continue;
      const normalized = opt.name.trim().toLowerCase();
      if (seenNames.has(normalized)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Nama opsi "${opt.name.trim()}" tidak boleh duplikat dalam satu grup pilihan`,
          path: ["options", i, "name"],
        });
      } else {
        seenNames.add(normalized);
      }
    }
  });

export type OptionGroupInput = z.infer<typeof optionGroupSchema>;

export const menuItemWithGroupsSchema = menuItemSchema
  .extend({
    option_groups: z.array(optionGroupSchema).default([]),
  })
  .strict()
  .superRefine((item, ctx) => {
    if (!Array.isArray(item.option_groups)) {
      return;
    }
    const seenGroupNames = new Set<string>();
    for (let i = 0; i < item.option_groups.length; i++) {
      const grp = item.option_groups[i];
      if (typeof grp?.name !== "string") continue;
      const normalized = grp.name.trim().toLowerCase();
      if (seenGroupNames.has(normalized)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Nama grup pilihan "${grp.name.trim()}" tidak boleh duplikat dalam satu menu`,
          path: ["option_groups", i, "name"],
        });
      } else {
        seenGroupNames.add(normalized);
      }
    }
  });

export type MenuItemWithGroupsInput = z.infer<typeof menuItemWithGroupsSchema>;

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
