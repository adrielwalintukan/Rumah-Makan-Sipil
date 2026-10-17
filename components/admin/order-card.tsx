"use client";

import * as React from "react";
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  Ban,
  Check,
  Clock,
  DollarSign,
  Flame,
  Loader2,
  RotateCcw,
  ShoppingBag,
  Utensils,
} from "lucide-react";
import type { AdminOrder, AdminOrderAction } from "@/lib/admin-orders";
import { formatDailyNumber, formatRelativeTime, formatRupiah } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface OrderCardProps {
  order: AdminOrder;
  isNew?: boolean;
  onOrderUpdated?: (updatedOrder: AdminOrder) => void;
}

const PRESET_CANCEL_REASONS = [
  "Bahan habis",
  "Pelanggan membatalkan",
  "Pesanan iseng/fiktif",
  "Toko tutup",
];

export function OrderCard({ order, isNew, onOrderUpdated }: OrderCardProps) {
  const [loadingAction, setLoadingAction] = React.useState<AdminOrderAction | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  // Dialog Konfirmasi Pembatalan
  const [isCancelDialogOpen, setIsCancelDialogOpen] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState("");

  // Warna garis kiri 4px sesuai status pembayaran (design-system §6.6)
  const paymentBorderColor =
    order.payment_status === "lunas"
      ? "border-l-green-700"
      : order.payment_status === "menunggu_verifikasi"
        ? "border-l-amber-500"
        : "border-l-danger";

  const isDineIn = order.order_type === "dine_in";
  const dailyNum = formatDailyNumber(order.daily_number);

  const handleAction = async (action: AdminOrderAction, reason?: string) => {
    setActionError(null);
    setLoadingAction(action);

    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          cancel_reason: reason || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal memproses aksi pesanan.");
      }

      if (data.order && onOrderUpdated) {
        onOrderUpdated(data.order);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan.";
      setActionError(msg);
    } finally {
      setLoadingAction(null);
      setIsCancelDialogOpen(false);
    }
  };

  const handleConfirmCancel = (e: React.FormEvent) => {
    e.preventDefault();
    handleAction("batal", cancelReason);
  };

  return (
    <div
      data-testid="admin-order-card"
      className={`flex flex-col rounded-xl border border-line bg-card shadow-xs transition-all border-l-4 ${paymentBorderColor} ${
        isNew ? "animate-pulse ring-2 ring-amber-400" : ""
      }`}
    >
      {/* Header Kartu: Nomor Antrean, Nama, Tipe Pesanan */}
      <div className="flex items-start justify-between gap-3 border-b border-line/60 p-4 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-display text-2xl font-bold text-green-900 tracking-tight">
              {dailyNum}
            </span>
            <span className="font-display text-base font-bold text-ink-900 truncate max-w-[150px]">
              {order.customer_name}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-ink-500 mt-0.5">
            <Clock className="size-3.5" aria-hidden />
            <span suppressHydrationWarning>{formatRelativeTime(order.created_at)}</span>
          </div>
        </div>

        {/* Tipe Pesanan (Makan di sini / Bungkus) */}
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
            isDineIn
              ? "bg-cream-100 text-ink-800 border border-line"
              : "bg-brown-100 text-brown-900 border border-brown-200"
          }`}
        >
          {isDineIn ? (
            <>
              <Utensils className="size-3.5" aria-hidden />
              <span>Makan di sini</span>
            </>
          ) : (
            <>
              <ShoppingBag className="size-3.5" aria-hidden />
              <span>Bungkus</span>
            </>
          )}
        </span>
      </div>

      {/* Daftar Item Pesanan */}
      <div className="flex-1 p-4 py-3 space-y-2.5">
        {order.order_items && order.order_items.length > 0 ? (
          order.order_items.map((item) => {
            const hasOptions = item.options && item.options.length > 0;
            return (
              <div key={item.id} className="text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold text-ink-900">
                    <span className="text-green-800 font-bold mr-1.5">{item.quantity}×</span>
                    {item.name}
                  </span>
                  <span className="text-xs font-semibold text-ink-600 shrink-0">
                    {formatRupiah(item.subtotal)}
                  </span>
                </div>

                {/* Varian / Pilihan Tambahan */}
                {hasOptions && (
                  <p className="text-xs text-ink-600 pl-5 mt-0.5">
                    ({item.options!.map((o) => (o.price_delta > 0 ? `${o.name} +${formatRupiah(o.price_delta)}` : o.name)).join(", ")})
                  </p>
                )}

                {/* Catatan Item */}
                {item.note && (
                  <p className="text-xs italic text-brown-900 bg-brown-50 rounded px-2 py-0.5 mt-1 ml-5 inline-block">
                    &ldquo;{item.note}&rdquo;
                  </p>
                )}
              </div>
            );
          })
        ) : (
          <p className="text-xs text-ink-500 italic">Memuat item pesanan...</p>
        )}
      </div>

      {/* Footer Kartu: Total & Status Pembayaran */}
      <div className="border-t border-line/60 bg-cream-50/50 p-4 pt-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-[11px] font-semibold text-ink-500 uppercase tracking-wider block">
            Total
          </span>
          <span className="text-base font-bold text-brown-700">
            {formatRupiah(order.total)}
          </span>
        </div>

        {/* Badge Metode & Status Bayar */}
        <div className="flex items-center gap-1.5">
          <span className="rounded-md border border-line bg-card px-2 py-0.5 text-xs font-bold text-ink-700 uppercase">
            {order.payment_method === "qris" ? "QRIS" : "Cash"}
          </span>

          {order.payment_status === "lunas" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
              <BadgeCheck className="size-3.5" aria-hidden />
              <span>Lunas</span>
            </span>
          ) : order.payment_status === "menunggu_verifikasi" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
              <Clock className="size-3.5" aria-hidden />
              <span>Perlu Verifikasi</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-danger-bg px-2.5 py-0.5 text-xs font-semibold text-danger">
              <AlertCircle className="size-3.5" aria-hidden />
              <span>Belum Bayar</span>
            </span>
          )}
        </div>
      </div>

      {/* Banner Error Aksi (jika ada) */}
      {actionError && (
        <div className="mx-4 mb-2 p-2.5 rounded-lg bg-danger-bg border border-danger/30 text-xs text-danger font-medium flex items-center justify-between gap-2">
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-danger hover:underline text-[11px] shrink-0"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Baris Tombol Aksi Pesanan (M3: Issue #13) */}
      <div className="border-t border-line/60 bg-card p-3 flex flex-wrap items-center justify-between gap-2">
        {/* Sisi Kiri: Aksi Pembayaran & Pembatalan */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Tombol Tandai Lunas (tersedia selama belum lunas) */}
          {order.payment_status !== "lunas" && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => handleAction("tandai_lunas")}
              disabled={loadingAction !== null}
              className="h-9 min-h-[36px] text-xs font-bold border-green-700/30 bg-green-50 text-green-800 hover:bg-green-100"
            >
              {loadingAction === "tandai_lunas" ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <DollarSign className="size-3.5 text-green-700" aria-hidden />
              )}
              <span>Tandai Lunas</span>
            </Button>
          )}

          {/* Tombol Tolak Bayar / Pembayaran Belum Masuk (khusus saat menunggu_verifikasi) */}
          {order.payment_status === "menunggu_verifikasi" && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => handleAction("pembayaran_belum_masuk")}
              disabled={loadingAction !== null}
              title="Kembalikan status bayar ke Belum Bayar jika uang belum masuk"
              className="h-9 min-h-[36px] text-xs font-medium border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
            >
              {loadingAction === "pembayaran_belum_masuk" ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <RotateCcw className="size-3.5 text-amber-700" aria-hidden />
              )}
              <span>Belum Masuk</span>
            </Button>
          )}

          {/* Tombol Batal (tersedia selama belum selesai & belum batal) */}
          {order.status !== "selesai" && order.status !== "batal" && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setCancelReason("");
                setIsCancelDialogOpen(true);
              }}
              disabled={loadingAction !== null}
              className="h-9 min-h-[36px] text-xs text-ink-500 hover:text-danger hover:bg-danger-bg"
            >
              <Ban className="size-3.5" aria-hidden />
              <span>Batal</span>
            </Button>
          )}
        </div>

        {/* Sisi Kanan: Tombol Utama Alur Masak (Mulai Masak → Siap → Selesai) */}
        <div>
          {order.status === "baru" && (
            <Button
              type="button"
              size="sm"
              onClick={() => handleAction("mulai_masak")}
              disabled={loadingAction !== null}
              className="h-9 min-h-[36px] text-xs font-bold bg-green-700 text-white hover:bg-green-800 shadow-xs"
            >
              {loadingAction === "mulai_masak" ? (
                <Loader2 className="size-3.5 animate-spin mr-1" aria-hidden />
              ) : (
                <Flame className="size-3.5 mr-1 text-amber-200" aria-hidden />
              )}
              <span>Mulai Masak</span>
              <ArrowRight className="size-3.5 ml-1" aria-hidden />
            </Button>
          )}

          {order.status === "dimasak" && (
            <Button
              type="button"
              size="sm"
              onClick={() => handleAction("siap")}
              disabled={loadingAction !== null}
              className="h-9 min-h-[36px] text-xs font-bold bg-green-700 text-white hover:bg-green-800 shadow-xs"
            >
              {loadingAction === "siap" ? (
                <Loader2 className="size-3.5 animate-spin mr-1" aria-hidden />
              ) : (
                <Check className="size-3.5 mr-1" aria-hidden />
              )}
              <span>Siap Diambil</span>
              <ArrowRight className="size-3.5 ml-1" aria-hidden />
            </Button>
          )}

          {order.status === "siap" && (
            <Button
              type="button"
              size="sm"
              onClick={() => handleAction("selesai")}
              disabled={loadingAction !== null}
              className="h-9 min-h-[36px] text-xs font-bold bg-green-700 text-white hover:bg-green-800 shadow-xs"
            >
              {loadingAction === "selesai" ? (
                <Loader2 className="size-3.5 animate-spin mr-1" aria-hidden />
              ) : (
                <Check className="size-3.5 mr-1" aria-hidden />
              )}
              <span>Selesai</span>
            </Button>
          )}
        </div>
      </div>

      {/* Dialog Konfirmasi Pembatalan Pesanan */}
      <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleConfirmCancel} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Batalkan Pesanan {dailyNum}?</DialogTitle>
              <DialogDescription>
                Pesanan atas nama <strong>{order.customer_name}</strong> akan dibatalkan dan tidak dihitung dalam laporan keuangan.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <label htmlFor={`cancel-reason-${order.id}`} className="text-xs font-bold uppercase tracking-wider text-ink-700">
                Alasan Pembatalan (Opsional)
              </label>

              {/* Pilihan cepat alasan */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {PRESET_CANCEL_REASONS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setCancelReason(preset)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                      cancelReason === preset
                        ? "border-green-700 bg-green-50 text-green-900 font-bold"
                        : "border-line bg-card text-ink-700 hover:bg-cream-100"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <input
                id={`cancel-reason-${order.id}`}
                type="text"
                maxLength={200}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Misal: Bahan baku ayam habis..."
                className="h-10 w-full rounded-md border border-line bg-card px-3 text-sm text-ink-900 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-100"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCancelDialogOpen(false)}
                disabled={loadingAction === "batal"}
              >
                Kembali
              </Button>
              <Button
                type="submit"
                variant="destructive"
                size="sm"
                disabled={loadingAction === "batal"}
                className="bg-danger hover:bg-danger/90 text-white font-bold"
              >
                {loadingAction === "batal" ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin mr-1.5" />
                    <span>Membatalkan...</span>
                  </>
                ) : (
                  <span>Ya, Batalkan Pesanan</span>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
