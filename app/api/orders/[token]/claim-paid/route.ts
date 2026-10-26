import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const cleanToken = token?.trim();

  if (!cleanToken) {
    return NextResponse.json({ error: "Token pesanan tidak valid." }, { status: 400 });
  }

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.rpc("claim_paid", { token: cleanToken });

    if (error || !data) {
      return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan pada server.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
