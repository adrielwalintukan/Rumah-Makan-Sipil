import * as React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  MenuItemForm,
  type MenuItemFormData,
} from "@/components/admin/menu/menu-item-form";
import { UUID_REGEX } from "@/lib/schemas";

export const metadata: Metadata = {
  title: "Ubah Menu · Dashboard Rumah Makan Sipil",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

async function EditMenuLoader({ params }: PageProps) {
  await connection();
  const { id } = await params;

  if (!id || !UUID_REGEX.test(id)) {
    notFound();
  }

  const supabase = await createServerSupabaseClient();

  const [{ data: menuItem, error: menuError }, { data: categories }] =
    await Promise.all([
      supabase
        .from("menu_items")
        .select(
          "id, category_id, name, description, price, image_path, is_available, sort_order"
        )
        .eq("id", id)
        .eq("is_active", true)
        .maybeSingle(),
      supabase
        .from("categories")
        .select("id, name")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
    ]);

  if (menuError || !menuItem) {
    notFound();
  }

  const initialData: MenuItemFormData = {
    id: menuItem.id,
    category_id: menuItem.category_id,
    name: menuItem.name,
    description: menuItem.description ?? "",
    price: menuItem.price,
    image_path: menuItem.image_path ?? null,
    is_available: menuItem.is_available,
    sort_order: menuItem.sort_order,
  };

  return (
    <div className="rounded-xl border border-line bg-card p-6 shadow-xs">
      <MenuItemForm
        initialData={initialData}
        categories={categories ?? []}
        mode="edit"
      />
    </div>
  );
}

function MenuFormSkeleton() {
  return (
    <div className="rounded-xl border border-line bg-card p-6 shadow-xs space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-4 w-20 rounded bg-cream-200" />
        <div className="h-12 w-full rounded-md bg-cream-100" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-28 rounded bg-cream-200" />
        <div className="h-12 w-full rounded-md bg-cream-100" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-28 rounded bg-cream-200" />
        <div className="h-12 w-full rounded-md bg-cream-100" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-32 rounded bg-cream-200" />
        <div className="h-24 w-full rounded-md bg-cream-100" />
      </div>
      <div className="h-16 w-full rounded-xl bg-cream-100" />
      <div className="flex justify-between gap-3 pt-6 border-t border-line">
        <div className="h-11 w-28 rounded-md bg-cream-200" />
        <div className="flex gap-3">
          <div className="h-11 w-20 rounded-md bg-cream-200" />
          <div className="h-11 w-32 rounded-md bg-cream-200" />
        </div>
      </div>
    </div>
  );
}

export default function AdminEditMenuPage({ params }: PageProps) {
  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full pb-12">
      {/* Breadcrumb / Navigasi Kembali */}
      <div className="flex items-center gap-2">
        <Link
          href="/admin/menu"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-600 hover:text-green-800 transition min-h-[44px] -ml-2 px-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700"
        >
          <ArrowLeft className="size-4" aria-hidden />
          <span>Kembali ke Kelola Menu</span>
        </Link>
      </div>

      {/* Header Halaman */}
      <div className="border-b border-line pb-4">
        <h1 className="font-display text-2xl font-bold text-green-900">
          Ubah Menu
        </h1>
        <p className="text-sm text-ink-600 mt-1">
          Perbarui informasi, harga, atau status ketersediaan menu.
        </p>
      </div>

      <React.Suspense fallback={<MenuFormSkeleton />}>
        <EditMenuLoader params={params} />
      </React.Suspense>
    </div>
  );
}
