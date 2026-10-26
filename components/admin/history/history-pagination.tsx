"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface HistoryPaginationProps {
  page: number;
  totalPages: number;
  totalCount: number;
  limit: number;
}

export function HistoryPagination({
  page,
  totalPages,
  totalCount,
  limit,
}: HistoryPaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const safeTotalPages = Math.max(1, totalPages);
  const safePage = Math.max(1, Math.min(page, safeTotalPages));

  const fromItem = totalCount > 0 ? (safePage - 1) * limit + 1 : 0;
  const toItem = totalCount > 0 ? Math.min(safePage * limit, totalCount) : 0;

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > safeTotalPages || newPage === safePage) return;

    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (newPage === 1) {
      params.delete("page");
    } else {
      params.set("page", String(newPage));
    }

    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-line pt-4 sm:flex-row">
      {/* Ringkasan Baris Data */}
      <p className="text-sm text-ink-600">
        {totalCount > 0 ? (
          <>
            Menampilkan{" "}
            <span className="font-semibold text-ink-900 tabular-nums">
              {`${fromItem}-${toItem}`}
            </span>{" "}
            dari{" "}
            <span className="font-semibold text-ink-900 tabular-nums">
              {totalCount}
            </span>{" "}
            pesanan
          </>
        ) : (
          "Tidak ada pesanan"
        )}
      </p>

      {/* Kontrol Paginasi */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => handlePageChange(safePage - 1)}
          disabled={safePage <= 1}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-lg border border-line bg-card px-3 py-2 text-sm font-semibold text-ink-900 shadow-xs transition-colors hover:bg-cream-100 disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronLeft className="size-4 shrink-0" aria-hidden />
          <span>Sebelumnya</span>
        </button>

        <span className="px-2 text-sm font-medium text-ink-600 tabular-nums">
          {`Halaman ${safePage} dari ${safeTotalPages}`}
        </span>

        <button
          type="button"
          onClick={() => handlePageChange(safePage + 1)}
          disabled={safePage >= safeTotalPages}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-lg border border-line bg-card px-3 py-2 text-sm font-semibold text-ink-900 shadow-xs transition-colors hover:bg-cream-100 disabled:pointer-events-none disabled:opacity-40"
        >
          <span>Selanjutnya</span>
          <ChevronRight className="size-4 shrink-0" aria-hidden />
        </button>
      </div>
    </div>
  );
}
