import * as React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getAdminUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  StoreSettingsForm,
  type StoreSettingsData,
} from "@/components/admin/settings/store-settings-form";
import { ChangePasswordForm } from "@/components/admin/settings/change-password-form";

export const metadata: Metadata = {
  title: "Pengaturan Toko · Dashboard Rumah Makan Sipil",
};

const defaultSettings: StoreSettingsData = {
  store_name: "Rumah Makan Sipil",
  tagline: "Spesialis Masakan Rumahan & Ikan Bakar Khas Manado",
  whatsapp_number: "62895806567230",
  dos_price: 2000,
  qris_image_path: null,
  is_open: true,
};

async function SettingsLoader() {
  await connection();
  const admin = await getAdminUser();
  if (!admin) {
    redirect("/admin/login");
  }

  const supabase = await createServerSupabaseClient();
  const { data: settings } = await supabase
    .from("settings")
    .select(
      "store_name, tagline, whatsapp_number, dos_price, qris_image_path, is_open"
    )
    .eq("id", 1)
    .single();

  return (
    <>
      <StoreSettingsForm initialSettings={settings ?? defaultSettings} />
      <ChangePasswordForm />
    </>
  );
}

function SettingsLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-pulse" aria-busy="true">
      {/* Skeleton Kartu 1: Profil & Pengaturan Toko */}
      <div className="rounded-xl border border-line bg-card p-4 sm:p-6 shadow-xs flex flex-col gap-5">
        <div className="border-b border-line pb-4 flex items-center gap-3">
          <div className="size-10 rounded-lg bg-cream-200" />
          <div className="space-y-1.5">
            <div className="h-5 w-48 rounded bg-cream-200" />
            <div className="h-3 w-72 rounded bg-cream-100" />
          </div>
        </div>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="h-4 w-28 rounded bg-cream-200" />
            <div className="h-12 w-full rounded-md bg-cream-100" />
          </div>
          <div className="space-y-1.5">
            <div className="h-4 w-32 rounded bg-cream-200" />
            <div className="h-12 w-full rounded-md bg-cream-100" />
          </div>
          <div className="space-y-1.5">
            <div className="h-4 w-36 rounded bg-cream-200" />
            <div className="h-12 w-full rounded-md bg-cream-100" />
          </div>
          <div className="space-y-1.5">
            <div className="h-4 w-40 rounded bg-cream-200" />
            <div className="h-12 w-full rounded-md bg-cream-100" />
          </div>
          <div className="h-44 w-full max-w-sm mx-auto rounded-lg bg-cream-100" />
        </div>
        <div className="flex justify-end pt-3 border-t border-line">
          <div className="h-11 w-44 rounded-md bg-cream-200" />
        </div>
      </div>

      {/* Skeleton Kartu 2: Keamanan Akun */}
      <div className="rounded-xl border border-line bg-card p-4 sm:p-6 shadow-xs flex flex-col gap-5">
        <div className="border-b border-line pb-4 flex items-center gap-3">
          <div className="size-10 rounded-lg bg-cream-200" />
          <div className="space-y-1.5">
            <div className="h-5 w-36 rounded bg-cream-200" />
            <div className="h-3 w-64 rounded bg-cream-100" />
          </div>
        </div>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="h-4 w-28 rounded bg-cream-200" />
            <div className="h-12 w-full rounded-md bg-cream-100" />
          </div>
          <div className="space-y-1.5">
            <div className="h-4 w-44 rounded bg-cream-200" />
            <div className="h-12 w-full rounded-md bg-cream-100" />
          </div>
        </div>
        <div className="flex justify-end pt-3 border-t border-line">
          <div className="h-11 w-36 rounded-md bg-cream-200" />
        </div>
      </div>
    </div>
  );
}

export default function AdminSettingsPage() {
  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="border-b border-line pb-4">
        <h1 className="font-display text-2xl font-bold text-green-900">
          Pengaturan Toko
        </h1>
        <p className="text-sm text-ink-600">
          Kelola profil warung, kontak WhatsApp, gambar QRIS pembayaran, dan keamanan akun.
        </p>
      </div>

      <React.Suspense fallback={<SettingsLoadingSkeleton />}>
        <SettingsLoader />
      </React.Suspense>
    </div>
  );
}
