"use client";

import * as React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

export interface ReportErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ReportErrorState({ message, onRetry }: ReportErrorStateProps) {
  const handleReload = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  return (
    <div
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50/70 p-6 sm:p-8 text-center shadow-xs"
    >
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-red-100 text-red-700 mb-3">
        <AlertCircle className="size-6" aria-hidden />
      </div>
      <h2 className="font-display text-lg font-bold text-red-900">
        Gagal Memuat Laporan Penjualan
      </h2>
      <p className="mt-1.5 text-sm text-red-700 max-w-md mx-auto">
        {message ||
          "Terjadi kendala teknis saat memuat data laporan dari basis data. Pastikan migrasi terbaru telah dijalankan dan koneksi server stabil."}
      </p>
      <div className="mt-5 flex justify-center">
        <button
          type="button"
          onClick={handleReload}
          className="min-h-[44px] min-w-[44px] px-5 py-2 rounded-lg bg-red-700 text-white text-sm font-medium hover:bg-red-800 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-red-700 inline-flex items-center justify-center gap-2"
        >
          <RefreshCw className="size-4 shrink-0" aria-hidden />
          <span>Muat Ulang Halaman</span>
        </button>
      </div>
    </div>
  );
}
