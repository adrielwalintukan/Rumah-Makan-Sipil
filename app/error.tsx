"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorProps) {
  React.useEffect(() => {
    // Catat error ke console untuk keperluan diagnosis
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[80vh] flex-1 flex-col items-center justify-center bg-cream-50 px-4 py-12 text-center">
      <div
        className="mb-6 flex size-16 items-center justify-center rounded-full bg-brown-100 text-brown-700"
        aria-hidden="true"
      >
        <AlertCircle className="size-8" />
      </div>
      <h1 className="font-display text-2xl font-bold text-green-900 sm:text-3xl">
        Ada Sedikit Kendala
      </h1>
      <p className="mt-3 max-w-md text-base text-ink-600">
        Maaf, halaman ini sedang sulit dihubungi. Silakan coba muat ulang atau periksa sambungan internet kamu.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button
          type="button"
          onClick={() => reset()}
          className="min-h-[48px] px-6"
        >
          Coba Lagi
        </Button>
        <Button
          variant="secondary"
          asChild
          className="min-h-[48px] px-6"
        >
          <Link href="/">Kembali ke Menu Utama</Link>
        </Button>
      </div>
    </main>
  );
}
