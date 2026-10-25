import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { PromoCarousel } from "./promo-carousel";
import type { StoreSettings } from "@/lib/menu";

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
});
