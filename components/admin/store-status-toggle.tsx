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
      onStatusChange?.(data.is_open);
    } catch (err) {
      // Rollback ke status semula jika request gagal
      setIsOpen(!targetStatus);
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan.";
      setErrorMsg(msg);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div
        className={`flex items-center gap-3 rounded-xl border px-3 py-1.5 transition-colors min-h-[44px] ${
          isOpen
            ? "border-green-600/30 bg-green-50/80 text-green-950"
            : "border-line bg-card text-ink-800"
        }`}
      >
        <div className="flex items-center gap-2">
          <Store
            className={`size-4.5 ${
              isOpen ? "text-green-700" : "text-ink-400"
            }`}
            aria-hidden
          />
          <div className="flex flex-col leading-tight">
            <div className="flex items-center gap-1.5">
              <span
                className={`size-2 rounded-full ${
                  isOpen ? "bg-green-600 animate-pulse" : "bg-danger"
                }`}
                aria-hidden
              />
              <span className="font-display text-sm font-bold">
                {isOpen ? "Toko Buka" : "Toko Tutup"}
              </span>
            </div>
            <span className="text-[11px] text-ink-500 font-medium">
              {isOpen ? "Menerima pesanan" : "Pemesanan ditutup"}
            </span>
          </div>
        </div>

        {/* Accessible Switch Toggle */}
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
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed ${
            isOpen ? "bg-green-700" : "bg-ink-300"
          }`}
        >
          <span
            className={`pointer-events-none inline-flex size-5 transform items-center justify-center rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
              isOpen ? "translate-x-5" : "translate-x-0"
            }`}
          >
            {isUpdating && (
              <Loader2 className="size-3 animate-spin text-ink-500" aria-hidden />
            )}
          </span>
        </button>
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
