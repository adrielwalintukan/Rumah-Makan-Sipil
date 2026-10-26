import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { financeQuerySchema, getFinanceDateRange } from "@/lib/admin-finance";

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const rawParams: Record<string, string> = {};
    searchParams.forEach((val, key) => {
      if (val.trim() !== "") {
        rawParams[key] = val;
      }
    });

    const parsed = financeQuerySchema.safeParse(rawParams);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "BAD_REQUEST",
          message: "Parameter query tidak valid.",
          details: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const { from, to } = getFinanceDateRange(
      parsed.data.preset,
      parsed.data.from,
      parsed.data.to
    );

    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc("cashbook", {
      p_from_date: from,
      p_to_date: to,
    });

    if (error) {
      console.error("Gagal menjalankan RPC cashbook:", error);
      return NextResponse.json(
        {
          error: "INTERNAL_SERVER_ERROR",
          message: "Gagal mengambil data buku kas.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("Gagal memproses buku kas:", error);
    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Gagal memproses data buku kas.",
      },
      { status: 500 }
    );
  }
}
