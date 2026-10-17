"use client";

import * as React from "react";
import {
  AlertCircle,
  BadgeCheck,
  Clock,
  ShoppingBag,
  Utensils,
} from "lucide-react";
import type { AdminOrder } from "@/lib/admin-orders";
import { formatDailyNumber, formatRelativeTime, formatRupiah } from "@/lib/format";

interface OrderCardProps {
  order: AdminOrder;
  isNew?: boolean;
}

export function OrderCard({ order, isNew }: OrderCardProps) {
  // Warna garis kiri 4px sesuai status pembayaran (design-system §6.6)
  const paymentBorderColor =
    order.payment_status === "lunas"
      ? "border-l-green-700"
      : order.payment_status === "menunggu_verifikasi"
        ? "border-l-amber-500"
        : "border-l-danger";

  const isDineIn = order.order_type === "dine_in";

  return (
    <div
      className={`flex flex-col rounded-xl border border-line bg-card shadow-xs transition-all border-l-4 ${paymentBorderColor} ${
        isNew ? "animate-pulse ring-2 ring-amber-400" : ""
      }`}
    >
      {/* Header Kartu: Nomor Antrean, Nama, Tipe Pesanan */}
      <div className="flex items-start justify-between gap-3 border-b border-line/60 p-4 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-display text-2xl font-bold text-green-900 tracking-tight">
              {formatDailyNumber(order.daily_number)}
            </span>
            <span className="font-display text-base font-bold text-ink-900 truncate max-w-[150px]">
              {order.customer_name}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-ink-500 mt-0.5">
            <Clock className="size-3.5" aria-hidden />
            <span>
              {formatRelativeTime(order.created_at)}
            </span>
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
    </div>
  );
}
