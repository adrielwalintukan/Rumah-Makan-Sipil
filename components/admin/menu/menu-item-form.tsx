"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Camera,
  ChevronDown,
  Crop,
  Loader2,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatRupiah } from "@/lib/format";
import { UUID_REGEX } from "@/lib/schemas";
import { validateImageFile } from "@/lib/image-compression";
import { PhotoCropDialog } from "./photo-crop-dialog";
import {
  getMenuPhotoUrl,
  saveMenuItemWithPhotoCleanup,
} from "@/lib/storage";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export interface MenuItemFormData {
  id?: string;
  category_id: string;
  name: string;
  description: string;
  price: number;
  image_path?: string | null;
  is_available: boolean;
  sort_order?: number;
}

export interface MenuItemFormProps {
  initialData?: MenuItemFormData;
  categories: Array<{ id: string; name: string }>;
  mode: "create" | "edit";
}

export function MenuItemForm({
  initialData,
  categories,
  mode,
}: MenuItemFormProps) {
  const router = useRouter();

  const [categoryId, setCategoryId] = React.useState<string>(
    initialData?.category_id || (categories.length === 1 ? categories[0].id : "")
  );
  const [name, setName] = React.useState<string>(initialData?.name || "");
  const [description, setDescription] = React.useState<string>(
    initialData?.description || ""
  );
  const [price, setPrice] = React.useState<string>(
    initialData?.price !== undefined ? String(initialData.price) : ""
  );
  const [isAvailable, setIsAvailable] = React.useState<boolean>(
    initialData?.is_available ?? true
  );

  const [errors, setErrors] = React.useState<{
    categoryId?: string;
    name?: string;
    price?: string;
    description?: string;
  }>({});

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  const [cropFile, setCropFile] = React.useState<File | null>(null);
  const [isCropDialogOpen, setIsCropDialogOpen] = React.useState(false);
  const [processedBlob, setProcessedBlob] = React.useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(() =>
    getMenuPhotoUrl(initialData?.image_path)
  );
  const [isPhotoRemoved, setIsPhotoRemoved] = React.useState<boolean>(false);
  const [photoError, setPhotoError] = React.useState<string | null>(null);
  const isProcessingPhoto = false;

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleTriggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoError(null);

    const validation = validateImageFile(file);
    if (!validation.valid) {
      setPhotoError(validation.error || "File gambar tidak valid.");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setCropFile(file);
    setIsCropDialogOpen(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleApplyCrop = (blob: Blob, newPreviewUrl: string) => {
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setPhotoFile(cropFile);
    setProcessedBlob(blob);
    setPreviewUrl(newPreviewUrl);
    setIsPhotoRemoved(false);
    setPhotoError(null);
  };

  const handleOpenCropAdjust = () => {
    if (photoFile) {
      setCropFile(photoFile);
      setIsCropDialogOpen(true);
    }
  };

  const handleRemovePhoto = () => {
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setPhotoFile(null);
    setCropFile(null);
    setProcessedBlob(null);
    setPreviewUrl(null);
    setIsPhotoRemoved(true);
    setPhotoError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Preview format rupiah saat input harga valid
  const previewPrice = React.useMemo(() => {
    const trimmed = price.trim();
    if (!trimmed || !/^\d+$/.test(trimmed)) return null;
    const num = parseInt(trimmed, 10);
    if (isNaN(num) || num < 0) return null;
    return num;
  }, [price]);

  const validate = (): boolean => {
    const newErrors: {
      categoryId?: string;
      name?: string;
      price?: string;
      description?: string;
    } = {};

    if (!categoryId || !UUID_REGEX.test(categoryId)) {
      newErrors.categoryId = "Kategori wajib dipilih.";
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      newErrors.name = "Nama menu wajib diisi.";
    } else if (trimmedName.length > 100) {
      newErrors.name = "Nama menu maksimal 100 karakter.";
    }

    const trimmedPrice = price.trim();
    if (!trimmedPrice) {
      newErrors.price = "Harga wajib diisi.";
    } else if (!/^\d+$/.test(trimmedPrice)) {
      newErrors.price = "Harga harus berupa bilangan bulat Rupiah tanpa desimal.";
    } else {
      const num = parseInt(trimmedPrice, 10);
      if (isNaN(num) || num < 0) {
        newErrors.price = "Harga tidak boleh negatif.";
      }
    }

    if (description.trim().length > 500) {
      newErrors.description = "Deskripsi maksimal 500 karakter.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validate()) {
      return;
    }

    const numPrice = parseInt(price.trim(), 10);
    setIsSubmitting(true);

    try {
      const isCategoryChanged =
        initialData !== undefined && categoryId !== initialData.category_id;

      const payload = {
        category_id: categoryId,
        name: name.trim(),
        description: description.trim(),
        price: numPrice,
        image_path: isPhotoRemoved ? null : (initialData?.image_path ?? null),
        is_available: isAvailable,
        ...(initialData?.sort_order !== undefined && !isCategoryChanged
          ? { sort_order: initialData.sort_order }
          : {}),
      };

      const endpoint =
        mode === "create"
          ? "/api/admin/menu"
          : `/api/admin/menu/${initialData!.id}`;
      const method = mode === "create" ? "POST" : "PATCH";

      const supabase = createBrowserSupabaseClient();
      const result = await saveMenuItemWithPhotoCleanup({
        storage: supabase.storage,
        processedBlob,
        payload,
        endpoint,
        method,
        isReferenced: async (path: string) => {
          const { data, error } = await supabase
            .from("menu_items")
            .select("id")
            .eq("image_path", path)
            .maybeSingle();
          if (error) {
            throw new Error(error.message);
          }
          return !!data;
        },
      });

      if (!result.success) {
        throw new Error(result.error || "Gagal menyimpan menu.");
      }

      router.push("/admin/menu");
      router.refresh();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat menyimpan menu.";
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!initialData?.id || isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/admin/menu/${initialData.id}`, {
        method: "DELETE",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Gagal menghapus menu.");
      }

      setIsDeleteDialogOpen(false);
      router.push("/admin/menu");
      router.refresh();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Gagal menghapus menu.";
      setDeleteError(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
        {submitError && (
          <div
            role="alert"
            className="rounded-lg border border-danger/30 bg-danger-bg/40 p-3.5 text-sm font-medium text-danger flex items-start gap-2.5"
          >
            <AlertCircle className="size-5 shrink-0 mt-0.5" aria-hidden />
            <div className="flex-1 leading-snug">{submitError}</div>
          </div>
        )}

        {categories.length === 0 && (
          <div
            role="alert"
            className="rounded-lg border border-warning/30 bg-warning-bg/40 p-3.5 text-sm font-medium text-warning flex items-start gap-2.5"
          >
            <AlertCircle className="size-5 shrink-0 mt-0.5" aria-hidden />
            <div className="flex-1 leading-snug">
              Belum ada kategori yang dibuat. Buat kategori terlebih dahulu di{" "}
              <Link
                href="/admin/menu"
                className="underline font-semibold hover:text-green-900"
              >
                halaman Kelola Menu
              </Link>{" "}
              sebelum menambahkan menu.
            </div>
          </div>
        )}

        {/* Kategori */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="category_id"
            className="text-sm font-semibold text-ink-900"
          >
            Kategori <span className="text-danger">*</span>
          </label>
          <div className="relative">
            <select
              id="category_id"
              name="category_id"
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                if (errors.categoryId) {
                  setErrors((prev) => ({ ...prev, categoryId: undefined }));
                }
              }}
              disabled={isSubmitting || isDeleting || isProcessingPhoto || categories.length === 0}
              aria-invalid={!!errors.categoryId}
              aria-describedby={
                errors.categoryId ? "category-error" : undefined
              }
              className={cn(
                "flex h-12 w-full appearance-none rounded-md border border-line bg-card px-3.5 pr-10 py-2 text-base text-ink-900 shadow-xs transition-[color,box-shadow]",
                "focus-visible:border-green-700 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-green-100",
                "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
                errors.categoryId && "border-danger ring-3 ring-danger/10"
              )}
            >
              {categories.length === 0 ? (
                <option value="" disabled>
                  Belum ada kategori
                </option>
              ) : (
                <>
                  <option value="" disabled>
                    -- Pilih Kategori --
                  </option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </>
              )}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-500"
              aria-hidden
            />
          </div>
          {errors.categoryId && (
            <p
              id="category-error"
              role="alert"
              className="text-xs text-danger font-medium flex items-center gap-1"
            >
              <AlertCircle className="size-3.5 shrink-0" aria-hidden />
              {errors.categoryId}
            </p>
          )}
        </div>

        {/* Nama Menu */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="name" className="text-sm font-semibold text-ink-900">
              Nama Menu <span className="text-danger">*</span>
            </label>
            <span className="text-xs text-ink-500">{name.length}/100</span>
          </div>
          <Input
            id="name"
            name="name"
            type="text"
            maxLength={100}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) {
                setErrors((prev) => ({ ...prev, name: undefined }));
              }
            }}
            placeholder="Contoh: Paket Ayam Geprek"
            disabled={isSubmitting || isDeleting || isProcessingPhoto}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "name-error" : undefined}
            className={cn(
              "min-h-[44px] h-12",
              errors.name && "border-danger ring-3 ring-danger/10"
            )}
          />
          {errors.name && (
            <p
              id="name-error"
              role="alert"
              className="text-xs text-danger font-medium flex items-center gap-1"
            >
              <AlertCircle className="size-3.5 shrink-0" aria-hidden />
              {errors.name}
            </p>
          )}
        </div>

        {/* Harga */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="price"
              className="text-sm font-semibold text-ink-900"
            >
              Harga (Rupiah) <span className="text-danger">*</span>
            </label>
            {previewPrice !== null && (
              <span className="text-xs font-semibold text-brown-700">
                {formatRupiah(previewPrice)}
              </span>
            )}
          </div>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
              <span className="text-sm font-semibold text-ink-500">Rp</span>
            </div>
            <Input
              id="price"
              name="price"
              type="number"
              min={0}
              step={1}
              value={price}
              onChange={(e) => {
                setPrice(e.target.value);
                if (errors.price) {
                  setErrors((prev) => ({ ...prev, price: undefined }));
                }
              }}
              placeholder="0"
              disabled={isSubmitting || isDeleting || isProcessingPhoto}
              aria-invalid={!!errors.price}
              aria-describedby={errors.price ? "price-error" : undefined}
              className={cn(
                "min-h-[44px] h-12 pl-11",
                errors.price && "border-danger ring-3 ring-danger/10"
              )}
            />
          </div>
          {errors.price && (
            <p
              id="price-error"
              role="alert"
              className="text-xs text-danger font-medium flex items-center gap-1"
            >
              <AlertCircle className="size-3.5 shrink-0" aria-hidden />
              {errors.price}
            </p>
          )}
        </div>

        {/* Deskripsi */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="description"
              className="text-sm font-semibold text-ink-900"
            >
              Deskripsi{" "}
              <span className="text-xs font-normal text-ink-500">
                (Opsional)
              </span>
            </label>
            <span className="text-xs text-ink-500">
              {description.length}/500
            </span>
          </div>
          <textarea
            id="description"
            name="description"
            rows={3}
            maxLength={500}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              if (errors.description) {
                setErrors((prev) => ({ ...prev, description: undefined }));
              }
            }}
            placeholder="Keterangan bahan, porsi, atau cara penyajian..."
            disabled={isSubmitting || isDeleting || isProcessingPhoto}
            aria-invalid={!!errors.description}
            aria-describedby={
              errors.description ? "description-error" : undefined
            }
            className={cn(
              "flex min-h-[96px] w-full rounded-md border border-line bg-card px-3.5 py-2.5 text-base text-ink-900 shadow-xs transition-[color,box-shadow]",
              "placeholder:text-ink-400 focus-visible:border-green-700 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-green-100",
              "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
              errors.description && "border-danger ring-3 ring-danger/10"
            )}
          />
          {errors.description && (
            <p
              id="description-error"
              role="alert"
              className="text-xs text-danger font-medium flex items-center gap-1"
            >
              <AlertCircle className="size-3.5 shrink-0" aria-hidden />
              {errors.description}
            </p>
          )}
        </div>

        {/* Foto Menu */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-0.5">
            <span
              id="photo-label"
              className="text-sm font-semibold text-ink-900"
            >
              Foto Menu
            </span>
            <p id="photo-help-text" className="text-xs text-ink-600 leading-relaxed">
              Opsional. Format JPG, PNG, atau WebP, maks. 5 MB. Posisi dan ukuran dapat disesuaikan ke rasio 4:3.
            </p>
          </div>

          <input
            id="menu-photo-input"
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            tabIndex={-1}
            disabled={isSubmitting || isDeleting || isProcessingPhoto}
            onChange={handleFileChange}
            aria-hidden="true"
          />

          {previewUrl ? (
            <div className="flex flex-col gap-3">
              <div className="relative w-full max-w-xs sm:max-w-sm aspect-[4/3] overflow-hidden rounded-xl border border-line bg-cream-100 shadow-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Pratinjau foto menu"
                  className="size-full object-cover"
                />

                {isProcessingPhoto && (
                  <div className="absolute inset-0 bg-ink-900/60 flex flex-col items-center justify-center gap-2 text-white p-4">
                    <Loader2
                      className="size-6 animate-spin motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                    <span className="text-xs font-semibold">
                      Memproses foto...
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTriggerFileInput}
                  disabled={isSubmitting || isDeleting || isProcessingPhoto}
                  className="min-h-[44px] gap-2 font-semibold"
                >
                  <Camera className="size-4 shrink-0" aria-hidden="true" />
                  <span>Ganti Foto</span>
                </Button>
                {photoFile && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleOpenCropAdjust}
                    disabled={isSubmitting || isDeleting || isProcessingPhoto}
                    className="min-h-[44px] gap-2 font-semibold"
                  >
                    <Crop className="size-4 shrink-0" aria-hidden="true" />
                    <span>Sesuaikan Posisi</span>
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleRemovePhoto}
                  disabled={isSubmitting || isDeleting || isProcessingPhoto}
                  className="min-h-[44px] gap-2 text-danger hover:bg-danger-bg/40 hover:text-danger focus-visible:ring-danger"
                >
                  <Trash2 className="size-4 shrink-0" aria-hidden="true" />
                  <span>Hapus Foto</span>
                </Button>
              </div>

              {photoFile && (
                <p className="text-xs text-ink-500 truncate max-w-xs">
                  Foto baru: {photoFile.name}
                </p>
              )}
            </div>
          ) : (
            <div
              className={cn(
                "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-line bg-cream-50/50 p-6 text-center transition-colors hover:border-green-700/50 hover:bg-cream-100/40 w-full max-w-xs sm:max-w-sm aspect-[4/3]",
                photoError && "border-danger/60 bg-danger-bg/10"
              )}
            >
              {isProcessingPhoto ? (
                <div className="flex flex-col items-center justify-center gap-2 text-ink-700">
                  <Loader2
                    className="size-8 animate-spin text-green-700 motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                  <span className="text-sm font-semibold">
                    Memproses foto...
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="flex size-12 items-center justify-center rounded-full bg-cream-100 text-ink-600">
                    <Camera className="size-6" aria-hidden="true" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold text-ink-900">
                      Belum ada foto menu
                    </span>
                    <span className="text-xs text-ink-500">
                      Rasio 4:3, maks. 5 MB
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleTriggerFileInput}
                    disabled={isSubmitting || isDeleting || isProcessingPhoto}
                    className="min-h-[44px] gap-2 font-semibold mt-1"
                  >
                    <UploadCloud className="size-4 shrink-0" aria-hidden="true" />
                    <span>Pilih Foto</span>
                  </Button>
                </div>
              )}
            </div>
          )}

          {photoError && (
            <p
              role="alert"
              className="text-xs text-danger font-medium flex items-center gap-1 mt-1"
            >
              <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
              <span>{photoError}</span>
            </p>
          )}
        </div>

        {/* Status Ketersediaan */}
        <div className="flex flex-col gap-2">
          <span
            id="availability-label"
            className="text-sm font-semibold text-ink-900"
          >
            Status Ketersediaan
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={isAvailable}
            aria-labelledby="availability-label"
            disabled={isSubmitting || isDeleting || isProcessingPhoto}
            onClick={() => setIsAvailable((prev) => !prev)}
            className={cn(
              "flex items-center justify-between gap-4 rounded-xl border p-3.5 min-h-[44px] transition-all motion-reduce:transition-none cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed",
              isAvailable
                ? "border-green-600/30 bg-green-50/80 text-green-950 hover:bg-green-100/70"
                : "border-line bg-cream-50/60 text-ink-700 hover:bg-cream-100/70"
            )}
          >
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "size-2.5 rounded-full shrink-0",
                    isAvailable ? "bg-green-600" : "bg-ink-400"
                  )}
                  aria-hidden
                />
                <span className="text-sm font-bold text-ink-900">
                  {isAvailable ? "Tersedia" : "Habis (stok kosong)"}
                </span>
              </div>
              <span className="text-xs text-ink-600">
                {isAvailable
                  ? "Menu aktif dan dapat dipesan oleh pelanggan."
                  : "Menu ditandai habis dan tidak dapat dipesan oleh pelanggan."}
              </span>
            </div>
            <div
              aria-hidden="true"
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 rounded-full border border-line transition-colors duration-200 ease-in-out motion-reduce:transition-none",
                isAvailable ? "bg-green-700 border-green-700" : "bg-ink-400/35"
              )}
            >
              <span
                className={cn(
                  "inline-block size-5 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out motion-reduce:transition-none",
                  isAvailable ? "translate-x-5" : "translate-x-0"
                )}
              />
            </div>
          </button>
        </div>

        {/* Tombol Aksi */}
        {mode === "create" ? (
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-6 border-t border-line">
            <Button
              type="button"
              variant="outline"
              asChild
              disabled={isSubmitting || isProcessingPhoto}
              className={cn(
                "min-h-[44px] h-11 w-full sm:w-auto",
                (isSubmitting || isProcessingPhoto) && "pointer-events-none opacity-50"
              )}
            >
              <Link
                href="/admin/menu"
                className={cn(
                  (isSubmitting || isProcessingPhoto) && "pointer-events-none opacity-50"
                )}
              >
                Batal
              </Link>
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || categories.length === 0 || isProcessingPhoto}
              className="min-h-[44px] h-11 w-full sm:w-auto font-semibold"
            >
              {isSubmitting ? (
                <>
                  <Loader2
                    className="size-4 animate-spin motion-reduce:animate-none"
                    aria-hidden
                  />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <span>Simpan Menu</span>
              )}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 pt-6 border-t border-line">
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
              <Button
                type="button"
                variant="destructive"
                onClick={() => setIsDeleteDialogOpen(true)}
                disabled={isSubmitting || isDeleting || isProcessingPhoto}
                className="min-h-[44px] h-11 w-full sm:w-auto"
              >
                <Trash2 className="size-4" aria-hidden />
                <span>Hapus Menu</span>
              </Button>

              <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  asChild
                  disabled={isSubmitting || isDeleting || isProcessingPhoto}
                  className={cn(
                    "min-h-[44px] h-11 w-full sm:w-auto",
                    (isSubmitting || isDeleting || isProcessingPhoto) &&
                      "pointer-events-none opacity-50"
                  )}
                >
                  <Link
                    href="/admin/menu"
                    className={cn(
                      (isSubmitting || isDeleting || isProcessingPhoto) &&
                        "pointer-events-none opacity-50"
                    )}
                  >
                    Batal
                  </Link>
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || isDeleting || isProcessingPhoto}
                  className="min-h-[44px] h-11 w-full sm:w-auto font-semibold"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2
                        className="size-4 animate-spin motion-reduce:animate-none"
                        aria-hidden
                      />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>Simpan Menu</span>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </form>

      {/* Dialog Konfirmasi Hapus Lunak */}
      <Dialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          if (!isDeleting) {
            setIsDeleteDialogOpen(open);
            if (!open) setDeleteError(null);
          }
        }}
      >
        <DialogContent showCloseButton={!isDeleting} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-danger flex items-center gap-2">
              <Trash2 className="size-5 shrink-0" aria-hidden />
              <span>Hapus Menu</span>
            </DialogTitle>
            <DialogDescription className="text-ink-700 pt-2 leading-relaxed">
              Hapus menu ini? Menu akan disembunyikan dari pelanggan, namun
              riwayat pesanan terdahulu tetap tersimpan.
            </DialogDescription>
          </DialogHeader>

          {deleteError && (
            <div
              role="alert"
              className="rounded-lg bg-danger/10 border border-danger/20 p-3 text-xs text-danger flex items-center gap-2"
            >
              <AlertCircle className="size-4 shrink-0" aria-hidden />
              <span>{deleteError}</span>
            </div>
          )}

          <DialogFooter className="mt-4 gap-2 sm:gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setDeleteError(null);
              }}
              disabled={isDeleting}
              className="min-h-[44px] h-11 w-full sm:w-auto"
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
              className="min-h-[44px] h-11 w-full sm:w-auto"
            >
              {isDeleting ? (
                <>
                  <Loader2
                    className="size-4 animate-spin motion-reduce:animate-none"
                    aria-hidden
                  />
                  <span>Menghapus...</span>
                </>
              ) : (
                <span>Hapus Menu</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PhotoCropDialog
        isOpen={isCropDialogOpen}
        onClose={() => setIsCropDialogOpen(false)}
        file={cropFile}
        onApply={handleApplyCrop}
      />
    </>
  );
}
