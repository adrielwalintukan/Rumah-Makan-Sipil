import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as React from "react";
import { renderToString } from "react-dom/server";
import { DesktopCartPanel } from "./desktop-cart-panel";
import { QuantityStepper } from "@/components/pelanggan/quantity-stepper";
import * as useCartModule from "@/lib/use-cart";
import type { Category, MenuItem } from "@/lib/menu";
import type { CartLine } from "@/lib/cart";

// Helper rekursif untuk mencari elemen dalam tree React element
function findElement(
  element: unknown,
  predicate: (el: { type?: unknown; props?: Record<string, unknown> }) => boolean,
): { type?: unknown; props?: Record<string, unknown> } | null {
  if (!element || typeof element !== "object") return null;
  const candidate = element as { type?: unknown; props?: Record<string, unknown> };
  if (predicate(candidate)) return candidate;

  if (candidate.props?.children) {
    const children = Array.isArray(candidate.props.children)
      ? candidate.props.children
      : [candidate.props.children];
    for (const child of children) {
      const found = findElement(child, predicate);
      if (found) return found;
    }
  }
  return null;
}

const mie: MenuItem = {
  id: "mie-cotto",
  name: "Cotto Ayam Laksa",
  description: "Cotto ayam laksa khas Manado",
  price: 15000,
  image_url: null,
  is_available: true,
  option_groups: [
    {
      id: "opsi-kuah",
      name: "Pilihan Kuah",
      type: "single",
      required: true,
      options: [
        { id: "kuah-laksa", name: "Laksa", price_delta: 0, is_available: true },
        { id: "kuah-cotto", name: "Original", price_delta: 0, is_available: true },
      ],
    },
    {
      id: "opsi-tambahan",
      name: "Tambahan",
      type: "multiple",
      required: false,
      options: [
        { id: "tambah-telur", name: "Telur Rebus", price_delta: 3000, is_available: true },
      ],
    },
  ],
};

const esTeh: MenuItem = {
  id: "es-teh",
  name: "Es Teh Manis",
  description: "Es teh manis segar",
  price: 5000,
  image_url: null,
  is_available: true,
  option_groups: [],
};

const mockCategories: Category[] = [
  {
    id: "makanan",
    name: "Makanan",
    items: [mie],
  },
  {
    id: "minuman",
    name: "Minuman",
    items: [esTeh],
  },
];

