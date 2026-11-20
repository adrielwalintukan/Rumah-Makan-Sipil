"use client";

import { useEffect, useRef, useState } from "react";
import { Rotate3d } from "lucide-react";
import {
  mountHero3DScene,
  type DishPreset,
  type Hero3DController,
} from "@/components/pelanggan/hero-3d-scene";
import { NasiArt } from "@/components/pelanggan/promo-art";

const DISH_OPTIONS: ReadonlyArray<{ id: DishPreset; label: string }> = [
  { id: "nasi", label: "Nasi Campur" },
  { id: "mie", label: "Mie Hangat" },
  { id: "esteh", label: "Es Teh" },
];

export function Hero3DStage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fallbackRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<Hero3DController | null>(null);
  const [activeDish, setActiveDish] = useState<DishPreset>("nasi");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const motionQuery =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;
    const controller = mountHero3DScene(canvas, {
      initialDish: "nasi",
      reducedMotion: motionQuery?.matches ?? false,
      onReady: () => {
        canvas.style.opacity = "1";
        if (fallbackRef.current) {
          fallbackRef.current.style.opacity = "0";
        }
      },
    });

    if (!controller) return;
    controllerRef.current = controller;

    const handleMotionChange = (e: MediaQueryListEvent) => {
      controller.setReducedMotion(e.matches);
    };
    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            controller.resize();
          })
        : null;

    motionQuery?.addEventListener("change", handleMotionChange);
    resizeObserver?.observe(canvas);

    return () => {
      motionQuery?.removeEventListener("change", handleMotionChange);
      resizeObserver?.disconnect();
      controller.destroy();
      controllerRef.current = null;
    };
  }, []);

  const handleSelectDish = (dish: DishPreset) => {
    setActiveDish(dish);
    controllerRef.current?.setDish(dish);
  };

  return (
    <div className="relative flex w-full flex-col items-center lg:w-80 lg:shrink-0">
      <div className="relative flex h-44 w-full max-w-[18rem] items-center justify-center sm:h-52 lg:h-60 lg:max-w-none">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-4 rounded-full bg-[radial-gradient(circle,rgb(168_106_50/0.35),rgb(58_110_78/0.2)_55%,transparent_75%)] blur-2xl"
        />
        <div
          ref={fallbackRef}
          className="pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-500"
        >
          <NasiArt className="w-40 drop-shadow-xl sm:w-48 lg:w-56" />
        </div>
        <canvas
          ref={canvasRef}
          aria-label="Model 3D interaktif hidangan Rumah Makan Sipil. Geser untuk memutar."
          role="img"
          className="relative z-10 size-full cursor-grab touch-none opacity-0 transition-opacity duration-500 active:cursor-grabbing"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute right-1 bottom-1 z-20 inline-flex items-center gap-1 rounded-full bg-green-900/75 px-2.5 py-1 text-[11px] font-medium text-green-100 ring-1 ring-white/15 backdrop-blur-md"
        >
          <Rotate3d className="size-3.5 text-brown-100" />
          Geser 360°
        </span>
      </div>

      <div
        role="group"
        aria-label="Pilih pratinjau hidangan 3D"
        className="mt-2 inline-flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-full bg-white/10 p-1 ring-1 ring-white/15 backdrop-blur-md"
      >
        {DISH_OPTIONS.map(({ id, label }) => {
          const isActive = activeDish === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={isActive}
              onClick={() => handleSelectDish(id)}
              className={`min-h-11 rounded-full px-3.5 text-xs font-semibold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream-50 ${
                isActive
                  ? "bg-cream-50 text-green-900 shadow-sm"
                  : "text-cream-50/90 hover:bg-white/10 hover:text-cream-50"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
