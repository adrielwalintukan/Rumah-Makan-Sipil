import { NextResponse } from "next/server";
import { getClientIpHash } from "@/lib/ip";
import { checkoutPayloadSchema } from "@/lib/schemas";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Format permintaan harus berupa JSON yang valid." },
      { status: 400 },
    );
  }

  const parsed = checkoutPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validasi data pesanan gagal.",
        details: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
      },
      { status: 400 },
    );
  }

  const { device_id, ...orderData } = parsed.data;
  const ip_hash = getClientIpHash(req);

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.rpc("create_order", {
      payload: orderData,
      device_id,
      ip_hash,
    });

    if (error) {
      try {
        const parsedErr = JSON.parse(error.message);
        if (parsedErr.code === "STORE_CLOSED") {
          return NextResponse.json(
            { error: "Toko sedang tutup. Silakan coba lagi saat toko buka." },
            { status: 400 },
          );
        }
        if (parsedErr.code === "RATE_LIMITED") {
          return NextResponse.json(
            {
              error:
                "Terlalu banyak pesanan dalam waktu singkat. Silakan tunggu beberapa menit sebelum memesan kembali.",
            },
            { status: 429 },
          );
        }
        if (parsedErr.code === "ITEM_UNAVAILABLE") {
          return NextResponse.json(
            {
              error: "Beberapa menu atau opsi yang dipilih sedang habis.",
              unavailable_item_ids: parsedErr.item_ids || [],
            },
            { status: 400 },
          );
        }
        if (parsedErr.code === "INVALID_ITEM") {
          return NextResponse.json(
            { error: parsedErr.message || "Data pesanan tidak valid." },
            { status: 400 },
          );
        }
      } catch {
        // Abaikan jika bukan JSON string
      }

      return NextResponse.json(
        { error: error.message || "Gagal membuat pesanan." },
        { status: 400 },
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan pada server.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
