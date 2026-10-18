"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  FolderCog,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CategoryDialog } from "@/components/admin/menu/category-dialog";
import { MenuPhoto } from "@/components/pelanggan/menu-photo";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface AdminMenuItem {
  id: string;
  category_id: string;
  name: string;
  description?: string | null;
  price: number;
  image_path?: string | null;
  is_available: boolean;
  is_active: boolean;
  sort_order: number;
  category?: {
    id: string;
    name: string;
  } | null;
}

export interface AdminCategoryItem {
  id: string;
  name: string;
  sort_order: number;
}

export interface MenuManagementViewProps {
  initialCategories: AdminCategoryItem[];
  initialMenuItems: AdminMenuItem[];
}

export function MenuManagementView({
  initialCategories,
  initialMenuItems,
}: MenuManagementViewProps) {
  const router = useRouter();

  const [categories, setCategories] =
    React.useState<AdminCategoryItem[]>(initialCategories);
  const [menuItems, setMenuItems] =
    React.useState<AdminMenuItem[]>(initialMenuItems);

  const [selectedCategoryId, setSelectedCategoryId] =
    React.useState<string>("all");
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] =
    React.useState<boolean>(false);

  const [deletingItem, setDeletingItem] = React.useState<AdminMenuItem | null>(
    null
  );
  const [isDeleting, setIsDeleting] = React.useState<boolean>(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const [isReordering, setIsReordering] = React.useState<boolean>(false);
  const [togglingId, setTogglingId] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  // Sinkronkan state jika props server berubah (sesuai rekomendasi React untuk render-based adjustment)
  const [prevInitialCategories, setPrevInitialCategories] =
    React.useState(initialCategories);
  if (prevInitialCategories !== initialCategories) {
    setPrevInitialCategories(initialCategories);
    setCategories(initialCategories);
  }

  const [prevInitialMenuItems, setPrevInitialMenuItems] =
    React.useState(initialMenuItems);
  if (prevInitialMenuItems !== initialMenuItems) {
    setPrevInitialMenuItems(initialMenuItems);
    setMenuItems(initialMenuItems);
  }

  // Jika kategori yang dipilih tidak ada di categories, fallback ke "all"
  const activeCategoryId =
    selectedCategoryId !== "all" &&
    !categories.some((c) => c.id === selectedCategoryId)
      ? "all"
      : selectedCategoryId;

  // Urutan kategori berdasarkan sort_order lalu nama
  const sortedCategories = React.useMemo(() => {
    return [...categories].sort(
      (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
    );
  }, [categories]);

  // Hitung jumlah menu per kategori
  const categoryCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    menuItems.forEach((item) => {
      counts[item.category_id] = (counts[item.category_id] || 0) + 1;
    });
    return counts;
  }, [menuItems]);

  // Urutkan menu items berdasarkan kategori (sort_order), lalu sort_order item, lalu nama
  const sortedMenuItems = React.useMemo(() => {
    const catOrderMap = new Map<string, number>();
    sortedCategories.forEach((cat, idx) => {
      catOrderMap.set(cat.id, cat.sort_order ?? idx);
    });

    return [...menuItems].sort((a, b) => {
      const catOrderA = catOrderMap.get(a.category_id) ?? 9999;
      const catOrderB = catOrderMap.get(b.category_id) ?? 9999;
      if (catOrderA !== catOrderB) {
        return catOrderA - catOrderB;
      }
      if (a.sort_order !== b.sort_order) {
        return a.sort_order - b.sort_order;
      }
      return a.name.localeCompare(b.name);
    });
  }, [menuItems, sortedCategories]);

  // Filter daftar menu sesuai kategori aktif
  const filteredMenuItems = React.useMemo(() => {
    if (activeCategoryId === "all") {
      return sortedMenuItems;
    }
    return sortedMenuItems.filter(
      (item) => item.category_id === activeCategoryId
    );
  }, [sortedMenuItems, activeCategoryId]);

  // URL foto menu
  const getImageUrl = (imagePath?: string | null) => {
    if (!imagePath) return null;
    if (imagePath.startsWith("http") || imagePath.startsWith("/")) {
      return imagePath;
    }
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl) {
      return `${supabaseUrl}/storage/v1/object/public/menu-photos/${imagePath}`;
    }
    return `/menu-photos/${imagePath}`;
  };

  // Re-fetch kategori dan menu ketika dialog kategori ditutup dengan perubahan
  const handleCategoriesUpdated = async () => {
    try {
      const [catRes, menuRes] = await Promise.all([
        fetch("/api/admin/categories"),
        fetch("/api/admin/menu"),
      ]);

      if (catRes.ok) {
        const catJson = await catRes.json();
        if (Array.isArray(catJson.data)) {
          setCategories(catJson.data);
        }
      }

      if (menuRes.ok) {
        const menuJson = await menuRes.json();
        if (Array.isArray(menuJson.data)) {
          setMenuItems(menuJson.data);
        }
      }
    } catch {
      // router.refresh fallback
    }
    router.refresh();
  };

  // Quick Toggle Habis (Optimistic Update)
  const handleToggleAvailability = async (item: AdminMenuItem) => {
    if (togglingId === item.id) return;
    setActionError(null);

    const previousAvailable = item.is_available;
    const newAvailable = !previousAvailable;

    // Optimistic update
    setMenuItems((prev) =>
      prev.map((m) =>
        m.id === item.id ? { ...m, is_available: newAvailable } : m
      )
    );
    setTogglingId(item.id);

    try {
      const res = await fetch(`/api/admin/menu/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_available: newAvailable }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data.error || "Gagal memperbarui status ketersediaan menu."
        );
      }

      router.refresh();
    } catch (err) {
      // Revert jika gagal
      setMenuItems((prev) =>
        prev.map((m) =>
          m.id === item.id ? { ...m, is_available: previousAvailable } : m
        )
      );
      const message =
        err instanceof Error
          ? err.message
          : "Gagal memperbarui status ketersediaan menu.";
      setActionError(message);
    } finally {
      setTogglingId(null);
    }
  };

  // Urutan Naik / Turun Menu dalam Kategori yang Sama
  const handleMoveItem = async (
    item: AdminMenuItem,
    direction: "up" | "down"
  ) => {
    if (isReordering) return;
    setActionError(null);

    // Kumpulkan seluruh item aktif di kategori yang sama, terurut
    const categoryItems = sortedMenuItems.filter(
      (m) => m.category_id === item.category_id
    );
    const currentIndex = categoryItems.findIndex((m) => m.id === item.id);
    if (currentIndex === -1) return;

    const targetIndex =
      direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= categoryItems.length) return;

    const previousMenuItems = [...menuItems];

    // Reorder array dalam kategori ini
    const reorderedCatItems = [...categoryItems];
    const [moved] = reorderedCatItems.splice(currentIndex, 1);
    reorderedCatItems.splice(targetIndex, 0, moved);

    // Petakan sort_order baru
    const updatedOrders = new Map<string, number>();
    reorderedCatItems.forEach((m, idx) => {
      updatedOrders.set(m.id, idx);
    });

    // Optimistic update
    setMenuItems((prev) =>
      prev.map((m) =>
        updatedOrders.has(m.id)
          ? { ...m, sort_order: updatedOrders.get(m.id)! }
          : m
      )
    );

    setIsReordering(true);

    try {
      const payload = {
        items: reorderedCatItems.map((m, idx) => ({
          id: m.id,
          sort_order: idx,
        })),
      };

      const res = await fetch("/api/admin/menu", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Gagal mengubah urutan menu.");
      }

      router.refresh();
    } catch (err) {
      // Revert jika gagal
      setMenuItems(previousMenuItems);
      const message =
        err instanceof Error ? err.message : "Gagal mengubah urutan menu.";
      setActionError(message);
    } finally {
      setIsReordering(false);
    }
  };

  // Soft Delete Menu
  const handleConfirmDelete = async () => {
    if (!deletingItem || isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/admin/menu/${deletingItem.id}`, {
        method: "DELETE",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Gagal menghapus menu.");
      }

      // Hapus dari state lokal langsung
      setMenuItems((prev) => prev.filter((m) => m.id !== deletingItem.id));
      setDeletingItem(null);
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal menghapus menu.";
      setDeleteError(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const selectedCategoryName =
    activeCategoryId === "all"
      ? "Semua"
      : categories.find((c) => c.id === activeCategoryId)?.name ?? "Kategori";

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Header & Toolbar */}
      <div className="flex flex-col gap-4 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-green-900">
            Kelola Menu
          </h1>
          <p className="mt-1 text-sm text-ink-600">
            Tambah, ubah harga, foto, dan status ketersediaan menu.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setIsCategoryDialogOpen(true)}
            className="min-h-[44px] flex-1 sm:flex-none gap-2 font-semibold"
          >
            <FolderCog className="size-4 shrink-0" aria-hidden />
            <span>Kelola Kategori</span>
          </Button>
          <Button
            asChild
            className="min-h-[44px] flex-1 sm:flex-none gap-2 font-semibold"
          >
            <Link href="/admin/menu/baru">
              <Plus className="size-4 shrink-0" aria-hidden />
              <span>Tambah Menu</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Global Action Error Alert */}
      {actionError && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-lg border border-danger/30 bg-danger-bg/40 p-3.5 text-sm font-medium text-danger"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="size-5 shrink-0 mt-0.5" aria-hidden />
            <span className="leading-snug">{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded p-1 text-danger hover:bg-danger-bg/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
            aria-label="Tutup notifikasi error"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      )}

      {/* Kategori Tabs / Pills */}
      {categories.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 no-scrollbar sm:flex-wrap">
          <button
            type="button"
            onClick={() => setSelectedCategoryId("all")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold min-h-[44px] transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700",
              activeCategoryId === "all"
                ? "bg-green-700 text-white shadow-xs"
                : "border border-line bg-card text-ink-700 hover:bg-cream-100 hover:text-ink-900"
            )}
            aria-pressed={activeCategoryId === "all"}
          >
            <span>Semua</span>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-xs font-bold",
                activeCategoryId === "all"
                  ? "bg-white/20 text-white"
                  : "bg-cream-100 text-ink-600"
              )}
            >
              {menuItems.length}
            </span>
          </button>

          {sortedCategories.map((cat) => {
            const count = categoryCounts[cat.id] || 0;
            const isSelected = activeCategoryId === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategoryId(cat.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold min-h-[44px] transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700",
                  isSelected
                    ? "bg-green-700 text-white shadow-xs"
                    : "border border-line bg-card text-ink-700 hover:bg-cream-100 hover:text-ink-900"
                )}
                aria-pressed={isSelected}
              >
                <span>{cat.name}</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-xs font-bold",
                    isSelected
                      ? "bg-white/20 text-white"
                      : "bg-cream-100 text-ink-600"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Daftar Menu Items / Empty State */}
      {categories.length === 0 ? (
        /* Empty State: Belum ada kategori */
        <div className="rounded-xl border border-line bg-card p-8 text-center shadow-xs">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-cream-100 text-green-800">
            <FolderCog className="size-6" aria-hidden />
          </div>
          <h2 className="font-display text-lg font-bold text-ink-900">
            Belum Ada Kategori Menu
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-600">
            Buat kategori terlebih dahulu untuk mulai menambahkan dan mengelompokkan
            menu makanan atau minuman.
          </p>
          <div className="mt-5">
            <Button
              type="button"
              variant="default"
              onClick={() => setIsCategoryDialogOpen(true)}
              className="min-h-[44px] font-semibold gap-2"
            >
              <FolderCog className="size-4 shrink-0" aria-hidden />
              <span>Kelola Kategori</span>
            </Button>
          </div>
        </div>
      ) : menuItems.length === 0 ? (
        /* Empty State: Belum ada menu sama sekali */
        <div className="rounded-xl border border-line bg-card p-8 text-center shadow-xs">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-cream-100 text-green-800">
            <UtensilsCrossed className="size-6" aria-hidden />
          </div>
          <h2 className="font-display text-lg font-bold text-ink-900">
            Belum Ada Menu
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-600">
            Daftar menu masih kosong. Tambahkan menu pertama Anda agar pelanggan
            dapat mulai memesan makanan atau minuman.
          </p>
          <div className="mt-5">
            <Button asChild className="min-h-[44px] font-semibold gap-2">
              <Link href="/admin/menu/baru">
                <Plus className="size-4 shrink-0" aria-hidden />
                <span>Tambah Menu</span>
              </Link>
            </Button>
          </div>
        </div>
      ) : filteredMenuItems.length === 0 ? (
        /* Empty State: Kategori aktif tidak punya menu */
        <div className="rounded-xl border border-line bg-card p-8 text-center shadow-xs">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-cream-100 text-green-800">
            <UtensilsCrossed className="size-6" aria-hidden />
          </div>
          <h2 className="font-display text-lg font-bold text-ink-900">
            Belum Ada Menu di Kategori &quot;{selectedCategoryName}&quot;
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-600">
            Tambahkan menu baru ke kategori ini atau pilih tab kategori lain.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelectedCategoryId("all")}
              className="min-h-[44px]"
            >
              Lihat Semua Menu
            </Button>
            <Button asChild className="min-h-[44px] font-semibold gap-2">
              <Link href="/admin/menu/baru">
                <Plus className="size-4 shrink-0" aria-hidden />
                <span>Tambah Menu</span>
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        /* List Menu Items */
        <div className="flex flex-col gap-3">
          {filteredMenuItems.map((item) => {
            // Posisi item dalam kategori untuk menentukan disable Up / Down
            const categoryItems = sortedMenuItems.filter(
              (m) => m.category_id === item.category_id
            );
            const itemCatIndex = categoryItems.findIndex(
              (m) => m.id === item.id
            );
            const isFirstInCategory = itemCatIndex <= 0;
            const isLastInCategory =
              itemCatIndex === categoryItems.length - 1;

            const imageUrl = getImageUrl(item.image_path);
            const categoryName = item.category?.name ?? "";
            const isToggling = togglingId === item.id;

            return (
              <div
                key={item.id}
                data-testid="admin-menu-card"
                className={cn(
                  "rounded-xl border bg-card p-4 shadow-xs transition-shadow hover:shadow-sm",
                  item.is_available
                    ? "border-line"
                    : "border-line/70 bg-cream-50/40 opacity-90"
                )}
              >
                {/* Bagian Atas: Foto, Nama, Kategori, Harga, Deskripsi */}
                <div className="flex items-start gap-3.5">
                  <div className="size-16 sm:size-20 shrink-0 overflow-hidden rounded-lg border border-line/40">
                    <MenuPhoto
                      name={item.name}
                      imageUrl={imageUrl}
                      category={categoryName}
                      sizes="(min-width: 640px) 80px, 64px"
                      className="size-full"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-base sm:text-lg text-ink-900 leading-snug break-words">
                        {item.name}
                      </h2>
                      {categoryName && (
                        <span className="inline-flex items-center rounded-sm bg-cream-100 px-2 py-0.5 text-xs font-medium text-ink-700">
                          {categoryName}
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-sm sm:text-base font-bold text-brown-700 tabular-nums">
                      {formatRupiah(item.price)}
                    </p>

                    {item.description && (
                      <p className="mt-1 text-xs text-ink-600 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Bagian Bawah: Action Bar (Urutan, Quick Toggle, Ubah, Hapus) */}
                <div className="mt-3.5 flex flex-col gap-2.5 border-t border-line/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
                  {/* Left: Reorder & Quick Toggle Habis */}
                  <div className="flex flex-wrap items-center justify-between gap-2.5 sm:justify-start">
                    {/* Urutan Naik / Turun */}
                    <div className="flex items-center gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-11 min-h-[44px] min-w-[44px] text-ink-600 hover:bg-cream-100 hover:text-ink-900 disabled:opacity-30"
                        onClick={() => handleMoveItem(item, "up")}
                        disabled={isFirstInCategory || isReordering}
                        aria-label={`Pindahkan menu ${item.name} ke atas`}
                      >
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-11 min-h-[44px] min-w-[44px] text-ink-600 hover:bg-cream-100 hover:text-ink-900 disabled:opacity-30"
                        onClick={() => handleMoveItem(item, "down")}
                        disabled={isLastInCategory || isReordering}
                        aria-label={`Pindahkan menu ${item.name} ke bawah`}
                      >
                        <ArrowDown className="size-4" />
                      </Button>
                    </div>

                    {/* Quick Toggle Habis */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={item.is_available}
                      disabled={isToggling}
                      onClick={() => handleToggleAvailability(item)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg border px-3 py-1.5 min-h-[44px] transition-colors cursor-pointer select-none text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700 disabled:opacity-50 disabled:cursor-not-allowed",
                        item.is_available
                          ? "border-green-600/30 bg-green-50/70 hover:bg-green-100/70 text-green-950"
                          : "border-line bg-cream-100/70 hover:bg-cream-200/70 text-ink-700"
                      )}
                      aria-label={`Status ketersediaan ${item.name}: ${
                        item.is_available ? "Tersedia" : "Habis"
                      }`}
                    >
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "size-2 rounded-full shrink-0",
                              item.is_available
                                ? "bg-green-600"
                                : "bg-ink-400"
                            )}
                            aria-hidden
                          />
                          <span className="text-xs font-bold leading-none">
                            {item.is_available ? "Tersedia" : "Habis"}
                          </span>
                        </div>
                        <span className="text-[10px] text-ink-600 leading-tight mt-0.5 hidden sm:inline">
                          {item.is_available ? "Bisa dipesan" : "Stok kosong"}
                        </span>
                      </div>

                      {/* Switch Knob */}
                      <div
                        aria-hidden="true"
                        className={cn(
                          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent transition-colors duration-200 ease-in-out motion-reduce:transition-none ml-1",
                          item.is_available ? "bg-green-700" : "bg-ink-400/40"
                        )}
                      >
                        {isToggling ? (
                          <Loader2 className="size-3 animate-spin mx-auto text-white" />
                        ) : (
                          <span
                            className={cn(
                              "inline-block size-4 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out motion-reduce:transition-none",
                              item.is_available
                                ? "translate-x-4"
                                : "translate-x-0.5"
                            )}
                          />
                        )}
                      </div>
                    </button>
                  </div>

                  {/* Right: Ubah & Hapus */}
                  <div className="flex items-center justify-end gap-2 border-t border-line/40 pt-2.5 sm:border-0 sm:pt-0">
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="min-h-[44px] px-3.5 text-sm text-ink-800 hover:text-green-800"
                    >
                      <Link
                        href={`/admin/menu/${item.id}`}
                        className="inline-flex items-center gap-1.5"
                      >
                        <Pencil className="size-4" aria-hidden />
                        <span>Ubah</span>
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDeleteError(null);
                        setDeletingItem(item);
                      }}
                      className="min-h-[44px] px-3 text-sm text-danger hover:bg-danger-bg/40 hover:text-danger focus-visible:ring-danger"
                      aria-label={`Hapus menu ${item.name}`}
                    >
                      <Trash2 className="size-4" aria-hidden />
                      <span>Hapus</span>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog Konfirmasi Hapus Lunak */}
      <Dialog
        open={!!deletingItem}
        onOpenChange={(open) => !open && !isDeleting && setDeletingItem(null)}
      >
        <DialogContent
          showCloseButton={!isDeleting}
          className="p-4 sm:max-w-md sm:p-6"
        >
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-ink-900">
              Hapus Menu {deletingItem?.name}?
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm text-ink-600 leading-relaxed">
              Menu ini akan disembunyikan dari daftar pelanggan. Riwayat pesanan
              yang menggunakan menu ini tetap aman dan tidak akan terhapus.
            </DialogDescription>
          </DialogHeader>

          {deleteError && (
            <div
              role="alert"
              className="mt-3 flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger-bg/40 p-3 text-sm font-medium text-danger"
            >
              <AlertCircle className="size-4 shrink-0 mt-0.5" aria-hidden />
              <span>{deleteError}</span>
            </div>
          )}

          <DialogFooter className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={isDeleting}
              onClick={() => setDeletingItem(null)}
              className="min-h-[44px]"
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeleting}
              onClick={handleConfirmDelete}
              className="min-h-[44px] gap-2"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  <span>Menghapus...</span>
                </>
              ) : (
                <span>Hapus Menu</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Management Dialog */}
      <CategoryDialog
        isOpen={isCategoryDialogOpen}
        onClose={() => setIsCategoryDialogOpen(false)}
        categories={categories}
        onCategoriesUpdated={handleCategoriesUpdated}
      />
    </div>
  );
}
