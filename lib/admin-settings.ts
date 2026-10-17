import { z } from "zod";

export const updateStoreStatusSchema = z.object({
  is_open: z.boolean({
    message: "Status buka/tutup toko harus berupa boolean.",
  }),
});

export type UpdateStoreStatusInput = z.infer<typeof updateStoreStatusSchema>;
