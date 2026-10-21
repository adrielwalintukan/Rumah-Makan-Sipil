import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { HistorySummaryCards } from "./history-summary-cards";
import { HistoryFilterBar } from "./history-filter-bar";
import { HistoryPagination } from "./history-pagination";
import {
  HistoryOrderList,
  formatHistoryCardTime,
  formatItemsSummary,
} from "./history-order-list";
import {
  OrderDetailSheet,
  formatWitaDateTime,
  getWhatsAppUrl,
} from "./order-detail-sheet";
import type {
  OrderHistorySummary,
  OrderHistoryQuery,
  AdminOrder,
} from "@/lib/admin-orders";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/admin/riwayat",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("radix-ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("radix-ui")>();
  return {
    ...actual,
    Dialog: {
      ...actual.Dialog,
      Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    },
  };
});

const mockOrder1: AdminOrder = {
  id: "order-1",
  public_token: "tok-1",
  order_date: "2026-10-21",
  daily_number: 1,
  customer_name: "Budi Santoso",
  customer_phone: "081234567890",
  order_type: "dine_in",
  payment_method: "qris",
  payment_status: "belum_bayar",
  status: "baru",
  total: 45000,
  cancel_reason: null,
  created_at: "2026-10-21T04:29:19Z",
  paid_at: null,
  order_items: [
    {
      id: "item-1",
      order_id: "order-1",
      menu_item_id: "menu-1",
      name: "Cotto Makassar",
      unit_price: 35000,
      quantity: 1,
      subtotal: 35000,
      note: "Sedikit pedas",
      options: [
        {
          group: "Pilihan Karbo",
          name: "Ketupat",
          price_delta: 5000,
        },
      ],
    },
    {
      id: "item-2",
      order_id: "order-1",
      menu_item_id: "menu-2",
      name: "Es Teh Manis",
      unit_price: 5000,
      quantity: 1,
      subtotal: 5000,
      note: null,
      options: null,
    },
  ],
};

const mockOrder2: AdminOrder = {
  id: "order-2",
  public_token: "tok-2",
  order_date: "2026-10-21",
  daily_number: 2,
  customer_name: "Siti Rahma",
  customer_phone: null,
  order_type: "takeaway",
  payment_method: "cash",
  payment_status: "lunas",
  status: "selesai",
  total: 20000,
  cancel_reason: null,
  created_at: "2026-10-21T05:00:00Z",
  paid_at: "2026-10-21T05:05:00Z",
  order_items: [
    {
      id: "item-3",
      order_id: "order-2",
      menu_item_id: "menu-3",
      name: "Nasi Goreng",
      unit_price: 20000,
      quantity: 1,
      subtotal: 20000,
      note: null,
      options: null,
    },
  ],
};

const mockOrderCancelled: AdminOrder = {
  id: "order-3",
  public_token: "tok-3",
  order_date: "2026-10-21",
  daily_number: 3,
  customer_name: "Andi Wijaya",
  customer_phone: "085299887766",
  order_type: "takeaway",
  payment_method: "cash",
  payment_status: "belum_bayar",
  status: "batal",
  total: 30000,
  cancel_reason: "Bahan baku ayam habis",
  created_at: "2026-10-21T06:00:00Z",
  paid_at: null,
  order_items: [],
};

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

