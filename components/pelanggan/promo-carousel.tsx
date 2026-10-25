"use client";

import { useRef, useState, type ComponentType } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, MessageCircle, Package, QrCode, Smartphone } from "lucide-react";
import { formatRupiah } from "@/lib/format";
import type { StoreSettings } from "@/lib/menu";

type Slide = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  Icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  cta?: { label: string; href: string; external?: boolean };
  tone: string;
  ctaTone: string;
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
      eyebrow: "Untuk acara & pesanan banyak",
      title: "Paket Makanan Dos",
      body: `${price} / dos. Pesan dulu lewat WhatsApp.`,
      Icon: Package,
      cta: {
        label: "Pesan via WhatsApp",
        href: `https://wa.me/${settings.whatsapp_number}?text=${encodeURIComponent(waText)}`,
        external: true,
      },
      tone: "bg-brown-700 text-cream-50",
      ctaTone: "bg-cream-50 text-brown-700",
    },
    {
      id: "pesan",
      eyebrow: "Tanpa antre di kasir",
      title: "Pesan langsung dari HP",
      body: "Pilih menu, isi nama, dan kami panggil saat pesanan siap.",
      Icon: Smartphone,
      cta: { label: "Lihat menu", href: "#menu" },
      tone: "bg-green-700 text-cream-50",
      ctaTone: "bg-cream-50 text-green-900",
    },
    {
      id: "bayar",
      eyebrow: "Bayar sesukamu",
      title: "QRIS atau tunai",
      body: "Scan QRIS dari semua bank & e-wallet, atau bayar cash di kasir.",
      Icon: QrCode,
      tone: "border border-line bg-cream-100 text-green-900",
      ctaTone: "",
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
            className={`relative flex min-h-44 w-[86%] shrink-0 snap-start flex-col overflow-hidden rounded-2xl p-5 shadow-card sm:w-[62%] lg:w-[calc(50%-0.375rem)] ${s.tone}`}
          >
            <s.Icon aria-hidden className="pointer-events-none absolute -right-5 -bottom-5 size-36 opacity-15" />
            <p className="text-xs font-semibold tracking-wider uppercase opacity-90">{s.eyebrow}</p>
            <h2 className="mt-1 font-display text-2xl leading-tight font-bold">{s.title}</h2>
            <p className="mt-1.5 max-w-[30ch] text-sm">{s.body}</p>
            {s.cta && (
              <a
                href={s.cta.href}
                {...(s.cta.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className={`relative mt-auto inline-flex h-11 w-fit items-center gap-2 self-start rounded-full px-4 text-sm font-bold shadow-sm transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-cream-50 focus-visible:ring-offset-2 focus-visible:ring-offset-green-900 focus-visible:outline-none ${s.ctaTone}`}
              >
                {s.cta.external ? <MessageCircle className="size-4" aria-hidden /> : null}
                {s.cta.label}
                {!s.cta.external ? <ArrowRight className="size-4" aria-hidden /> : null}
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
