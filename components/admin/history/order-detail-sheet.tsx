"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type {
  AdminOrder,
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
} from "@/lib/admin-orders";
import { formatDailyNumber, formatRupiah } from "@/lib/format";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  AlertCircle,
  BadgeCheck,
  Ban,
  Check,
  CheckCircle2,
  Clock,
  DollarSign,
  Flame,
  Loader2,
  MessageCircle,
  ShoppingBag,
  Sparkles,
  Utensils,
  User,
  Phone,
} from "lucide-react";

export interface OrderDetailSheetProps {
  order: AdminOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onOrderUpdated?: () => void;
}

/**
 * Format tanggal dan waktu ke standar WITA (Asia/Makassar) tanpa em dash.
 * Contoh: "Rabu, 21 Okt 2026, 12:29 WITA"
 */
export function formatWitaDateTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return (
      new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Makassar",
        weekday: "long",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
        .format(date)
        .replace(".", ":") + " WITA"
    );
  } catch {
    return dateString;
  }
}

/**
 * Normalisasi nomor WhatsApp format internasional Indonesia (62...).
 * Mengembalikan null jika digit nomor tidak memenuhi panjang valid.
 */
export function getWhatsAppUrl(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  let normalized = digits;
  if (normalized.startsWith("0")) {
    normalized = "62" + normalized.slice(1);
  } else if (normalized.startsWith("8")) {
    normalized = "62" + normalized;
  }
  if (normalized.length < 10) return null;
  return `https://wa.me/${normalized}`;
}

