"use client";

import { useEffect, useState } from "react";

/** Id hero yang diamati; bar ringkas muncul begitu hero tertutup bar ini. */
export const STORE_HERO_ID = "toko-hero";

/**
 * Bar ringkas toko (design-system §6.8): turun dari atas saat hero tergulir keluar, dengan tab
 * kategori menempel di bawahnya. Hanya hiasan visual (judul asli tetap h1 di hero), jadi aria-hidden.
 */
export function StickyStoreBar({ isOpen }: { isOpen: boolean }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const hero = document.getElementById(STORE_HERO_ID);
    if (!hero) return;
    // -56px = tinggi bar: bar muncul tepat saat bagian bawah hero masuk ke bawah bar.
    const observer = new IntersectionObserver(([e]) => setShown(!e.isIntersecting), {
      rootMargin: "-56px 0px 0px 0px",
    });
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      aria-hidden
      data-shown={shown}
      className={`fixed inset-x-0 top-0 z-40 transition-[translate,opacity] duration-300 ease-out motion-reduce:transition-none ${
        shown ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-full opacity-0"
      }`}
    >
      <div className="relative mx-auto flex h-14 w-full max-w-3xl items-center justify-between overflow-hidden rounded-b-2xl bg-green-900 px-5 shadow-lg lg:max-w-6xl">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgb(255_255_255/0.07)_1.5px,transparent_1.5px)] [background-size:18px_18px]" />
        <div aria-hidden className="pointer-events-none absolute -top-10 -left-10 size-32 rounded-full bg-green-600/40 blur-2xl" />
        <p className="relative flex items-baseline gap-2">
          <span className="text-[10px] font-semibold tracking-[0.3em] text-green-100">RUMAH MAKAN</span>
          <span className="font-display text-2xl leading-none font-extrabold tracking-wide text-cream-50">SIPIL</span>
        </p>
        <span
          className={`relative inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
            isOpen ? "bg-success-bg text-success" : "bg-danger-bg text-danger"
          }`}
        >
          <span className={`size-2 rounded-full ${isOpen ? "bg-success" : "bg-danger"}`} />
          {isOpen ? "Buka" : "Tutup"}
        </span>
      </div>
    </div>
  );
}
