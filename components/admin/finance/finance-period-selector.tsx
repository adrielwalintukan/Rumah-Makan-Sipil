"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronRight } from "lucide-react";
import type { FinancePreset } from "@/lib/admin-finance";

interface FinancePeriodSelectorProps {
  currentPreset: FinancePreset;
  currentFrom?: string;
  currentTo?: string;
  todayStr?: string;
}

export function FinancePeriodSelector({
  currentPreset,
  currentFrom = "",
  currentTo = "",
  todayStr = "",
}: FinancePeriodSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<FinancePreset>(currentPreset);
  const [customFrom, setCustomFrom] = useState(currentFrom);
  const [customTo, setCustomTo] = useState(currentTo);
  const [validationError, setValidationError] = useState<string | null>(null);

  const applyPreset = (preset: FinancePreset) => {
    setActiveTab(preset);
    setValidationError(null);

    const params = new URLSearchParams(searchParams.toString());
    if (preset === "today") {
      params.delete("preset");
      params.delete("from");
      params.delete("to");
    } else if (preset === "this_month") {
      params.set("preset", "this_month");
      params.delete("from");
      params.delete("to");
    } else {
      params.set("preset", "custom");
      if (customFrom) params.set("from", customFrom);
      if (customTo) params.set("to", customTo);
    }

    startTransition(() => {
      router.push(`/admin/keuangan?${params.toString()}`);
    });
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!customFrom || !customTo) {
      setValidationError("Tanggal awal dan akhir harus diisi.");
      return;
    }

    if (customFrom > customTo) {
      setValidationError("Tanggal awal tidak boleh lebih besar dari tanggal akhir.");
      return;
    }

    if (todayStr && (customFrom > todayStr || customTo > todayStr)) {
      setValidationError("Tanggal tidak boleh melebihi tanggal hari ini.");
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set("preset", "custom");
    params.set("from", customFrom);
    params.set("to", customTo);

    startTransition(() => {
      router.push(`/admin/keuangan?${params.toString()}`);
    });
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-600">
          Periode Buku Kas
        </span>
        {isPending && (
          <span className="text-xs text-ink-600 animate-pulse">Memuat data...</span>
        )}
      </div>

      {/* Preset Buttons */}
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Pilihan periode buku kas">
        <button
          type="button"
          onClick={() => applyPreset("today")}
          className={`min-h-[44px] min-w-[44px] rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-green-700 ${
            activeTab === "today"
              ? "bg-green-700 text-white shadow-xs"
              : "border border-line bg-cream-100 text-ink-600 hover:bg-cream-200"
          }`}
          aria-pressed={activeTab === "today"}
        >
          Hari Ini
        </button>

        <button
          type="button"
          onClick={() => applyPreset("this_month")}
          className={`min-h-[44px] min-w-[44px] rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-green-700 ${
            activeTab === "this_month"
              ? "bg-green-700 text-white shadow-xs"
              : "border border-line bg-cream-100 text-ink-600 hover:bg-cream-200"
          }`}
          aria-pressed={activeTab === "this_month"}
        >
          Bulan Ini
        </button>

        <button
          type="button"
          onClick={() => applyPreset("custom")}
          className={`min-h-[44px] min-w-[44px] rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-green-700 ${
            activeTab === "custom"
              ? "bg-green-700 text-white shadow-xs"
              : "border border-line bg-cream-100 text-ink-600 hover:bg-cream-200"
          }`}
          aria-pressed={activeTab === "custom"}
        >
          Rentang Kustom
        </button>
      </div>

      {/* Form Rentang Kustom */}
      {activeTab === "custom" && (
        <form onSubmit={handleCustomSubmit} className="mt-2 flex flex-col gap-3 pt-3 border-t border-line">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="custom-from" className="text-xs font-medium text-ink-600">
                Dari Tanggal
              </label>
              <div className="relative">
                <input
                  id="custom-from"
                  type="date"
                  value={customFrom}
                  max={todayStr || undefined}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="min-h-[44px] w-full rounded-lg border border-line bg-card px-3 py-2 text-base sm:text-sm text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="custom-to" className="text-xs font-medium text-ink-600">
                Sampai Tanggal
              </label>
              <div className="relative">
                <input
                  id="custom-to"
                  type="date"
                  value={customTo}
                  max={todayStr || undefined}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="min-h-[44px] w-full rounded-lg border border-line bg-card px-3 py-2 text-base sm:text-sm text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700"
                  required
                />
              </div>
            </div>
          </div>

          {validationError && (
            <p className="text-xs font-medium text-danger" role="alert">
              {validationError}
            </p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-green-600 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-green-700 disabled:opacity-50"
            >
              <span>Terapkan Rentang</span>
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
