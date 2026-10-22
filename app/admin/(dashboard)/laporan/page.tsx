import * as React from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getReportDateRange,
  getSalesReport,
  reportQuerySchema,
  type ReportQuery,
  type SalesReportResult,
} from "@/lib/admin-reports";
import { ReportPeriodSelector } from "@/components/admin/reports/report-period-selector";
import { ReportMetricCards } from "@/components/admin/reports/report-metric-cards";
import { ReportPaymentMethods } from "@/components/admin/reports/report-payment-methods";
import { ReportTopItems } from "@/components/admin/reports/report-top-items";
import { ReportErrorState } from "@/components/admin/reports/report-error-state";

export const metadata: Metadata = {
  title: "Laporan Penjualan · Dashboard Rumah Makan Sipil",
};

interface AdminReportsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const MONTHS_ID = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

function formatDisplayDate(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const monthName = MONTHS_ID[monthIdx] ?? parts[1];
  return `${day} ${monthName} ${year}`;
}

export async function ReportsDataLoader({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();

  const admin = await getAdminUser();
  if (!admin) {
    redirect("/admin/login");
  }

  const rawParams = await searchParams;

  const cleanParams: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(rawParams || {})) {
    const singleVal = Array.isArray(val) ? val[0] : val;
    if (singleVal !== undefined && singleVal !== "") {
      cleanParams[key] = singleVal;
    }
  }

  let query: ReportQuery;
  try {
    query = reportQuerySchema.parse(cleanParams);
  } catch {
    query = {
      preset: "today",
      limit: 5,
    };
  }

  const preset = query.preset ?? "today";
  const { from, to } = getReportDateRange(
    preset,
    query.from,
    query.to
  );
  const dateSubtitle =
    from === to
      ? `WITA: ${formatDisplayDate(from)}`
      : `WITA: ${formatDisplayDate(from)} s.d. ${formatDisplayDate(to)}`;

  const supabase = await createServerSupabaseClient();
  let reportData: SalesReportResult | null = null;
  let isError = false;

  try {
    reportData = await getSalesReport(supabase, query);
  } catch (err) {
    console.error("Gagal memuat laporan penjualan di Server Component:", err);
    isError = true;
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      {/* Header Halaman */}
      <div className="border-b border-line pb-4">
        <h1 className="font-display text-2xl font-bold text-green-900">
          Laporan Penjualan
        </h1>
        <p className="mt-1 text-sm text-ink-600">{dateSubtitle}</p>
      </div>

      {/* Pilihan Periode (Preset Hari Ini, Bulan Ini, Kustom) */}
      <ReportPeriodSelector
        currentPreset={preset}
        currentFrom={from}
        currentTo={to}
      />

      {isError || !reportData ? (
        /* State Error Eksplisit dengan pesan generik aman tanpa membocorkan error basis data mentah */
        <ReportErrorState message="Terjadi kendala teknis saat memuat laporan. Silakan coba lagi." />
      ) : (
        <>
          {/* Kartu Metrik Utama */}
          <ReportMetricCards summary={reportData.summary} />

          {/* Grid Komposisi Pembayaran dan Menu Terlaris */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ReportPaymentMethods summary={reportData.summary} />
            <ReportTopItems topItems={reportData.topItems} />
          </div>
        </>
      )}
    </div>
  );
}

function ReportsLoadingSkeleton() {
  return (
    <div
      className="flex flex-col gap-6 max-w-5xl animate-pulse"
      aria-busy="true"
      aria-label="Memuat laporan penjualan..."
    >
      {/* Header skeleton */}
      <div className="border-b border-line pb-4">
        <div className="h-8 w-56 rounded-md bg-cream-200" />
        <div className="h-4 w-64 rounded bg-cream-100 mt-2" />
      </div>

      {/* Period selector skeleton */}
      <div className="flex flex-wrap gap-2">
        <div className="h-11 w-24 rounded-lg bg-cream-100" />
        <div className="h-11 w-24 rounded-lg bg-cream-100" />
        <div className="h-11 w-24 rounded-lg bg-cream-100" />
      </div>

      {/* Metric cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-28 rounded-xl border border-line bg-card p-4"
          />
        ))}
      </div>

      {/* Grid 2 kolom skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-64 rounded-xl border border-line bg-card p-5" />
        <div className="h-64 rounded-xl border border-line bg-card p-5" />
      </div>
    </div>
  );
}

export default function AdminReportsPage({
  searchParams,
}: AdminReportsPageProps) {
  return (
    <React.Suspense fallback={<ReportsLoadingSkeleton />}>
      <ReportsDataLoader searchParams={searchParams} />
    </React.Suspense>
  );
}
