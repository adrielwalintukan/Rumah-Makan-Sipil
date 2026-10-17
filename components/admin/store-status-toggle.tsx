"use client";

import * as React from "react";
import { AlertCircle, Loader2, Store } from "lucide-react";

interface StoreStatusToggleProps {
  initialIsOpen: boolean;
  onStatusChange?: (newIsOpen: boolean) => void;
}

export function StoreStatusToggle({
  initialIsOpen,
  onStatusChange,
}: StoreStatusToggleProps) {
  const [isOpen, setIsOpen] = React.useState(initialIsOpen);
  const [prevInitial, setPrevInitial] = React.useState(initialIsOpen);
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [announcement, setAnnouncement] = React.useState<string>("");

  // Sesuaikan state jika initialIsOpen dari server diperbarui
  if (prevInitial !== initialIsOpen) {
    setPrevInitial(initialIsOpen);
    setIsOpen(initialIsOpen);
  }

  const handleToggle = async () => {
    if (isUpdating) return;

    setErrorMsg(null);
    const targetStatus = !isOpen;

    // Optimistic UI update
    setIsOpen(targetStatus);
    setIsUpdating(true);
    setAnnouncement("Sedang memperbarui status toko...");

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_open: targetStatus }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mengubah status toko.");
      }

      setIsOpen(data.is_open);
      setAnnouncement(
        data.is_open
          ? "Toko sekarang dibuka untuk menerima pesanan."
          : "Toko sekarang ditutup."
      );
      onStatusChange?.(data.is_open);
    } catch (err) {
      // Rollback ke status semula jika request gagal
      setIsOpen(!targetStatus);
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan.";
      setErrorMsg(msg);
      setAnnouncement(`Gagal memperbarui status toko: ${msg}`);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={isOpen}
        aria-label={
          isOpen
            ? "Toko sedang buka. Klik untuk menutup toko."
            : "Toko sedang tutup. Klik untuk membuka toko."
        }
        disabled={isUpdating}
        onClick={handleToggle}
        className={`group flex items-center justify-between gap-3.5 rounded-xl border px-3 py-1.5 transition-all motion-reduce:transition-none min-h-[44px] cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed ${
          isOpen
            ? "border-green-600/30 bg-green-50/80 text-green-950 hover:bg-green-100/70 hover:border-green-600/50"
            : "border-line bg-card text-ink-900 hover:bg-cream-50 hover:border-ink-400/40"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <Store
            className={`size-4.5 shrink-0 ${
              isOpen ? "text-green-700" : "text-ink-600"
            }`}
            aria-hidden
          />
          <div className="flex flex-col leading-tight">
            <div className="flex items-center gap-1.5">
              <span
                className={`size-2 rounded-full shrink-0 ${
                  isOpen
                    ? "bg-green-600 animate-pulse motion-reduce:animate-none"
                    : "bg-danger"
                }`}
                aria-hidden
              />
              <span className="font-display text-sm font-bold">
                {isOpen ? "Toko Buka" : "Toko Tutup"}
              </span>
            </div>
            <span className="text-[11px] text-ink-600 font-medium">
              {isOpen ? "Menerima pesanan" : "Klik untuk buka"}
            </span>
          </div>
        </div>

        {/* Visual Switch Indicator */}
        <div
          aria-hidden="true"
          className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border border-line transition-colors duration-200 ease-in-out motion-reduce:transition-none ${
            isOpen ? "bg-green-700 border-green-700" : "bg-ink-400/35"
          }`}
        >
          <span
            className={`inline-flex size-5 transform items-center justify-center rounded-full bg-white shadow-xs transition duration-200 ease-in-out motion-reduce:transition-none ${
              isOpen ? "translate-x-5" : "translate-x-0"
            }`}
          >
            {isUpdating && (
              <Loader2
                className="size-3 animate-spin motion-reduce:animate-none text-ink-600"
                aria-hidden
              />
            )}
          </span>
        </div>
      </button>

      {/* Screen reader live announcement for status changes */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="flex items-center gap-1.5 text-xs text-danger font-medium mt-0.5 px-1"
        >
          <AlertCircle className="size-3.5 shrink-0" aria-hidden />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
}
