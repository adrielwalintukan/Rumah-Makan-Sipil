import type { Metadata } from "next";
import Link from "next/link";
import { UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Halaman Tidak Ditemukan - Rumah Makan Sipil",
  description: "Halaman yang kamu tuju tidak ditemukan. Silakan kembali ke menu utama.",
};

export default function NotFound() {
  return (
    <main className="flex min-h-[80vh] flex-1 flex-col items-center justify-center bg-cream-50 px-4 py-12 text-center">
      <div
        className="mb-6 flex size-16 items-center justify-center rounded-full bg-brown-100 text-brown-700"
        aria-hidden="true"
      >
        <UtensilsCrossed className="size-8" />
      </div>
      <h1 className="font-display text-3xl font-bold text-green-900">
        Halaman Tidak Ditemukan
      </h1>
      <p className="mt-3 max-w-md text-base text-ink-600">
        Sepertinya halaman yang kamu tuju tidak ada atau menu sudah dipindahkan. Yuk kembali ke menu makanan enak hari ini.
      </p>
      <div className="mt-8">
        <Button asChild className="min-h-[48px] px-6">
          <Link href="/">Lihat Menu</Link>
        </Button>
      </div>
    </main>
  );
}
