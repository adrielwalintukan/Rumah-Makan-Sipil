import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getAdminUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  financeQuerySchema,
  getFinanceDateRange,
  getFinanceData,
  getWitaTodayDateString,
  type FinanceQuery,
} from "@/lib/admin-finance";
import { FinanceDashboardClient } from "@/components/admin/finance/finance-dashboard-client";

export const metadata: Metadata = {
  title: "Catatan Keuangan · Dashboard Rumah Makan Sipil",
  description: "Buku kas, pencatatan pengeluaran operasional, dan laba kotor warung makan.",
};

function FinanceLoadingSkeleton() {
  return (
    <div
      className="flex flex-col gap-6 animate-pulse"
      aria-busy="true"
      aria-label="Memuat catatan keuangan..."
    >
      <div className="h-28 rounded-xl bg-cream-100" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="h-32 rounded-xl bg-cream-100" />
        <div className="h-32 rounded-xl bg-cream-100" />
        <div className="h-32 rounded-xl bg-cream-100" />
      </div>
      <div className="h-64 rounded-xl bg-cream-100" />
      <div className="h-64 rounded-xl bg-cream-100" />
    </div>
  );
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function FinanceDataLoader({ searchParams }: PageProps) {
  await connection();

  const admin = await getAdminUser();
  if (!admin) {
    redirect("/admin/login");
  }

  const rawParams = await searchParams;
  const normalizedParams: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawParams || {})) {
    const singleVal = Array.isArray(value) ? value[0] : value;
    if (typeof singleVal === "string" && singleVal.trim() !== "") {
      normalizedParams[key] = singleVal;
    }
  }

  const parsed = financeQuerySchema.safeParse(normalizedParams);
  const validatedQuery: FinanceQuery = parsed.success
    ? parsed.data
    : { preset: "today" };

  const todayStr = getWitaTodayDateString();
  const { from, to } = getFinanceDateRange(
    validatedQuery.preset,
    validatedQuery.from,
    validatedQuery.to
  );

  const supabase = await createServerSupabaseClient();
  const financeData = await getFinanceData(supabase, validatedQuery);

  return (
    <FinanceDashboardClient
      initialData={financeData}
      preset={validatedQuery.preset}
      from={from}
      to={to}
      todayStr={todayStr}
    />
  );
}

export default function AdminFinancePage({ searchParams }: PageProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* Header Halaman */}
      <div className="border-b border-line pb-4">
        <h1 className="font-display text-2xl font-bold text-green-900">
          Catatan Keuangan
        </h1>
        <p className="text-sm text-ink-600">
          Pemasukan omzet pesanan, pengeluaran operasional warung, dan estimasi laba kotor.
        </p>
      </div>

      <Suspense fallback={<FinanceLoadingSkeleton />}>
        <FinanceDataLoader searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
