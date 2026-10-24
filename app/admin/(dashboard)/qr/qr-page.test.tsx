import { beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { renderToString } from "react-dom/server";

// Mock server-only
vi.mock("server-only", () => ({}));

// Mock connection
vi.mock("next/server", () => ({
  connection: vi.fn(),
}));

// Mock auth
const mockGetAdminUser = vi.fn();
vi.mock("@/lib/auth", () => ({
  getAdminUser: () => mockGetAdminUser(),
}));

// Mock redirect
const mockRedirect = vi.fn().mockImplementation((url: string) => {
  const err = new Error(`NEXT_REDIRECT: ${url}`);
  (err as unknown as { digest: string }).digest = `NEXT_REDIRECT;replace;${url};307;`;
  throw err;
});
vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => mockRedirect(...args),
}));

// Mock Supabase
const mockSingle = vi.fn();
const mockEq = vi.fn(() => ({ single: mockSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));
const mockSupabase = { from: mockFrom };

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => mockSupabase,
}));

// Mock generateQrDataUrl
vi.mock("@/lib/qr", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/qr")>();
  return {
    ...actual,
    generateQrDataUrl: vi.fn().mockResolvedValue("data:image/png;base64,mockqr"),
  };
});

import AdminQrPosterPage, {
  QrPosterLoader,
  QrPosterLoadingSkeleton,
} from "./page";

describe("AdminQrPosterPage (/admin/qr)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("QrPosterLoader", () => {
    it("me-redirect pengguna yang belum login ke /admin/login", async () => {
      mockGetAdminUser.mockResolvedValueOnce(null);

      await expect(QrPosterLoader()).rejects.toThrow(
        "NEXT_REDIRECT: /admin/login"
      );
      expect(mockRedirect).toHaveBeenCalledWith("/admin/login");
    });

    it("memuat data settings dan merender poster saat admin terautentikasi", async () => {
      mockGetAdminUser.mockResolvedValueOnce({
        id: "admin-123",
        email: "owner@rumahmakansipil.com",
      });
      mockSingle.mockResolvedValueOnce({
        data: {
          store_name: "Warung Sipil Mantap",
          tagline: "Ikan Bakar Rica Sedap",
        },
        error: null,
      });

      const element = await QrPosterLoader();
      const html = renderToString(element);

      expect(html).toContain("Warung Sipil Mantap");
      expect(html).toContain("Ikan Bakar Rica Sedap");
      expect(html).toContain("Cetak Poster");
    });

    it("menggunakan data fallback jika baris settings di database kosong", async () => {
      mockGetAdminUser.mockResolvedValueOnce({
        id: "admin-123",
        email: "owner@rumahmakansipil.com",
      });
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const element = await QrPosterLoader();
      const html = renderToString(element);

      expect(html).toContain("Rumah Makan Sipil");
      expect(html).toContain("Spesialis Masakan Rumahan &amp; Ikan Bakar Khas Manado");
    });
  });

  describe("QrPosterLoadingSkeleton & AdminQrPosterPage", () => {
    it("merender skeleton loading state dengan benar", () => {
      const html = renderToString(<QrPosterLoadingSkeleton />);
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain("animate-pulse");
    });

    it("merender container halaman utama dengan judul dan deskripsi", () => {
      const html = renderToString(<AdminQrPosterPage />);
      expect(html).toContain("Poster QR Pemesanan");
      expect(html).toContain("Pratinjau poster siap cetak (A4/A5)");
    });
  });
});
