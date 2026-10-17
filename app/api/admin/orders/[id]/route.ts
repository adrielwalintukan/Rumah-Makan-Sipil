import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth";
import { adminOrderActionSchema } from "@/lib/admin-orders";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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
  if (!id) {
    return NextResponse.json(
      { error: "ID pesanan tidak valid." },
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

  const parseResult = adminOrderActionSchema.safeParse(body);
  if (!parseResult.success) {
    const errorMsg =
      parseResult.error.issues[0]?.message ?? "Aksi pesanan tidak valid.";
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }

  const { action, cancel_reason } = parseResult.data;

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc("admin_update_order", {
      p_order_id: id,
      p_action: action,
      p_cancel_reason: cancel_reason ?? null,
    });

    if (error) {
      if (error.code === "P0002") {
        return NextResponse.json(
          { error: "Pesanan tidak ditemukan." },
          { status: 404 }
        );
      }
      if (error.code === "42501") {
        return NextResponse.json(
          { error: "Akun ini tidak memiliki hak akses pemilik." },
          { status: 403 }
        );
      }
      if (error.code === "22023") {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ order: data }, { status: 200 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Terjadi kesalahan pada server.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