describe("DesktopCartPanel (components/pelanggan/desktop-cart-panel)", () => {
  let useCartSpy: ReturnType<typeof vi.spyOn>;
  let writeCartSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    useCartSpy = vi.spyOn(useCartModule, "useCart").mockReturnValue([]);
    writeCartSpy = vi.spyOn(useCartModule, "writeCart").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("merender empty state saat keranjang kosong", () => {
    useCartSpy.mockReturnValue([]);

    const html = renderToString(
      <DesktopCartPanel categories={mockCategories} isOpen={true} />,
    );

    expect(html).toContain("Pesanan Kamu");
    expect(html).toContain("Keranjang masih kosong");
    expect(html).toContain("Pilih menu lezat di sebelah kiri untuk mulai memesan 🍲");
    expect(html).not.toContain("desktop-cart-list");
    expect(html).not.toContain("desktop-cart-total");
    expect(html).not.toContain("Lanjut pesan");

    // Bebas dari karakter em dash
    expect(html).not.toContain("\u2014");
  });

  it("merender daftar item keranjang, jumlah, subtotal, dan total dengan format rupiah yang benar", () => {
    const sampleCart: CartLine[] = [
      {
        menuItemId: "mie-cotto",
        optionIds: ["kuah-laksa", "tambah-telur"],
        note: "tidak pedas",
        quantity: 2,
      },
      {
        menuItemId: "es-teh",
        optionIds: [],
        note: "",
        quantity: 1,
      },
    ];
    useCartSpy.mockReturnValue(sampleCart);

    const html = renderToString(
      <DesktopCartPanel categories={mockCategories} isOpen={true} />,
    );

    // Header badge
    expect(html).toContain("Pesanan Kamu");
    expect(html).toContain("3 item");

    // Baris item 1 (15.000 + 3.000 = 18.000 x 2 = Rp36.000)
    expect(html).toContain("Cotto Ayam Laksa");
    expect(html).toContain("Laksa, Telur Rebus");
    expect(html).toContain("tidak pedas");
    expect(html).toContain("Rp36.000");

    // Baris item 2 (5.000 x 1 = Rp5.000)
    expect(html).toContain("Es Teh Manis");
    expect(html).toContain("Rp5.000");

    // Total (36.000 + 5.000 = Rp41.000)
    expect(html).toContain("Rp41.000");

    // Tombol Lanjut Pesan aktif
    expect(html).toContain("Lanjut pesan");
    expect(html).toContain('href="/checkout"');

    // Bebas dari karakter em dash
    expect(html).not.toContain("\u2014");
  });

  it("mengaktifkan tombol checkout saat toko buka dan menonaktifkannya saat toko tutup", () => {
    const sampleCart: CartLine[] = [
      {
        menuItemId: "es-teh",
        optionIds: [],
        note: "",
        quantity: 2,
      },
    ];
    useCartSpy.mockReturnValue(sampleCart);

    // Kondisi 1: Toko buka
    const openHtml = renderToString(
      <DesktopCartPanel categories={mockCategories} isOpen={true} />,
    );
    expect(openHtml).toContain("Lanjut pesan");
    expect(openHtml).toContain('href="/checkout"');
    expect(openHtml).not.toContain("Toko sedang tutup");

    // Kondisi 2: Toko tutup
    const closedHtml = renderToString(
      <DesktopCartPanel categories={mockCategories} isOpen={false} />,
    );
    expect(closedHtml).toContain("Toko sedang tutup");
    expect(closedHtml).toContain("disabled");
    expect(closedHtml).not.toContain('href="/checkout"');
  });

  it("menonaktifkan tombol checkout jika ada menu yang habis atau tidak tersedia", () => {
    const unavailableCategories: Category[] = [
      {
        id: "makanan",
        name: "Makanan",
        items: [{ ...mie, is_available: false }],
      },
    ];
    const sampleCart: CartLine[] = [
      {
        menuItemId: "mie-cotto",
        optionIds: ["kuah-laksa"],
        note: "",
        quantity: 1,
      },
    ];
    useCartSpy.mockReturnValue(sampleCart);

    const html = renderToString(
      <DesktopCartPanel categories={unavailableCategories} isOpen={true} />,
    );

    expect(html).toContain("Menu habis atau berubah. Hapus dari keranjang.");
    expect(html).toContain("Hapus menu yang habis dulu");
    expect(html).toContain("disabled");
    expect(html).not.toContain('href="/checkout"');
  });

  it("memanggil writeCart saat tombol hapus diklik", () => {
    const sampleCart: CartLine[] = [
      {
        menuItemId: "es-teh",
        optionIds: [],
        note: "",
        quantity: 1,
      },
    ];
    useCartSpy.mockReturnValue(sampleCart);

    const element = DesktopCartPanel({
      categories: mockCategories,
      isOpen: true,
    });

    const deleteButton = findElement(
      element,
      (el) =>
        typeof el.props?.onClick === "function" &&
        typeof el.props?.className === "string" &&
        el.props.className.includes("text-danger"),
    );

    expect(deleteButton).toBeDefined();
    expect(typeof deleteButton?.props?.onClick).toBe("function");

    // Jalankan handler onClick tombol Hapus
    (deleteButton?.props?.onClick as () => void)();

    expect(writeCartSpy).toHaveBeenCalledTimes(1);

    // Verifikasi pemutakhiran keranjang menghapus item tersebut
    const updater = writeCartSpy.mock.calls[0][0];
    const result = updater(sampleCart);
    expect(result).toHaveLength(0);
  });

  it("memanggil writeCart saat stepper kuantitas diubah", () => {
    const sampleCart: CartLine[] = [
      {
        menuItemId: "es-teh",
        optionIds: [],
        note: "",
        quantity: 1,
      },
    ];
    useCartSpy.mockReturnValue(sampleCart);

    const element = DesktopCartPanel({
      categories: mockCategories,
      isOpen: true,
    });

    const stepper = findElement(
      element,
      (el) =>
        el.type === QuantityStepper ||
        (typeof el.type === "function" && el.type.name === "QuantityStepper"),
    );

    expect(stepper).toBeDefined();
    expect(typeof stepper?.props?.onChange).toBe("function");

    // Ubah jumlah menjadi 3
    (stepper?.props?.onChange as (q: number) => void)(3);

    expect(writeCartSpy).toHaveBeenCalledTimes(1);

    // Verifikasi pemutakhiran keranjang mengubah jumlah menjadi 3
    const updater = writeCartSpy.mock.calls[0][0];
    const result = updater(sampleCart);
    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(3);
  });
});
