import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { reportQuerySchema, getSalesReport } from "@/lib/admin-reports";

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

    const parsed = reportQuerySchema.safeParse(rawParams);
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

    const supabase = await createServerSupabaseClient();
    const report = await getSalesReport(supabase, parsed.data);

    return NextResponse.json(report, { status: 200 });
  } catch (error) {
    console.error("Gagal memproses laporan penjualan:", error);
    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Gagal memproses laporan penjualan.",
      },
      { status: 500 }
    );
  }
}
