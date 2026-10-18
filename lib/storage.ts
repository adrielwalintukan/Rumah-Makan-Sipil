export const MENU_PHOTOS_BUCKET = "menu-photos";

/**
 * Menghasilkan URL publik untuk foto menu berdasarkan image_path dari database.
 * Mendukung path relatif Supabase Storage, URL absolut (http/https), atau path publik lokal.
 */
export function getMenuPhotoUrl(imagePath?: string | null): string | null {
  if (!imagePath || !imagePath.trim()) return null;
  const trimmed = imagePath.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("/")) {
    return trimmed;
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    const baseUrl = supabaseUrl.replace(/\/+$/, "");
    const cleanPath = trimmed.replace(/^\/+/, "");
    return `${baseUrl}/storage/v1/object/public/${MENU_PHOTOS_BUCKET}/${cleanPath}`;
  }
  return `/${MENU_PHOTOS_BUCKET}/${trimmed}`;
}

export interface SaveMenuItemParams {
  storage: {
    from: (bucket: string) => {
      upload: (
        path: string,
        file: Blob,
        options?: { contentType?: string; upsert?: boolean }
      ) => Promise<{ error: { message: string } | null }>;
      remove: (paths: string[]) => Promise<{ error: { message: string } | null }>;
    };
  };
  processedBlob: Blob | null;
  payload: Record<string, unknown>;
  endpoint: string;
  method: "POST" | "PATCH";
  fetcher?: typeof fetch;
}

/**
 * Menyimpan menu ke API sekaligus mengunggah foto baru jika ada.
 * Jika pengunggahan foto berhasil tetapi request penyimpanan menu gagal,
 * fungsi ini melakukan pembersihan best-effort terhadap file baru tersebut agar tidak menjadi orphan.
 */
export async function saveMenuItemWithPhotoCleanup({
  storage,
  processedBlob,
  payload,
  endpoint,
  method,
  fetcher = fetch,
}: SaveMenuItemParams): Promise<{ success: boolean; error?: string }> {
  let uploadedNewPath: string | null = null;

  try {
    let finalImagePath: string | null =
      (payload.image_path as string | null) ?? null;

    if (processedBlob) {
      const fileName = "items/" + crypto.randomUUID() + ".webp";
      const { error: uploadError } = await storage
        .from(MENU_PHOTOS_BUCKET)
        .upload(fileName, processedBlob, {
          contentType: "image/webp",
          upsert: true,
        });

      if (uploadError) {
        throw new Error("Gagal mengunggah foto: " + uploadError.message);
      }
      uploadedNewPath = fileName;
      finalImagePath = fileName;
    }

    const res = await fetcher(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, image_path: finalImagePath }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || "Gagal menyimpan menu.");
    }

    return { success: true };
  } catch (err) {
    if (uploadedNewPath) {
      try {
        const { error: cleanupError } = await storage
          .from(MENU_PHOTOS_BUCKET)
          .remove([uploadedNewPath]);
        if (cleanupError) {
          console.error(
            "Gagal membersihkan foto baru dari storage:",
            cleanupError
          );
        }
      } catch (cleanupException) {
        console.error(
          "Gagal membersihkan foto baru dari storage:",
          cleanupException
        );
      }
    }
    const msg =
      err instanceof Error
        ? err.message
        : "Terjadi kesalahan saat menyimpan menu.";
    return { success: false, error: msg };
  }
}