export function OrderDetailSheet({
  order,
  isOpen,
  onClose,
  onOrderUpdated,
}: OrderDetailSheetProps) {
  const router = useRouter();
  const isDesktop = useMediaQuery("(min-width: 768px)", false);

  const [prevOrder, setPrevOrder] = React.useState(order);
  const [currentOrder, setCurrentOrder] = React.useState<AdminOrder | null>(order);
  const [isMutating, setIsMutating] = React.useState(false);
  const [mutationError, setMutationError] = React.useState<string | null>(null);

  // Sinkronkan state lokal saat prop order berubah tanpa memicu cascading renders di useEffect
  if (order !== prevOrder) {
    setPrevOrder(order);
    setCurrentOrder(order);
    setMutationError(null);
  }

  // Order yang sedang aktif dirender (fallback ke state lokal saat transisi sheet tutup)
  const activeOrder = currentOrder || order;

  const handleMarkPaid = async () => {
    if (!activeOrder) return;
    setIsMutating(true);
    setMutationError(null);

    try {
      const res = await fetch(`/api/admin/orders/${activeOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "tandai_lunas" }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal memperbarui status pembayaran.");
      }

      if (data.order) {
        setCurrentOrder((prev) =>
          prev ? { ...prev, ...data.order, order_items: prev.order_items } : data.order
        );
      } else {
        setCurrentOrder((prev) =>
          prev ? { ...prev, payment_status: "lunas" } : null
        );
      }

      onOrderUpdated?.();
      router.refresh();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Terjadi kesalahan saat memproses.";
      setMutationError(msg);
    } finally {
      setIsMutating(false);
    }
  };

  const renderOrderStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case "baru":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-900 border border-blue-200">
            <Sparkles className="size-3.5" aria-hidden />
            <span>Baru</span>
          </span>
        );
      case "dimasak":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900 border border-amber-300">
            <Flame className="size-3.5" aria-hidden />
            <span>Sedang Dimasak</span>
          </span>
        );
      case "siap":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-2.5 py-1 text-xs font-semibold text-purple-900 border border-purple-200">
            <CheckCircle2 className="size-3.5" aria-hidden />
            <span>Siap Diambil</span>
          </span>
        );
      case "selesai":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-900 border border-green-200">
            <Check className="size-3.5" aria-hidden />
            <span>Selesai</span>
          </span>
        );
      case "batal":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-bg px-2.5 py-1 text-xs font-semibold text-danger border border-danger/30">
            <Ban className="size-3.5" aria-hidden />
            <span>Dibatalkan</span>
          </span>
        );
    }
  };

  const renderPaymentStatusBadge = (status: PaymentStatus) => {
    switch (status) {
      case "lunas":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-900 border border-green-200">
            <BadgeCheck className="size-3.5" aria-hidden />
            <span>Lunas</span>
          </span>
        );
      case "menunggu_verifikasi":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900 border border-amber-300">
            <Clock className="size-3.5" aria-hidden />
            <span>Menunggu Verifikasi</span>
          </span>
        );
      case "belum_bayar":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-bg px-2.5 py-1 text-xs font-semibold text-danger border border-danger/30">
            <AlertCircle className="size-3.5" aria-hidden />
            <span>Belum Bayar</span>
          </span>
        );
    }
  };

  const renderPaymentMethodBadge = (method: PaymentMethod) => {
    return (
      <span className="rounded-md border border-line bg-card px-2.5 py-1 text-xs font-bold text-ink-700 uppercase">
        {method === "qris" ? "QRIS" : "Tunai (Cash)"}
      </span>
    );
  };

  if (!activeOrder) {
    return (
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          side={isDesktop ? "right" : "bottom"}
          className={
            isDesktop
              ? "sm:max-w-lg w-full h-full overflow-y-auto border-l border-line bg-card p-6 shadow-xl"
              : "max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-line bg-card p-6 shadow-xl"
          }
        >
          <SheetHeader className="text-left">
            <SheetTitle className="font-display text-xl font-bold text-ink-900">
              Detail Pesanan
            </SheetTitle>
            <SheetDescription className="text-sm text-ink-600">
              Tidak ada data pesanan yang dipilih.
            </SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    );
  }

  const isDineIn = activeOrder.order_type === "dine_in";
  const dailyNum = formatDailyNumber(activeOrder.daily_number);
  const waUrl = activeOrder.customer_phone
    ? getWhatsAppUrl(activeOrder.customer_phone)
    : null;
  const canMarkPaid =
    activeOrder.payment_status !== "lunas" && activeOrder.status !== "batal";

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={isDesktop ? "right" : "bottom"}
        className={
          isDesktop
            ? "sm:max-w-lg w-full h-full overflow-y-auto border-l border-line bg-card p-6 shadow-xl flex flex-col gap-5"
            : "max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-line bg-card p-5 sm:p-6 shadow-xl flex flex-col gap-5"
        }
      >
        {/* Header Drawer */}
        <SheetHeader className="text-left border-b border-line pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-display text-2xl font-bold text-green-900 tracking-tight">
                {dailyNum}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  isDineIn
                    ? "bg-cream-100 text-ink-800 border border-line"
                    : "bg-brown-100 text-brown-900 border border-brown-200"
                }`}
              >
                {isDineIn ? (
                  <>
                    <Utensils className="size-3.5" aria-hidden />
                    <span>Makan di Sini</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="size-3.5" aria-hidden />
                    <span>Bungkus</span>
                  </>
                )}
              </span>
            </div>
          </div>

          <SheetTitle className="sr-only">
            Detail Pesanan Antrean {dailyNum}
          </SheetTitle>

          <SheetDescription className="mt-1 text-xs text-ink-600">
            Dipesan pada {formatWitaDateTime(activeOrder.created_at)}
          </SheetDescription>
        </SheetHeader>

        {/* 1. Informasi Pelanggan */}
        <div className="space-y-2 rounded-xl border border-line bg-cream-50/50 p-3.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-ink-600">
            Informasi Pelanggan
          </h4>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <User className="size-4 text-ink-500 shrink-0" aria-hidden />
              <span className="font-semibold text-ink-900 text-sm">
                {activeOrder.customer_name}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-line/60">
              <div className="flex items-center gap-2 text-xs">
                <Phone className="size-3.5 text-ink-500 shrink-0" aria-hidden />
                {activeOrder.customer_phone ? (
                  <span className="font-medium text-ink-900">
                    {activeOrder.customer_phone}
                  </span>
                ) : (
                  <span className="text-ink-500 italic">
                    Tidak ada nomor telepon
                  </span>
                )}
              </div>

              {waUrl && (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] min-w-[44px] items-center gap-1.5 rounded-lg border border-line bg-card px-3 py-2 text-xs font-semibold text-green-800 hover:bg-cream-100 transition-colors"
                >
                  <MessageCircle className="size-4 text-green-700" aria-hidden />
                  <span>Chat WhatsApp</span>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* 2. Status Pesanan & Pembayaran */}
        <div className="space-y-2.5 rounded-xl border border-line bg-card p-3.5 shadow-xs">
          <h4 className="text-xs font-bold uppercase tracking-wider text-ink-600">
            Status & Pembayaran
          </h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-ink-500 block mb-1">Status Masak:</span>
              {renderOrderStatusBadge(activeOrder.status)}
            </div>
            <div>
              <span className="text-ink-500 block mb-1">Status Bayar:</span>
              {renderPaymentStatusBadge(activeOrder.payment_status)}
            </div>
            <div className="col-span-2 pt-1.5 border-t border-line/60 flex items-center justify-between">
              <span className="text-ink-500">Metode Bayar:</span>
              {renderPaymentMethodBadge(activeOrder.payment_method)}
            </div>
          </div>

          {/* Banner Alasan Pembatalan (Jika dibatalkan) */}
          {activeOrder.status === "batal" && (
            <div className="mt-2 rounded-lg border border-danger/30 bg-danger-bg/50 p-3 text-xs">
              <p className="font-semibold text-danger flex items-center gap-1.5">
                <Ban className="size-3.5 shrink-0" aria-hidden />
                <span>Alasan Pembatalan:</span>
              </p>
              <p className="mt-1 text-ink-800 font-medium">
                {activeOrder.cancel_reason ||
                  "Tidak ada catatan alasan pembatalan."}
              </p>
            </div>
          )}
        </div>

        {/* 3. Rincian Item Pesanan */}
        <div className="space-y-2.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-ink-600">
            Rincian Item ({activeOrder.order_items?.length ?? 0} jenis)
          </h4>
          <div className="divide-y divide-line/60 rounded-xl border border-line bg-card p-3 shadow-xs">
            {activeOrder.order_items && activeOrder.order_items.length > 0 ? (
              activeOrder.order_items.map((item) => {
                const hasOptions = item.options && item.options.length > 0;
                return (
                  <div
                    key={item.id}
                    className="py-2.5 first:pt-0 last:pb-0 space-y-1"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold text-ink-900">
                        <span className="font-bold text-green-800 mr-1.5">
                          {item.quantity}x
                        </span>
                        {item.name}
                      </span>
                      <span className="text-sm font-semibold text-ink-900 shrink-0 tabular-nums">
                        {formatRupiah(item.subtotal)}
                      </span>
                    </div>

                    {hasOptions && (
                      <ul className="pl-5 space-y-0.5 text-xs text-ink-600">
                        {item.options!.map((opt, idx) => (
                          <li key={idx}>
                            + {opt.name}
                            {opt.price_delta > 0
                              ? ` (${formatRupiah(opt.price_delta)})`
                              : ""}
                          </li>
                        ))}
                      </ul>
                    )}

                    {item.note && (
                      <div className="pl-5 pt-0.5">
                        <span className="inline-block rounded bg-amber-50 px-2 py-0.5 text-xs italic text-amber-900 border border-amber-200/60">
                          Catatan: &ldquo;{item.note}&rdquo;
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-ink-500 italic py-2">
                Tidak ada data rincian item.
              </p>
            )}
          </div>
        </div>

        {/* 4. Rincian Total Pesanan */}
        <div className="rounded-xl border border-line bg-cream-50 p-4 flex items-center justify-between">
          <span className="text-sm font-bold text-ink-700 uppercase tracking-wider">
            Total Pesanan
          </span>
          <span className="font-display text-2xl font-bold text-green-900 tabular-nums">
            {formatRupiah(activeOrder.total)}
          </span>
        </div>

        {/* Banner Error Mutasi */}
        {mutationError && (
          <div className="rounded-lg border border-danger/30 bg-danger-bg p-3 text-xs text-danger font-medium flex items-center justify-between gap-2">
            <span>{mutationError}</span>
            <button
              type="button"
              onClick={() => setMutationError(null)}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-danger font-semibold underline hover:no-underline shrink-0"
            >
              Tutup
            </button>
          </div>
        )}

        {/* Footer Sheet: Aksi Koreksi Tandai Lunas & Tutup */}
        <SheetFooter className="mt-auto pt-4 border-t border-line flex flex-col gap-2 sm:flex-row sm:justify-end">
          {canMarkPaid && (
            <button
              type="button"
              onClick={handleMarkPaid}
              disabled={isMutating}
              className="inline-flex min-h-[44px] min-w-[44px] w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-green-600 transition-colors disabled:opacity-50"
            >
              {isMutating ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <DollarSign className="size-4" aria-hidden />
                  <span>Tandai Lunas</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            data-testid="order-detail-close-button"
            className="inline-flex min-h-[44px] min-w-[44px] w-full sm:w-auto items-center justify-center rounded-lg border border-line bg-card px-4 py-2.5 text-sm font-semibold text-ink-700 hover:bg-cream-100 transition-colors"
          >
            Tutup
          </button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
