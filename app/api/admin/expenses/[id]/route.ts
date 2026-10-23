import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { expensePayloadSchema } from "@/lib/admin-finance";
import { UUID_REGEX } from "@/lib/schemas";

const uuidSchema = z.string().regex(UUID_REGEX, "ID pengeluaran tidak valid.");
const updatePayloadSchema = expensePayloadSchema.partial();

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json(
        {
          error: "UNAUTHORIZED",
          message: "Akses ditolak: sesi admin diperlukan.",
        },
        { status: 401 }
      );
    }

    const { id } = await props.params;
    const parsedId = uuidSchema.safeParse(id);
    if (!parsedId.success) {
      return NextResponse.json(
        { error: "BAD_REQUEST", message: "Format ID pengeluaran tidak valid." },
        { status: 400 }
      );
    }

    const json = await request.json().catch(() => null);
    const parsed = updatePayloadSchema.safeParse(json);
    if (!parsed.success || Object.keys(parsed.data).length === 0) {
      return NextResponse.json(
        {
          error: "BAD_REQUEST",
          message: "Perubahan data pengeluaran tidak valid.",
          details: parsed.error?.issues,
        },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("expenses")
      .update(parsed.data)
      .eq("id", parsedId.data)
      .select()
      .single();

    if (error || !data) {
      console.error("Gagal memperbarui catatan pengeluaran:", error);
      return NextResponse.json(
        {
          error: "NOT_FOUND",
          message: "Catatan pengeluaran tidak ditemukan atau gagal diperbarui.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ expense: data }, { status: 200 });
  } catch (error) {
    console.error("Gagal memproses perbaikan pengeluaran:", error);
    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Gagal memproses pembaruan pengeluaran.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json(
        {
          error: "UNAUTHORIZED",
          message: "Akses ditolak: sesi admin diperlukan.",
        },
        { status: 401 }
      );
    }

    const { id } = await props.params;
    const parsedId = uuidSchema.safeParse(id);
    if (!parsedId.success) {
      return NextResponse.json(
        { error: "BAD_REQUEST", message: "Format ID pengeluaran tidak valid." },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", parsedId.data);

    if (error) {
      console.error("Gagal menghapus catatan pengeluaran:", error);
      return NextResponse.json(
        {
          error: "INTERNAL_SERVER_ERROR",
          message: "Gagal menghapus catatan pengeluaran.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Gagal memproses penghapusan pengeluaran:", error);
    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Gagal memproses penghapusan pengeluaran.",
      },
      { status: 500 }
    );
  }
}
