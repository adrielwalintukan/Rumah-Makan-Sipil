import { PHONE_REGEX } from "@/lib/schemas";

const DEVICE_ID_KEY = "device_id";
const ACTIVE_ORDERS_KEY = "active_orders";

let memoryDeviceId: string | null = null;
let memoryActiveOrders: string[] = [];

function getStorage(): Storage | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // LocalStorage diblokir atau tidak tersedia (mode privat / SSR)
  }
  return null;
}

/** Ambil atau generate UUID device_id unik untuk rate limiting di browser (AGENTS.md §8.8). */
export function getDeviceId(): string {
  const storage = getStorage();
  if (storage) {
    try {
      let id = storage.getItem(DEVICE_ID_KEY);
      if (!id) {
        id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        storage.setItem(DEVICE_ID_KEY, id);
      }
      return id;
    } catch {
      // fallback jika getItem/setItem melempar error
    }
  }

  if (!memoryDeviceId) {
    memoryDeviceId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
  return memoryDeviceId;
}

/** Buat idempotency key unik untuk setiap pengiriman checkout (mencegah double order). */
export function createIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Ambil daftar public_token pesanan aktif hari ini dari localStorage. */
export function getActiveOrders(): string[] {
  const storage = getStorage();
  if (storage) {
    try {
      const raw = storage.getItem(ACTIVE_ORDERS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((t): t is string => typeof t === "string");
      }
    } catch {
      return [];
    }
  }
  return memoryActiveOrders;
}

/** Simpan public_token pesanan baru ke active_orders di localStorage. */
export function addActiveOrder(token: string): void {
  const cleanToken = token.trim();
  if (!cleanToken) return;

  const storage = getStorage();
  const current = getActiveOrders().filter((t) => t !== cleanToken);
  const updated = [cleanToken, ...current];

  if (storage) {
    try {
      storage.setItem(ACTIVE_ORDERS_KEY, JSON.stringify(updated));
      return;
    } catch {
      // fallback ke memory
    }
  }
  memoryActiveOrders = updated;
}

/** Hapus public_token tertentu dari active_orders (misal setelah pesanan selesai/batal). */
export function removeActiveOrder(token: string): void {
  const cleanToken = token.trim();
  if (!cleanToken) return;

  const storage = getStorage();
  const current = getActiveOrders().filter((t) => t !== cleanToken);

  if (storage) {
    try {
      storage.setItem(ACTIVE_ORDERS_KEY, JSON.stringify(current));
      return;
    } catch {
      // fallback ke memory
    }
  }
  memoryActiveOrders = current;
}

/** Kosongkan seluruh daftar active_orders (misal untuk testing). */
export function clearActiveOrders(): void {
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(ACTIVE_ORDERS_KEY);
      return;
    } catch {
      // fallback
    }
  }
  memoryActiveOrders = [];
}

/** Validasi format nomor HP Indonesia opsional. */
export function isValidIndonesianPhone(phone: string): boolean {
  const trimmed = phone.trim();
  if (!trimmed) return true;
  return PHONE_REGEX.test(trimmed);
}
