import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAdminUser } from "@/lib/auth";
import { STORE_BUCKET } from "@/lib/storage";
import {
  updateStoreStatusSchema,
  updateStoreSettingsSchema,
} from "@/lib/admin-settings";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json(
      { error: "Akses ditolak. Sesi pemilik diperlukan." },
      { status: 401 }
    );
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("settings")
      .select(
        "store_name, tagline, whatsapp_number, dos_price, qris_image_path, is_open"
      )
      .eq("id", 1)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Terjadi kesalahan pada server.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json(
      { error: "Akses ditolak. Sesi pemilik diperlukan." },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Format request body tidak valid." },
      { status: 400 }
    );
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Format request body tidak valid." },
      { status: 400 }
    );
  }

  const rawBody = body as Record<string, unknown>;
  const hasOtherSettingsFields =
    "store_name" in rawBody ||
    "whatsapp_number" in rawBody ||
    "dos_price" in rawBody ||
    "tagline" in rawBody ||
    "qris_image_path" in rawBody;

  const isStatusToggle = "is_open" in rawBody && !hasOtherSettingsFields;

  if (isStatusToggle) {
    const parseResult = updateStoreStatusSchema.safeParse(rawBody);
    if (!parseResult.success) {
      const errorMsg =
        parseResult.error.issues[0]?.message ??
        "Status buka/tutup toko tidak valid.";
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    try {
      const supabase = await createServerSupabaseClient();
      const { data, error } = await supabase
        .from("settings")
        .update({ is_open: parseResult.data.is_open })
        .eq("id", 1)
        .select("is_open")
        .single();

      if (error) {
        if (error.code === "42501") {
          return NextResponse.json(
            { error: "Akun ini tidak memiliki hak akses pemilik." },
            { status: 403 }
          );
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      revalidatePath("/");
      revalidatePath("/admin");
      revalidatePath("/admin/pengaturan");

      return NextResponse.json({ is_open: data.is_open }, { status: 200 });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Terjadi kesalahan pada server.";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const parseResult = updateStoreSettingsSchema.safeParse(rawBody);
  if (!parseResult.success) {
    const errorMsg =
      parseResult.error.issues[0]?.message ?? "Data pengaturan tidak valid.";
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }

  const parsedData = parseResult.data;

  try {
    const supabase = await createServerSupabaseClient();

    // Ambil qris_image_path saat ini dari database untuk pembersihan file lama secara defensif
    const { data: currentSettings, error: fetchErr } = await supabase
      .from("settings")
      .select("qris_image_path")
      .eq("id", 1)
      .single();

    if (fetchErr) {
      if (fetchErr.code === "42501") {
        return NextResponse.json(
          { error: "Akun ini tidak memiliki hak akses pemilik." },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    const oldQrisPath = currentSettings?.qris_image_path ?? null;

    const updatePayload: Record<string, unknown> = {
      store_name: parsedData.store_name,
      whatsapp_number: parsedData.whatsapp_number,
      dos_price: parsedData.dos_price,
    };
    if (parsedData.tagline !== undefined) {
      updatePayload.tagline = parsedData.tagline;
    }
    if (parsedData.qris_image_path !== undefined) {
      updatePayload.qris_image_path = parsedData.qris_image_path;
    }
    if (parsedData.is_open !== undefined) {
      updatePayload.is_open = parsedData.is_open;
    }

    const { data: updatedData, error: updateErr } = await supabase
      .from("settings")
      .update(updatePayload)
      .eq("id", 1)
      .select(
        "store_name, tagline, whatsapp_number, dos_price, qris_image_path, is_open"
      )
      .single();

    if (updateErr) {
      if (updateErr.code === "42501") {
        return NextResponse.json(
          { error: "Akun ini tidak memiliki hak akses pemilik." },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Pembersihan foto QRIS lama secara defensif jika field qris_image_path disertakan
    if (parsedData.qris_image_path !== undefined) {
      const newQrisPath = parsedData.qris_image_path;
      if (oldQrisPath && oldQrisPath !== newQrisPath) {
        try {
          const { error: storageErr } = await supabase.storage
            .from(STORE_BUCKET)
            .remove([oldQrisPath]);
          if (storageErr) {
            console.error(
              "Gagal membersihkan foto QRIS lama dari storage:",
              storageErr
            );
          }
        } catch (storageException) {
          console.error(
            "Gagal membersihkan foto QRIS lama dari storage:",
            storageException
          );
        }
      }
    }

    revalidatePath("/");
    revalidatePath("/admin");
    revalidatePath("/admin/pengaturan");

    return NextResponse.json(updatedData, { status: 200 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Terjadi kesalahan pada server.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
