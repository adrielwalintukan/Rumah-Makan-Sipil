"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Bell, CheckCircle2, Flame } from "lucide-react";
import { getActiveOrders, removeActiveOrder } from "@/lib/orders-client";

interface ActiveOrderSummary {
  public_token: string;
  daily_number: number;
  status: "baru" | "dimasak" | "siap" | "selesai" | "batal";
}

export function ActiveOrderBanner() {
  const [activeOrder, setActiveOrder] = React.useState<ActiveOrderSummary | null>(null);

  React.useEffect(() => {
    let isMounted = true;
    const tokens = getActiveOrders();
    if (tokens.length === 0) return;

    const token = tokens[0];

    async function checkActiveOrder() {
      try {
        const res = await fetch(`/api/orders/${token}`, {
          headers: { "Cache-Control": "no-cache" },
        });

        if (!res.ok) {
          // Token tidak valid atau 404, bersihkan dari active_orders
          removeActiveOrder(token);
          return;
        }

        const data = await res.json();
        if (!isMounted) return;

        // Jika pesanan sudah selesai atau dibatalkan, jangan tampilkan banner dan hapus dari active_orders
        if (data.status === "selesai" || data.status === "batal") {
          removeActiveOrder(token);
          setActiveOrder(null);
          return;
        }

        setActiveOrder({
          public_token: data.public_token,
          daily_number: data.daily_number,
          status: data.status,
        });
      } catch {
        // Abaikan bila ada gangguan jaringan sesaat
      }
    }

    checkActiveOrder();

    return () => {
      isMounted = false;
    };
  }, []);

  if (!activeOrder) return null;

  const dailyNum = String(activeOrder.daily_number).padStart(3, "0");

  const statusConfig = {
    baru: {
      label: "Menunggu dimasak",
      icon: Bell,
      badgeClass: "bg-cream-100 text-ink-600 border-line",
    },
    dimasak: {
      label: "Sedang dimasak",
      icon: Flame,
      badgeClass: "bg-warning-bg text-warning border-warning/30",
    },
    siap: {
      label: "Siap diambil!",
      icon: CheckCircle2,
      badgeClass: "bg-success-bg text-success border-success/30 animate-pulse",
    },
  }[activeOrder.status as "baru" | "dimasak" | "siap"] || {
    label: "Diproses",
    icon: Bell,
    badgeClass: "bg-cream-100 text-ink-600 border-line",
  };

  const StatusIcon = statusConfig.icon;

  return (
    <section aria-label="Pesanan aktif" className="mb-4">
      <Link
        href={`/pesanan/${activeOrder.public_token}`}
        className="group flex items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50/90 p-3.5 transition-all hover:border-green-700 hover:bg-green-100/80 active:scale-[0.99]"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-green-700 text-white shadow-xs">
            <StatusIcon className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-green-900">
              Pesanan aktif kamu <span className="font-bold">#{dailyNum}</span>
            </p>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusConfig.badgeClass}`}
              >
                {statusConfig.label}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs font-bold text-green-800 group-hover:translate-x-0.5 transition-transform shrink-0">
          <span>Lihat status</span>
          <ArrowRight className="size-4" aria-hidden />
        </div>
      </Link>
    </section>
  );
}
