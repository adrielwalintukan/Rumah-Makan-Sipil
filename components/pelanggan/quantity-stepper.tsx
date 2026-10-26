"use client";

import { Minus, Plus } from "lucide-react";
import { MAX_QUANTITY } from "@/lib/cart";

export function QuantityStepper({
  value,
  onChange,
  label,
  min = 0,
}: {
  value: number;
  onChange: (value: number) => void;
  /** Nama barang, untuk label pembaca layar. */
  label: string;
  min?: number;
}) {
  const btn =
    "inline-flex size-10 items-center justify-center rounded-full border border-primary text-primary transition-colors hover:bg-accent disabled:opacity-40";
  return (
    <div className="flex items-center gap-1" role="group" aria-label={`Jumlah ${label}`}>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        aria-label={`Kurangi ${label}`}
      >
        <Minus className="size-4" />
      </button>
      <span className="w-8 text-center font-semibold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(value + 1)}
        disabled={value >= MAX_QUANTITY}
        aria-label={`Tambah ${label}`}
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
