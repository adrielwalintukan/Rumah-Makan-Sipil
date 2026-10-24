import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as React from "react";
import { renderToString } from "react-dom/server";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";

describe("Audit Aksesibilitas, Safe Area, dan Motion (Task 5)", () => {
  const rootDir = process.cwd();
  const globalsCssPath = path.join(rootDir, "app", "globals.css");
  const globalsCss = fs.readFileSync(globalsCssPath, "utf8");

  describe("1. Audit & Perbaikan Animasi Reduced-Motion", () => {
    it("memiliki blok CSS @media (prefers-reduced-motion: reduce) di app/globals.css", () => {
      expect(globalsCss).toContain("@media (prefers-reduced-motion: reduce)");
    });

    it("meminimalkan durasi animasi dan transisi saat prefers-reduced-motion aktif", () => {
      expect(globalsCss).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
      expect(globalsCss).toMatch(/animation-iteration-count:\s*1\s*!important/);
      expect(globalsCss).toMatch(/transition-duration:\s*0\.01ms\s*!important/);
    });

    it("menonaktifkan smooth scroll dengan scroll-behavior auto saat reduced-motion aktif", () => {
      expect(globalsCss).toMatch(/scroll-behavior:\s*auto\s*!important/);
    });
  });

  describe("2. Audit Safe Area Viewport iPhone & HP Android", () => {
    it("memiliki definisi safe area utility pb-safe di app/globals.css", () => {
      expect(globalsCss).toContain("pb-safe");
      expect(globalsCss).toContain("env(safe-area-inset-bottom)");
    });

    it("memperhitungkan safe area pada bilah keranjang bawah pelanggan (CartBar)", () => {
      const cartBarPath = path.join(rootDir, "components", "pelanggan", "cart-bar.tsx");
      const cartBarContent = fs.readFileSync(cartBarPath, "utf8");
      expect(cartBarContent).toContain("safe-area-inset-bottom");
      expect(cartBarContent).toMatch(/pb-\[max\(\d+(\.\d+)?rem,env\(safe-area-inset-bottom\)\)\]/);
    });

    it("memperhitungkan safe area pada navigasi bawah admin (AdminNav)", () => {
      const adminNavPath = path.join(rootDir, "components", "admin", "admin-nav.tsx");
      const adminNavContent = fs.readFileSync(adminNavPath, "utf8");
      expect(adminNavContent).toMatch(/pb-safe|safe-area-inset-bottom/);
    });

    it("memperhitungkan safe area pada lembar pilihan opsi menu (OptionSheet)", () => {
      const optionSheetPath = path.join(rootDir, "components", "pelanggan", "option-sheet.tsx");
      const optionSheetContent = fs.readFileSync(optionSheetPath, "utf8");
      expect(optionSheetContent).toContain("safe-area-inset-bottom");
    });
  });

  describe("3. Pencegahan Auto-Zoom iOS Safari pada Kolom Input", () => {
    it("komponen Input merender kelas text-base (minimal 16px) secara default", () => {
      const html = renderToString(React.createElement(Input, { placeholder: "Uji input" }));
      expect(html).toContain("text-base");
      expect(html).toContain('data-slot="input"');
    });

    it("komponen Input tidak menggunakan font di bawah 16px (text-sm atau text-xs) di mobile", () => {
      const inputPath = path.join(rootDir, "components", "ui", "input.tsx");
      const inputContent = fs.readFileSync(inputPath, "utf8");
      expect(inputContent).toContain("text-base");
      expect(inputContent).not.toMatch(/\btext-sm\b(?!\s*file:)/);
    });

    it("seluruh input dan textarea pada form admin memiliki ukuran font minimal text-base pada mobile", () => {
      const filesToCheck = [
        path.join(rootDir, "components", "admin", "finance", "expense-form-dialog.tsx"),
        path.join(rootDir, "components", "admin", "finance", "finance-period-selector.tsx"),
        path.join(rootDir, "components", "admin", "history", "history-filter-bar.tsx"),
        path.join(rootDir, "components", "admin", "order-card.tsx"),
        path.join(rootDir, "components", "admin", "reports", "report-period-selector.tsx"),
        path.join(rootDir, "components", "admin", "login-form.tsx"),
        path.join(rootDir, "components", "admin", "menu", "menu-item-form.tsx"),
        path.join(rootDir, "components", "pelanggan", "option-sheet.tsx"),
      ];

      for (const filePath of filesToCheck) {
        const content = fs.readFileSync(filePath, "utf8");
        expect(content).toContain("text-base");
      }
    });
  });

  describe("4. Audit Fokus Keyboard & Aksesibilitas", () => {
    it("komponen Button memiliki kelas ring fokus keyboard yang jelas", () => {
      const buttonHtml = renderToString(React.createElement(Button, null, "Tombol Uji"));
      expect(buttonHtml).toContain("focus-visible:ring-2");
      expect(buttonHtml).toContain("focus-visible:ring-green-700");
    });

    it("buttonVariants menghasilkan kelas fokus keyboard untuk varian default", () => {
      const classes = buttonVariants({ variant: "default" });
      expect(classes).toContain("focus-visible:outline-none");
      expect(classes).toContain("focus-visible:ring-2");
      expect(classes).toContain("focus-visible:ring-green-700");
    });

    it("komponen Input memiliki ring fokus keyboard yang jelas saat aktif", () => {
      const html = renderToString(React.createElement(Input, { placeholder: "Uji fokus" }));
      expect(html).toContain("focus-visible:border-green-700");
      expect(html).toContain("focus-visible:outline-none");
    });
  });

  describe("5. Kepatuhan Standar Penulisan (Nol Karakter Em Dash)", () => {
    it("tidak terdapat karakter em dash pada berkas CSS dan komponen yang dimodifikasi", () => {
      const filesToCheck = [
        globalsCssPath,
        path.join(rootDir, "components", "pelanggan", "cart-bar.tsx"),
        path.join(rootDir, "components", "admin", "admin-nav.tsx"),
        path.join(rootDir, "components", "ui", "input.tsx"),
        path.join(rootDir, "components", "ui", "button.tsx"),
        path.join(rootDir, "lib", "accessibility.test.ts"),
      ];

      for (const filePath of filesToCheck) {
        const content = fs.readFileSync(filePath, "utf8");
        expect(content.includes("\u2014")).toBe(false);
      }
    });
  });
});
