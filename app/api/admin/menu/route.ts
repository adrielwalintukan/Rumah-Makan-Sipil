import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAdminUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { menuItemSchema, reorderSchema } from "@/lib/admin-menu-schemas";
import { UUID_REGEX } from "@/lib/schemas";

export async function GET(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json(
      { error: "Akses ditolak. Sesi pemilik diperlukan." },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("category_id");

    const supabase = await createServerSupabaseClient();
    let query = supabase
      .from("menu_items")
      .select("*, category:categories(id, name)")
      .eq("is_active", true);

    if (categoryId) {
      if (!UUID_REGEX.test(categoryId)) {
        return NextResponse.json(
          { error: "ID kategori tidak valid." },
          { status: 400 }
        );
      }
      query = query.eq("category_id", categoryId);
    }

    query = query.order("sort_order", { ascending: true });
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

  const parseResult = menuItemSchema.safeParse(body);
  if (!parseResult.success) {
    const errorMsg =
      parseResult.error.issues[0]?.message ?? "Data menu tidak valid.";
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }

  try {
    const supabase = await createServerSupabaseClient();

    let sortOrder = parseResult.data.sort_order;
    if (sortOrder === undefined) {
      // shortcut: penentuan max(sort_order) + 1 di server memadai untuk 1 akun pemilik (v1).
      // Upgrade ke RPC/transaksi database jika warung mendukung multi-admin konkuren di masa depan.
      const { data: maxItem, error: maxErr } = await supabase
        .from("menu_items")
        .select("sort_order")
        .eq("category_id", parseResult.data.category_id)
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

      sortOrder = maxItem?.sort_order !== undefined ? maxItem.sort_order + 1 : 0;
    }

    const { data, error } = await supabase
      .from("menu_items")
      .insert({
        category_id: parseResult.data.category_id,
        name: parseResult.data.name,
        description: parseResult.data.description,
        price: parseResult.data.price,
        image_path: parseResult.data.image_path ?? null,
        is_available: parseResult.data.is_available,
        sort_order: sortOrder,
        is_active: true,
      })
      .select("*, category:categories(id, name)")
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
    const { error } = await supabase.rpc("reorder_menu_items", {
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
          { error: "Menu tidak ditemukan atau tidak aktif." },
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
