import type { Category, MenuItem, MenuOption } from "@/lib/menu";

/** Baris keranjang di localStorage: hanya id + jumlah + catatan. Harga selalu dari menu terbaru. */
export type CartLine = { menuItemId: string; optionIds: string[]; note: string; quantity: number };

export const MAX_QUANTITY = 20;
export const MAX_LINES = 30;
export const MAX_NOTE = 100;

export function lineKey(line: Pick<CartLine, "menuItemId" | "optionIds" | "note">): string {
  return [line.menuItemId, [...line.optionIds].sort().join(","), line.note.trim()].join("|");
}

/** Tambah baris; menu + opsi + catatan yang sama digabung (US-02). */
export function addLine(lines: CartLine[], line: CartLine): CartLine[] {
  const key = lineKey(line);
  const existing = lines.find((l) => lineKey(l) === key);
  if (existing) {
    return lines.map((l) =>
      l === existing ? { ...l, quantity: Math.min(MAX_QUANTITY, l.quantity + line.quantity) } : l,
    );
  }
  if (lines.length >= MAX_LINES) return lines;
  return [...lines, { ...line, note: line.note.trim(), quantity: Math.min(MAX_QUANTITY, line.quantity) }];
}

/** Ubah jumlah; 0 atau kurang = hapus baris. */
export function setQuantity(lines: CartLine[], key: string, quantity: number): CartLine[] {
  if (quantity <= 0) return lines.filter((l) => lineKey(l) !== key);
  return lines.map((l) => (lineKey(l) === key ? { ...l, quantity: Math.min(MAX_QUANTITY, quantity) } : l));
}

/** Pilihan menu valid: semua grup wajib terisi, grup "single" maks. 1 opsi, opsi tersedia. */
export function isSelectionValid(item: MenuItem, optionIds: string[]): boolean {
  return item.option_groups.every((g) => {
    const picked = g.options.filter((o) => optionIds.includes(o.id));
    if (picked.some((o) => !o.is_available)) return false;
    if (g.required && picked.length === 0) return false;
    return g.type === "multiple" || picked.length <= 1;
  });
}

export function unitPrice(item: MenuItem, optionIds: string[]): number {
  const options = item.option_groups.flatMap((g) => g.options).filter((o) => optionIds.includes(o.id));
  return item.price + options.reduce((sum, o) => sum + o.price_delta, 0);
}

export type ResolvedLine = {
  key: string;
  line: CartLine;
  item: MenuItem | null;
  options: MenuOption[];
  unitPrice: number;
  subtotal: number;
  /** false bila menu/opsi sudah tidak ada, habis, atau pilihannya tidak valid lagi. */
  available: boolean;
};

/** Cocokkan keranjang dengan menu terbaru (tampilan saja; total final dihitung server di M2). */
export function resolveCart(lines: CartLine[], categories: Category[]) {
  const items = new Map(categories.flatMap((c) => c.items).map((i) => [i.id, i]));
  const resolved: ResolvedLine[] = lines.map((line) => {
    const item = items.get(line.menuItemId) ?? null;
    const allOptions = item?.option_groups.flatMap((g) => g.options) ?? [];
    const options = allOptions.filter((o) => line.optionIds.includes(o.id));
    const available =
      !!item &&
      item.is_available &&
      options.length === line.optionIds.length &&
      isSelectionValid(item, line.optionIds);
    const price = item ? unitPrice(item, line.optionIds) : 0;
    return { key: lineKey(line), line, item, options, unitPrice: price, subtotal: price * line.quantity, available };
  });
  const usable = resolved.filter((r) => r.available);
  return {
    lines: resolved,
    count: usable.reduce((n, r) => n + r.line.quantity, 0),
    total: usable.reduce((n, r) => n + r.subtotal, 0),
    hasUnavailable: resolved.length !== usable.length,
  };
}

/** Baca keranjang dari JSON localStorage; data rusak/asing dibuang, bukan bikin crash. */
export function parseCart(raw: string | null): CartLine[] {
  try {
    const data: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(data)) return [];
    return data
      .filter(
        (l): l is CartLine =>
          typeof l?.menuItemId === "string" &&
          Array.isArray(l.optionIds) &&
          l.optionIds.every((o: unknown) => typeof o === "string") &&
          typeof l.note === "string" &&
          Number.isInteger(l.quantity) &&
          l.quantity > 0,
      )
      .slice(0, MAX_LINES)
      .map((l) => ({ ...l, note: l.note.slice(0, MAX_NOTE), quantity: Math.min(MAX_QUANTITY, l.quantity) }));
  } catch {
    return [];
  }
}
