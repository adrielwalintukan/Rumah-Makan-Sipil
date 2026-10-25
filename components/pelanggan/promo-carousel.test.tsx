import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { PromoCarousel } from "./promo-carousel";
import type { MenuItem, StoreSettings } from "@/lib/menu";

const settings: StoreSettings = {
  is_open: true,
  store_name: "Rumah Makan Sipil",
  tagline: null,
  whatsapp_number: "6289580656723",
  dos_price: 25000,
};

describe("PromoCarousel", () => {
  it("menampilkan 3 slide dengan label posisi untuk pembaca layar", () => {
    const html = renderToString(<PromoCarousel settings={settings} />);
    expect(html).toContain('aria-roledescription="carousel"');
    expect(html.match(/aria-roledescription="slide"/g)).toHaveLength(3);
    expect(html).toContain("1 dari 3: Paket Makanan Dos");
  });

  it("tombol Paket Dos membuka WhatsApp toko dengan pesan terisi (US-07)", () => {
    const html = renderToString(<PromoCarousel settings={settings} />);
    const href = html.match(/href="(https:\/\/wa\.me\/[^"]+)"/)?.[1].replace(/&amp;/g, "&");
    expect(href).toBeDefined();
    expect(href!.startsWith("https://wa.me/6289580656723?text=")).toBe(true);
    expect(decodeURIComponent(href!.split("text=")[1])).toContain(
      "Halo Rumah Makan Sipil, saya mau pesan Paket Dos (Rp25.000/dos)",
    );
  });

  const nasi: MenuItem = {
    id: "m-nasi",
    name: "Nasi Campur",
    description: null,
    price: 15000,
    image_url: null,
    is_available: true,
    option_groups: [
      { id: "g1", name: "Lauk", type: "single", required: true, options: [{ id: "o1", name: "Ayam", price_delta: 2000, is_available: true }] },
    ],
  };
  const teh: MenuItem = { ...nasi, id: "m-teh", name: "Teh Manis", price: 5000, option_groups: [] };

  it("menampilkan menu unggulan lebih dulu dengan tombol Pilih/Tambah sesuai pilihan menu", () => {
    const html = renderToString(
      <PromoCarousel
        settings={settings}
        featured={[
          { item: nasi, category: "Makanan" },
          { item: teh, category: "Minuman" },
        ]}
        canOrder
        onPick={() => {}}
      />,
    );
    expect(html.match(/aria-roledescription="slide"/g)).toHaveLength(5);
    expect(html).toContain("1 dari 5: Nasi Campur");
    expect(html).toContain("Menu unggulan");
    expect(html).toContain('aria-label="Pilih Nasi Campur"');
    expect(html).toContain('aria-label="Tambah Teh Manis"');
  });

  it("tanpa tombol pesan di slide menu unggulan saat toko tutup", () => {
    const html = renderToString(
      <PromoCarousel settings={settings} featured={[{ item: teh, category: "Minuman" }]} canOrder={false} onPick={() => {}} />,
    );
    expect(html).toContain("1 dari 4: Teh Manis");
    expect(html).not.toContain('aria-label="Tambah Teh Manis"');
  });
});
