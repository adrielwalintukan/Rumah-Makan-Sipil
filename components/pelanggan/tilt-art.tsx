"use client";

import { useRef } from "react";
import type { ReactNode } from "react";

/** Membungkus ilustrasi agar miring mengikuti pointer (parallax). Mati bila reduced-motion; sentuhan tidak memicu. */
export function TiltArt({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  function move(e: React.PointerEvent) {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(700px) rotateY(${x * 14}deg) rotateX(${-y * 14}deg) scale(1.04)`;
  }

  return (
    <div
      ref={ref}
      onPointerMove={move}
      onPointerLeave={() => ref.current && (ref.current.style.transform = "")}
      className={`transition-transform duration-200 ease-out will-change-transform ${className ?? ""}`}
    >
      {children}
    </div>
  );
}
