import { Suspense } from "react";
import { ActiveOrderBanner } from "@/components/pelanggan/active-order-banner";
import { MenuView } from "@/components/pelanggan/menu-view";
import { PaketDosCard } from "@/components/pelanggan/paket-dos-card";
import { StoreHeader } from "@/components/pelanggan/store-header";
import { getMenu } from "@/lib/menu";

export default function MenuPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-28">
      <Suspense fallback={<MenuSkeleton />}>
        <Menu />
      </Suspense>
    </main>
  );
}

async function Menu() {
  const { categories, settings } = await getMenu();
  return (
    <>
      <StoreHeader settings={settings} />
      <ActiveOrderBanner />
      <MenuView categories={categories} isOpen={settings.is_open} />
      <div className="mt-8">
        <PaketDosCard settings={settings} />
      </div>
    </>
  );
}

function MenuSkeleton() {
  return (
    <div aria-busy="true" aria-label="Memuat menu" className="animate-pulse pt-8">
      <div className="mx-auto h-28 w-48 rounded-lg bg-cream-100" />
      <div className="mt-8 flex gap-2">
        <div className="h-11 w-28 rounded-full bg-cream-100" />
        <div className="h-11 w-28 rounded-full bg-cream-100" />
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-24 rounded-lg bg-cream-100" />
        ))}
      </div>
    </div>
  );
}