describe("HistoryOrderList", () => {
  it("merender empty state ramah saat daftar pesanan kosong", () => {
    const html = renderToString(
      <HistoryOrderList orders={[]} onSelectOrder={vi.fn()} />
    );

    expect(html).toContain("Tidak ada pesanan ditemukan");
    expect(html).toContain(
      "Tidak ada data riwayat pesanan yang cocok dengan filter atau kata kunci saat ini."
    );
    expect(html).toContain("Reset ke Hari Ini");
    expect(html).not.toContain("—");
  });

  it("merender daftar kartu pesanan lengkap dengan nomor antrean, nama, ringkasan item, dan total", () => {
    const html = renderToString(
      <HistoryOrderList
        orders={[mockOrder1, mockOrder2]}
        onSelectOrder={vi.fn()}
      />
    );

    expect(html).toContain("#001");
    expect(html).toContain("Budi Santoso");
    expect(html).toContain("Makan di Sini");
    expect(html).toContain("2 item: Cotto Makassar, Es Teh Manis");
    expect(html).toContain("Rp45.000");
    expect(html).toContain("Baru");
    expect(html).toContain("Belum Bayar");

    expect(html).toContain("#002");
    expect(html).toContain("Siti Rahma");
    expect(html).toContain("Bungkus");
    expect(html).toContain("1 item: Nasi Goreng");
    expect(html).toContain("Rp20.000");
    expect(html).toContain("Selesai");
    expect(html).toContain("Lunas");

    expect(html).not.toContain("—");
  });

  it("merangkum nama dan jumlah item dengan benar lewat formatItemsSummary", () => {
    expect(formatItemsSummary([])).toBe("Tidak ada item");
    expect(formatItemsSummary(mockOrder1.order_items)).toBe(
      "2 item: Cotto Makassar, Es Teh Manis"
    );
    expect(formatItemsSummary(mockOrder2.order_items)).toBe(
      "1 item: Nasi Goreng"
    );
  });

  it("memformat waktu kartu dalam zona WITA tanpa em dash", () => {
    const formatted = formatHistoryCardTime("2026-10-21T04:29:19Z");
    expect(formatted).toContain("WITA");
    expect(formatted).not.toContain("—");
  });
});

describe("OrderDetailSheet", () => {
  it("merender rincian pesanan lengkap saat sheet terbuka", () => {
    const html = renderToString(
      <OrderDetailSheet
        order={mockOrder1}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    // Header & Info Pelanggan
    expect(html).toContain("#001");
    expect(html).toContain("Makan di Sini");
    expect(html).toContain("Budi Santoso");
    expect(html).toContain("081234567890");
    expect(html).toContain("Chat WhatsApp");
    expect(html).toContain("https://wa.me/6281234567890");

    // Status & Metode Bayar
    expect(html).toContain("Baru");
    expect(html).toContain("Belum Bayar");
    expect(html).toContain("QRIS");

    // Item pesanan, varian, dan catatan
    expect(html).toContain("Cotto Makassar");
    expect(html).toContain("Ketupat");
    expect(html).toContain("Rp5.000");
    expect(html).toContain("Catatan:");
    expect(html).toContain("Sedikit pedas");
    expect(html).toContain("Es Teh Manis");

    // Total dan tombol aksi
    expect(html).toContain("Total Pesanan");
    expect(html).toContain("Rp45.000");
    expect(html).toContain("Tandai Lunas");
    expect(html).toContain("Tutup");
    expect(html).not.toContain("—");
  });

  it("tidak menampilkan tombol Tandai Lunas jika pesanan sudah lunas", () => {
    const html = renderToString(
      <OrderDetailSheet
        order={mockOrder2}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(html).toContain("#002");
    expect(html).toContain("Lunas");
    expect(html).not.toContain("Tandai Lunas");
    expect(html).toContain("Tutup");
    expect(html).not.toContain("—");
  });

  it("menampilkan alasan pembatalan jika status pesanan adalah batal", () => {
    const html = renderToString(
      <OrderDetailSheet
        order={mockOrderCancelled}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(html).toContain("#003");
    expect(html).toContain("Dibatalkan");
    expect(html).toContain("Alasan Pembatalan:");
    expect(html).toContain("Bahan baku ayam habis");
    expect(html).not.toContain("Tandai Lunas");
    expect(html).not.toContain("—");
  });

  it("memformat URL WhatsApp dengan benar untuk berbagai format nomor", () => {
    expect(getWhatsAppUrl("081234567890")).toBe("https://wa.me/6281234567890");
    expect(getWhatsAppUrl("+6281234567890")).toBe("https://wa.me/6281234567890");
    expect(getWhatsAppUrl("0852-9988-7766")).toBe("https://wa.me/6285299887766");
    expect(getWhatsAppUrl("123")).toBeNull();
    expect(getWhatsAppUrl("")).toBeNull();
  });

  it("memformat tanggal dan waktu dalam standar WITA tanpa em dash", () => {
    const formatted = formatWitaDateTime("2026-10-21T04:29:19Z");
    expect(formatted).toContain("WITA");
    expect(formatted).not.toContain("—");
  });
});
