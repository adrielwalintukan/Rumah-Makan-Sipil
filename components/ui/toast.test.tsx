import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as React from "react";
import { renderToString } from "react-dom/server";
import {
  toast,
  dismissToast,
  clearToasts,
  getToasts,
  ToastItem,
  Toaster,
  type ToastProps,
} from "./toast";

describe("Toast System (components/ui/toast)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearToasts();
  });

  afterEach(() => {
    clearToasts();
    vi.restoreAllMocks();
  });

  describe("Fungsi toast() helper & state queue", () => {
    it("menambahkan toast baru dengan ID unik dan data yang sesuai", () => {
      const result = toast({
        title: "Pesanan Diproses",
        description: "Pesanan #001 sedang disiapkan di dapur.",
        variant: "success",
      });

      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe("string");
      expect(typeof result.dismiss).toBe("function");

      const activeToasts = getToasts();
      expect(activeToasts).toHaveLength(1);
      expect(activeToasts[0].title).toBe("Pesanan Diproses");
      expect(activeToasts[0].description).toBe(
        "Pesanan #001 sedang disiapkan di dapur."
      );
      expect(activeToasts[0].variant).toBe("success");
    });

    it("menggunakan variant default dan durasi 3000ms jika tidak dispesifikasikan", () => {
      toast({
        title: "Pemberitahuan",
      });

      const activeToasts = getToasts();
      expect(activeToasts).toHaveLength(1);
      expect(activeToasts[0].variant).toBe("default");
      expect(activeToasts[0].duration).toBe(3000);
    });

    it("menghapus toast secara manual melalui fungsi dismiss()", () => {
      const { dismiss } = toast({
        title: "Notifikasi A",
      });

      expect(getToasts()).toHaveLength(1);
      dismiss();
      expect(getToasts()).toHaveLength(0);
    });

    it("menghapus toast secara manual melalui dismissToast(id)", () => {
      const { id } = toast({
        title: "Notifikasi B",
      });

      expect(getToasts()).toHaveLength(1);
      dismissToast(id);
      expect(getToasts()).toHaveLength(0);
    });

    it("menghapus toast secara otomatis setelah 3 detik (3000 ms)", () => {
      toast({
        title: "Auto Dismiss",
      });

      expect(getToasts()).toHaveLength(1);

      // Sebelum 3000 ms masih ada
      vi.advanceTimersByTime(2900);
      expect(getToasts()).toHaveLength(1);

      // Lewat 3000 ms harus sudah hilang
      vi.advanceTimersByTime(150);
      expect(getToasts()).toHaveLength(0);
    });

    it("menghormati durasi kustom jika diberikan", () => {
      toast({
        title: "Durasi Panjang",
        duration: 5000,
      });

      expect(getToasts()).toHaveLength(1);

      vi.advanceTimersByTime(3500);
      expect(getToasts()).toHaveLength(1);

      vi.advanceTimersByTime(1600);
      expect(getToasts()).toHaveLength(0);
    });
  });

  describe("Komponen ToastItem & Varian Visual (docs/design-system.md §6.8)", () => {
    it("merender varian success dengan border hijau, ikon, teks, dan atribut aksesibilitas", () => {
      const mockDismiss = vi.fn();
      const item: ToastProps = {
        id: "toast-1",
        title: "Berhasil Simpan",
        description: "Data telah disimpan ke server.",
        variant: "success",
      };

      const html = renderToString(
        <ToastItem toast={item} onDismiss={mockDismiss} />
      );

      expect(html).toContain('role="status"');
      expect(html).toContain('aria-live="polite"');
      expect(html).toContain('aria-atomic="true"');
      expect(html).toContain("border-green-700");
      expect(html).toContain("text-green-700");
      expect(html).toContain("text-green-900");
      expect(html).toContain("Berhasil Simpan");
      expect(html).toContain("Data telah disimpan ke server.");
      expect(html).toContain('aria-label="Tutup notifikasi"');
    });

    it("merender varian danger dengan border danger, teks, dan ikon merah", () => {
      const mockDismiss = vi.fn();
      const item: ToastProps = {
        id: "toast-2",
        title: "Terjadi Galat",
        description: "Gagal menghubungkan ke basis data.",
        variant: "danger",
      };

      const html = renderToString(
        <ToastItem toast={item} onDismiss={mockDismiss} />
      );

      expect(html).toContain('role="status"');
      expect(html).toContain('aria-live="polite"');
      expect(html).toContain("border-danger");
      expect(html).toContain("text-danger");
      expect(html).toContain("Terjadi Galat");
      expect(html).toContain("Gagal menghubungkan ke basis data.");
    });

    it("merender varian default dengan border line dan teks netral", () => {
      const mockDismiss = vi.fn();
      const item: ToastProps = {
        id: "toast-3",
        title: "Informasi",
        description: "Warung buka hingga pukul 21:00 WITA.",
        variant: "default",
      };

      const html = renderToString(
        <ToastItem toast={item} onDismiss={mockDismiss} />
      );

      expect(html).toContain('role="status"');
      expect(html).toContain('aria-live="polite"');
      expect(html).toContain("border-line");
      expect(html).toContain("text-ink-900");
      expect(html).toContain("Informasi");
      expect(html).toContain("Warung buka hingga pukul 21:00 WITA.");
    });
  });

  describe("Komponen Toaster Container", () => {
    it("tidak merender apa pun saat antrean toast kosong", () => {
      const html = renderToString(<Toaster />);
      expect(html).toBe("");
    });

    it("merender kontainer fixed di bagian atas layar saat ada toast aktif", () => {
      toast({
        title: "Notifikasi Global",
        description: "Pesan sistem aktif.",
        variant: "success",
      });

      const html = renderToString(<Toaster />);
      expect(html).toContain("fixed top-4 inset-x-0 mx-auto max-w-sm px-4 z-50");
      expect(html).toContain("Notifikasi Global");
      expect(html).toContain("Pesan sistem aktif.");
    });
  });
});
