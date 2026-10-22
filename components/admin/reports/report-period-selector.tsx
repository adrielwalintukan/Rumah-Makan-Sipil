"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import type { ReportPreset } from "@/lib/admin-reports";
import { getWitaTodayDateString } from "@/lib/admin-reports";
import { Calendar } from "lucide-react";

export interface ReportPeriodSelectorProps {
  currentPreset: ReportPreset;
  currentFrom?: string;
  currentTo?: string;
}

const PRESET_OPTIONS: { id: ReportPreset; label: string }[] = [
  { id: "today", label: "Hari Ini" },
  { id: "this_month", label: "Bulan Ini" },
  { id: "custom", label: "Kustom" },
];

export function ReportPeriodSelector({
  currentPreset,
  currentFrom,
  currentTo,
}: ReportPeriodSelectorProps) {
  const router = useRouter();
  const pathname = usePathname() || "/admin/laporan";
  const todayStr = getWitaTodayDateString();

  const [prevPreset, setPrevPreset] = React.useState(currentPreset);
  const [isCustomMode, setIsCustomMode] = React.useState(currentPreset === "custom");
  if (currentPreset !== prevPreset) {
    setPrevPreset(currentPreset);
    setIsCustomMode(currentPreset === "custom");
  }

  const activePreset: ReportPreset = isCustomMode ? "custom" : currentPreset;

  const [prevFrom, setPrevFrom] = React.useState(currentFrom);
  const [customFrom, setCustomFrom] = React.useState(currentFrom ?? todayStr);
  if (currentFrom !== prevFrom) {
    setPrevFrom(currentFrom);
    setCustomFrom(currentFrom ?? todayStr);
  }

  const [prevTo, setPrevTo] = React.useState(currentTo);
  const [customTo, setCustomTo] = React.useState(currentTo ?? todayStr);
  if (currentTo !== prevTo) {
    setPrevTo(currentTo);
    setCustomTo(currentTo ?? todayStr);
  }

  const handlePresetClick = (preset: ReportPreset) => {
    if (preset === "custom") {
      setIsCustomMode(true);
      return;
    }
    setIsCustomMode(false);
    router.push(`${pathname}?preset=${preset}`);
  };

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customFrom || !customTo) return;

    let f = customFrom;
    let t = customTo;
    if (f > t) {
      const temp = f;
      f = t;
      t = temp;
      setCustomFrom(f);
      setCustomTo(t);
    }

    router.push(`${pathname}?preset=custom&from=${f}&to=${t}`);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Segmented Chips */}
      <div
        role="group"
        aria-label="Pilih periode laporan"
        className="flex flex-wrap items-center gap-2"
      >
        {PRESET_OPTIONS.map((option) => {
          const isActive = activePreset === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => handlePresetClick(option.id)}
              className={`min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-green-700 ${
                isActive
                  ? "bg-green-700 text-white shadow-xs"
                  : "bg-cream-100 text-ink-700 hover:bg-cream-200"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {/* Form Tanggal Kustom */}
      {isCustomMode && (
        <form
          onSubmit={handleApplyCustom}
          className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-card p-3 sm:p-4 shadow-xs"
        >
          <div className="flex flex-col gap-1.5 min-w-[140px] flex-1">
            <label
              htmlFor="report-custom-from"
              className="text-xs font-semibold text-ink-700"
            >
              Dari Tanggal
            </label>
            <div className="relative">
              <input
                id="report-custom-from"
                type="date"
                value={customFrom}
                max={todayStr}
                onChange={(e) => setCustomFrom(e.target.value)}
                required
                className="w-full min-h-[44px] rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink-900 focus:outline-hidden focus:ring-2 focus:ring-green-700"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5 min-w-[140px] flex-1">
            <label
              htmlFor="report-custom-to"
              className="text-xs font-semibold text-ink-700"
            >
              Sampai Tanggal
            </label>
            <div className="relative">
              <input
                id="report-custom-to"
                type="date"
                value={customTo}
                max={todayStr}
                onChange={(e) => setCustomTo(e.target.value)}
                required
                className="w-full min-h-[44px] rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink-900 focus:outline-hidden focus:ring-2 focus:ring-green-700"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full sm:w-auto min-h-[44px] min-w-[44px] px-5 py-2 rounded-lg bg-green-700 text-white text-sm font-medium hover:bg-green-800 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-green-700 flex items-center justify-center gap-1.5"
          >
            <Calendar className="size-4 shrink-0" aria-hidden />
            <span>Terapkan</span>
          </button>
        </form>
      )}
    </div>
  );
}
