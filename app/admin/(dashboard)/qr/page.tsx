import * as React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getAdminUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getStoreCanonicalUrl, generateQrDataUrl } from "@/lib/qr";
import { QrPosterDashboard } from "@/components/admin/qr/qr-poster-dashboard";

export const metadata: Metadata = {
  title: "Poster QR · Dashboard Rumah Makan Sipil",
  description: "Pratinjau, cetak, dan unduh poster QR meja dan kasir Rumah Makan Sipil.",
};

export async function QrPosterLoader() {
  await connection();
  const admin = await getAdminUser();
  if (!admin) {
    redirect("/admin/login");
  }

  const supabase = await createServerSupabaseClient();
  const { data: settings } = await supabase
    .from("settings")
    .select("store_name, tagline")
    .eq("id", 1)
    .single();

  const storeName = settings?.store_name || "Rumah Makan Sipil";
  const tagline =
    settings?.tagline || "Spesialis Masakan Rumahan & Ikan Bakar Khas Manado";
  const siteUrl = getStoreCanonicalUrl();
  const qrDataUrl = await generateQrDataUrl(siteUrl, {
    errorCorrectionLevel: "M",
    width: 600,
  });

  return (
    <QrPosterDashboard
      initialStoreName={storeName}
      initialTagline={tagline}
      initialQrDataUrl={qrDataUrl}
      siteUrl={siteUrl}
    />
  );
}

export function QrPosterLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-pulse" aria-busy="true">
      {/* Skeleton Toolbar */}
      <div className="rounded-xl border border-line bg-card p-5 h-28" />

      {/* Skeleton Preview Area */}
      <div className="flex justify-center rounded-2xl border border-line bg-cream-100/40 p-8">
        <div className="w-full max-w-md aspect-[210/297] rounded-2xl bg-cream-100" />
      </div>
    </div>
  );
}

export default function AdminQrPosterPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header Halaman (Disembunyikan saat cetak) */}
      <div className="no-print border-b border-line pb-4">
        <h1 className="font-display text-2xl font-bold text-green-900">
          Poster QR Pemesanan
        </h1>
        <p className="text-sm text-ink-600 mt-0.5">
          Pratinjau poster siap cetak (A4/A5) untuk meja dan kasir, atau unduh
          gambar resolusi tinggi (300 DPI).
        </p>
      </div>

      <Suspense fallback={<QrPosterLoadingSkeleton />}>
        <QrPosterLoader />
      </Suspense>
    </div>
  );
}
