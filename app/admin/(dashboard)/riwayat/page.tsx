import type { Metadata } from "next";
import { History } from "lucide-react";

export const metadata: Metadata = {
  title: "Riwayat Pesanan · Dashboard Rumah Makan Sipil",
};

export default function AdminHistoryPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="border-b border-line pb-4">
        <h1 className="font-display text-2xl font-bold text-green-900">Riwayat Pesanan</h1>
        <p className="text-sm text-ink-600">Daftar arsip pesanan selesai dan dibatalkan per tanggal.</p>
      </div>

      <div className="rounded-xl border border-line bg-card p-8 text-center shadow-xs">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-cream-100 text-green-800 mb-3">
          <History className="size-6" aria-hidden />
        </div>
        <h2 className="font-display text-lg font-bold text-ink-900">Arsip Riwayat</h2>
        <p className="mt-1 text-sm text-ink-600 max-w-md mx-auto">
          Fitur filter riwayat pesanan akan diimplementasikan pada Milestone M5.
        </p>
      </div>
    </div>
  );
}
