import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { formatRupiah } from "@/lib/format";

/** Bar keranjang mengambang (design-system §6.4); tampil hanya bila ada item. */
export function CartBar({ count, total }: { count: number; total: number }) {
  if (count === 0) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
      <Link
        href="/keranjang"
        className="mx-auto flex h-14 max-w-3xl items-center gap-3 rounded-lg bg-primary px-4 text-primary-foreground shadow-sheet animate-in slide-in-from-bottom-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700"
      >
        <ShoppingBag className="size-5" aria-hidden />
        <span className="font-semibold">
          {count} item · <span className="tabular-nums">{formatRupiah(total)}</span>
        </span>
        <span className="ml-auto text-sm font-semibold">Lihat keranjang →</span>
      </Link>
    </div>
  );
}
