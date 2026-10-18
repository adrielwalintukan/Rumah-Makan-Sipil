"use client";

import * as React from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface CategoryItem {
  id: string;
  name: string;
  sort_order: number;
}

export interface CategoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  categories: CategoryItem[];
  onCategoriesUpdated: () => void | Promise<void>;
}

export function CategoryDialog({
  isOpen,
  onClose,
  categories,
  onCategoriesUpdated,
}: CategoryDialogProps) {
  const [newCategoryName, setNewCategoryName] = React.useState("");
  const [isAdding, setIsAdding] = React.useState(false);

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingName, setEditingName] = React.useState("");
  const [isSavingEdit, setIsSavingEdit] = React.useState(false);

  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const [isReordering, setIsReordering] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const [prevIsOpen, setPrevIsOpen] = React.useState(isOpen);
  if (prevIsOpen !== isOpen) {
    setPrevIsOpen(isOpen);
    if (!isOpen) {
      setNewCategoryName("");
      setEditingId(null);
      setEditingName("");
      setDeletingId(null);
      setErrorMessage(null);
    }
  }

  const sortedCategories = React.useMemo(() => {
    return [...categories].sort((a, b) => a.sort_order - b.sort_order);
  }, [categories]);

  const isBusy = isAdding || isReordering || isSavingEdit || isDeleting;

  const handleClose = () => {
    if (isBusy) return;
    setNewCategoryName("");
    setEditingId(null);
    setEditingName("");
    setDeletingId(null);
    setErrorMessage(null);
    onClose();
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;

    if (trimmed.length > 50) {
      setErrorMessage("Nama kategori maksimal 50 karakter.");
      return;
    }

    setIsAdding(true);
    setErrorMessage(null);

    const nextOrder =
      categories.length > 0
        ? Math.max(...categories.map((c) => c.sort_order)) + 1
        : 0;

    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, sort_order: nextOrder }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Gagal menambahkan kategori.");
      }

      setNewCategoryName("");
      await onCategoriesUpdated();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal menambahkan kategori.";
      setErrorMessage(message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleMove = async (currentIndex: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= sortedCategories.length) return;

    setIsReordering(true);
    setErrorMessage(null);

    const reordered = [...sortedCategories];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    const payload = {
      items: reordered.map((cat, idx) => ({
        id: cat.id,
        sort_order: idx,
      })),
    };

    try {
      const res = await fetch("/api/admin/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Gagal mengubah urutan kategori.");
      }

      await onCategoriesUpdated();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal mengubah urutan kategori.";
      setErrorMessage(message);
    } finally {
      setIsReordering(false);
    }
  };

  const handleStartEdit = (cat: CategoryItem) => {
    setErrorMessage(null);
    setDeletingId(null);
    setEditingId(cat.id);
    setEditingName(cat.name);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const handleSaveEdit = async (id: string, originalName: string) => {
    const trimmed = editingName.trim();
    if (!trimmed) {
      setErrorMessage("Nama kategori tidak boleh kosong.");
      return;
    }
    if (trimmed.length > 50) {
      setErrorMessage("Nama kategori maksimal 50 karakter.");
      return;
    }

    if (trimmed === originalName) {
      handleCancelEdit();
      return;
    }

    setIsSavingEdit(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/admin/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Gagal memperbarui kategori.");
      }

      handleCancelEdit();
      await onCategoriesUpdated();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal memperbarui kategori.";
      setErrorMessage(message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleStartDelete = (cat: CategoryItem) => {
    setErrorMessage(null);
    handleCancelEdit();
    setDeletingId(cat.id);
  };

  const handleCancelDelete = () => {
    setDeletingId(null);
  };

  const handleConfirmDelete = async (id: string) => {
    setIsDeleting(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/admin/categories/${id}`, {
        method: "DELETE",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Gagal menghapus kategori.");
      }

      setDeletingId(null);
      await onCategoriesUpdated();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal menghapus kategori.";
      setErrorMessage(message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        showCloseButton={!isBusy}
        className="flex max-h-[90vh] flex-col overflow-hidden p-4 sm:max-w-lg sm:p-6"
      >
        <DialogHeader>
          <DialogTitle>Kelola Kategori</DialogTitle>
          <DialogDescription>
            Atur urutan tampilan, ubah nama, atau tambah kategori baru.
          </DialogDescription>
        </DialogHeader>

        {/* Error notification */}
        {errorMessage && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-bg p-3 text-sm text-danger"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span className="flex-1 font-medium">{errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="flex size-11 -mr-2 -mt-2 shrink-0 items-center justify-center rounded text-danger transition hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
              aria-label="Tutup pesan error"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        {/* Form Tambah Kategori Baru */}
        <form onSubmit={handleAddCategory} className="flex gap-2">
          <Input
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Nama kategori baru"
            maxLength={50}
            disabled={isBusy}
            aria-label="Nama kategori baru"
            className="h-11 flex-1 text-base"
          />
          <Button
            type="submit"
            disabled={isBusy || !newCategoryName.trim()}
            className="min-h-[44px] shrink-0 gap-1.5 px-4"
          >
            {isAdding ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Menambahkan...</span>
              </>
            ) : (
              <>
                <Plus className="size-4" />
                <span>Tambah</span>
              </>
            )}
          </Button>
        </form>

        {/* Daftar Kategori */}
        <div
          role="region"
          aria-label="Daftar Kategori"
          className="-mr-1 flex-1 overflow-y-auto divide-y divide-line pr-1 min-h-[140px] max-h-[50vh]"
        >
          {sortedCategories.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-600">
              Belum ada kategori yang dibuat.
            </p>
          ) : (
            sortedCategories.map((cat, index) => {
              if (editingId === cat.id) {
                return (
                  <div key={cat.id} className="py-2.5">
                    <div className="flex items-center gap-2">
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleSaveEdit(cat.id, cat.name);
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            e.stopPropagation();
                            handleCancelEdit();
                          }
                        }}
                        disabled={isSavingEdit}
                        maxLength={50}
                        aria-label={`Ubah nama kategori ${cat.name}`}
                        className="h-11 flex-1 text-base"
                        autoFocus
                      />
                      <Button
                        type="button"
                        size="icon"
                        onClick={() => handleSaveEdit(cat.id, cat.name)}
                        disabled={isSavingEdit || !editingName.trim()}
                        className="size-11 shrink-0"
                        aria-label="Simpan perubahan nama"
                      >
                        {isSavingEdit ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Check className="size-4" />
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={handleCancelEdit}
                        disabled={isSavingEdit}
                        className="size-11 shrink-0"
                        aria-label="Batal ubah nama"
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  </div>
                );
              }

              if (deletingId === cat.id) {
                return (
                  <div
                    key={cat.id}
                    className="my-2 space-y-2.5 rounded-lg border border-danger/30 bg-danger-bg/40 p-3"
                  >
                    <p className="text-sm font-medium leading-snug text-ink-900">
                      Hapus kategori{" "}
                      <span className="font-semibold text-danger">
                        &quot;{cat.name}&quot;
                      </span>
                      ?
                    </p>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleCancelDelete}
                        disabled={isDeleting}
                        className="min-h-[44px] px-3.5 text-sm font-medium text-ink-900"
                      >
                        Batal
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => handleConfirmDelete(cat.id)}
                        disabled={isDeleting}
                        className="min-h-[44px] gap-1.5 px-3.5 text-sm font-medium"
                      >
                        {isDeleting ? (
                          <>
                            <Loader2 className="size-4 animate-spin" />
                            <span>Menghapus...</span>
                          </>
                        ) : (
                          "Ya, Hapus"
                        )}
                      </Button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={cat.id}
                  className="flex items-center justify-between gap-2 py-2.5"
                >
                  {/* Reorder Buttons */}
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-11 shrink-0 text-ink-600 hover:bg-cream-100 hover:text-ink-900 disabled:opacity-30"
                      onClick={() => handleMove(index, "up")}
                      disabled={index === 0 || isBusy}
                      aria-label={`Pindahkan ${cat.name} ke atas`}
                    >
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-11 shrink-0 text-ink-600 hover:bg-cream-100 hover:text-ink-900 disabled:opacity-30"
                      onClick={() => handleMove(index, "down")}
                      disabled={
                        index === sortedCategories.length - 1 || isBusy
                      }
                      aria-label={`Pindahkan ${cat.name} ke bawah`}
                    >
                      <ArrowDown className="size-4" />
                    </Button>
                  </div>

                  {/* Category Name */}
                  <span
                    className="flex-1 min-w-0 truncate px-1 text-base font-medium text-ink-900"
                    title={cat.name}
                  >
                    {cat.name}
                  </span>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-11 shrink-0 text-ink-600 hover:bg-cream-100 hover:text-ink-900"
                      onClick={() => handleStartEdit(cat)}
                      disabled={isBusy}
                      aria-label={`Ubah nama kategori ${cat.name}`}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-11 shrink-0 text-danger hover:bg-danger-bg hover:text-danger"
                      onClick={() => handleStartDelete(cat)}
                      disabled={isBusy}
                      aria-label={`Hapus kategori ${cat.name}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <DialogFooter className="mt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isBusy}
            className="min-h-[44px] w-full sm:w-auto"
          >
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
