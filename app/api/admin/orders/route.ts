import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getLiveOrders } from "@/lib/admin-orders";

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServerSupabaseClient();
  const orders = await getLiveOrders(supabase);

  return NextResponse.json({ orders });
}
