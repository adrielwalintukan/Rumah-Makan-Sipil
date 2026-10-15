import Image from "next/image";
import { Coffee, Utensils } from "lucide-react";
import { cn } from "@/lib/utils";

/** Foto menu 4:3 atau placeholder bermerek (design-system §5). Ukuran ditentukan pembungkus. */
export function MenuPhoto({
  name,
  imageUrl,
  category,
  className,
  sizes,
}: {
  name: string;
  imageUrl: string | null;
  category: string;
  className?: string;
  sizes: string;
}) {
  const Icon = category.toLowerCase().includes("minum") ? Coffee : Utensils;
  return (
    <div className={cn("@container relative aspect-[4/3] shrink-0 overflow-hidden rounded-sm bg-cream-100", className)}>
      {imageUrl ? (
        // shortcut: unoptimized karena foto sudah dikompres di browser saat upload (M4); aktifkan optimasi Vercel bila ukuran jadi masalah
        <Image src={imageUrl} alt={name} fill sizes={sizes} unoptimized className="object-cover" />
      ) : (
        <div aria-hidden className="flex size-full items-center justify-center">
          <Icon className="absolute size-1/2 text-brown-500/25" strokeWidth={1.5} />
          <span className="relative font-display text-[22cqw] leading-none font-extrabold text-brown-700">
            {name.charAt(0).toUpperCase()}
          </span>
        </div>
      )}
    </div>
  );
}
