import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { PaymentCard, type PaymentCardProps } from "./payment-card";

const order: PaymentCardProps["order"] = {
  public_token: "tok",
  daily_number: 7,
  customer_name: "Rian",
  payment_method: "qris",
  payment_status: "belum_bayar",
  total: 10000,
};
const render = (o: Partial<PaymentCardProps["order"]>) =>
  renderToString(<PaymentCard order={{ ...order, ...o }} qrisImageUrl="https://example.test/qris.png" />);

describe("PaymentCard", () => {
  it("belum bayar QRIS: tampilkan QR dan cara membayar", () => {
    const html = render({});
    expect(html).toContain("qris.png");
    expect(html).toContain("Cara Membayar dengan QRIS");
  });

  it("lunas QRIS: QR dan cara membayar disembunyikan, hanya konfirmasi lunas", () => {
    const html = render({ payment_status: "lunas" });
    expect(html).not.toContain("qris.png");
    expect(html).not.toContain("Cara Membayar");
    expect(html).toContain("Pembayaran Lunas");
    expect(html).toContain("Rp10.000");
  });

  it("lunas tunai: instruksi bayar di kasir disembunyikan", () => {
    const html = render({ payment_method: "cash", payment_status: "lunas" });
    expect(html).not.toContain("Bayar di Kasir");
    expect(html).toContain("tunai kamu sudah diterima");
  });
});
