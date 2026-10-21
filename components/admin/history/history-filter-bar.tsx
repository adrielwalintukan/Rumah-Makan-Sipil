"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { OrderHistoryQuery, OrderHistoryPreset, OrderHistoryStatusFilter } from "@/lib/admin-orders";
import { getWitaTodayDateString } from "@/lib/admin-orders";
import { Search, X, RotateCcw, Calendar } from "lucide-react";

interface HistoryFilterBarProps {
  currentParams: OrderHistoryQuery;
}

const PRESET_OPTIONS: { id: OrderHistoryPreset; label: string }[] = [
  { id: "today", label: "Hari Ini" },
  { id: "yesterday", label: "Kemarin" },
  { id: "last7days", label: "7 Hari" },
  { id: "last30days", label: "30 Hari" },
  { id: "custom", label: "Kustom" },
];

export function HistoryFilterBar({ currentParams }: HistoryFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Manage state synchronized with props during render without useEffect cascading renders
  const todayStr = getWitaTodayDateString();

  const [prevPreset, setPrevPreset] = React.useState(currentParams.preset);
  const [isCustomMode, setIsCustomMode] = React.useState(currentParams.preset === "custom");
  if (currentParams.preset !== prevPreset) {
    setPrevPreset(currentParams.preset);
    setIsCustomMode(currentParams.preset === "custom");
  }
  const activePreset: OrderHistoryPreset = isCustomMode ? "custom" : (currentParams.preset ?? "today");

  const [prevFrom, setPrevFrom] = React.useState(currentParams.from);
  const [customFrom, setCustomFrom] = React.useState(currentParams.from ?? todayStr);
  if (currentParams.from !== prevFrom) {
    setPrevFrom(currentParams.from);
    setCustomFrom(currentParams.from ?? todayStr);
  }

  const [prevTo, setPrevTo] = React.useState(currentParams.to);
  const [customTo, setCustomTo] = React.useState(currentParams.to ?? todayStr);
  if (currentParams.to !== prevTo) {
    setPrevTo(currentParams.to);
    setCustomTo(currentParams.to ?? todayStr);
  }

  const [prevSearch, setPrevSearch] = React.useState(currentParams.search);
  const [searchVal, setSearchVal] = React.useState(currentParams.search ?? "");
  if (currentParams.search !== prevSearch) {
    setPrevSearch(currentParams.search);
    setSearchVal(currentParams.search ?? "");
  }

  // Push new query parameters to URL, always resetting page to 1
  const updateQuery = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");

    // Reset pagination to first page whenever filter parameters change
    params.delete("page");

    for (const [key, value] of Object.entries(updates)) {
      if (
        !value ||
        value === "all" ||
        (key === "preset" && value === "today")
      ) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }

    // If preset is not custom, remove custom date range params
    const nextPreset = updates.preset !== undefined ? updates.preset : (params.get("preset") || "today");
    if (nextPreset !== "custom") {
      params.delete("from");
      params.delete("to");
    }

    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const handlePresetClick = (preset: OrderHistoryPreset) => {
    if (preset === "custom") {
      setIsCustomMode(true);
      // Don't update URL immediately until custom range is submitted
      return;
    }
    setIsCustomMode(false);
    updateQuery({ preset });
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

    updateQuery({ preset: "custom", from: f, to: t });
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as OrderHistoryStatusFilter;
    updateQuery({ status: newStatus });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateQuery({ search: searchVal.trim() });
  };

  const handleClearSearch = () => {
    setSearchVal("");
    updateQuery({ search: "" });
  };

  const handleReset = () => {
    setIsCustomMode(false);
    setSearchVal("");
    const today = getWitaTodayDateString();
    setCustomFrom(today);
    setCustomTo(today);
    router.push(pathname);
  };

  const isFiltered =
    (currentParams.preset && currentParams.preset !== "today") ||
    (currentParams.status && currentParams.status !== "all") ||
    !!currentParams.search ||
    !!currentParams.from ||
    !!currentParams.to;

  const currentStatus = currentParams.status ?? "all";

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-card p-3 sm:p-4 shadow-xs">
      {/* 1. Tombol Preset Waktu (Scrollable horizontal di mobile) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:pb-0">
        {PRESET_OPTIONS.map((item) => {
          const isActive = activePreset === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handlePresetClick(item.id)}
              className={`inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors ${
                isActive
                  ? "border-green-700 bg-green-700 text-white shadow-xs"
                  : "border-line bg-card text-ink-700 hover:bg-cream-100 hover:text-ink-900"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* 2. Baris Tanggal Kustom (tampil saat preset === "custom") */}
      {activePreset === "custom" && (
        <form
          onSubmit={handleApplyCustom}
          className="flex flex-col gap-2 rounded-lg border border-line bg-cream-50 p-3 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <label
              htmlFor="filter-date-from"
              className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-600"
            >
              Dari Tanggal
            </label>
            <div className="relative">
              <input
                id="filter-date-from"
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="flex h-11 min-h-[44px] w-full rounded-md border border-line bg-card px-3 py-2 text-sm text-ink-900 shadow-xs focus-visible:border-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-100"
                required
              />
            </div>
          </div>

          <div className="flex-1">
            <label
              htmlFor="filter-date-to"
              className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-600"
            >
              Sampai Tanggal
            </label>
            <div className="relative">
              <input
                id="filter-date-to"
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="flex h-11 min-h-[44px] w-full rounded-md border border-line bg-card px-3 py-2 text-sm text-ink-900 shadow-xs focus-visible:border-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-100"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-green-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700"
          >
            <Calendar className="size-4 shrink-0" aria-hidden />
            <span>Terapkan</span>
          </button>
        </form>
      )}

      {/* 3. Baris Kontrol: Pencarian Cepat, Filter Status, & Tombol Reset */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between border-t border-line pt-3">
        {/* Kolom Pencarian Cepat */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-ink-400">
            <Search className="size-4.5" aria-hidden />
          </div>
          <input
            type="text"
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            placeholder="Cari nama / #antrean..."
            className="flex h-11 min-h-[44px] w-full rounded-md border border-line bg-card pl-10 pr-10 py-2 text-sm text-ink-900 placeholder:text-ink-400 shadow-xs focus-visible:border-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-100"
          />
          {searchVal && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute inset-y-0 right-0 flex min-h-[44px] min-w-[44px] items-center justify-center text-ink-400 hover:text-ink-900 transition-colors"
              aria-label="Hapus pencarian"
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </form>

        {/* Filter Status & Tombol Reset */}
        <div className="flex items-center gap-2">
          <label htmlFor="filter-status-select" className="sr-only">
            Filter Status Pesanan
          </label>
          <select
            id="filter-status-select"
            value={currentStatus}
            onChange={handleStatusChange}
            className="flex h-11 min-h-[44px] rounded-md border border-line bg-card px-3 py-2 text-sm font-medium text-ink-900 shadow-xs focus-visible:border-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-100"
          >
            <option value="all">Semua Status</option>
            <option value="selesai">Selesai</option>
            <option value="batal">Batal</option>
          </select>

          {isFiltered && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-lg border border-line bg-card px-3.5 py-2 text-sm font-semibold text-danger hover:bg-danger-bg transition-colors"
              title="Reset semua filter"
            >
              <RotateCcw className="size-4 shrink-0" aria-hidden />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
