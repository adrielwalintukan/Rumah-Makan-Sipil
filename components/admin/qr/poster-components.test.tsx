import { describe, it, expect } from "vitest";
import * as React from "react";
import { renderToString } from "react-dom/server";
import { PosterCard } from "./poster-card";
import { QrPosterDashboard } from "./qr-poster-dashboard";

describe("components/admin/qr/poster-card", () => {
  const dummyProps = {
    size: "a4" as const,
    storeName: "Rumah Makan Sipil",
    tagline: "Spesialis Masakan Rumahan & Ikan Bakar Khas Manado",
    qrDataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    siteUrl: "https://rumah-makan-sipil.vercel.app",
  };

  it("merender nama toko, tagline, dan emblem RMS dengan benar", () => {
    const html = renderToString(<PosterCard {...dummyProps} />);

    expect(html).toContain("Rumah Makan Sipil");
    expect(html).toContain("Spesialis Masakan Rumahan &amp; Ikan Bakar Khas Manado");
    expect(html).toContain("RMS");
  });

  it("merender gambar QR code saat data URL tersedia", () => {
    const html = renderToString(<PosterCard {...dummyProps} />);

    expect(html).toContain('alt="QR Code Pemesanan Rumah Makan Sipil"');
    expect(html).toContain(dummyProps.qrDataUrl);
  });

  it("merender fallback saat data URL kosong", () => {
    const html = renderToString(<PosterCard {...dummyProps} qrDataUrl="" />);

    expect(html).toContain("Membuat QR...");
  });

  it("merender 3 langkah pemesanan dan URL web toko", () => {
    const html = renderToString(<PosterCard {...dummyProps} />);

    expect(html).toContain("1. Scan QR");
    expect(html).toContain("2. Pilih Menu");
    expect(html).toContain("3. Bayar");
    expect(html).toContain(dummyProps.siteUrl);
  });

  it("merender proporsi khusus untuk ukuran A5", () => {
    const html = renderToString(<PosterCard {...dummyProps} size="a5" />);

    expect(html).toContain("aspect-[210/297]");
    expect(html).toContain("RMS");
  });

  it("merender proporsi ringkas untuk ukuran A6 (tenda meja kecil)", () => {
    const html = renderToString(<PosterCard {...dummyProps} size="a6" />);

    expect(html).toContain("rounded-xl border-2 border-[#1F3D2B]");
    expect(html).toContain("p-2 sm:p-2.5");
    expect(html).toContain("RMS");
  });
});

describe("components/admin/qr/qr-poster-dashboard", () => {
  const defaultDashboardProps = {
    initialStoreName: "Rumah Makan Sipil",
    initialTagline: "Spesialis Masakan Rumahan",
    initialQrDataUrl: "data:image/png;base64,dummy",
    siteUrl: "https://rumah-makan-sipil.vercel.app",
  };

  it("merender kontrol pilihan ukuran A4, A5, dan A6", () => {
    const html = renderToString(
      <QrPosterDashboard {...defaultDashboardProps} />
    );

    expect(html).toContain("Ukuran A4 (Dinding / Kasir)");
    expect(html).toContain("Ukuran A5 (Meja Sedang)");
    expect(html).toContain("Ukuran A6 (Tenda Meja Kecil)");
    expect(html).toContain('aria-pressed="true"');
  });

  it("merender tombol Cetak Poster, Unduh Dokumen Word, dan Unduh PNG", () => {
    const html = renderToString(
      <QrPosterDashboard {...defaultDashboardProps} />
    );

    expect(html).toContain("Cetak Poster");
    expect(html).toContain("Unduh Dokumen Word");
    expect(html).toContain("Unduh PNG (300 DPI)");
  });

  it("merender teks tips cetak untuk meja makan", () => {
    const html = renderToString(
      <QrPosterDashboard {...defaultDashboardProps} />
    );

    expect(html).toContain("Tips Cetak &amp; Pengaturan:");
    expect(html).toContain("A6 (Tenda Meja Kecil, ~10x15 cm)");
  });

  it("menampilkan peringatan URL jika siteUrl menunjuk ke localhost di non-production", () => {
    const html = renderToString(
      <QrPosterDashboard
        {...defaultDashboardProps}
        siteUrl="http://localhost:3000"
        isProduction={false}
      />
    );

    expect(html).toContain("Perhatian URL Localhost:");
    expect(html).toContain("http://localhost:3000");
    // Tombol tetap aktif saat non-production
    expect(html).not.toContain("Aksi Cetak &amp; Unduh Dinonaktifkan:");
  });

  it("memblokir dan menonaktifkan aksi cetak & unduh di production jika URL localhost", () => {
    const html = renderToString(
      <QrPosterDashboard
        {...defaultDashboardProps}
        siteUrl="http://localhost:3000"
        isProduction={true}
      />
    );

    expect(html).toContain("Aksi Cetak &amp; Unduh Dinonaktifkan:");
    expect(html).toContain('disabled=""');
  });

  it("TIDAK menampilkan peringatan URL jika siteUrl adalah domain HTTPS publik di production", () => {
    const html = renderToString(
      <QrPosterDashboard
        {...defaultDashboardProps}
        siteUrl="https://rumah-makan-sipil.vercel.app"
        isProduction={true}
      />
    );

    expect(html).not.toContain("Perhatian URL Localhost:");
    expect(html).not.toContain("Aksi Cetak &amp; Unduh Dinonaktifkan:");
  });

  it("merender dynamic print @page size", () => {
    const html = renderToString(
      <QrPosterDashboard {...defaultDashboardProps} />
    );

    expect(html).toContain("@page");
    expect(html).toContain("210mm 297mm");
  });
});
