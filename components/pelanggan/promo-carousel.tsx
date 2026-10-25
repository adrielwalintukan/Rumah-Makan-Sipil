"use client";

import { useRef, useState, type ComponentType } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { DosArt, PayArt, PhoneArt, WhatsAppGlyph } from "@/components/pelanggan/promo-art";
import { formatRupiah } from "@/lib/format";
import type { StoreSettings } from "@/lib/menu";

type Slide = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  Art: ComponentType<{ className?: string }>;
  cta?: { label: string; href: string; external?: boolean };
  tone: string;
  ctaTone: string;
  /** Warna titik pola latar & pill eyebrow (terang di slide gelap, gelap di slide krem). */
  dark: boolean;
};

// Jarak tepi kiri track (px-4) — dipakai untuk menghitung posisi snap tiap slide.
const PAD = 16;

/**
 * Banner geser di atas menu (design-system §6.8). Hanya info yang sudah ada di v1,
 * bukan promo/diskon (PRD §4.3). Paket Dos tetap dipesan via WhatsApp (P9, US-07).
 * Sengaja tanpa autoplay: konten bergerak sendiri butuh tombol jeda (WCAG 2.2.2).
 */
export function PromoCarousel({ settings }: { settings: StoreSettings }) {
  const price = formatRupiah(settings.dos_price);
  const waText = `Halo ${settings.store_name}, saya mau pesan Paket Dos (${price}/dos). Jumlah: … Tanggal: …`;
  const slides: Slide[] = [
    {
      id: "dos",
      eyebrow: "Pesanan banyak",
      title: "Paket Makanan Dos",
      body: `${price} / dos. Pesan dulu lewat WhatsApp.`,
      Art: DosArt,
      cta: {
        label: "Pesan via WhatsApp",
        href: `https://wa.me/${settings.whatsapp_number}?text=${encodeURIComponent(waText)}`,
        external: true,
      },
      tone: "bg-brown-700 text-cream-50",
      ctaTone: "bg-cream-50 text-brown-700",
      dark: true,
    },
    {
      id: "pesan",
      eyebrow: "Tanpa antre",
      title: "Pesan langsung dari HP",
      body: "Pilih menu, isi nama, dan kami panggil saat pesanan siap.",
      Art: PhoneArt,
      cta: { label: "Lihat menu", href: "#menu" },
      tone: "bg-green-700 text-cream-50",
      ctaTone: "bg-cream-50 text-green-900",
      dark: true,
    },
    {
      id: "bayar",
      eyebrow: "Bayar mudah",
      title: "QRIS atau tunai",
      body: "Scan QRIS dari semua bank & e-wallet, atau bayar cash di kasir.",
      Art: PayArt,
      tone: "border border-line bg-cream-100 text-green-900",
      ctaTone: "",
      dark: false,
    },
  ];

  const track = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);

  const goTo = (i: number) => {
    const el = track.current;
    const slide = el?.children[i] as HTMLElement | undefined;
    if (!el || !slide) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: slide.offsetLeft - PAD, behavior: reduce ? "auto" : "smooth" });
  };

  // Slide aktif = slide yang posisi snap-nya paling dekat dengan posisi scroll.
  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    const kids = Array.from(el.children) as HTMLElement[];
    const dist = (k: HTMLElement) => Math.abs(k.offsetLeft - PAD - el.scrollLeft);
    setIndex(kids.reduce((best, k, i) => (dist(k) < dist(kids[best]) ? i : best), 0));
  };

  return (
    <section aria-roledescription="carousel" aria-label="Info Rumah Makan Sipil" className="relative mt-2 mb-2">
      <ul
        ref={track}
        onScroll={onScroll}
        className="relative -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:scroll-px-0 lg:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((s, i) => (
          <li
            key={s.id}
            aria-roledescription="slide"
            aria-label={`${i + 1} dari ${slides.length}: ${s.title}`}
            className={`relative flex min-h-44 w-[86%] shrink-0 snap-start flex-col gap-3 overflow-hidden rounded-2xl p-4 shadow-card sm:w-[62%] sm:p-5 lg:w-[calc(50%-0.375rem)] ${s.tone}`}
          >
            {/* Pola titik + cahaya: hiasan agar banner tidak datar. */}
            <div
              aria-hidden
              className={`pointer-events-none absolute inset-0 [background-size:16px_16px] ${
                s.dark
                  ? "bg-[radial-gradient(rgb(255_255_255/0.12)_1.5px,transparent_1.5px)]"
                  : "bg-[radial-gradient(rgb(31_61_43/0.08)_1.5px,transparent_1.5px)]"
              }`}
            />
            <div aria-hidden className="pointer-events-none absolute -top-16 -right-10 size-48 rounded-full bg-white/15 blur-2xl" />
            <div className="relative flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p
                  className={`inline-block rounded-full px-2.5 py-1 text-[11px] leading-none font-bold tracking-wider uppercase ${
                    s.dark ? "bg-white/15" : "bg-green-700 text-cream-50"
                  }`}
                >
                  {s.eyebrow}
                </p>
                <h2 className="mt-2 font-display text-xl leading-tight font-bold sm:text-2xl">{s.title}</h2>
                <p className="mt-1.5 text-sm">{s.body}</p>
              </div>
              <s.Art className="-mt-1 -mr-2 w-24 shrink-0 drop-shadow-md sm:w-36" />
            </div>
            {s.cta && (
              <a
                href={s.cta.href}
                {...(s.cta.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className={`relative mt-auto inline-flex h-11 w-fit items-center gap-2 self-start rounded-full pr-4 pl-1.5 text-sm font-bold shadow-sm transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-cream-50 focus-visible:ring-offset-2 focus-visible:ring-offset-green-900 focus-visible:outline-none ${s.ctaTone}`}
              >
                {s.cta.external ? (
                  // Hijau WhatsApp resmi hanya untuk logo pihak ketiga, bukan token brand (design-system §11).
                  <span className="inline-flex size-8 items-center justify-center rounded-full bg-[#25D366] text-white">
                    <WhatsAppGlyph className="size-5" />
                  </span>
                ) : (
                  <span className="inline-flex size-8 items-center justify-center rounded-full bg-green-700 text-cream-50">
                    <ArrowRight className="size-4" aria-hidden />
                  </span>
                )}
                {s.cta.label}
              </a>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-1 flex items-center justify-center">
        <button
          type="button"
          onClick={() => goTo(Math.max(0, index - 1))}
          disabled={index === 0}
          aria-label="Banner sebelumnya"
          className="hidden size-11 items-center justify-center rounded-full text-green-900 hover:bg-accent disabled:opacity-30 sm:inline-flex"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        {slides.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`Tampilkan banner ${i + 1}: ${s.title}`}
            aria-current={i === index ? "true" : undefined}
            className="group inline-flex size-11 items-center justify-center"
          >
            <span
              aria-hidden
              className={`h-2 rounded-full transition-all ${i === index ? "w-6 bg-green-700" : "w-2 bg-ink-400/50 group-hover:bg-ink-400"}`}
            />
          </button>
        ))}
        <button
          type="button"
          onClick={() => goTo(Math.min(slides.length - 1, index + 1))}
          disabled={index === slides.length - 1}
          aria-label="Banner berikutnya"
          className="hidden size-11 items-center justify-center rounded-full text-green-900 hover:bg-accent disabled:opacity-30 sm:inline-flex"
        >
          <ChevronRight className="size-5" aria-hidden />
        </button>
      </div>
    </section>
  );
}
