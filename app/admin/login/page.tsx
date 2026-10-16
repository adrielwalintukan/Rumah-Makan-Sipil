import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";
import { LoginForm } from "@/components/admin/login-form";

export const metadata: Metadata = {
  title: "Login Pemilik · Rumah Makan Sipil",
  description: "Masuk ke dashboard pemilik Rumah Makan Sipil.",
};

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12 bg-cream-50">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-600 hover:text-green-900 transition-colors"
          >
            <ArrowLeft className="size-4" aria-hidden />
            <span>Kembali ke Menu</span>
          </Link>
          <div className="flex items-center gap-1 text-[11px] font-semibold text-ink-400">
            <Shield className="size-3.5 text-green-700" aria-hidden />
            <span>Akses Khusus</span>
          </div>
        </div>

        <div className="flex flex-col items-center text-center gap-1.5">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-green-700 text-white shadow-sm mb-2">
            <span className="font-display text-2xl font-bold tracking-wider">RMS</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-green-900">
            Rumah Makan Sipil
          </h1>
          <p className="text-sm text-ink-600">
            Masuk ke Dashboard Pemilik (Kasir & Dapur)
          </p>
        </div>

        <div className="rounded-xl border border-line bg-card p-6 shadow-xs">
          <LoginForm />
        </div>

        <p className="text-center text-xs text-ink-400">
          Pendaftaran akun publik dimatikan. Hanya akun pemilik terdaftar yang dapat masuk.
        </p>
      </div>
    </main>
  );
}
