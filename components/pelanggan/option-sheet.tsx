"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { MenuPhoto } from "@/components/pelanggan/menu-photo";
import { QuantityStepper } from "@/components/pelanggan/quantity-stepper";
import { MAX_NOTE, addLine, isSelectionValid, unitPrice } from "@/lib/cart";
import { formatRupiah } from "@/lib/format";
import type { MenuItem } from "@/lib/menu";
import { writeCart } from "@/lib/use-cart";

/** Bottom sheet pilihan menu (design-system §6.3). Dipasang dengan key per menu agar state reset. */
export function OptionSheet({
  item,
  category,
  canOrder,
  onClose,
}: {
  item: MenuItem;
  category: string;
  canOrder: boolean;
  onClose: () => void;
}) {
  const [optionIds, setOptionIds] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [quantity, setQuantity] = useState(1);

  const valid = isSelectionValid(item, optionIds);
  const price = unitPrice(item, optionIds) * quantity;

  function toggle(groupId: string, optionId: string, single: boolean) {
    const group = item.option_groups.find((g) => g.id === groupId)!;
    const groupIds = group.options.map((o) => o.id);
    setOptionIds((ids) => {
      if (single) return [...ids.filter((id) => !groupIds.includes(id)), optionId];
      return ids.includes(optionId) ? ids.filter((id) => id !== optionId) : [...ids, optionId];
    });
  }

  function add() {
    writeCart((lines) => addLine(lines, { menuItemId: item.id, optionIds, note, quantity }));
    onClose();
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[90dvh] w-full max-w-lg gap-0 rounded-t-xl shadow-sheet"
      >
        <div className="overflow-y-auto px-4 pt-3 pb-4">
          <div aria-hidden className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" />
          {item.image_url && (
            <MenuPhoto
              name={item.name}
              imageUrl={item.image_url}
              category={category}
              sizes="(min-width: 512px) 480px, 100vw"
              className="mb-4 w-full rounded-lg"
            />
          )}
          <SheetTitle className="pr-10 text-xl text-green-900">{item.name}</SheetTitle>
          <SheetDescription className="mt-1 text-base font-semibold text-brown-700 tabular-nums">
            {formatRupiah(item.price)}
          </SheetDescription>
          {item.description && <p className="mt-1 text-sm text-ink-600">{item.description}</p>}

          {item.option_groups.map((group) => {
            const single = group.type === "single";
            return (
              <fieldset key={group.id} className="mt-5">
                <legend className="flex w-full items-center justify-between font-semibold text-ink-900">
                  {group.name}
                  <span className="rounded-full bg-muted-status-bg px-2 py-0.5 text-xs font-medium text-muted-status">
                    {group.required ? "Wajib" : single ? "Opsional" : "Boleh lebih dari satu"}
                  </span>
                </legend>
                <div className="mt-2 divide-y divide-line rounded-md border">
                  {group.options.map((option) => (
                    <label
                      key={option.id}
                      className="flex min-h-12 cursor-pointer items-center gap-3 px-3 has-disabled:cursor-not-allowed has-disabled:opacity-50"
                    >
                      <input
                        type={single ? "radio" : "checkbox"}
                        name={group.id}
                        checked={optionIds.includes(option.id)}
                        disabled={!option.is_available}
                        onChange={() => toggle(group.id, option.id, single)}
                        className="size-5 accent-green-700"
                      />
                      <span className="flex-1">{option.name}</span>
                      <span className="text-sm text-ink-600 tabular-nums">
                        {!option.is_available
                          ? "Habis"
                          : option.price_delta > 0
                            ? `+${formatRupiah(option.price_delta)}`
                            : ""}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            );
          })}

          <label className="mt-5 block">
            <span className="font-semibold text-ink-900">Catatan</span>
            <span className="text-sm text-ink-600"> (opsional)</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={MAX_NOTE}
              rows={2}
              placeholder="Contoh: tidak pedas, tanpa sayur"
              className="mt-2 w-full resize-none rounded-sm border bg-card px-3 py-2 text-base outline-none focus:border-primary focus:ring-[3px] focus:ring-green-100"
            />
          </label>

          <div className="mt-4 flex items-center justify-between">
            <span className="font-semibold text-ink-900">Jumlah</span>
            <QuantityStepper value={quantity} onChange={setQuantity} label={item.name} min={1} />
          </div>
        </div>

        <div className="border-t bg-card px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button className="w-full" disabled={!valid || !canOrder || !item.is_available} onClick={add}>
            {!canOrder ? "Toko sedang tutup" : `Tambah · ${formatRupiah(price)}`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
