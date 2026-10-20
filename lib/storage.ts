export const MENU_PHOTOS_BUCKET = "menu-photos";
export const STORE_BUCKET = "store";

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

/**
 * Menghasilkan URL publik untuk foto QRIS toko berdasarkan image_path dari database/pengaturan.
 * Mendukung path relatif Supabase Storage, URL absolut (http/https), atau path publik lokal.
 */
export function getQrisImageUrl(imagePath?: string | null): string | null {
  if (!imagePath || !imagePath.trim()) return null;
  const trimmed = imagePath.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("/")) {
    return trimmed;
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    const baseUrl = supabaseUrl.replace(/\/+$/, "");
    const cleanPath = trimmed.replace(/^\/+/, "");
    return `${baseUrl}/storage/v1/object/public/${STORE_BUCKET}/${cleanPath}`;
  }
  return `/${STORE_BUCKET}/${trimmed}`;
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
  isReferenced?: (path: string) => Promise<boolean>;
}

export interface SaveStoreSettingsParams {
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
  compressedBlob: Blob | null;
  payload: Record<string, unknown>;
  endpoint?: string;
  fetcher?: typeof fetch;
  isReferenced?: (path: string) => Promise<boolean>;
}

export interface SaveStoreSettingsResult {
  success: boolean;
  error?: string;
  uploadedPath?: string | null;
}

async function executeCleanup(
  storage: SaveMenuItemParams["storage"],
  bucket: string,
  path: string
) {
  try {
    const { error: cleanupError } = await storage
      .from(bucket)
      .remove([path]);
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

/**
 * Menyimpan menu ke API sekaligus mengunggah foto baru jika ada.
 * Jika pengunggahan foto berhasil tetapi request penyimpanan menu gagal dengan respons error (HTTP 4xx/5xx),
 * fungsi ini melakukan pembersihan best-effort terhadap file baru tersebut agar tidak menjadi orphan.
 * Pada kegagalan jaringan (network error) yang bersifat ambigu, file hanya dibersihkan jika dipastikan
 * belum direferensikan oleh menu di database, mencegah terhapusnya foto yang sebenarnya sudah tersimpan.
 */
export async function saveMenuItemWithPhotoCleanup({
  storage,
  processedBlob,
  payload,
  endpoint,
  method,
  fetcher = fetch,
  isReferenced,
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

    let res: Response;
    try {
      res = await fetcher(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, image_path: finalImagePath }),
      });
    } catch (networkError) {
      // Ambiguitas network error: request mungkin sudah di-commit oleh server,
      // namun respons hilang/terputus sebelum sampai ke klien.
      // Hanya bersihkan jika dipastikan foto BELUM direferensikan oleh menu apapun di database.
      if (uploadedNewPath) {
        let shouldCleanup = false;
        if (isReferenced) {
          try {
            const referenced = await isReferenced(uploadedNewPath);
            if (!referenced) {
              shouldCleanup = true;
            }
          } catch (refCheckErr) {
            console.error(
              "Gagal memeriksa referensi foto setelah network error:",
              refCheckErr
            );
            shouldCleanup = false;
          }
        }
        if (shouldCleanup) {
          await executeCleanup(storage, MENU_PHOTOS_BUCKET, uploadedNewPath);
        }
      }

      const msg =
        networkError instanceof Error
          ? networkError.message
          : "Terjadi kesalahan saat menyimpan menu.";
      return { success: false, error: msg };
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Server merespons dengan HTTP error (4xx/5xx): mutasi tidak berhasil di database
      if (uploadedNewPath) {
        let shouldCleanup = true;
        if (isReferenced) {
          try {
            const referenced = await isReferenced(uploadedNewPath);
            if (referenced) {
              shouldCleanup = false;
            }
          } catch (refCheckErr) {
            console.error("Gagal memeriksa referensi foto:", refCheckErr);
          }
        }
        if (shouldCleanup) {
          await executeCleanup(storage, MENU_PHOTOS_BUCKET, uploadedNewPath);
        }
      }
      throw new Error(data.error || "Gagal menyimpan menu.");
    }

    return { success: true };
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : "Terjadi kesalahan saat menyimpan menu.";
    return { success: false, error: msg };
  }
}

/**
 * Menyimpan pengaturan toko ke API (/api/admin/settings) sekaligus mengunggah gambar QRIS baru jika ada.
 * Jika pengunggahan QRIS berhasil tetapi request penyimpanan pengaturan gagal dengan respons error (HTTP 4xx/5xx),
 * fungsi ini melakukan pembersihan best-effort terhadap file baru tersebut agar tidak menjadi orphan.
 * Pada kegagalan jaringan (network error) yang bersifat ambigu, file hanya dibersihkan jika dipastikan
 * belum direferensikan oleh database (settings.qris_image_path), mencegah terhapusnya QRIS yang sebenarnya
 * sudah tersimpan di server.
 */
export async function saveStoreSettingsWithQrisCleanup({
  storage,
  compressedBlob,
  payload,
  endpoint = "/api/admin/settings",
  fetcher = fetch,
  isReferenced,
}: SaveStoreSettingsParams): Promise<SaveStoreSettingsResult> {
  let uploadedNewPath: string | null = null;

  try {
    const patchBody: Record<string, unknown> = { ...payload };

    if (compressedBlob) {
      const fileName = "qris/" + crypto.randomUUID() + ".webp";
      const { error: uploadError } = await storage
        .from(STORE_BUCKET)
        .upload(fileName, compressedBlob, {
          contentType: "image/webp",
          upsert: true,
        });

      if (uploadError) {
        throw new Error(
          "Gagal mengunggah gambar QRIS ke penyimpanan: " + uploadError.message
        );
      }
      uploadedNewPath = fileName;
      patchBody.qris_image_path = fileName;
    }

    let res: Response;
    try {
      res = await fetcher(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchBody),
      });
    } catch (networkError) {
      // Ambiguitas network error: request mungkin sudah di-commit oleh server,
      // namun respons hilang/terputus sebelum sampai ke klien.
      // Hanya bersihkan jika dipastikan path baru BELUM direferensikan oleh settings di database.
      if (uploadedNewPath) {
        let shouldCleanup = false;
        if (isReferenced) {
          try {
            const referenced = await isReferenced(uploadedNewPath);
            if (!referenced) {
              shouldCleanup = true;
            }
          } catch (refCheckErr) {
            console.error(
              "Gagal memeriksa referensi QRIS setelah network error:",
              refCheckErr
            );
            shouldCleanup = false;
          }
        }
        if (shouldCleanup) {
          await executeCleanup(storage, STORE_BUCKET, uploadedNewPath);
        }
      }

      const msg =
        networkError instanceof Error
          ? networkError.message
          : "Terjadi kesalahan jaringan saat menyimpan pengaturan.";
      return { success: false, error: msg };
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Server merespons dengan HTTP error (4xx/5xx): mutasi tidak berhasil di database
      if (uploadedNewPath) {
        let shouldCleanup = true;
        if (isReferenced) {
          try {
            const referenced = await isReferenced(uploadedNewPath);
            if (referenced) {
              shouldCleanup = false;
            }
          } catch (refCheckErr) {
            console.error("Gagal memeriksa referensi QRIS:", refCheckErr);
          }
        }
        if (shouldCleanup) {
          await executeCleanup(storage, STORE_BUCKET, uploadedNewPath);
        }
      }
      throw new Error(data.error || "Gagal menyimpan pengaturan toko.");
    }

    return { success: true, uploadedPath: uploadedNewPath };
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : "Terjadi kesalahan saat menyimpan pengaturan.";
    return { success: false, error: msg };
  }
}
