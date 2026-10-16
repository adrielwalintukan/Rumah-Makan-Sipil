import type { Metadata } from "next";
import { QrCode } from "lucide-react";

export const metadata: Metadata = {
  title: "Poster QR · Dashboard Rumah Makan Sipil",
};

export default function AdminQrPosterPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="border-b border-line pb-4">
        <h1 className="font-display text-2xl font-bold text-green-900">Poster QR Pesan</h1>
        <p className="text-sm text-ink-600">Pratinjau poster meja dan kasir, siap cetak (A4/A5) atau unduh PNG.</p>
      </div>

      <div className="rounded-xl border border-line bg-card p-8 text-center shadow-xs">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-cream-100 text-green-800 mb-3">
          <QrCode className="size-6" aria-hidden />
        </div>
        <h2 className="font-display text-lg font-bold text-ink-900">Cetak & Unduh Poster</h2>
        <p className="mt-1 text-sm text-ink-600 max-w-md mx-auto">
          Fitur cetak poster QR dan unduh gambar akan diimplementasikan pada Milestone M6.
        </p>
      </div>
    </div>
  );
}
