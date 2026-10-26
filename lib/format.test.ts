import { describe, expect, it } from "vitest";
import { formatDailyNumber, formatRelativeTime, formatRupiah } from "./format";

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

describe("formatDailyNumber", () => {
  it("menambahkan padding 3 digit dengan prefix #", () => {
    expect(formatDailyNumber(1)).toBe("#001");
    expect(formatDailyNumber(7)).toBe("#007");
    expect(formatDailyNumber(42)).toBe("#042");
    expect(formatDailyNumber(123)).toBe("#123");
  });
});

describe("formatRelativeTime", () => {
  it("menampilkan 'baru saja' jika kurang dari 1 menit", () => {
    const now = new Date("2026-10-17T12:00:30Z");
    const created = "2026-10-17T12:00:00Z";
    expect(formatRelativeTime(created, now)).toBe("baru saja");
  });

  it("menampilkan menit jika kurang dari 60 menit", () => {
    const now = new Date("2026-10-17T12:15:00Z");
    const created = "2026-10-17T12:03:00Z";
    expect(formatRelativeTime(created, now)).toBe("12 mnt lalu");
  });

  it("menampilkan jam WITA jika 60 menit atau lebih", () => {
    const now = new Date("2026-10-17T15:00:00Z");
    // 12:00 UTC = 20:00 WITA (UTC+8)
    const created = "2026-10-17T12:00:00Z";
    expect(formatRelativeTime(created, now)).toBe("20:00");
  });
});
