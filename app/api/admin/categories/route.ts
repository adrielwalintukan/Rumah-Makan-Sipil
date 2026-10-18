import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAdminUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { categorySchema, reorderSchema } from "@/lib/admin-menu-schemas";

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
    let query = supabase
      .from("categories")
      .select("*")
      .order("sort_order", { ascending: true });

    if (query && typeof query.order === "function") {
      query = query.order("name", { ascending: true });
    }

    const { data, error } = await query;

    if (error) {
      if (error.code === "42501") {
        return NextResponse.json(
          { error: "Akun ini tidak memiliki hak akses pemilik." },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data ?? [] }, { status: 200 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Terjadi kesalahan pada server.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
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

  const parseResult = categorySchema.safeParse(body);
  if (!parseResult.success) {
    const errorMsg =
      parseResult.error.issues[0]?.message ?? "Data kategori tidak valid.";
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("categories")
      .insert({
        name: parseResult.data.name,
        sort_order: parseResult.data.sort_order,
      })
      .select()
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
    revalidatePath("/admin/menu");

    return NextResponse.json({ data }, { status: 201 });
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

  const parseResult = reorderSchema.safeParse(body);
  if (!parseResult.success) {
    const errorMsg =
      parseResult.error.issues[0]?.message ?? "Data urutan tidak valid.";
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.rpc("reorder_categories", {
      p_items: parseResult.data.items,
    });

    if (error) {
      if (error.code === "42501") {
        return NextResponse.json(
          { error: "Akun ini tidak memiliki hak akses pemilik." },
          { status: 403 }
        );
      }
      if (error.code === "P0002") {
        return NextResponse.json(
          { error: "Kategori tidak ditemukan." },
          { status: 404 }
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
