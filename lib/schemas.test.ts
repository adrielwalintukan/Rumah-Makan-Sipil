import { describe, expect, it } from "vitest";
import { checkoutPayloadSchema } from "./schemas";

describe("checkoutPayloadSchema", () => {
  const validPayload = {
    customer_name: "Budi Santoso",
    customer_phone: "081234567890",
    order_type: "dine_in",
    payment_method: "qris",
    idempotency_key: "idem-12345",
    device_id: "device-uuid-123",
    items: [
      {
        menu_item_id: "00000000-0000-0000-0000-000000000001",
        option_ids: ["00000000-0000-0000-0000-000000000002"],
        quantity: 2,
        note: "Pedas",
      },
    ],
  };

  it("menerima payload valid", () => {
    const res = checkoutPayloadSchema.safeParse(validPayload);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.customer_name).toBe("Budi Santoso");
      expect(res.data.customer_phone).toBe("081234567890");
    }
  });

  it("mengizinkan customer_phone kosong atau null", () => {
    const resNull = checkoutPayloadSchema.safeParse({ ...validPayload, customer_phone: null });
    expect(resNull.success).toBe(true);
    if (resNull.success) expect(resNull.data.customer_phone).toBeNull();

    const resEmpty = checkoutPayloadSchema.safeParse({ ...validPayload, customer_phone: "" });
    expect(resEmpty.success).toBe(true);
    if (resEmpty.success) expect(resEmpty.data.customer_phone).toBeNull();
  });

  it("menolak nomor HP tidak valid", () => {
    const res = checkoutPayloadSchema.safeParse({ ...validPayload, customer_phone: "123456" });
    expect(res.success).toBe(false);
  });

  it("menolak nama pemesan kurang dari 2 atau lebih dari 30 karakter", () => {
    const resShort = checkoutPayloadSchema.safeParse({ ...validPayload, customer_name: "A" });
    expect(resShort.success).toBe(false);

    const resLong = checkoutPayloadSchema.safeParse({
      ...validPayload,
      customer_name: "Nama Pemesan Ini Jauh Lebih Dari Tiga Puluh Karakter Panjangnya",
    });
    expect(resLong.success).toBe(false);
  });

  it("menolak jenis pesanan atau metode bayar di luar enum", () => {
    const resType = checkoutPayloadSchema.safeParse({ ...validPayload, order_type: "delivery" });
    expect(resType.success).toBe(false);

    const resPay = checkoutPayloadSchema.safeParse({ ...validPayload, payment_method: "gopay" });
    expect(resPay.success).toBe(false);
  });

  it("menolak keranjang item kosong", () => {
    const res = checkoutPayloadSchema.safeParse({ ...validPayload, items: [] });
    expect(res.success).toBe(false);
  });

  it("menolak kuantitas di luar batas 1–20", () => {
    const resZero = checkoutPayloadSchema.safeParse({
      ...validPayload,
      items: [{ ...validPayload.items[0], quantity: 0 }],
    });
    expect(resZero.success).toBe(false);

    const resOver = checkoutPayloadSchema.safeParse({
      ...validPayload,
      items: [{ ...validPayload.items[0], quantity: 21 }],
    });
    expect(resOver.success).toBe(false);
  });

  it("menolak catatan lebih dari 100 karakter", () => {
    const res = checkoutPayloadSchema.safeParse({
      ...validPayload,
      items: [{ ...validPayload.items[0], note: "a".repeat(101) }],
    });
    expect(res.success).toBe(false);
  });
});
