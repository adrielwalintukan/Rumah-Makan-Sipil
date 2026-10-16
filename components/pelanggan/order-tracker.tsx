"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  Check,
  CheckCircle2,
  Flame,
  UtensilsCrossed,
  XCircle,
} from "lucide-react";
import { PaymentCard } from "@/components/pelanggan/payment-card";
import { formatRupiah } from "@/lib/format";
import { addActiveOrder, removeActiveOrder } from "@/lib/orders-client";

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  subtotal: number;
  options?: Array<{ name: string }>;
  note?: string;
}

export interface OrderData {
  public_token: string;
  order_date: string;
  daily_number: number;
  customer_name: string;
  order_type: "dine_in" | "takeaway";
  payment_method: "qris" | "cash";
  payment_status: "belum_bayar" | "menunggu_verifikasi" | "lunas";
  status: "baru" | "dimasak" | "siap" | "selesai" | "batal";
  cancel_reason?: string | null;
  total: number;
  created_at: string;
  paid_at?: string | null;
  items?: OrderItem[];
}

export interface OrderTrackerProps {
  initialOrder: OrderData;
  qrisImageUrl: string | null;
}

export function OrderTracker({ initialOrder, qrisImageUrl }: OrderTrackerProps) {
  const [order, setOrder] = React.useState<OrderData>(initialOrder);
  const prevStatusRef = React.useRef(initialOrder.status);

  // Pastikan pesanan tersimpan di active_orders HP pelanggan (US-06)
  React.useEffect(() => {
    if (order.status !== "selesai" && order.status !== "batal") {
      addActiveOrder(order.public_token);
    } else {
      removeActiveOrder(order.public_token);
    }
  }, [order.public_token, order.status]);

  // Polling pembaruan status setiap 5 detik selama tab aktif
  // shortcut: polling, bukan realtime, karena pelanggan tidak punya sesi untuk RLS; ganti ke Realtime Broadcast jika beban polling terasa (docs/architecture.md §7).
  React.useEffect(() => {
    if (order.status === "selesai" || order.status === "batal") {
      return;
    }

    let isMounted = true;

    const fetchLatestOrder = async () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }

      try {
        const res = await fetch(`/api/orders/${order.public_token}`, {
          headers: { "Cache-Control": "no-cache" },
        });

        if (!res.ok) return;

        const data: OrderData = await res.json();
        if (!isMounted) return;

        // Picu getar bila status beralih menjadi siap (US-06)
        if (prevStatusRef.current !== "siap" && data.status === "siap") {
          if (typeof window !== "undefined" && "vibrate" in navigator) {
            try {
              navigator.vibrate([200, 100, 200]);
            } catch {
              // diabaikan bila ditolak oleh browser
            }
          }
        }

        prevStatusRef.current = data.status;
        setOrder(data);
      } catch {
        // Abaikan gangguan jaringan temporer
      }
    };

    const intervalId = setInterval(fetchLatestOrder, 5000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchLatestOrder();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [order.public_token, order.status]);

  const dailyNum = String(order.daily_number).padStart(3, "0");

  const cookStatusConfig = {
    baru: {
      label: "Menunggu Dimasak",
      icon: Bell,
      className: "border-line bg-cream-100 text-ink-700",
      description: "Pesanan kamu sudah diterima dan menunggu antrean masak.",
    },
    dimasak: {
      label: "Sedang Dimasak",
      icon: Flame,
      className: "border-warning/30 bg-warning-bg text-warning",
      description: "Koki sedang menyiapkan dan memasak pesanan kamu di dapur.",
    },
    siap: {
      label: "Pesanan Siap!",
      icon: CheckCircle2,
      className: "border-success/30 bg-success-bg text-success font-semibold",
      description: "Makanan sudah selesai dimasak dan siap diambil.",
    },
    selesai: {
      label: "Selesai",
      icon: Check,
      className: "border-line bg-cream-50 text-ink-600",
      description: "Pesanan telah selesai disajikan. Selamat menikmati makananmu!",
    },
    batal: {
      label: "Pesanan Dibatalkan",
      icon: XCircle,
      className: "border-danger/30 bg-danger-bg text-danger",
      description: "Pesanan ini telah dibatalkan oleh pihak warung.",
    },
  }[order.status] || {
    label: "Diproses",
    icon: Bell,
    className: "border-line bg-cream-100 text-ink-700",
    description: "Pesanan sedang diproses.",
  };

  const CookIcon = cookStatusConfig.icon;

  return (
    <div className="flex flex-col gap-5">
      {/* Tombol kembali & Judul */}
      <div className="flex items-center gap-2">
        <Link
          href="/"
          aria-label="Kembali ke menu"
          className="inline-flex size-11 items-center justify-center rounded-full hover:bg-accent"
        >
          <ArrowLeft className="size-5 text-ink-900" />
        </Link>
        <h1 className="font-display text-2xl font-bold text-green-900">Pesanan #{dailyNum}</h1>
      </div>

      {/* Region Status Dinamis dengan aria-live="polite" untuk Aksesibilitas (US-06, Design System §9) */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="flex flex-col gap-3"
      >
        {/* Banner Khusus saat Status Siap */}
        {order.status === "siap" && (
          <div
            data-testid="order-ready-banner"
            className="flex items-center gap-3 rounded-lg border border-success bg-success-bg p-4 text-ink-900 shadow-xs animate-in fade-in slide-in-from-top-1 duration-300"
          >
            <CheckCircle2 className="size-6 shrink-0 text-success" aria-hidden />
            <div>
              <p className="font-bold text-green-900 text-base">Pesanan kamu siap! Silakan ambil di kasir.</p>
              <p className="text-xs text-ink-600 mt-0.5">
                Sebutkan nomor antrean <strong className="text-green-900">#{dailyNum}</strong> saat mengambil makanan.
              </p>
            </div>
          </div>
        )}

        {/* Banner Khusus saat Status Batal */}
        {order.status === "batal" && (
          <div
            data-testid="order-cancelled-banner"
            className="flex items-start gap-3 rounded-lg border border-danger bg-danger-bg p-4 text-ink-900 shadow-xs"
          >
            <AlertCircle className="size-5 shrink-0 text-danger mt-0.5" aria-hidden />
            <div>
              <p className="font-bold text-danger text-base">Pesanan dibatalkan</p>
              {order.cancel_reason ? (
                <p className="text-xs text-ink-700 mt-1">
                  Alasan pembatalan: <strong className="font-semibold text-danger">{order.cancel_reason}</strong>
                </p>
              ) : (
                <p className="text-xs text-ink-600 mt-1">
                  Pesanan telah dibatalkan. Silakan hubungi kasir jika ada kendala.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Header Nomor Antrean Besar (Fraunces) */}
        <div className="flex flex-col items-center gap-2 rounded-lg border border-line bg-card p-6 text-center">
          <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-bold text-green-800">
            Pesanan Berhasil Dibuat!
          </span>

          <div className="mt-1 flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${cookStatusConfig.className}`}
            >
              <CookIcon className="size-3.5" aria-hidden />
              <span>{cookStatusConfig.label}</span>
            </span>
          </div>

          <span className="text-xs font-bold tracking-wider text-ink-600 uppercase mt-1">Nomor Antrean</span>
          <span className="font-display text-5xl font-bold text-green-900 tabular-nums">#{dailyNum}</span>

          <p className="text-sm font-semibold text-ink-900">
            Atas nama: <span className="text-green-900">{order.customer_name}</span>
          </p>

          <div className="mt-2 flex items-center gap-1.5 rounded-full bg-cream-50 px-3 py-1 text-xs font-medium text-ink-600 border border-line">
            <UtensilsCrossed className="size-3.5 text-green-700" aria-hidden />
            <span>{order.order_type === "dine_in" ? "Makan di sini" : "Bungkus (Takeaway)"}</span>
          </div>

          <p className="mt-2 text-xs text-ink-400 max-w-sm">
            {cookStatusConfig.description}
          </p>
        </div>
      </div>

      {/* Kartu Pembayaran: QRIS atau Cash */}
      <PaymentCard
        order={order}
        qrisImageUrl={qrisImageUrl}
        onPaymentStatusChange={(newStatus) => {
          setOrder((prev) => ({ ...prev, payment_status: newStatus }));
        }}
      />

      {/* Rincian Item Pesanan */}
      <div className="flex flex-col gap-3 rounded-lg border border-line bg-card p-4">
        <h2 className="text-sm font-bold tracking-wide text-ink-900 border-b border-line pb-2.5">
          RINCIAN PESANAN
        </h2>
        <ul className="divide-y divide-line/60">
          {Array.isArray(order.items) &&
            order.items.map((item) => (
              <li key={item.id} className="flex items-start justify-between py-2 text-sm">
                <div className="min-w-0 pr-2">
                  <p className="font-medium text-ink-900">
                    {item.quantity}x {item.name}
                  </p>
                  {Array.isArray(item.options) && item.options.length > 0 && (
                    <p className="text-xs text-ink-600">{item.options.map((o) => o.name).join(", ")}</p>
                  )}
                  {item.note && <p className="text-xs text-ink-600 italic">“{item.note}”</p>}
                </div>
                <span className="shrink-0 font-semibold text-ink-900 tabular-nums">
                  {formatRupiah(item.subtotal)}
                </span>
              </li>
            ))}
        </ul>

        <div className="mt-2 flex justify-between border-t border-line pt-2 text-base font-bold">
          <span className="text-ink-900">Total:</span>
          <span className="text-green-900 tabular-nums">{formatRupiah(order.total)}</span>
        </div>
      </div>
    </div>
  );
}
