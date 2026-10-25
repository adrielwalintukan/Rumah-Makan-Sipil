"use client";

import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Plus, Star } from "lucide-react";
import { MenuPhoto } from "@/components/pelanggan/menu-photo";
import { DosArt, PayArt, PhoneArt, WhatsAppGlyph } from "@/components/pelanggan/promo-art";
import { formatRupiah } from "@/lib/format";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import type { MenuItem, StoreSettings } from "@/lib/menu";

type Slide = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  /** Ilustrasi info, atau foto menu untuk slide menu unggulan. */
  Art?: ComponentType<{ className?: string }>;
  media?: ReactNode;
  cta?: { label: string; href: string; external?: boolean };
  /** Tombol aksi menu unggulan (Tambah / Pilih) — tombol, bukan link. */
  action?: { label: string; onClick: () => void };
  tone: string;
  ctaTone: string;
  /** Warna titik pola latar & pill eyebrow (terang di slide gelap, gelap di slide krem). */
  dark: boolean;
};

// Lama tiap banner tampil sebelum bergeser otomatis.
const AUTOPLAY_MS = 4500;

/**
 * Banner geser di atas menu (design-system §6.8): menu unggulan pilihan pemilik (Issue #63)
 * lalu info yang sudah ada di v1, bukan promo/diskon (PRD §4.3). Paket Dos via WhatsApp (P9, US-07).
 * Bergeser otomatis; berhenti sementara saat di-hover, berhenti permanen begitu disentuh,
 * digeser, atau difokus, dan tidak otomatis sama sekali bila prefers-reduced-motion.
 * shortcut: tanpa tombol jeda atas permintaan pemilik (WCAG 2.2.2 menyarankan tombol), tambahkan bila ada keluhan.
 */
export function PromoCarousel({
  settings,
  featured = [],
  canOrder = false,
  onPick,
}: {
  settings: StoreSettings;
  /** Menu unggulan yang tersedia (bukan Habis), urut seperti daftar menu. */
  featured?: { item: MenuItem; category: string }[];
  canOrder?: boolean;
  /** Dipanggil tombol Tambah/Pilih: tambah langsung atau buka pilihan (logika sama dengan kartu menu). */
  onPick?: (item: MenuItem, category: string) => void;
}) {
  const price = formatRupiah(settings.dos_price);
  const featuredSlides: Slide[] = featured.map(({ item, category }) => {
    const hasOptions = item.option_groups.length > 0;
    return {
      id: `menu-${item.id}`,
      eyebrow: "Menu unggulan",
      title: item.name,
      body: `${formatRupiah(item.price)}${item.description ? ` · ${item.description}` : ""}`,
      media: (
        <MenuPhoto
          name={item.name}
          imageUrl={item.image_url}
          category={category}
          sizes="(min-width: 640px) 176px, 112px"
          className="w-28 rounded-xl ring-4 ring-white/15 sm:w-44"
        />
      ),
      action:
        canOrder && onPick
          ? { label: hasOptions ? "Pilih" : "Tambah", onClick: () => onPick(item, category) }
          : undefined,
      tone: "bg-green-900 text-cream-50",
      ctaTone: "bg-cream-50 text-green-900",
      dark: true,
    };
  });
  const waText = `Halo ${settings.store_name}, saya mau pesan Paket Dos (${price}/dos). Jumlah: … Tanggal: …`;
  const slides: Slide[] = [
    ...featuredSlides,
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
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  // Sekali pelanggan berinteraksi, banner tidak bergeser sendiri lagi agar tidak "dikejar" saat membaca.
  const [stopped, setStopped] = useState(false);
  const playing = !reduceMotion && !stopped;
  const [held, setHeld] = useState(false);
  const count = slides.length;

  const goTo = (i: number) => {
    const el = track.current;
    const slide = el?.children[(i + count) % count] as HTMLElement | undefined;
    if (!el || !slide) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: slide.offsetLeft, behavior: reduce ? "auto" : "smooth" });
  };

  // Slide aktif = slide yang posisinya paling dekat dengan posisi scroll. Track `relative` = offsetParent
  // tiap slide, jadi offsetLeft dan scrollLeft memakai origin yang sama (jangan hapus kelas `relative`).
  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    const kids = Array.from(el.children) as HTMLElement[];
    const dist = (k: HTMLElement) => Math.abs(k.offsetLeft - el.scrollLeft);
    setIndex(kids.reduce((best, k, i) => (dist(k) < dist(kids[best]) ? i : best), 0));
  };

  // Timer diulang tiap index berubah, jadi geser manual juga mereset hitungan.
  useEffect(() => {
    if (!playing || held || count < 2) return;
    const t = window.setTimeout(() => goTo(index + 1), AUTOPLAY_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- goTo hanya membaca ref & count
  }, [index, playing, held, count]);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Info Rumah Makan Sipil"
      className="relative mt-2 mb-2"
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onPointerDown={() => setStopped(true)}
      onFocus={() => setStopped(true)}
    >
      <ul
        ref={track}
        onScroll={onScroll}
        aria-live={playing ? "off" : "polite"}
        className="relative flex snap-x snap-mandatory gap-3 overflow-x-auto rounded-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((s, i) => (
          <li
            key={s.id}
            aria-roledescription="slide"
            aria-label={`${i + 1} dari ${slides.length}: ${s.title}`}
            className={`relative flex min-h-44 w-full shrink-0 snap-center snap-always flex-col gap-3 overflow-hidden rounded-2xl p-4 sm:p-6 lg:min-h-52 lg:px-10 ${s.tone}`}
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
                  {s.id.startsWith("menu-") ? (
                    <Star className="mr-1 inline size-3 -translate-y-px fill-current" aria-hidden />
                  ) : null}
                  {s.eyebrow}
                </p>
                <h2 className="mt-2 font-display text-xl leading-tight font-bold sm:text-2xl">{s.title}</h2>
                <p className="mt-1.5 text-sm">{s.body}</p>
              </div>
              {s.media ?? (s.Art && <s.Art className="-mt-1 -mr-2 w-24 shrink-0 drop-shadow-md sm:w-36 lg:w-44" />)}
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
            {s.action && (
              <button
                type="button"
                onClick={s.action.onClick}
                aria-label={`${s.action.label} ${s.title}`}
                className={`relative mt-auto inline-flex h-11 w-fit items-center gap-2 self-start rounded-full pr-4 pl-1.5 text-sm font-bold shadow-sm transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-cream-50 focus-visible:ring-offset-2 focus-visible:ring-offset-green-900 focus-visible:outline-none ${s.ctaTone}`}
              >
                <span className="inline-flex size-8 items-center justify-center rounded-full bg-green-700 text-cream-50">
                  <Plus className="size-4" aria-hidden />
                </span>
                {s.action.label}
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-1 flex items-center justify-center">
        <button
          type="button"
          onClick={() => goTo(index - 1)}
          aria-label="Banner sebelumnya"
          className="hidden size-11 items-center justify-center rounded-full text-green-900 hover:bg-accent sm:inline-flex"
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
          onClick={() => goTo(index + 1)}
          aria-label="Banner berikutnya"
          className="hidden size-11 items-center justify-center rounded-full text-green-900 hover:bg-accent sm:inline-flex"
        >
          <ChevronRight className="size-5" aria-hidden />
        </button>
      </div>
    </section>
  );
}
