import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { MenuCard } from "./menu-card";
import type { MenuItem } from "@/lib/menu";

const item: MenuItem = {
  id: "m-1",
  name: "Nasi Campur",
  description: null,
  price: 15000,
  image_url: "https://example.test/nasi.jpg",
  is_available: true,
  option_groups: [],
};

const render = (i: MenuItem) =>
  renderToString(<MenuCard item={i} category="Makanan" cart={[]} canOrder onOpen={() => {}} />);

describe("MenuCard", () => {
  it("foto menu bisa diketuk untuk dilihat besar", () => {
    expect(render(item)).toContain('aria-label="Lihat foto Nasi Campur"');
  });

  it("placeholder tanpa foto tidak menjadi tombol lihat foto", () => {
    expect(render({ ...item, image_url: null })).not.toContain("Lihat foto");
  });
});
