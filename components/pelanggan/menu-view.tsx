"use client";

import { useEffect, useState } from "react";
import { CartBar } from "@/components/pelanggan/cart-bar";
import { DesktopCartPanel } from "@/components/pelanggan/desktop-cart-panel";
import { MenuCard } from "@/components/pelanggan/menu-card";
import { OptionSheet } from "@/components/pelanggan/option-sheet";
import { resolveCart } from "@/lib/cart";
import type { Category, MenuItem } from "@/lib/menu";
import { useCart } from "@/lib/use-cart";

export function MenuView({
  categories,
  isOpen,
}: {
  categories: Category[];
  isOpen: boolean;
}) {
  const cart = useCart();
  const { count, total } = resolveCart(cart, categories);
  const [selected, setSelected] = useState<{ item: MenuItem; category: string } | null>(null);
  const [active, setActive] = useState(categories[0]?.id);

  // Chip kategori aktif mengikuti section yang sedang terlihat.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((e) => e.isIntersecting);
        if (visible) setActive(visible.target.id.replace("kategori-", ""));
      },
      { rootMargin: "-120px 0px -60% 0px" },
    );
    categories.forEach((c) => {
      const el = document.getElementById(`kategori-${c.id}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [categories]);

  return (
    <>
      <div id="menu" className="scroll-mt-2 lg:flex lg:items-start lg:gap-8">
        <div className="flex-1 min-w-0 max-w-3xl">
          <nav
            aria-label="Kategori menu"
            className="sticky top-0 z-30 -mx-4 flex gap-2 overflow-x-auto bg-background/95 px-4 py-3 backdrop-blur"
          >
            {categories.map((c) => (
              <a
                key={c.id}
                href={`#kategori-${c.id}`}
                aria-current={active === c.id ? "true" : undefined}
                className={`inline-flex h-11 shrink-0 items-center rounded-full border px-5 text-sm font-semibold transition-colors ${
                  active === c.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-line bg-card text-ink-900 hover:bg-accent"
                }`}
              >
                {c.name}
              </a>
            ))}
          </nav>

          {categories.map((c) => (
            <section key={c.id} id={`kategori-${c.id}`} aria-labelledby={`judul-${c.id}`} className="scroll-mt-20 pt-4">
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
