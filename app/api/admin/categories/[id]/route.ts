import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAdminUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { categorySchema } from "@/lib/admin-menu-schemas";
import { UUID_REGEX } from "@/lib/schemas";

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
      { error: "ID kategori tidak valid." },
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
  const hasName = "name" in rawBody;
  const hasSortOrder = "sort_order" in rawBody;

  if (!hasName && !hasSortOrder) {
    return NextResponse.json(
      { error: "Tidak ada data yang diperbarui." },
      { status: 400 }
    );
  }

  const parseResult = categorySchema.partial().safeParse(body);
  if (!parseResult.success) {
    const errorMsg =
      parseResult.error.issues[0]?.message ?? "Data kategori tidak valid.";
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }

  const updateData: { name?: string; sort_order?: number } = {};
  if (hasName && parseResult.data.name !== undefined) {
    updateData.name = parseResult.data.name;
  }
  if (hasSortOrder && parseResult.data.sort_order !== undefined) {
    updateData.sort_order = parseResult.data.sort_order;
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("categories")
      .update(updateData)
      .eq("id", id)
      .select()
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
        { error: "Kategori tidak ditemukan." },
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
      { error: "ID kategori tidak valid." },
      { status: 400 }
    );
  }

  try {
    const supabase = await createServerSupabaseClient();

    // Pastikan tidak ada menu yang terkait dengan kategori ini
    const { count, error: countError } = await supabase
      .from("menu_items")
      .select("id", { count: "exact", head: true })
      .eq("category_id", id);

    if (countError) {
      if (countError.code === "42501") {
        return NextResponse.json(
          { error: "Akun ini tidak memiliki hak akses pemilik." },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    if (count !== null && count > 0) {
      return NextResponse.json(
        { error: "Kategori tidak dapat dihapus karena masih memiliki menu terkait." },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", id);

    if (error) {
      if (error.code === "23503") {
        return NextResponse.json(
          { error: "Kategori tidak dapat dihapus karena masih memiliki menu terkait." },
          { status: 400 }
        );
      }
      if (error.code === "42501") {
        return NextResponse.json(
          { error: "Akun ini tidak memiliki hak akses pemilik." },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
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
