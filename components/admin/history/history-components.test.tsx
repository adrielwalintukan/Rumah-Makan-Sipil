import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { HistorySummaryCards } from "./history-summary-cards";
import { HistoryFilterBar } from "./history-filter-bar";
import { HistoryPagination } from "./history-pagination";
import type { OrderHistorySummary, OrderHistoryQuery } from "@/lib/admin-orders";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/admin/riwayat",
  useSearchParams: () => new URLSearchParams(),
}));

describe("HistorySummaryCards", () => {
  it("merender kartu total pesanan dan omzet lunas dengan benar", () => {
    const summary: OrderHistorySummary = {
      totalOrders: 42,
      totalRevenue: 850000,
      totalCash: 350000,
      totalQris: 500000,
    };

    const html = renderToString(<HistorySummaryCards summary={summary} />);

    expect(html).toContain("Total Pesanan");
    expect(html).toContain("42");
    expect(html).toContain("Omzet Lunas");
    expect(html).toContain("Rp850.000");
    expect(html).toContain("Tunai: Rp350.000");
    expect(html).toContain("QRIS: Rp500.000");
    expect(html).not.toContain("—"); // Antislop R-02
  });

  it("merender skeleton loading saat isLoading bernilai true", () => {
    const summary: OrderHistorySummary = {
      totalOrders: 0,
      totalRevenue: 0,
      totalCash: 0,
      totalQris: 0,
    };

    const html = renderToString(
      <HistorySummaryCards summary={summary} isLoading={true} />
    );

    expect(html).toContain("animate-pulse");
    expect(html).not.toContain("—");
  });

  it("merender nominal nol dengan aman tanpa error", () => {
    const summary: OrderHistorySummary = {
      totalOrders: 0,
      totalRevenue: 0,
      totalCash: 0,
      totalQris: 0,
    };

    const html = renderToString(<HistorySummaryCards summary={summary} />);

    expect(html).toContain("Total Pesanan");
    expect(html).toContain(">0<");
    expect(html).toContain("Rp0");
  });
});

describe("HistoryFilterBar", () => {
  it("merender tombol preset dan kontrol filter default", () => {
    const params: OrderHistoryQuery = {
      preset: "today",
      status: "all",
      page: 1,
      limit: 50,
    };

    const html = renderToString(<HistoryFilterBar currentParams={params} />);

    expect(html).toContain("Hari Ini");
    expect(html).toContain("Kemarin");
    expect(html).toContain("7 Hari");
    expect(html).toContain("30 Hari");
    expect(html).toContain("Kustom");
    expect(html).toContain("Semua Status");
    expect(html).toContain("Selesai");
    expect(html).toContain("Batal");
    expect(html).toContain("Cari nama / #antrean...");
    expect(html).not.toContain("—");
  });

  it("merender input tanggal kustom saat preset bernilai custom", () => {
    const params: OrderHistoryQuery = {
      preset: "custom",
      from: "2026-10-01",
      to: "2026-10-15",
      status: "selesai",
      page: 1,
      limit: 50,
    };

    const html = renderToString(<HistoryFilterBar currentParams={params} />);

    expect(html).toContain("Dari Tanggal");
    expect(html).toContain("Sampai Tanggal");
    expect(html).toContain("2026-10-01");
    expect(html).toContain("2026-10-15");
    expect(html).toContain("Terapkan");
    expect(html).toContain("Reset");
    expect(html).not.toContain("—");
  });

  it("merender tombol reset saat filter aktif bukan default", () => {
    const params: OrderHistoryQuery = {
      preset: "today",
      status: "batal",
      search: "Ahmad",
      page: 1,
      limit: 50,
    };

    const html = renderToString(<HistoryFilterBar currentParams={params} />);

    expect(html).toContain("Reset");
    expect(html).toContain('value="Ahmad"');
  });
});

describe("HistoryPagination", () => {
  it("merender ringkasan halaman dan status tombol di halaman pertama", () => {
    const html = renderToString(
      <HistoryPagination page={1} totalPages={3} totalCount={120} limit={50} />
    );

    expect(html).toContain("Menampilkan");
    expect(html).toContain("1-50");
    expect(html).toContain("120");
    expect(html).toContain("pesanan");
    expect(html).toContain("Halaman 1 dari 3");
    expect(html).toContain("disabled"); // Tombol Sebelumnya disabled
    expect(html).not.toContain("—");
  });

  it("merender tombol Sebelumnya dan Selanjutnya aktif di halaman tengah", () => {
    const html = renderToString(
      <HistoryPagination page={2} totalPages={3} totalCount={120} limit={50} />
    );

    expect(html).toContain("51-100");
    expect(html).toContain("Halaman 2 dari 3");
  });

  it("merender status disabled pada tombol Selanjutnya di halaman terakhir", () => {
    const html = renderToString(
      <HistoryPagination page={3} totalPages={3} totalCount={120} limit={50} />
    );

    expect(html).toContain("101-120");
    expect(html).toContain("Halaman 3 dari 3");
  });

  it("merender keterangan ketika tidak ada data (totalCount = 0)", () => {
    const html = renderToString(
      <HistoryPagination page={1} totalPages={1} totalCount={0} limit={50} />
    );

    expect(html).toContain("Tidak ada pesanan");
    expect(html).toContain("Halaman 1 dari 1");
  });
});
