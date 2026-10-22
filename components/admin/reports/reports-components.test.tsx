import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { ReportPeriodSelector } from "./report-period-selector";
import { ReportMetricCards } from "./report-metric-cards";
import { ReportPaymentMethods } from "./report-payment-methods";
import { ReportTopItems } from "./report-top-items";
import { ReportErrorState } from "./report-error-state";
import type { ReportSummary, TopItem } from "@/lib/admin-reports";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/admin/laporan",
  useSearchParams: () => new URLSearchParams(),
}));

describe("ReportPeriodSelector", () => {
  it("merender 3 pilihan preset chip: Hari Ini, Bulan Ini, Kustom", () => {
    const html = renderToString(<ReportPeriodSelector currentPreset="today" />);

    expect(html).toContain("Hari Ini");
    expect(html).toContain("Bulan Ini");
    expect(html).toContain("Kustom");
    expect(html).not.toContain("—"); // Antislop R-02
  });

  it("menandai chip aktif dengan warna kontras jelas", () => {
    const htmlToday = renderToString(<ReportPeriodSelector currentPreset="today" />);
    expect(htmlToday).toContain("bg-green-700 text-white");

    const htmlMonth = renderToString(<ReportPeriodSelector currentPreset="this_month" />);
    expect(htmlMonth).toContain("bg-green-700 text-white");
  });

  it("memiliki ukuran target sentuh interaktif minimal 44px", () => {
    const html = renderToString(<ReportPeriodSelector currentPreset="today" />);
    expect(html).toContain("min-h-[44px]");
  });

  it("tidak menampilkan form input tanggal saat preset bukan custom", () => {
    const html = renderToString(<ReportPeriodSelector currentPreset="today" />);
    expect(html).not.toContain('type="date"');
    expect(html).not.toContain("Terapkan");
  });

  it("menampilkan input tanggal native dan tombol Terapkan saat preset custom aktif", () => {
    const html = renderToString(
      <ReportPeriodSelector
        currentPreset="custom"
        currentFrom="2026-10-01"
        currentTo="2026-10-15"
      />
    );

    expect(html).toContain('type="date"');
    expect(html).toContain('value="2026-10-01"');
    expect(html).toContain('value="2026-10-15"');
    expect(html).toContain("Dari Tanggal");
    expect(html).toContain("Sampai Tanggal");
    expect(html).toContain("Terapkan");
    expect(html).not.toContain("—");
  });

  it("menggunakan tanggal default saat preset custom aktif tanpa parameter tanggal", () => {
    const html = renderToString(<ReportPeriodSelector currentPreset="custom" />);

    expect(html).toContain('type="date"');
    expect(html).toContain("Dari Tanggal");
    expect(html).toContain("Sampai Tanggal");
    expect(html).toContain("Terapkan");
  });
});

