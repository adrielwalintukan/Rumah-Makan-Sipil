import { describe, expect, it } from "vitest";
import { formatRupiah } from "./format";

describe("formatRupiah", () => {
  it("memakai titik ribuan tanpa spasi dan tanpa desimal", () => {
    expect(formatRupiah(15000)).toBe("Rp15.000");
    expect(formatRupiah(1250000)).toBe("Rp1.250.000");
  });

  it("menangani nol dan nilai negatif (pengeluaran/laba rugi)", () => {
    expect(formatRupiah(0)).toBe("Rp0");
    expect(formatRupiah(-5000)).toBe("-Rp5.000");
  });

  it("menolak nominal bukan bilangan bulat", () => {
    expect(() => formatRupiah(1500.5)).toThrow();
  });
});
