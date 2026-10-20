"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Loader2,
  QrCode,
  Store,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatRupiah } from "@/lib/format";
import { updateStoreSettingsSchema } from "@/lib/admin-settings";
import {
  compressQrisPhoto,
  validateImageFile,
} from "@/lib/image-compression";
import { getQrisImageUrl, saveStoreSettingsWithQrisCleanup } from "@/lib/storage";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export interface StoreSettingsData {
  store_name: string;
  tagline: string | null;
  whatsapp_number: string;
  dos_price: number;
  qris_image_path: string | null;
  is_open?: boolean;
}

export interface StoreSettingsFormProps {
  initialSettings: StoreSettingsData;
}

export function StoreSettingsForm({ initialSettings }: StoreSettingsFormProps) {
  const router = useRouter();

  const [storeName, setStoreName] = React.useState<string>(
    initialSettings.store_name ?? ""
  );
  const [tagline, setTagline] = React.useState<string>(
    initialSettings.tagline ?? ""
  );
  const [whatsappNumber, setWhatsappNumber] = React.useState<string>(
    initialSettings.whatsapp_number ?? ""
  );
  const [dosPrice, setDosPrice] = React.useState<string>(
    initialSettings.dos_price !== undefined
      ? String(initialSettings.dos_price)
      : "2000"
  );
  const [currentQrisPath, setCurrentQrisPath] = React.useState<string | null>(
    initialSettings.qris_image_path ?? null
  );

  const [compressedBlob, setCompressedBlob] = React.useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(() =>
    getQrisImageUrl(initialSettings.qris_image_path)
  );
  const [selectedFileName, setSelectedFileName] = React.useState<string | null>(
    null
  );

  const [isProcessingImage, setIsProcessingImage] = React.useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [errors, setErrors] = React.useState<Record<string, string | undefined>>({});
  const [photoError, setPhotoError] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Bersihkan object URL saat unmount untuk mencegah memory leak
  React.useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Pratinjau format Rupiah dinamis saat input harga paket dos valid
  const previewDosPrice = React.useMemo(() => {
    const trimmed = dosPrice.trim();
    if (!trimmed || !/^\d+$/.test(trimmed)) return null;
    const num = parseInt(trimmed, 10);
    if (isNaN(num) || num < 0) return null;
    return num;
  }, [dosPrice]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoError(null);
    setSuccessMessage(null);

    const validation = validateImageFile(file);
    if (!validation.valid) {
      setPhotoError(validation.error || "File gambar tidak valid.");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setIsProcessingImage(true);
    try {
      const blob = await compressQrisPhoto(file);
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
      const objectUrl = URL.createObjectURL(blob);
      setCompressedBlob(blob);
      setPreviewUrl(objectUrl);
      setSelectedFileName(file.name);
      setPhotoError(null);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Gagal memproses gambar QRIS.";
      setPhotoError(msg);
    } finally {
      setIsProcessingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveImage = () => {
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setCompressedBlob(null);
    setPreviewUrl(null);
    setCurrentQrisPath(null);
    setSelectedFileName(null);
    setPhotoError(null);
    setSuccessMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);
    setErrors({});

    const parsedPrice =
      dosPrice.trim() === "" ? NaN : Number(dosPrice.trim());

    const rawPayload = {
      store_name: storeName.trim(),
      tagline: tagline.trim() === "" ? null : tagline.trim(),
      whatsapp_number: whatsappNumber.trim(),
      dos_price: parsedPrice,
      qris_image_path: currentQrisPath ?? null,
    };

    const validation = updateStoreSettingsSchema.safeParse(rawPayload);
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of validation.error.issues) {
        const field = String(issue.path[0]);
        if (field && !fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    const validData = validation.data;
    setIsSubmitting(true);

    const supabase = createBrowserSupabaseClient();

    try {
      const result = await saveStoreSettingsWithQrisCleanup({
        storage: supabase.storage,
        compressedBlob,
        payload: {
          store_name: validData.store_name,
          tagline: validData.tagline,
          whatsapp_number: validData.whatsapp_number,
          dos_price: validData.dos_price,
          qris_image_path: currentQrisPath,
        },
        isReferenced: async (path: string) => {
          const { data, error } = await supabase
            .from("settings")
            .select("qris_image_path")
            .eq("id", 1)
            .maybeSingle();
          if (error) {
            throw new Error(error.message);
          }
          return data?.qris_image_path === path;
        },
      });

      if (!result.success) {
        throw new Error(result.error || "Gagal menyimpan pengaturan toko.");
      }

      if (result.uploadedPath) {
        setCurrentQrisPath(result.uploadedPath);
        setCompressedBlob(null);
        setSelectedFileName(null);
        const permanentUrl = getQrisImageUrl(result.uploadedPath);
        if (permanentUrl) {
          if (previewUrl && previewUrl.startsWith("blob:")) {
            URL.revokeObjectURL(previewUrl);
          }
          setPreviewUrl(permanentUrl);
        }
      } else if (currentQrisPath === null) {
        setCurrentQrisPath(null);
        setCompressedBlob(null);
        setSelectedFileName(null);
      }

      setSuccessMessage("Pengaturan toko berhasil disimpan.");
      router.refresh();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Gagal menyimpan pengaturan toko.";
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-line bg-card p-4 sm:p-6 shadow-xs">
      <div className="border-b border-line pb-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-cream-100 text-green-800">
            <Store className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-ink-900">
              Profil & Pengaturan Toko
            </h2>
            <p className="text-xs text-ink-600">
              Informasi warung, kontak WhatsApp pelanggan, harga dos, dan foto QRIS pembayaran.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        {submitError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger-bg p-3.5 text-sm font-medium text-danger"
          >
            <AlertCircle className="size-5 shrink-0 mt-0.5" aria-hidden="true" />
            <span className="leading-snug">{submitError}</span>
          </div>
        )}

        {successMessage && (
          <div
            role="status"
            className="flex items-start gap-2.5 rounded-lg border border-green-700/30 bg-green-100/50 p-3.5 text-sm font-medium text-green-900"
          >
            <CheckCircle2
              className="size-5 shrink-0 mt-0.5 text-green-700"
              aria-hidden="true"
            />
            <span className="leading-snug">{successMessage}</span>
          </div>
        )}

        {/* Nama Toko */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="settings-store-name"
              className="text-sm font-semibold text-ink-900"
            >
              Nama Toko <span className="text-danger">*</span>
            </label>
            <span className="text-xs text-ink-500">{storeName.length}/100</span>
          </div>
          <Input
            id="settings-store-name"
            name="store_name"
            type="text"
            maxLength={100}
            value={storeName}
            onChange={(e) => {
              setStoreName(e.target.value);
              if (errors.store_name) {
                setErrors((prev) => ({ ...prev, store_name: undefined }));
              }
            }}
            placeholder="Rumah Makan Sipil"
            disabled={isSubmitting}
            aria-invalid={!!errors.store_name}
            aria-describedby={errors.store_name ? "store-name-error" : undefined}
            className={cn(
              "min-h-[44px]",
              errors.store_name && "border-danger ring-3 ring-danger/10"
            )}
          />
          {errors.store_name && (
            <p
              id="store-name-error"
              role="alert"
              className="text-xs text-danger font-medium flex items-center gap-1"
            >
              <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
              {errors.store_name}
            </p>
          )}
        </div>

        {/* Tagline Toko */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="settings-tagline"
              className="text-sm font-semibold text-ink-900"
            >
              Tagline Toko{" "}
              <span className="text-xs font-normal text-ink-500">(Opsional)</span>
            </label>
            <span className="text-xs text-ink-500">{tagline.length}/150</span>
          </div>
          <Input
            id="settings-tagline"
            name="tagline"
            type="text"
            maxLength={150}
            value={tagline}
            onChange={(e) => {
              setTagline(e.target.value);
              if (errors.tagline) {
                setErrors((prev) => ({ ...prev, tagline: undefined }));
              }
            }}
            placeholder="Spesialis Masakan Rumahan & Ikan Bakar Khas Manado"
            disabled={isSubmitting}
            aria-invalid={!!errors.tagline}
            aria-describedby={errors.tagline ? "tagline-error" : undefined}
            className={cn(
              "min-h-[44px]",
              errors.tagline && "border-danger ring-3 ring-danger/10"
            )}
          />
          {errors.tagline && (
            <p
              id="tagline-error"
              role="alert"
              className="text-xs text-danger font-medium flex items-center gap-1"
            >
              <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
              {errors.tagline}
            </p>
          )}
        </div>

        {/* Nomor WhatsApp */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="settings-whatsapp"
            className="text-sm font-semibold text-ink-900"
          >
            Nomor WhatsApp <span className="text-danger">*</span>
          </label>
          <Input
            id="settings-whatsapp"
            name="whatsapp_number"
            type="tel"
            inputMode="numeric"
            value={whatsappNumber}
            onChange={(e) => {
              setWhatsappNumber(e.target.value);
              if (errors.whatsapp_number) {
                setErrors((prev) => ({ ...prev, whatsapp_number: undefined }));
              }
            }}
            placeholder="62895806567230"
            disabled={isSubmitting}
            aria-invalid={!!errors.whatsapp_number}
            aria-describedby={
              errors.whatsapp_number ? "whatsapp-error" : "whatsapp-guide"
            }
            className={cn(
              "min-h-[44px]",
              errors.whatsapp_number && "border-danger ring-3 ring-danger/10"
            )}
          />
          <p id="whatsapp-guide" className="text-xs text-ink-600">
            Gunakan awalan 62 tanpa tanda + atau spasi, contoh: 62895806567230
          </p>
          {errors.whatsapp_number && (
            <p
              id="whatsapp-error"
              role="alert"
              className="text-xs text-danger font-medium flex items-center gap-1"
            >
              <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
              {errors.whatsapp_number}
            </p>
          )}
        </div>

        {/* Harga Paket Dos */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="settings-dos-price"
              className="text-sm font-semibold text-ink-900"
            >
              Harga Paket Dos (Rupiah) <span className="text-danger">*</span>
            </label>
            {previewDosPrice !== null && (
              <span className="text-xs font-semibold text-brown-700">
                {formatRupiah(previewDosPrice)}
              </span>
            )}
          </div>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
              <span className="text-sm font-semibold text-ink-500">Rp</span>
            </div>
            <Input
              id="settings-dos-price"
              name="dos_price"
              type="number"
              min={0}
              step={100}
              value={dosPrice}
              onChange={(e) => {
                setDosPrice(e.target.value);
                if (errors.dos_price) {
                  setErrors((prev) => ({ ...prev, dos_price: undefined }));
                }
              }}
              placeholder="2000"
              disabled={isSubmitting}
              aria-invalid={!!errors.dos_price}
              aria-describedby={
                errors.dos_price ? "dos-price-error" : "dos-price-help"
              }
              className={cn(
                "min-h-[44px] pl-11",
                errors.dos_price && "border-danger ring-3 ring-danger/10"
              )}
            />
          </div>
          <p id="dos-price-help" className="text-xs text-ink-600">
            Biaya tambahan per pesanan untuk tipe bungkus atau dos.
          </p>
          {errors.dos_price && (
            <p
              id="dos-price-error"
              role="alert"
              className="text-xs text-danger font-medium flex items-center gap-1"
            >
              <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
              {errors.dos_price}
            </p>
          )}
        </div>

        {/* Uploader QRIS */}
        <div className="flex flex-col gap-2 pt-2 border-t border-line">
          <div>
            <span className="text-sm font-semibold text-ink-900">
              Foto Kode QRIS Toko
            </span>
            <p className="text-xs text-ink-600">
              Format JPG, PNG, atau WebP, maks. 5 MB. Aspek rasio gambar asli dipertahankan tanpa terpotong agar kode QRIS mudah dipindai.
            </p>
          </div>

          <input
            id="qris-image-input"
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={isSubmitting || isProcessingImage}
            onChange={handleFileChange}
          />

          {photoError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-bg p-3 text-xs font-medium text-danger max-w-sm mx-auto"
            >
              <AlertCircle className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{photoError}</span>
            </div>
          )}

          {previewUrl ? (
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Pratinjau gambar QRIS pembayaran"
                  className="object-contain max-h-[260px] w-auto mx-auto rounded-lg border border-line bg-white p-2 shadow-xs"
                />
                {isProcessingImage && (
                  <div className="absolute inset-0 bg-ink-900/60 rounded-lg flex flex-col items-center justify-center gap-2 text-white p-4">
                    <Loader2
                      className="size-6 animate-spin motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                    <span className="text-xs font-semibold">
                      Memproses gambar...
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <label
                  htmlFor="qris-image-input"
                  className={cn(
                    "inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-md border border-line bg-card px-4 py-2 text-sm font-semibold text-ink-900 shadow-xs transition-all hover:bg-cream-100 focus-within:ring-2 focus-within:ring-green-700 active:scale-[0.98]",
                    (isSubmitting || isProcessingImage) &&
                      "pointer-events-none opacity-50"
                  )}
                >
                  <Camera className="size-4 shrink-0" aria-hidden="true" />
                  <span>Ganti Gambar</span>
                </label>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleRemoveImage}
                  disabled={isSubmitting || isProcessingImage}
                  className="min-h-[44px] gap-2 text-danger hover:bg-danger-bg/40 hover:text-danger focus-visible:ring-danger"
                >
                  <Trash2 className="size-4 shrink-0" aria-hidden="true" />
                  <span>Hapus Gambar</span>
                </Button>
              </div>

              {selectedFileName && (
                <p className="text-xs text-ink-500 truncate max-w-xs text-center">
                  Gambar baru: {selectedFileName}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-line bg-cream-50/60 p-6 text-center max-w-sm mx-auto gap-3 my-2 w-full">
              <div className="flex size-14 items-center justify-center rounded-full bg-cream-100 text-ink-500">
                <QrCode className="size-8" aria-hidden="true" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-ink-900">
                  Belum ada gambar QRIS
                </p>
                <p className="text-xs text-ink-600 max-w-xs">
                  Unggah gambar kode QRIS untuk ditampilkan kepada pelanggan saat pembayaran QRIS.
                </p>
              </div>

              {isProcessingImage ? (
                <div className="flex items-center gap-2 text-ink-700 min-h-[44px]">
                  <Loader2
                    className="size-5 animate-spin text-green-700 motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                  <span className="text-sm font-semibold">Memproses gambar...</span>
                </div>
              ) : (
                <label
                  htmlFor="qris-image-input"
                  className={cn(
                    "inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-md border border-line bg-card px-4 py-2 text-sm font-semibold text-ink-900 shadow-xs transition-all hover:bg-cream-100 focus-within:ring-2 focus-within:ring-green-700 active:scale-[0.98]",
                    (isSubmitting || isProcessingImage) &&
                      "pointer-events-none opacity-50"
                  )}
                >
                  <UploadCloud className="size-4 shrink-0" aria-hidden="true" />
                  <span>Pilih Gambar QRIS</span>
                </label>
              )}
            </div>
          )}
        </div>

        {/* Tombol Simpan */}
        <div className="flex justify-end pt-3 border-t border-line">
          <Button
            type="submit"
            disabled={isSubmitting || isProcessingImage}
            className="min-h-[44px] min-w-[170px] gap-2 font-bold"
          >
            {isSubmitting ? (
              <>
                <Loader2
                  className="size-4 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
                <span>Menyimpan...</span>
              </>
            ) : (
              <span>Simpan Pengaturan</span>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
