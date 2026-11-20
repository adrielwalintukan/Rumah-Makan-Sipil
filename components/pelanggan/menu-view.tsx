"use client";

import { useEffect, useRef, useState } from "react";
import { CartBar } from "@/components/pelanggan/cart-bar";
import { DesktopCartPanel } from "@/components/pelanggan/desktop-cart-panel";
import { MenuCard } from "@/components/pelanggan/menu-card";
import { OptionSheet } from "@/components/pelanggan/option-sheet";
import { PromoCarousel } from "@/components/pelanggan/promo-carousel";
import { addLine, resolveCart } from "@/lib/cart";
import type { Category, MenuItem, StoreSettings } from "@/lib/menu";
import { useCart, writeCart } from "@/lib/use-cart";

export function MenuView({
  categories,
  settings,
  featuredIds,
}: {
  categories: Category[];
  settings: StoreSettings;
  featuredIds: string[];
}) {
  const isOpen = settings.is_open;
  const cart = useCart();
  const { count, total } = resolveCart(cart, categories);
  const [selected, setSelected] = useState<{ item: MenuItem; category: string } | null>(null);
  const [active, setActive] = useState(categories[0]?.id);

  // Indikator tab geser mengikuti tab aktif, dan tab aktif digulirkan ke tengah bar.
  const navRef = useRef<HTMLElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  useEffect(() => {
    const nav = navRef.current;
    const el = nav?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!nav || !el) return;
    setPill({ left: el.offsetLeft, width: el.offsetWidth });
    // Hanya geser bar tab secara horizontal (bukan scrollIntoView, agar halaman tidak ikut bergulir).
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    nav.scrollTo({ left: el.offsetLeft - (nav.clientWidth - el.offsetWidth) / 2, behavior: reduce ? "auto" : "smooth" });
  }, [active]);

  // Chip kategori aktif mengikuti section yang sedang terlihat.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((e) => e.isIntersecting);
        if (visible) setActive(visible.target.id.replace("kategori-", ""));
      },
      { rootMargin: "-130px 0px -60% 0px" },
    );
    categories.forEach((c) => {
      const el = document.getElementById(`kategori-${c.id}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [categories]);

  // Menu unggulan yang Habis tidak dipromosikan di banner.
  const featured = featuredIds.flatMap((id) =>
    categories.flatMap((c) =>
      c.items.filter((item) => item.id === id && item.is_available).map((item) => ({ item, category: c.name })),
    ),
  );
  // Sama dengan kartu menu: tanpa pilihan langsung masuk keranjang, berpilihan buka bottom sheet.
  const pick = (item: MenuItem, category: string) =>
    item.option_groups.length > 0
      ? setSelected({ item, category })
      : writeCart((lines) => addLine(lines, { menuItemId: item.id, optionIds: [], note: "", quantity: 1 }));

  return (
    <>
      <PromoCarousel settings={settings} featured={featured} canOrder={isOpen} onPick={pick} />
      <div id="menu" className="scroll-mt-14 lg:flex lg:items-start lg:gap-8">
        <div className="flex-1 min-w-0 max-w-3xl">
          <nav
            ref={navRef}
            aria-label="Kategori menu"
            className="glass sticky top-14 z-30 -mx-4 flex gap-1 overflow-x-auto rounded-none px-4 py-2 sm:mx-0 sm:rounded-full sm:px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {pill && (
              <span
                aria-hidden
                style={{ left: pill.left, width: pill.width }}
                className="absolute inset-y-2 rounded-full bg-gradient-to-b from-green-600 to-green-800 shadow-md shadow-green-900/25 transition-[left,width] duration-300 ease-out"
              />
            )}
            {categories.map((c) => (
              <a
                key={c.id}
                href={`#kategori-${c.id}`}
                aria-current={active === c.id ? "true" : undefined}
                className={`relative inline-flex h-11 shrink-0 items-center rounded-full px-5 text-sm font-semibold transition-colors ${
                  active === c.id ? "text-primary-foreground" : "text-ink-900 hover:bg-white/60"
                }`}
              >
                {c.name}
              </a>
            ))}
          </nav>

          {categories.map((c) => (
            <section key={c.id} id={`kategori-${c.id}`} aria-labelledby={`judul-${c.id}`} className="scroll-mt-32 pt-4">
              <h2 id={`judul-${c.id}`} className="mb-3 font-display text-2xl font-bold text-green-900">
                {c.name}
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {c.items.map((item) => (
                  <MenuCard
                    key={item.id}
                    item={item}
                    category={c.name}
                    cart={cart}
                    canOrder={isOpen}
                    onOpen={() => setSelected({ item, category: c.name })}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        <aside className="hidden lg:block lg:w-80 lg:shrink-0 sticky top-20">
          <DesktopCartPanel categories={categories} isOpen={isOpen} />
        </aside>
      </div>

      {selected && (
        <OptionSheet
          key={selected.item.id}
          item={selected.item}
          category={selected.category}
          canOrder={isOpen}
          onClose={() => setSelected(null)}
        />
      )}
      <CartBar count={count} total={total} />
    </>
  );
}
