import * as React from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getOrderHistory,
  orderHistoryQuerySchema,
  type OrderHistoryQuery,
} from "@/lib/admin-orders";
import { HistoryFilterBar } from "@/components/admin/history/history-filter-bar";
import { HistorySummaryCards } from "@/components/admin/history/history-summary-cards";
import { HistoryOrderList } from "@/components/admin/history/history-order-list";
import { HistoryPagination } from "@/components/admin/history/history-pagination";

export const metadata: Metadata = {
  title: "Riwayat Pesanan · Dashboard Rumah Makan Sipil",
};

interface AdminHistoryPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function HistoryDataLoader({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();

  const admin = await getAdminUser();
  if (!admin) {
    redirect("/admin/login");
  }

  // Pada Next.js App Router terbaru, searchParams wajib di-await
  const rawParams = await searchParams;

  // Bersihkan parameter string kosong dan ambil item pertama jika berbentuk array
  const cleanParams: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(rawParams || {})) {
    const singleVal = Array.isArray(val) ? val[0] : val;
    if (singleVal !== undefined && singleVal !== "") {
      cleanParams[key] = singleVal;
    }
  }

  let query: OrderHistoryQuery;
  try {
    query = orderHistoryQuerySchema.parse(cleanParams);
  } catch {
    query = {
      preset: "today",
      status: "all",
      page: 1,
      limit: 50,
    };
  }

  const supabase = await createServerSupabaseClient();
  const result = await getOrderHistory(supabase, query);

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Header Halaman */}
      <div className="border-b border-line pb-4">
        <h1 className="font-display text-2xl font-bold text-green-900">
          Riwayat Pesanan
        </h1>
        <p className="mt-1 text-sm text-ink-600">
          Arsip lengkap pesanan warung berdasarkan filter tanggal WITA.
        </p>
      </div>

      {/* Baris Filter (Preset Tanggal, Status, Pencarian Cepat, Tanggal Kustom) */}
      <HistoryFilterBar currentParams={query} />

      {/* Ringkasan Metrik (Total Pesanan & Omzet Lunas) */}
      <HistorySummaryCards summary={result.summary} />

      {/* Daftar Pesanan Interaktif (Membuka OrderDetailSheet saat diklik) */}
      <HistoryOrderList orders={result.orders} />

      {/* Kontrol Paginasi Data */}
      <HistoryPagination
        page={result.page}
        totalPages={result.totalPages}
        totalCount={result.totalCount}
        limit={query.limit ?? 50}
      />
    </div>
  );
}

function HistoryLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6 pb-12 animate-pulse">
      <div className="border-b border-line pb-4">
        <div className="h-8 w-48 rounded-md bg-cream-200" />
        <div className="h-4 w-80 rounded bg-cream-100 mt-2" />
      </div>

      {/* Preset filter skeleton */}
      <div className="h-28 rounded-xl border border-line bg-card p-4" />

      {/* Summary cards skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="h-24 rounded-xl border border-line bg-card p-4" />
        <div className="h-24 rounded-xl border border-line bg-card p-4" />
      </div>

      {/* Orders list skeleton */}
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-28 rounded-xl border border-line bg-card p-4"
          />
        ))}
      </div>
    </div>
  );
}

export default function AdminHistoryPage({
  searchParams,
}: AdminHistoryPageProps) {
  return (
    <React.Suspense fallback={<HistoryLoadingSkeleton />}>
      <HistoryDataLoader searchParams={searchParams} />
    </React.Suspense>
  );
}
