import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAdminUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  menuItemSchema,
  quickToggleAvailabilitySchema,
} from "@/lib/admin-menu-schemas";
import { UUID_REGEX } from "@/lib/schemas";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json(
      { error: "Akses ditolak. Sesi pemilik diperlukan." },
      { status: 401 }
    );
  }

  const { id } = await params;
  if (!id || !UUID_REGEX.test(id)) {
    return NextResponse.json(
      { error: "ID menu tidak valid." },
      { status: 400 }
    );
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("menu_items")
      .select("*, category:categories(id, name)")
      .eq("id", id)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      if (error.code === "42501") {
        return NextResponse.json(
          { error: "Akun ini tidak memiliki hak akses pemilik." },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { error: "Menu tidak ditemukan." },
        { status: 404 }
      );
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Terjadi kesalahan pada server.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json(
      { error: "Akses ditolak. Sesi pemilik diperlukan." },
      { status: 401 }
    );
  }

  const { id } = await params;
  if (!id || !UUID_REGEX.test(id)) {
    return NextResponse.json(
      { error: "ID menu tidak valid." },
      { status: 400 }
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
  const keys = Object.keys(rawBody);

  let updateData: Record<string, unknown> = {};

  if (keys.length === 1 && "is_available" in rawBody) {
    const parseResult = quickToggleAvailabilitySchema.safeParse(rawBody);
    if (!parseResult.success) {
      const errorMsg =
        parseResult.error.issues[0]?.message ??
        "Data toggle ketersediaan tidak valid.";
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }
    updateData = { is_available: parseResult.data.is_available };
  } else {
    const allowedKeys = [
      "category_id",
      "name",
      "description",
      "price",
      "is_available",
      "sort_order",
    ];
    const hasAnyAllowedKey = allowedKeys.some((k) => k in rawBody);
    if (!hasAnyAllowedKey) {
      return NextResponse.json(
        { error: "Tidak ada data yang diperbarui." },
        { status: 400 }
      );
    }

    const parseResult = menuItemSchema.partial().safeParse(rawBody);
    if (!parseResult.success) {
      const errorMsg =
        parseResult.error.issues[0]?.message ?? "Data menu tidak valid.";
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    if ("category_id" in rawBody && parseResult.data.category_id !== undefined) {
      updateData.category_id = parseResult.data.category_id;
    }
    if ("name" in rawBody && parseResult.data.name !== undefined) {
      updateData.name = parseResult.data.name;
    }
    if (
      "description" in rawBody &&
      parseResult.data.description !== undefined
    ) {
      updateData.description = parseResult.data.description;
    }
    if ("price" in rawBody && parseResult.data.price !== undefined) {
      updateData.price = parseResult.data.price;
    }
    if (
      "is_available" in rawBody &&
      parseResult.data.is_available !== undefined
    ) {
      updateData.is_available = parseResult.data.is_available;
    }
    if ("sort_order" in rawBody && parseResult.data.sort_order !== undefined) {
      updateData.sort_order = parseResult.data.sort_order;
    }
  }

  try {
    const supabase = await createServerSupabaseClient();

    // Jika category_id diubah dan sort_order tidak ditentukan secara eksplisit di request,
    // tempatkan menu di akhir daftar kategori tujuan (max(sort_order) + 1)
    if (updateData.category_id && !("sort_order" in rawBody)) {
      const { data: currentItem, error: fetchErr } = await supabase
        .from("menu_items")
        .select("category_id")
        .eq("id", id)
        .eq("is_active", true)
        .maybeSingle();

      if (fetchErr) {
        if (fetchErr.code === "42501") {
          return NextResponse.json(
            { error: "Akun ini tidak memiliki hak akses pemilik." },
            { status: 403 }
          );
        }
        return NextResponse.json({ error: fetchErr.message }, { status: 500 });
      }

      if (!currentItem) {
        return NextResponse.json(
          { error: "Menu tidak ditemukan." },
          { status: 404 }
        );
      }

      if (updateData.category_id !== currentItem.category_id) {
        const { data: maxItem, error: maxErr } = await supabase
          .from("menu_items")
          .select("sort_order")
          .eq("category_id", updateData.category_id)
          .eq("is_active", true)
          .order("sort_order", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (maxErr) {
          if (maxErr.code === "42501") {
            return NextResponse.json(
              { error: "Akun ini tidak memiliki hak akses pemilik." },
              { status: 403 }
            );
          }
          return NextResponse.json({ error: maxErr.message }, { status: 500 });
        }

        updateData.sort_order =
          maxItem?.sort_order !== undefined ? maxItem.sort_order + 1 : 0;
      }
    }

    const { data, error } = await supabase
      .from("menu_items")
      .update(updateData)
      .eq("id", id)
      .eq("is_active", true)
      .select("*, category:categories(id, name)")
      .maybeSingle();

    if (error) {
      if (error.code === "42501") {
        return NextResponse.json(
          { error: "Akun ini tidak memiliki hak akses pemilik." },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { error: "Menu tidak ditemukan." },
        { status: 404 }
      );
    }

    revalidatePath("/");
    revalidatePath("/admin/menu");

    return NextResponse.json({ data }, { status: 200 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Terjadi kesalahan pada server.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json(
      { error: "Akses ditolak. Sesi pemilik diperlukan." },
      { status: 401 }
    );
  }

  const { id } = await params;
  if (!id || !UUID_REGEX.test(id)) {
    return NextResponse.json(
      { error: "ID menu tidak valid." },
      { status: 400 }
    );
  }

  try {
    const supabase = await createServerSupabaseClient();
    // HAPUS LUNAK: update is_active = false agar riwayat pesanan (order_items) tetap utuh
    const { data, error } = await supabase
      .from("menu_items")
      .update({ is_active: false })
      .eq("id", id)
      .eq("is_active", true)
      .select("id")
      .maybeSingle();

    if (error) {
      if (error.code === "42501") {
        return NextResponse.json(
          { error: "Akun ini tidak memiliki hak akses pemilik." },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { error: "Menu tidak ditemukan." },
        { status: 404 }
      );
    }

    revalidatePath("/");
    revalidatePath("/admin/menu");

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Terjadi kesalahan pada server.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
