import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { orderHistoryQuerySchema, getOrderHistory } from "@/lib/admin-orders";

export async function GET(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawParams: Record<string, string> = {};
  searchParams.forEach((val, key) => {
    if (val.trim() !== "") {
      rawParams[key] = val;
    }
  });

  const parsed = orderHistoryQuerySchema.safeParse(rawParams);
  if (!parsed.success) {
    const errorMsg =
      parsed.error.issues[0]?.message || "Parameter query tidak valid.";
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }

  try {
    const supabase = await createServerSupabaseClient();
    const result = await getOrderHistory(supabase, parsed.data);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Gagal mengambil riwayat pesanan:", error);
    return NextResponse.json(
      { error: "Gagal mengambil riwayat pesanan." },
      { status: 500 }
    );
  }
}
