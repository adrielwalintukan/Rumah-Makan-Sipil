import { beforeEach, describe, expect, it } from "vitest";
import {
  addActiveOrder,
  createIdempotencyKey,
  getActiveOrders,
  getDeviceId,
  isValidIndonesianPhone,
} from "./orders-client";

describe("orders-client helpers", () => {
  beforeEach(() => {
    // bersihkan storage jika ada
    try {
      window.localStorage.clear();
    } catch {
      // ignore
    }
  });

  it("getDeviceId menghasilkan ID yang konsisten pada pemanggilan berulang", () => {
    const id1 = getDeviceId();
    const id2 = getDeviceId();
    expect(id1).toBeTruthy();
    expect(id1).toBe(id2);
  });

  it("createIdempotencyKey menghasilkan key unik setiap kali dipanggil", () => {
    const key1 = createIdempotencyKey();
    const key2 = createIdempotencyKey();
    expect(key1).toBeTruthy();
    expect(key2).toBeTruthy();
    expect(key1).not.toBe(key2);
  });

  it("addActiveOrder dan getActiveOrders menyimpan dan mengambil token pesanan aktif secara terurut tanpa duplikat", () => {
    expect(getActiveOrders()).toEqual([]);

    addActiveOrder("tok-1");
    expect(getActiveOrders()).toEqual(["tok-1"]);

    addActiveOrder("tok-2");
    expect(getActiveOrders()).toEqual(["tok-2", "tok-1"]);

    // Duplikat akan dipindahkan ke paling depan
    addActiveOrder("tok-1");
    expect(getActiveOrders()).toEqual(["tok-1", "tok-2"]);
  });

  it("isValidIndonesianPhone memvalidasi format nomor HP Indonesia", () => {
    expect(isValidIndonesianPhone("")).toBe(true);
    expect(isValidIndonesianPhone("   ")).toBe(true);
    expect(isValidIndonesianPhone("081234567890")).toBe(true);
    expect(isValidIndonesianPhone("+6281234567890")).toBe(true);
    expect(isValidIndonesianPhone("6281234567890")).toBe(true);
    expect(isValidIndonesianPhone("0712345678")).toBe(false);
    expect(isValidIndonesianPhone("abcdef")).toBe(false);
  });
});
