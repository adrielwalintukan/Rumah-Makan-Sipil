"use client";

import { useSyncExternalStore } from "react";
import { type CartLine, parseCart } from "@/lib/cart";

const STORAGE_KEY = "cart";
const EMPTY: CartLine[] = [];
const listeners = new Set<() => void>();

// Cache per string mentah agar useSyncExternalStore menerima referensi yang stabil.
let cachedRaw: string | null = null;
let cachedLines: CartLine[] = EMPTY;
// Cadangan bila localStorage diblokir (mode privat): keranjang tetap jalan selama tab terbuka.
let memoryRaw: string | null = null;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return memoryRaw;
  }
}

function getSnapshot(): CartLine[] {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedLines = parseCart(raw);
  }
  return cachedLines;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key === STORAGE_KEY && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function writeCart(update: (lines: CartLine[]) => CartLine[]) {
  const raw = JSON.stringify(update(getSnapshot()));
  memoryRaw = raw;
  try {
    window.localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // tetap di memoryRaw
  }
  listeners.forEach((l) => l());
}

/** Keranjang kosong saat render server; isi asli muncul setelah hydrate. */
export function useCart(): CartLine[] {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}
