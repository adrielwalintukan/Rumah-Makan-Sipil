import { describe, it, expect } from "vitest";
import * as React from "react";
import { renderToString } from "react-dom/server";
import NotFound, { metadata } from "./not-found";

describe("Global 404 Page (app/not-found.tsx)", () => {
  it("merender judul, pesan ramah, dan tombol aksi menuju beranda", () => {
    const html = renderToString(<NotFound />);

    // Judul dan teks ramah
    expect(html).toContain("Halaman Tidak Ditemukan");
    expect(html).toContain(
      "Sepertinya halaman yang kamu tuju tidak ada atau menu sudah dipindahkan. Yuk kembali ke menu makanan enak hari ini."
    );

    // Identitas visual dan styling design system
    expect(html).toContain("font-display");
    expect(html).toContain("text-green-900");
    expect(html).toContain("bg-cream-50");

    // Tombol aksi utama menuju menu
    expect(html).toContain("Lihat Menu");
    expect(html).toContain('href="/"');

    // Aturan Antislop: Bebas dari karakter em dash
    expect(html).not.toContain("—");
  });

  it("menyediakan metadata yang ramah SEO dan pengguna", () => {
    expect(metadata.title).toContain("Halaman Tidak Ditemukan");
    expect(metadata.description).toBeDefined();
    expect(typeof metadata.description).toBe("string");
    expect(metadata.description).not.toContain("—");
  });
});
