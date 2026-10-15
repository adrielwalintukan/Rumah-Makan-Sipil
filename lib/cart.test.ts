import { describe, expect, it } from "vitest";
import {
  MAX_QUANTITY,
  addLine,
  isSelectionValid,
  lineKey,
  parseCart,
  resolveCart,
  setQuantity,
  unitPrice,
  type CartLine,
} from "./cart";
import type { Category, MenuItem } from "./menu";

const mie: MenuItem = {
  id: "mie",
  name: "Mie",
  description: null,
  price: 7000,
  image_url: null,
  is_available: true,
  option_groups: [
    {
      id: "jenis",
      name: "Jenis",
      type: "single",
      required: true,
      options: [
        { id: "kuah", name: "Kuah", price_delta: 0, is_available: true },
        { id: "goreng", name: "Goreng", price_delta: 0, is_available: true },
      ],
    },
    {
      id: "tambahan",
      name: "Tambahan",
      type: "multiple",
      required: false,
      options: [{ id: "telur", name: "Telur", price_delta: 3000, is_available: true }],
    },
  ],
};
const aqua: MenuItem = { ...mie, id: "aqua", name: "Aqua", price: 5000, option_groups: [] };
const menu: Category[] = [{ id: "c", name: "Makanan", items: [mie, aqua] }];
const line = (l: Partial<CartLine>): CartLine => ({ menuItemId: "mie", optionIds: [], note: "", quantity: 1, ...l });

describe("harga & validasi pilihan", () => {
  it("Mie Goreng + Telur = Rp10.000 seperti di banner", () => {
    expect(unitPrice(mie, ["goreng", "telur"])).toBe(10000);
  });

  it("grup wajib harus dipilih, grup single maks. 1", () => {
    expect(isSelectionValid(mie, [])).toBe(false);
    expect(isSelectionValid(mie, ["telur"])).toBe(false);
    expect(isSelectionValid(mie, ["kuah"])).toBe(true);
    expect(isSelectionValid(mie, ["kuah", "goreng"])).toBe(false);
  });

  it("opsi yang habis membuat pilihan tidak valid", () => {
    const habis: MenuItem = {
      ...mie,
      option_groups: mie.option_groups.map((g) => ({
        ...g,
        options: g.options.map((o) => ({ ...o, is_available: o.id !== "goreng" })),
      })),
    };
    expect(isSelectionValid(habis, ["goreng"])).toBe(false);
  });
});

describe("baris keranjang", () => {
  it("menu + opsi + catatan sama digabung; urutan opsi tidak berpengaruh", () => {
    let cart = addLine([], line({ optionIds: ["goreng", "telur"], quantity: 1 }));
    cart = addLine(cart, line({ optionIds: ["telur", "goreng"], quantity: 2 }));
    expect(cart).toHaveLength(1);
    expect(cart[0].quantity).toBe(3);
  });

  it("opsi atau catatan berbeda jadi baris terpisah (US-02)", () => {
    let cart = addLine([], line({ optionIds: ["kuah"] }));
    cart = addLine(cart, line({ optionIds: ["goreng"] }));
    cart = addLine(cart, line({ optionIds: ["kuah"], note: "tidak pedas" }));
    expect(cart).toHaveLength(3);
  });

  it("jumlah dibatasi 1–20; 0 menghapus baris", () => {
    const cart = addLine([], line({ optionIds: ["kuah"], quantity: 50 }));
    expect(cart[0].quantity).toBe(MAX_QUANTITY);
    expect(setQuantity(cart, lineKey(cart[0]), 0)).toEqual([]);
  });
});

describe("resolveCart", () => {
  it("menghitung jumlah & total dari harga menu terbaru, bukan harga lama", () => {
    const cart = [line({ optionIds: ["goreng", "telur"], quantity: 2 }), line({ menuItemId: "aqua", quantity: 1 })];
    const r = resolveCart(cart, menu);
    expect(r.count).toBe(3);
    expect(r.total).toBe(2 * 10000 + 5000);
    expect(r.hasUnavailable).toBe(false);
  });

  it("menu habis atau terhapus ditandai dan tidak dihitung", () => {
    const habisMenu: Category[] = [{ ...menu[0], items: [{ ...aqua, is_available: false }] }];
    const r = resolveCart([line({ menuItemId: "aqua" }), line({ optionIds: ["kuah"] })], habisMenu);
    expect(r.lines.map((l) => l.available)).toEqual([false, false]);
    expect(r.total).toBe(0);
    expect(r.hasUnavailable).toBe(true);
  });
});

describe("parseCart", () => {
  it("data rusak atau asing dibuang tanpa crash", () => {
    expect(parseCart(null)).toEqual([]);
    expect(parseCart("bukan json")).toEqual([]);
    expect(parseCart('{"a":1}')).toEqual([]);
    expect(parseCart(JSON.stringify([{ menuItemId: "x", optionIds: [], note: "", quantity: -1 }, 5]))).toEqual([]);
  });

  it("baris valid dipertahankan, catatan & jumlah dipotong ke batas", () => {
    const raw = JSON.stringify([{ menuItemId: "mie", optionIds: ["kuah"], note: "x".repeat(150), quantity: 99 }]);
    const [l] = parseCart(raw);
    expect(l.note).toHaveLength(100);
    expect(l.quantity).toBe(MAX_QUANTITY);
  });
});
