import type { Metadata } from "next";
import { Settings } from "lucide-react";

export const metadata: Metadata = {
  title: "Pengaturan Toko · Dashboard Rumah Makan Sipil",
};

export default function AdminSettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="border-b border-line pb-4">
        <h1 className="font-display text-2xl font-bold text-green-900">Pengaturan Toko</h1>
        <p className="text-sm text-ink-600">Nama toko, nomor WhatsApp, gambar QRIS, dan profil toko.</p>
      </div>

      <div className="rounded-xl border border-line bg-card p-8 text-center shadow-xs">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-cream-100 text-green-800 mb-3">
          <Settings className="size-6" aria-hidden />
        </div>
        <h2 className="font-display text-lg font-bold text-ink-900">Pengaturan & Gambar QRIS</h2>
        <p className="mt-1 text-sm text-ink-600 max-w-md mx-auto">
          Fitur upload gambar QRIS dan pengaturan toko akan diimplementasikan pada Milestone M4.
        </p>
      </div>
    </div>
  );
}
