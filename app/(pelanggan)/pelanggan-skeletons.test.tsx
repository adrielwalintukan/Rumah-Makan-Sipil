import { describe, it, expect, vi } from "vitest";
import * as React from "react";
import { renderToString } from "react-dom/server";

// Mock server-only agar Server Components yang mengimpor modul server dapat diuji
vi.mock("server-only", () => ({}));

import { CartSkeleton } from "./keranjang/page";
import { CheckoutSkeleton } from "./checkout/page";
import { OrderTrackSkeleton } from "./pesanan/[token]/page";

describe("Pelanggan Skeletons (Loading States)", () => {
  describe("CartSkeleton", () => {
    it("merender aria-busy, animate-pulse, aria-label, dan token warna bg-cream-100", () => {
      const html = renderToString(<CartSkeleton />);

      // Aksesibilitas
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('aria-label="Memuat keranjang"');

      // Animasi dan token warna (design-system.md §6.8)
      expect(html).toContain("animate-pulse");
      expect(html).toContain("bg-cream-100");
    });

    it("memiliki placeholder untuk item, kartu total, dan tombol aksi", () => {
      const html = renderToString(<CartSkeleton />);

      // Kartu container dan pembatas line
      expect(html).toContain("divide-line");
      expect(html).toContain("border-line");
      expect(html).toContain("bg-card");

      // Memiliki minimal 3 baris item placeholder dengan bg-cream-100
      const creamCount = (html.match(/bg-cream-100/g) || []).length;
      expect(creamCount).toBeGreaterThanOrEqual(8);
    });
  });

  describe("CheckoutSkeleton", () => {
    it("merender aria-busy, animate-pulse, aria-label, dan token warna bg-cream-100", () => {
      const html = renderToString(<CheckoutSkeleton />);

      // Aksesibilitas
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('aria-label="Memuat formulir checkout"');

      // Animasi dan token warna (design-system.md §6.8)
      expect(html).toContain("animate-pulse");
      expect(html).toContain("bg-cream-100");
    });

    it("memiliki placeholder untuk jenis pesanan, form data pemesan, metode pembayaran, ringkasan, dan tombol", () => {
      const html = renderToString(<CheckoutSkeleton />);

      // Grid opsi jenis pesanan (2 kolom)
      expect(html).toContain("grid-cols-2");

      // Ringkasan pesanan container
      expect(html).toContain("bg-card");
      expect(html).toContain("border-line");

      // Memiliki sejumlah elemen skeleton bg-cream-100
      const creamCount = (html.match(/bg-cream-100/g) || []).length;
      expect(creamCount).toBeGreaterThanOrEqual(8);
    });
  });

  describe("OrderTrackSkeleton", () => {
    it("merender aria-busy, animate-pulse, aria-label, dan token warna bg-cream-100", () => {
      const html = renderToString(<OrderTrackSkeleton />);

      // Aksesibilitas
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('aria-label="Memuat status pesanan"');

      // Animasi dan token warna (design-system.md §6.8)
      expect(html).toContain("animate-pulse");
      expect(html).toContain("bg-cream-100");
    });

    it("memiliki placeholder untuk nomor antrean, status, instruksi pembayaran, dan rincian pesanan", () => {
      const html = renderToString(<OrderTrackSkeleton />);

      // Area nomor antrean besar & kartu
      expect(html).toContain("bg-card");
      expect(html).toContain("rounded-full");

      // Memiliki sejumlah elemen skeleton bg-cream-100
      const creamCount = (html.match(/bg-cream-100/g) || []).length;
      expect(creamCount).toBeGreaterThanOrEqual(10);
    });
  });
});
