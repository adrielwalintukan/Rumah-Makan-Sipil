import { z } from "zod";

export const updateStoreStatusSchema = z.object({
  is_open: z.boolean({
    message: "Status buka/tutup toko harus berupa boolean.",
  }),
});

export type UpdateStoreStatusInput = z.infer<typeof updateStoreStatusSchema>;

export const STORE_QRIS_PATH_REGEX = /^qris\/[a-zA-Z0-9_-]+\.(webp|jpg|jpeg|png)$/;

export const updateStoreSettingsSchema = z
  .object({
    store_name: z
      .string()
      .trim()
      .min(1, "Nama toko wajib diisi")
      .max(100, "Nama toko maksimal 100 karakter"),
    tagline: z
      .string()
      .trim()
      .max(150, "Tagline maksimal 150 karakter")
      .transform((val) => (val === "" ? null : val))
      .nullable()
      .optional(),
    whatsapp_number: z
      .string()
      .trim()
      .regex(
        /^62[0-9]{8,13}$/,
        "Nomor WhatsApp harus diawali 62 dan diikuti 8 sampai 13 digit angka (contoh: 62895806567230)"
      ),
    dos_price: z
      .number({ message: "Harga Paket Dos harus berupa angka" })
      .int("Harga Paket Dos harus berupa bilangan bulat Rupiah")
      .min(0, "Harga Paket Dos tidak boleh negatif"),
    qris_image_path: z
      .string()
      .trim()
      .max(255, "Path gambar QRIS maksimal 255 karakter")
      .transform((val) => (val === "" ? null : val))
      .nullable()
      .optional()
      .refine(
        (val) => val === null || val === undefined || STORE_QRIS_PATH_REGEX.test(val),
        {
          message:
            "Format path QRIS tidak valid. Harus berupa path relatif dalam folder qris/ (mis. qris/file.webp)",
        }
      ),
    is_open: z.boolean().optional(),
  })
  .strict();

export type UpdateStoreSettingsInput = z.infer<typeof updateStoreSettingsSchema>;
