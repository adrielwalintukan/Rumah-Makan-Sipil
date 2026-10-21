"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  AdminOrder,
  OrderStatus,
  PaymentStatus,
} from "@/lib/admin-orders";
import { formatDailyNumber, formatRupiah } from "@/lib/format";
import { OrderDetailSheet } from "./order-detail-sheet";
import {
  AlertCircle,
  BadgeCheck,
  Ban,
  Check,
  CheckCircle2,
  Clock,
  Flame,
  Inbox,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  Utensils,
} from "lucide-react";

export interface HistoryOrderListProps {
  orders: AdminOrder[];
  onSelectOrder?: (order: AdminOrder) => void;
}

/**
 * Format tanggal dan jam ringkas untuk kartu arsip riwayat (WITA).
 * Contoh: "21 Okt, 12:29 WITA"
 */
export function formatHistoryCardTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return (
      new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Makassar",
        day: "numeric",
        month: "short",
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
 * Merangkum jumlah total item dan nama-nama item pesanan untuk tampilan kartu.
 * Contoh: "2 item: Cotto Ayam (Mie), Teh Manis"
 */
export function formatItemsSummary(items: AdminOrder["order_items"]): string {
  if (!items || items.length === 0) return "Tidak ada item";
  const totalQty = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const names = items.map((i) => i.name).join(", ");
  return `${totalQty} item: ${names}`;
}

export function HistoryOrderList({
  orders,
  onSelectOrder,
}: HistoryOrderListProps) {
  const router = useRouter();
  const [internalSelectedOrder, setInternalSelectedOrder] =
    React.useState<AdminOrder | null>(null);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);

  const handleSelect = (order: AdminOrder) => {
    if (onSelectOrder) {
      onSelectOrder(order);
    } else {
      setInternalSelectedOrder(order);
      setIsSheetOpen(true);
    }
  };

  const renderOrderStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case "baru":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-900 border border-blue-200">
            <Sparkles className="size-3" aria-hidden />
            <span>Baru</span>
          </span>
        );
      case "dimasak":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 border border-amber-300">
            <Flame className="size-3" aria-hidden />
            <span>Dimasak</span>
          </span>
        );
      case "siap":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-900 border border-purple-200">
            <CheckCircle2 className="size-3" aria-hidden />
            <span>Siap</span>
          </span>
        );
      case "selesai":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-900 border border-green-200">
            <Check className="size-3" aria-hidden />
            <span>Selesai</span>
          </span>
        );
      case "batal":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-danger-bg px-2 py-0.5 text-xs font-semibold text-danger border border-danger/30">
            <Ban className="size-3" aria-hidden />
            <span>Batal</span>
          </span>
        );
    }
  };

  const renderPaymentStatusBadge = (status: PaymentStatus) => {
    switch (status) {
      case "lunas":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-900 border border-green-200">
            <BadgeCheck className="size-3" aria-hidden />
            <span>Lunas</span>
          </span>
        );
      case "menunggu_verifikasi":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 border border-amber-300">
            <Clock className="size-3" aria-hidden />
            <span>Verifikasi</span>
          </span>
        );
      case "belum_bayar":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-danger-bg px-2 py-0.5 text-xs font-semibold text-danger border border-danger/30">
            <AlertCircle className="size-3" aria-hidden />
            <span>Belum Bayar</span>
          </span>
        );
    }
  };

  if (!orders || orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-line bg-card p-8 sm:p-12 text-center shadow-xs">
        <div className="flex size-14 items-center justify-center rounded-full bg-cream-100 text-ink-500 mb-4">
          <Inbox className="size-7" aria-hidden />
        </div>
        <h3 className="font-display text-lg font-bold text-ink-900">
          Tidak ada pesanan ditemukan
        </h3>
        <p className="mt-1.5 max-w-sm text-sm text-ink-600">
          Tidak ada data riwayat pesanan yang cocok dengan filter atau kata kunci saat ini.
        </p>
        <div className="mt-6">
          <Link
            href="/admin/riwayat"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-lg bg-green-700 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-green-600 transition-colors"
          >
            <RotateCcw className="size-4 shrink-0" aria-hidden />
            <span>Reset ke Hari Ini</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {orders.map((order) => {
          const isDineIn = order.order_type === "dine_in";
          const dailyNum = formatDailyNumber(order.daily_number);
          const timeFormatted = formatHistoryCardTime(order.created_at);
          const itemsSummary = formatItemsSummary(order.order_items);

          return (
            <button
              key={order.id}
              type="button"
              onClick={() => handleSelect(order)}
              className="group flex flex-col gap-3 rounded-xl border border-line bg-card p-4 text-left shadow-xs transition-colors hover:border-green-700/40 hover:bg-cream-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700 min-h-[44px] cursor-pointer"
            >
              {/* Baris Atas: Nomor Antrean, Waktu Pemesanan, Tipe Pesanan */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-display text-lg sm:text-xl font-bold text-green-900 group-hover:text-green-700">
                    {dailyNum}
                  </span>
                  <span className="text-xs text-ink-500 font-medium">
                    {timeFormatted}
                  </span>
                </div>

                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    isDineIn
                      ? "bg-cream-100 text-ink-800 border border-line"
                      : "bg-brown-100 text-brown-900 border border-brown-200"
                  }`}
                >
                  {isDineIn ? (
                    <>
                      <Utensils className="size-3" aria-hidden />
                      <span>Makan di Sini</span>
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="size-3" aria-hidden />
                      <span>Bungkus</span>
                    </>
                  )}
                </span>
              </div>

              {/* Baris Tengah: Nama Pelanggan & Ringkasan Item */}
              <div>
                <p className="font-semibold text-ink-900 group-hover:text-green-900 transition-colors">
                  {order.customer_name}
                </p>
                <p className="mt-0.5 text-xs text-ink-600 line-clamp-1">
                  {itemsSummary}
                </p>
              </div>

              {/* Baris Bawah: Total Rupiah & Badge Status */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-2.5">
                <span className="font-display text-base font-bold text-ink-900 tabular-nums">
                  {formatRupiah(order.total)}
                </span>

                <div className="flex items-center gap-1.5">
                  {renderOrderStatusBadge(order.status)}
                  {renderPaymentStatusBadge(order.payment_status)}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Sheet Detail Pesanan (aktif jika onSelectOrder tidak di-pass dari luar) */}
      {!onSelectOrder && (
        <OrderDetailSheet
          order={internalSelectedOrder}
          isOpen={isSheetOpen}
          onClose={() => {
            setIsSheetOpen(false);
          }}
          onOrderUpdated={() => {
            if (internalSelectedOrder) {
              setInternalSelectedOrder((prev) =>
                prev ? { ...prev, payment_status: "lunas" } : null
              );
            }
            router.refresh();
          }}
        />
      )}
    </>
  );
}
