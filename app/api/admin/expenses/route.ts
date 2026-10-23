import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  expensePayloadSchema,
  expensesQuerySchema,
  getFinanceDateRange,
} from "@/lib/admin-finance";

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

    const parsed = expensesQuerySchema.safeParse(rawParams);
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
    let query = supabase
      .from("expenses")
      .select("*")
      .gte("expense_date", from)
      .lte("expense_date", to)
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (parsed.data.category) {
      query = query.eq("category", parsed.data.category);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Gagal mengambil daftar pengeluaran:", error);
      return NextResponse.json(
        {
          error: "INTERNAL_SERVER_ERROR",
          message: "Gagal mengambil daftar pengeluaran.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ expenses: data || [] }, { status: 200 });
  } catch (error) {
    console.error("Gagal memproses daftar pengeluaran:", error);
    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Gagal memproses data pengeluaran.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
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

    const json = await request.json().catch(() => null);
    const parsed = expensePayloadSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "BAD_REQUEST",
          message: "Data pengeluaran tidak valid.",
          details: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        expense_date: parsed.data.expense_date,
        description: parsed.data.description,
        amount: parsed.data.amount,
        category: parsed.data.category,
      })
      .select()
      .single();

    if (error) {
      console.error("Gagal menambahkan pengeluaran ke basis data:", error);
      return NextResponse.json(
        {
          error: "INTERNAL_SERVER_ERROR",
          message: "Gagal menambahkan catatan pengeluaran.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ expense: data }, { status: 201 });
  } catch (error) {
    console.error("Gagal memproses tambah pengeluaran:", error);
    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Gagal memproses penambahan pengeluaran.",
      },
      { status: 500 }
    );
  }
}
