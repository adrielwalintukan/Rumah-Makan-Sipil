import * as React from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  MenuManagementView,
  type AdminCategoryItem,
  type AdminMenuItem,
} from "@/components/admin/menu/menu-management-view";

export const metadata: Metadata = {
  title: "Kelola Menu · Dashboard Rumah Makan Sipil",
};

async function MenuManagementLoader() {
  await connection();
  const supabase = await createServerSupabaseClient();

  const [{ data: categories }, { data: menuItems }] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, sort_order")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("menu_items")
      .select(
        "id, category_id, name, description, price, image_path, is_available, is_featured, is_active, sort_order, category:categories(id, name)"
      )
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  const initialCategories: AdminCategoryItem[] = (categories ?? []).map(
    (cat) => ({
      id: cat.id,
      name: cat.name,
      sort_order: cat.sort_order,
    })
  );

  const initialMenuItems: AdminMenuItem[] = (menuItems ?? []).map((item) => {
    let cat: { id: string; name: string } | null = null;
    if (item.category) {
      if (Array.isArray(item.category)) {
        cat = item.category[0] ?? null;
      } else {
        cat = item.category as { id: string; name: string };
      }
    }

    return {
      id: item.id,
      category_id: item.category_id,
      name: item.name,
      description: item.description,
      price: item.price,
      image_path: item.image_path,
      is_available: item.is_available,
      is_featured: item.is_featured,
      is_active: item.is_active,
      sort_order: item.sort_order,
      category: cat,
    };
  });

  return (
    <MenuManagementView
      initialCategories={initialCategories}
      initialMenuItems={initialMenuItems}
    />
  );
}

function MenuManagementSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-pulse pb-12">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-4 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-7 w-36 rounded-md bg-cream-200" />
          <div className="h-4 w-64 rounded bg-cream-100" />
        </div>
        <div className="flex items-center gap-2.5">
          <div className="h-11 w-36 rounded-md bg-cream-200" />
          <div className="h-11 w-36 rounded-md bg-cream-200" />
        </div>
      </div>

      {/* Categories Tabs Skeleton */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <div className="h-11 w-24 rounded-full bg-cream-200 shrink-0" />
        <div className="h-11 w-28 rounded-full bg-cream-100 shrink-0" />
        <div className="h-11 w-28 rounded-full bg-cream-100 shrink-0" />
      </div>

      {/* Menu Cards Skeleton */}
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-line bg-card p-4 shadow-xs space-y-4"
          >
            <div className="flex items-start gap-3.5">
              <div className="size-16 sm:size-20 rounded-lg bg-cream-100 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-40 rounded bg-cream-200" />
                <div className="h-4 w-20 rounded bg-cream-100" />
                <div className="h-4 w-24 rounded bg-cream-200" />
              </div>
            </div>
            <div className="border-t border-line/60 pt-3 flex items-center justify-between">
              <div className="h-10 w-28 rounded-md bg-cream-100" />
              <div className="h-10 w-32 rounded-md bg-cream-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminMenuPage() {
  return (
    <React.Suspense fallback={<MenuManagementSkeleton />}>
      <MenuManagementLoader />
    </React.Suspense>
  );
}