describe("ReportMetricCards", () => {
  const sampleSummary: ReportSummary = {
    totalOrders: 15,
    totalRevenue: 375000,
    totalCash: 175000,
    totalQris: 200000,
    cashOrders: 7,
    qrisOrders: 8,
    averageOrderValue: 25000,
    cashPercentage: 47,
    qrisPercentage: 53,
  };

  it("merender 3 metrik utama: Total Omzet, Total Pesanan, dan Rata-rata Pesanan", () => {
    const html = renderToString(<ReportMetricCards summary={sampleSummary} />);

    expect(html).toContain("Total Omzet");
    expect(html).toContain("Rp375.000");
    expect(html).toContain("Omzet Lunas (bukan batal)");

    expect(html).toContain("Total Pesanan");
    expect(html).toContain("15");
    expect(html).toContain("Pesanan Berhasil");

    expect(html).toContain("Rata-rata Pesanan");
    expect(html).toContain("Rp25.000");
    expect(html).toContain("Nilai rata-rata per pesanan");

    expect(html).not.toContain("—");
  });

  it("memformat nominal besar dengan pemisah ribuan Rupiah", () => {
    const largeSummary: ReportSummary = {
      totalOrders: 125,
      totalRevenue: 2500000,
      totalCash: 1500000,
      totalQris: 1000000,
      cashOrders: 75,
      qrisOrders: 50,
      averageOrderValue: 20000,
      cashPercentage: 60,
      qrisPercentage: 40,
    };

    const html = renderToString(<ReportMetricCards summary={largeSummary} />);

    expect(html).toContain("Rp2.500.000");
    expect(html).toContain("125");
    expect(html).toContain("Rp20.000");
  });

  it("merender nilai nol dengan aman tanpa error atau NaN", () => {
    const zeroSummary: ReportSummary = {
      totalOrders: 0,
      totalRevenue: 0,
      totalCash: 0,
      totalQris: 0,
      cashOrders: 0,
      qrisOrders: 0,
      averageOrderValue: 0,
      cashPercentage: 0,
      qrisPercentage: 0,
    };

    const html = renderToString(<ReportMetricCards summary={zeroSummary} />);

    expect(html).toContain("Rp0");
    expect(html).toContain(">0<");
    expect(html).not.toContain("NaN");
    expect(html).not.toContain("—");
  });
});

describe("ReportPaymentMethods", () => {
  const sampleSummary: ReportSummary = {
    totalOrders: 20,
    totalRevenue: 500000,
    totalCash: 300000,
    totalQris: 200000,
    cashOrders: 12,
    qrisOrders: 8,
    averageOrderValue: 25000,
    cashPercentage: 60,
    qrisPercentage: 40,
  };

  it("merender rincian, jumlah pesanan, dan persentase pembayaran Tunai vs QRIS", () => {
    const html = renderToString(<ReportPaymentMethods summary={sampleSummary} />);

    expect(html).toContain("Metode Pembayaran");
    expect(html).toContain("Tunai (Cash)");
    expect(html).toContain("Rp300.000");
    expect(html).toContain("12 pesanan");
    expect(html).toContain("60%");

    expect(html).toContain("QRIS (DANA Bisnis)");
    expect(html).toContain("Rp200.000");
    expect(html).toContain("8 pesanan");
    expect(html).toContain("40%");

    // Bar visual proporsional
    expect(html).toContain("width:60%");
    expect(html).toContain("width:40%");

    expect(html).not.toContain("—");
  });

  it("menangani kasus 100% Cash tanpa error visual", () => {
    const cashOnly: ReportSummary = {
      totalOrders: 10,
      totalRevenue: 200000,
      totalCash: 200000,
      totalQris: 0,
      cashOrders: 10,
      qrisOrders: 0,
      averageOrderValue: 20000,
      cashPercentage: 100,
      qrisPercentage: 0,
    };

    const html = renderToString(<ReportPaymentMethods summary={cashOnly} />);

    expect(html).toContain("100%");
    expect(html).toContain("0%");
    expect(html).toContain("10 pesanan");
    expect(html).toContain("0 pesanan");
    expect(html).toContain("width:100%");
  });

  it("menangani kasus 100% QRIS tanpa error visual", () => {
    const qrisOnly: ReportSummary = {
      totalOrders: 10,
      totalRevenue: 200000,
      totalCash: 0,
      totalQris: 200000,
      cashOrders: 0,
      qrisOrders: 10,
      averageOrderValue: 20000,
      cashPercentage: 0,
      qrisPercentage: 100,
    };

    const html = renderToString(<ReportPaymentMethods summary={qrisOnly} />);

    expect(html).toContain("0%");
    expect(html).toContain("100%");
    expect(html).toContain("0 pesanan");
    expect(html).toContain("10 pesanan");
    expect(html).toContain("width:100%");
  });

  it("merender pesan kosong saat total omzet nol", () => {
    const zeroSummary: ReportSummary = {
      totalOrders: 0,
      totalRevenue: 0,
      totalCash: 0,
      totalQris: 0,
      cashOrders: 0,
      qrisOrders: 0,
      averageOrderValue: 0,
      cashPercentage: 0,
      qrisPercentage: 0,
    };

    const html = renderToString(<ReportPaymentMethods summary={zeroSummary} />);

    expect(html).toContain("Belum ada transaksi pembayaran lunas pada periode ini");
    expect(html).not.toContain("—");
  });
});

