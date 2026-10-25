import { describe, it, expect } from "vitest";
import type { AdminOrder } from "@/lib/admin-orders";
import { applyOrderUpdate, insertOrderThenLoadItems } from "./live-orders-board";

const rawOrder: AdminOrder = {
  id: "order-1",
  public_token: "tok-1",
  order_date: "2026-10-26",
  daily_number: 1,
  customer_name: "Rian",
  customer_phone: null,
  order_type: "dine_in",
  payment_method: "qris",
  payment_status: "belum_bayar",
  status: "baru",
  total: 35000,
  cancel_reason: null,
  created_at: "2026-10-26T04:00:00Z",
  paid_at: null,
  order_items: [],
};

const items: AdminOrder["order_items"] = [
  {
    id: "item-1",
    order_id: "order-1",
    menu_item_id: "menu-1",
    name: "Cotto Makassar",
    unit_price: 35000,
    quantity: 1,
    subtotal: 35000,
    note: null,
    options: [],
  },
];

// Simulasi useState: setter menerima nilai atau fungsi updater
function createState(initial: AdminOrder[] = []) {
  const state = { orders: initial };
  const setOrders = (u: AdminOrder[] | ((prev: AdminOrder[]) => AdminOrder[])) => {
    state.orders = typeof u === "function" ? u(state.orders) : u;
  };
  return { state, setOrders };
}

function deferredItems() {
  let resolve!: (v: AdminOrder["order_items"]) => void;
  const promise = new Promise<AdminOrder["order_items"]>((r) => (resolve = r));
  return { promise, resolve };
}

describe("realtime Pesanan Live", () => {
  it("UPDATE klaim bayar yang tiba saat item masih dimuat tidak hilang", async () => {
    const { state, setOrders } = createState();
    const pending = deferredItems();

    const inserting = insertOrderThenLoadItems(rawOrder, setOrders, () => pending.promise);
    setOrders((prev) =>
      applyOrderUpdate(prev, { ...rawOrder, payment_status: "menunggu_verifikasi" })
    );
    pending.resolve(items);
    await inserting;

    expect(state.orders).toHaveLength(1);
    expect(state.orders[0].payment_status).toBe("menunggu_verifikasi");
    expect(state.orders[0].order_items).toEqual(items);
  });

  it("pesanan yang dibatalkan saat item dimuat tidak muncul kembali", async () => {
    const { state, setOrders } = createState();
    const pending = deferredItems();

    const inserting = insertOrderThenLoadItems(rawOrder, setOrders, () => pending.promise);
    setOrders((prev) => applyOrderUpdate(prev, { ...rawOrder, status: "batal" }));
    pending.resolve(items);
    await inserting;

    expect(state.orders).toHaveLength(0);
  });

  it("INSERT untuk pesanan yang sudah ada (hasil refresh) tidak menimpa status terbaru", async () => {
    const existing = { ...rawOrder, payment_status: "menunggu_verifikasi" as const };
    const { state, setOrders } = createState([existing]);

    await insertOrderThenLoadItems(rawOrder, setOrders, async () => items);

    expect(state.orders).toHaveLength(1);
    expect(state.orders[0].payment_status).toBe("menunggu_verifikasi");
  });

  it("pesanan selesai + lunas dikeluarkan dari board", () => {
    const next = applyOrderUpdate([{ ...rawOrder, order_items: items }], {
      ...rawOrder,
      status: "selesai",
      payment_status: "lunas",
    });
    expect(next).toHaveLength(0);
  });
});
