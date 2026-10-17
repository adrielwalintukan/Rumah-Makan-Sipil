"use client";

import * as React from "react";
import {
  Bell,
  BellOff,
  Flame,
  Monitor,
  RefreshCw,
  Sparkles,
  Utensils,
  Wifi,
  WifiOff,
} from "lucide-react";
import type { AdminOrder, OrderStatus } from "@/lib/admin-orders";
import { getOrderItems } from "@/lib/admin-orders";
import { useWakeLock } from "@/lib/hooks/use-wake-lock";
import { useIsDesktop } from "@/lib/hooks/use-media-query";
import { soundNotifier } from "@/lib/sound";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { OrderCard } from "./order-card";

interface LiveOrdersBoardProps {
  initialOrders: AdminOrder[];
}

export function LiveOrdersBoard({ initialOrders }: LiveOrdersBoardProps) {
  const [orders, setOrders] = React.useState<AdminOrder[]>(initialOrders);
  const [connectionStatus, setConnectionStatus] = React.useState<"connecting" | "connected" | "disconnected">("connecting");
  const [isSoundEnabled, setIsSoundEnabled] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [newOrderIds, setNewOrderIds] = React.useState<Set<string>>(new Set());
  const [mobileTab, setMobileTab] = React.useState<"semua" | OrderStatus>("semua");
  const isDesktop = useIsDesktop();

  // Screen Wake Lock API (Issue #12 & PRD US-10)
  const { isSupported: isWakeLockSupported, isActive: isWakeLockActive, request: requestWakeLock } = useWakeLock();

  // Aktifkan Wake Lock otomatis saat pertama kali dibuka
  React.useEffect(() => {
    if (isWakeLockSupported) {
      requestWakeLock();
    }
  }, [isWakeLockSupported, requestWakeLock]);

  // Fungsi toggle audio dengan penanganan browser autoplay
  const handleToggleSound = async () => {
    if (!isSoundEnabled) {
      const ok = await soundNotifier.unlock();
      if (ok) {
        soundNotifier.playOrderNotification();
        setIsSoundEnabled(true);
        try {
          localStorage.setItem("rms_admin_sound", "true");
        } catch {}
      }
    } else {
      setIsSoundEnabled(false);
      try {
        localStorage.setItem("rms_admin_sound", "false");
      } catch {}
    }
  };

  // Muat ulang data pesanan dari server (re-sync)
  const refreshOrders = React.useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/admin/orders", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (json.orders) {
          setOrders(json.orders);
        }
      }
    } catch {
      // Abaikan error jaringan sementara
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Subscribe Supabase Realtime postgres_changes
  React.useEffect(() => {
    const supabase = createBrowserSupabaseClient();

    const channel = supabase
      .channel("admin-orders-live")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
        },
        async (payload) => {
          const rawOrder = payload.new as AdminOrder;

          // Mainkan bunyi notifikasi pesanan baru jika audio aktif
          if (isSoundEnabled) {
            soundNotifier.playOrderNotification();
          }

          // Muat item pesanan untuk pesanan baru
          const items = await getOrderItems(supabase, rawOrder.id);
          const fullOrder: AdminOrder = {
            ...rawOrder,
            order_items: items,
          };

          // Tandai kartu pesanan baru agar berkedip
          setNewOrderIds((prev) => new Set(prev).add(fullOrder.id));
          setTimeout(() => {
            setNewOrderIds((prev) => {
              const next = new Set(prev);
              next.delete(fullOrder.id);
              return next;
            });
          }, 5000);

          setOrders((prev) => {
            if (prev.some((o) => o.id === fullOrder.id)) return prev;
            return [...prev, fullOrder];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
        },
        async (payload) => {
          const updated = payload.new as AdminOrder;

          setOrders((prev) => {
            // Jika pesanan telah selesai DAN lunas, atau dibatalkan, keluarkan dari board live
            if (
              updated.status === "batal" ||
              (updated.status === "selesai" && updated.payment_status === "lunas")
            ) {
              return prev.filter((o) => o.id !== updated.id);
            }

            return prev.map((o) => {
              if (o.id === updated.id) {
                return {
                  ...o,
                  ...updated,
                  // Pertahankan order_items yang sudah dimuat sebelumnya
                  order_items: o.order_items,
                };
              }
              return o;
            });
          });
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnectionStatus("connected");
          refreshOrders();
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConnectionStatus("disconnected");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isSoundEnabled, refreshOrders]);

  const handleOrderUpdated = React.useCallback((updated: AdminOrder) => {
    setOrders((prev) => {
      if (
        updated.status === "batal" ||
        (updated.status === "selesai" && updated.payment_status === "lunas")
      ) {
        return prev.filter((o) => o.id !== updated.id);
      }
      return prev.map((o) =>
        o.id === updated.id
          ? {
              ...o,
              ...updated,
              order_items: o.order_items,
            }
          : o
      );
    });
  }, []);

  // Kelompokkan pesanan berdasarkan status kanban
  const ordersBaru = orders.filter((o) => o.status === "baru");
  const ordersDimasak = orders.filter((o) => o.status === "dimasak");
  const ordersSiap = orders.filter((o) => o.status === "siap" || o.status === "selesai");

  // Filter untuk tampilan tab di mobile (< 640 px)
  const mobileFilteredOrders =
    mobileTab === "semua"
      ? orders
      : mobileTab === "siap"
        ? orders.filter((o) => o.status === "siap" || o.status === "selesai")
        : orders.filter((o) => o.status === mobileTab);

  return (
    <div className="flex flex-col gap-5">
      {/* Banner Peringatan jika Realtime Terputus */}
      {connectionStatus === "disconnected" && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-lg border border-danger/30 bg-danger-bg p-3.5 text-sm text-danger shadow-xs"
        >
          <div className="flex items-center gap-2.5">
            <WifiOff className="size-5 shrink-0" aria-hidden />
            <span className="font-semibold">
              Koneksi realtime terputus. Mencoba menyambungkan kembali...
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={refreshOrders}
            disabled={isRefreshing}
            className="h-8 border-danger/40 bg-card text-danger hover:bg-danger-bg"
          >
            <RefreshCw className={`size-3.5 mr-1.5 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden />
            Coba Lagi
          </Button>
        </div>
      )}

      {/* Bar Kontrol Atas: Judul, Status Koneksi, Audio, Wake Lock */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-2xl font-bold text-green-900">
              Pesanan Live
            </h1>
            <span className="inline-flex size-6 items-center justify-center rounded-full bg-green-700 text-xs font-bold text-white">
              {orders.length}
            </span>
          </div>
          <p className="text-xs text-ink-600 mt-0.5">
            Pesanan masuk langsung diperbarui tanpa memuat ulang halaman.
          </p>
        </div>

        {/* Toolbar Tombol Aksi & Indikator */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Koneksi */}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
              connectionStatus === "connected"
                ? "border-green-700/20 bg-green-50 text-green-800"
                : connectionStatus === "connecting"
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-danger/30 bg-danger-bg text-danger"
            }`}
          >
            {connectionStatus === "connected" ? (
              <>
                <Wifi className="size-3.5" aria-hidden />
                <span className="size-1.5 rounded-full bg-green-700 animate-pulse" />
                <span>Terhubung</span>
              </>
            ) : connectionStatus === "connecting" ? (
              <>
                <RefreshCw className="size-3.5 animate-spin" aria-hidden />
                <span>Menghubungkan...</span>
              </>
            ) : (
              <>
                <WifiOff className="size-3.5" aria-hidden />
                <span>Terputus</span>
              </>
            )}
          </span>

          {/* Tombol Suara Notifikasi */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleToggleSound}
            aria-pressed={isSoundEnabled}
            className={`h-8 min-h-[36px] text-xs font-semibold ${
              isSoundEnabled
                ? "border-green-700/30 bg-green-50 text-green-800 hover:bg-green-100"
                : "border-line text-ink-700 hover:bg-cream-100"
            }`}
          >
            {isSoundEnabled ? (
              <>
                <Bell className="size-3.5 mr-1.5 text-green-700" aria-hidden />
                <span>Suara Aktif</span>
              </>
            ) : (
              <>
                <BellOff className="size-3.5 mr-1.5 text-ink-400" aria-hidden />
                <span>Aktifkan Suara</span>
              </>
            )}
          </Button>

          {/* Indikator Screen Wake Lock */}
          {isWakeLockSupported && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                isWakeLockActive
                  ? "border-brown-200 bg-brown-50 text-brown-900"
                  : "border-line bg-card text-ink-500"
              }`}
              title={isWakeLockActive ? "Layar dijaga tetap menyala" : "Layar dapat meredup"}
            >
              <Monitor className="size-3.5" aria-hidden />
              <span>{isWakeLockActive ? "Layar Aktif" : "Layar Normal"}</span>
            </span>
          )}

          {/* Tombol Sinkronisasi Manual */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={refreshOrders}
            disabled={isRefreshing}
            aria-label="Segarkan daftar pesanan"
            className="h-8 min-h-[36px] border-line px-2.5 text-ink-700 hover:bg-cream-100"
          >
            <RefreshCw className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden />
          </Button>
        </div>
      </div>

      {/* Render salah satu tampilan: Tablet & Desktop (Kanban 3 Kolom) atau Mobile (Tab + 1 Kolom) */}
      {isDesktop ? (
        /* TAMPILAN TABLET & DESKTOP (≥ 640 px): Kanban 3 Kolom */
        <div className="grid grid-cols-3 gap-4.5 items-start">
          {/* Kolom 1: Pesanan Baru */}
          <div className="flex flex-col gap-3 rounded-xl border border-line bg-cream-50/70 p-3.5">
            <div className="flex items-center justify-between border-b border-line/60 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-amber-500" />
                <h2 className="font-display text-sm font-bold text-ink-900">
                  Pesanan Baru
                </h2>
              </div>
              <span className="rounded-full bg-card border border-line px-2 py-0.5 text-xs font-bold text-ink-700">
                {ordersBaru.length}
              </span>
            </div>

            <div className="flex flex-col gap-3 min-h-[200px]">
              {ordersBaru.length > 0 ? (
                ordersBaru.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    isNew={newOrderIds.has(order.id)}
                    onOrderUpdated={handleOrderUpdated}
                  />
                ))
              ) : (
                <div className="flex flex-col items-center justify-center p-6 text-center text-ink-400">
                  <Sparkles className="size-6 text-ink-300 mb-1" aria-hidden />
                  <p className="text-xs font-medium">Tidak ada pesanan baru</p>
                </div>
              )}
            </div>
          </div>

          {/* Kolom 2: Sedang Dimasak */}
          <div className="flex flex-col gap-3 rounded-xl border border-line bg-cream-50/70 p-3.5">
            <div className="flex items-center justify-between border-b border-line/60 pb-2.5">
              <div className="flex items-center gap-2">
                <Flame className="size-3.5 text-brown-700" aria-hidden />
                <h2 className="font-display text-sm font-bold text-ink-900">
                  Sedang Dimasak
                </h2>
              </div>
              <span className="rounded-full bg-card border border-line px-2 py-0.5 text-xs font-bold text-ink-700">
                {ordersDimasak.length}
              </span>
            </div>

            <div className="flex flex-col gap-3 min-h-[200px]">
              {ordersDimasak.length > 0 ? (
                ordersDimasak.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    isNew={newOrderIds.has(order.id)}
                    onOrderUpdated={handleOrderUpdated}
                  />
                ))
              ) : (
                <div className="flex flex-col items-center justify-center p-6 text-center text-ink-400">
                  <Utensils className="size-6 text-ink-300 mb-1" aria-hidden />
                  <p className="text-xs font-medium">Dapur sedang santai</p>
                </div>
              )}
            </div>
          </div>

          {/* Kolom 3: Siap Diambil */}
          <div className="flex flex-col gap-3 rounded-xl border border-line bg-cream-50/70 p-3.5">
            <div className="flex items-center justify-between border-b border-line/60 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-green-700" />
                <h2 className="font-display text-sm font-bold text-ink-900">
                  Siap Diambil
                </h2>
              </div>
              <span className="rounded-full bg-card border border-line px-2 py-0.5 text-xs font-bold text-ink-700">
                {ordersSiap.length}
              </span>
            </div>

            <div className="flex flex-col gap-3 min-h-[200px]">
              {ordersSiap.length > 0 ? (
                ordersSiap.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    isNew={newOrderIds.has(order.id)}
                    onOrderUpdated={handleOrderUpdated}
                  />
                ))
              ) : (
                <div className="flex flex-col items-center justify-center p-6 text-center text-ink-400">
                  <p className="text-xs font-medium">Belum ada pesanan siap</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* TAMPILAN MOBILE (< 640 px): Filter Tab Bar + 1 Kolom Vertikal */
        <div className="flex flex-col gap-4">
          {/* Tab Filter Status */}
          <div className="flex rounded-lg border border-line bg-card p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setMobileTab("semua")}
              className={`flex-1 py-1.5 text-center rounded-md transition ${
                mobileTab === "semua"
                  ? "bg-green-700 text-white shadow-xs font-bold"
                  : "text-ink-600 hover:text-ink-900"
              }`}
            >
              Semua ({orders.length})
            </button>
            <button
              type="button"
              onClick={() => setMobileTab("baru")}
              className={`flex-1 py-1.5 text-center rounded-md transition ${
                mobileTab === "baru"
                  ? "bg-green-700 text-white shadow-xs font-bold"
                  : "text-ink-600 hover:text-ink-900"
              }`}
            >
              Baru ({ordersBaru.length})
            </button>
            <button
              type="button"
              onClick={() => setMobileTab("dimasak")}
              className={`flex-1 py-1.5 text-center rounded-md transition ${
                mobileTab === "dimasak"
                  ? "bg-green-700 text-white shadow-xs font-bold"
                  : "text-ink-600 hover:text-ink-900"
              }`}
            >
              Dimasak ({ordersDimasak.length})
            </button>
            <button
              type="button"
              onClick={() => setMobileTab("siap")}
              className={`flex-1 py-1.5 text-center rounded-md transition ${
                mobileTab === "siap"
                  ? "bg-green-700 text-white shadow-xs font-bold"
                  : "text-ink-600 hover:text-ink-900"
              }`}
            >
              Siap ({ordersSiap.length})
            </button>
          </div>

          {/* Daftar Kartu Pesanan di Mobile */}
          {mobileFilteredOrders.length > 0 ? (
            <div className="flex flex-col gap-3.5">
              {mobileFilteredOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  isNew={newOrderIds.has(order.id)}
                  onOrderUpdated={handleOrderUpdated}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-line bg-card p-8 text-center">
              <Utensils className="mx-auto size-10 text-ink-300 mb-2" aria-hidden />
              <p className="font-semibold text-ink-800">Belum ada pesanan aktif</p>
              <p className="text-xs text-ink-500 mt-1">
                Pesanan baru yang masuk akan otomatis tampil di sini.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