describe("ReportTopItems", () => {
  const sampleTopItems: TopItem[] = [
    { name: "Cotto Makassar", total_quantity: 25, total_revenue: 875000 },
    { name: "Es Jeruk", total_quantity: 18, total_revenue: 144000 },
    { name: "Nasi Putih", total_quantity: 15, total_revenue: 75000 },
    { name: "Pallubasa", total_quantity: 10, total_revenue: 350000 },
    { name: "Es Teh Manis", total_quantity: 8, total_revenue: 40000 },
  ];

  it("merender judul dan daftar 5 menu terlaris lengkap dengan peringkat, porsi, dan omzet", () => {
    const html = renderToString(<ReportTopItems topItems={sampleTopItems} />);

    expect(html).toContain("5 Menu Terlaris");
    expect(html).toContain("Berdasarkan kuantitas porsi pesanan lunas");

    expect(html).toContain("Cotto Makassar");
    expect(html).toContain("25 porsi");
    expect(html).toContain("Rp875.000");

    expect(html).toContain("Es Jeruk");
    expect(html).toContain("18 porsi");
    expect(html).toContain("Rp144.000");

    expect(html).toContain("Es Teh Manis");
    expect(html).toContain("8 porsi");
    expect(html).toContain("Rp40.000");

    expect(html).not.toContain("—");
  });

  it("memberikan penekanan visual pada peringkat 1", () => {
    const html = renderToString(<ReportTopItems topItems={sampleTopItems} />);

    // Rank 1 badge distinct styling
    expect(html).toContain("bg-amber-100 text-amber-900");
  });

  it("merender dengan rapi saat hanya terdapat 1 item menu", () => {
    const singleItem: TopItem[] = [
      { name: "Nasi Goreng Spesial Komplit Telur Mata Sapi", total_quantity: 5, total_revenue: 125000 },
    ];

    const html = renderToString(<ReportTopItems topItems={singleItem} />);

    expect(html).toContain("Nasi Goreng Spesial Komplit Telur Mata Sapi");
    expect(html).toContain("5 porsi");
    expect(html).toContain("Rp125.000");
    expect(html).toContain("truncate");
  });

  it("merender empty state ramah saat daftar top items kosong", () => {
    const html = renderToString(<ReportTopItems topItems={[]} />);

    expect(html).toContain("5 Menu Terlaris");
    expect(html).toContain("Belum ada data menu terjual pada periode ini.");
    expect(html).not.toContain("—");
  });
});

describe("ReportErrorState", () => {
  it("merender pesan error dan judul kegagalan memuat laporan", () => {
    const html = renderToString(
      <ReportErrorState message="Koneksi basis data terputus." />
    );

    expect(html).toContain("Gagal Memuat Laporan Penjualan");
    expect(html).toContain("Koneksi basis data terputus.");
    expect(html).toContain('role="alert"');
    expect(html).not.toContain("—");
  });

  it("merender pesan default jika prop message tidak diberikan", () => {
    const html = renderToString(<ReportErrorState />);

    expect(html).toContain("Gagal Memuat Laporan Penjualan");
    expect(html).toContain(
      "Terjadi kendala teknis saat memuat laporan. Silakan coba lagi."
    );
  });

  it("memiliki tombol muat ulang dengan target sentuh minimal 44px", () => {
    const html = renderToString(<ReportErrorState />);

    expect(html).toContain("Muat Ulang Halaman");
    expect(html).toContain("min-h-[44px]");
    expect(html).toContain("min-w-[44px]");
  });
});
