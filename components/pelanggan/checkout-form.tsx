"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Banknote,
  ChevronRight,
  QrCode,
  ShoppingBag,
  Store,
  UtensilsCrossed,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resolveCart } from "@/lib/cart";
import { formatRupiah } from "@/lib/format";
import type { Category } from "@/lib/menu";
import {
  addActiveOrder,
  createIdempotencyKey,
  getDeviceId,
  isValidIndonesianPhone,
} from "@/lib/orders-client";
import { useCart, writeCart } from "@/lib/use-cart";

interface CheckoutFormProps {
  categories: Category[];
  isOpen: boolean;
}

export function CheckoutForm({ categories, isOpen }: CheckoutFormProps) {
  const router = useRouter();
  const cart = useCart();
  const { lines, total, hasUnavailable } = resolveCart(cart, categories);

  const [orderType, setOrderType] = React.useState<"dine_in" | "takeaway">("dine_in");
  const [paymentMethod, setPaymentMethod] = React.useState<"qris" | "cash">("qris");
  const [customerName, setCustomerName] = React.useState("");
  const [customerPhone, setCustomerPhone] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [nameError, setNameError] = React.useState<string | null>(null);
  const [phoneError, setPhoneError] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <ShoppingBag className="size-12 text-brown-500/60" aria-hidden />
        <h2 className="text-xl font-bold text-green-900">Keranjang masih kosong</h2>
        <p className="text-ink-600">Pilih menu terlebih dahulu sebelum melakukan checkout.</p>
        <Button asChild className="mt-2">
          <Link href="/">Lihat Menu</Link>
        </Button>
      </div>
    );
  }

  const validate = (): boolean => {
    let valid = true;
    const trimmedName = customerName.trim();

    if (trimmedName.length < 2 || trimmedName.length > 30) {
      setNameError("Nama pemesan wajib diisi (2–30 karakter).");
      valid = false;
    } else {
      setNameError(null);
    }

    if (customerPhone.trim() && !isValidIndonesianPhone(customerPhone)) {
      setPhoneError("Nomor HP harus berformat Indonesia (contoh: 081234567890).");
      valid = false;
    } else {
      setPhoneError(null);
    }

    return valid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!isOpen) {
      setSubmitError("Maaf, toko sedang tutup. Pesanan tidak dapat diproses saat ini.");
      return;
    }

    if (hasUnavailable) {
      setSubmitError("Beberapa menu di keranjang sedang habis. Silakan hapus menu tersebut di keranjang.");
      return;
    }

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const idempotencyKey = createIdempotencyKey();
      const deviceId = getDeviceId();

      const payload = {
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim() || null,
        order_type: orderType,
        payment_method: paymentMethod,
        idempotency_key: idempotencyKey,
        device_id: deviceId,
        items: lines.map((l) => ({
          menu_item_id: l.line.menuItemId,
          option_ids: l.line.optionIds,
          quantity: l.line.quantity,
          note: l.line.note,
        })),
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setSubmitError(data.error || "Gagal membuat pesanan. Silakan coba lagi.");
        setIsSubmitting(false);
        return;
      }

      // Berhasil: kosongkan keranjang, catat ke pesanan aktif, lalu buka halaman lacak/bayar
      writeCart(() => []);
      addActiveOrder(data.public_token);
      router.push(`/pesanan/${data.public_token}`);
    } catch {
      setSubmitError("Gagal menghubungi server. Periksa koneksi internet kamu dan coba lagi.");
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      {!isOpen && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-lg border border-warning bg-warning-bg p-4 text-sm font-medium text-ink-900"
        >
          <Store className="size-5 shrink-0 text-warning" aria-hidden />
          <span>Toko sedang tutup. Pemesanan tidak dapat dikirim saat ini.</span>
        </div>
      )}

      {hasUnavailable && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-lg border border-danger bg-danger-bg p-4 text-sm text-ink-900"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="size-5 shrink-0 text-danger" aria-hidden />
            <span>Ada menu yang sedang habis di keranjang kamu.</span>
          </div>
          <Link href="/keranjang" className="font-semibold text-danger underline hover:text-danger/80">
            Perbaiki
          </Link>
        </div>
      )}

      {submitError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-danger bg-danger-bg p-4 text-sm font-medium text-danger"
        >
          <AlertCircle className="size-5 shrink-0" aria-hidden />
          <span>{submitError}</span>
        </div>
      )}

      {/* 1. Jenis Pesanan (Kartu Pilihan Besar) */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-bold tracking-wide text-ink-900">
          JENIS PESANAN <span className="text-danger">*</span>
        </legend>
        <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Pilih jenis pesanan">
          <button
            type="button"
            role="radio"
            aria-checked={orderType === "dine_in"}
            onClick={() => setOrderType("dine_in")}
            className={`flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-lg border p-3 text-center transition-all ${
              orderType === "dine_in"
                ? "border-green-700 bg-green-100/60 font-semibold text-green-900 ring-2 ring-green-700/20"
                : "border-line bg-card text-ink-900 hover:bg-cream-100/50"
            }`}
          >
            <UtensilsCrossed className="size-5 text-green-700" aria-hidden />
            <span className="text-base">Makan di sini</span>
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={orderType === "takeaway"}
            onClick={() => setOrderType("takeaway")}
            className={`flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-lg border p-3 text-center transition-all ${
              orderType === "takeaway"
                ? "border-green-700 bg-green-100/60 font-semibold text-green-900 ring-2 ring-green-700/20"
                : "border-line bg-card text-ink-900 hover:bg-cream-100/50"
            }`}
          >
            <ShoppingBag className="size-5 text-green-700" aria-hidden />
            <span className="text-base">Bungkus</span>
          </button>
        </div>
      </fieldset>

      {/* 2. Data Pemesan */}
      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="customer-name" className="block text-sm font-bold tracking-wide text-ink-900">
            NAMA PEMESAN <span className="text-danger">*</span>
          </label>
          <p className="mb-2 text-xs text-ink-600">Dipanggil saat pesanan siap di kasir</p>
          <Input
            id="customer-name"
            name="customer_name"
            type="text"
            required
            maxLength={30}
            placeholder="Contoh: Budi Santoso"
            value={customerName}
            onChange={(e) => {
              setCustomerName(e.target.value);
              if (nameError) setNameError(null);
            }}
            aria-invalid={!!nameError}
            aria-describedby={nameError ? "name-error" : undefined}
          />
          {nameError && (
            <p id="name-error" className="mt-1.5 flex items-center gap-1 text-xs font-medium text-danger">
              <AlertCircle className="size-3.5 shrink-0" aria-hidden />
              <span>{nameError}</span>
            </p>
          )}
        </div>

        <div>
          <label htmlFor="customer-phone" className="block text-sm font-bold tracking-wide text-ink-900">
            NO. WHATSAPP / HP <span className="font-normal text-ink-400">(Opsional)</span>
          </label>
          <p className="mb-2 text-xs text-ink-600">Untuk konfirmasi jika ada menu yang habis</p>
          <Input
            id="customer-phone"
            name="customer_phone"
            type="tel"
            placeholder="08xxxxxxxxxx"
            value={customerPhone}
            onChange={(e) => {
              setCustomerPhone(e.target.value);
              if (phoneError) setPhoneError(null);
            }}
            aria-invalid={!!phoneError}
            aria-describedby={phoneError ? "phone-error" : undefined}
          />
          {phoneError && (
            <p id="phone-error" className="mt-1.5 flex items-center gap-1 text-xs font-medium text-danger">
              <AlertCircle className="size-3.5 shrink-0" aria-hidden />
              <span>{phoneError}</span>
            </p>
          )}
        </div>
      </div>

      {/* 3. Metode Pembayaran (Kartu Pilihan Besar) */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-bold tracking-wide text-ink-900">
          METODE PEMBAYARAN <span className="text-danger">*</span>
        </legend>
        <div className="flex flex-col gap-3" role="radiogroup" aria-label="Pilih metode pembayaran">
          <button
            type="button"
            role="radio"
            aria-checked={paymentMethod === "qris"}
            onClick={() => setPaymentMethod("qris")}
            className={`flex min-h-16 items-center gap-3.5 rounded-lg border p-3.5 text-left transition-all ${
              paymentMethod === "qris"
                ? "border-green-700 bg-green-100/60 font-semibold text-green-900 ring-2 ring-green-700/20"
                : "border-line bg-card text-ink-900 hover:bg-cream-100/50"
            }`}
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-green-700 text-white">
              <QrCode className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-ink-900">QRIS (DANA Bisnis)</p>
              <p className="text-xs text-ink-600">Bisa semua bank, GoPay, OVO, ShopeePay, DANA</p>
            </div>
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={paymentMethod === "cash"}
            onClick={() => setPaymentMethod("cash")}
            className={`flex min-h-16 items-center gap-3.5 rounded-lg border p-3.5 text-left transition-all ${
              paymentMethod === "cash"
                ? "border-green-700 bg-green-100/60 font-semibold text-green-900 ring-2 ring-green-700/20"
                : "border-line bg-card text-ink-900 hover:bg-cream-100/50"
            }`}
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-brown-700 text-white">
              <Banknote className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-ink-900">Cash / Tunai</p>
              <p className="text-xs text-ink-600">Bayar langsung di kasir saat mengambil pesanan</p>
            </div>
          </button>
        </div>
      </fieldset>

      {/* 4. Ringkasan Pesanan */}
      <div className="flex flex-col gap-3 rounded-lg border border-line bg-card p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold tracking-wide text-ink-900">RINGKASAN PESANAN</h3>
          <Link
            href="/keranjang"
            className="inline-flex items-center text-xs font-semibold text-green-700 hover:underline"
          >
            Ubah <ChevronRight className="size-3" aria-hidden />
          </Link>
        </div>

        <ul className="divide-y divide-line/60">
          {lines.map(({ key, line, item, options, subtotal, available }) => {
            const name = item?.name ?? "Menu tidak tersedia";
            return (
              <li key={key} className="flex items-start justify-between py-2 text-sm">
                <div className="min-w-0 pr-2">
                  <p className={`font-medium ${available ? "text-ink-900" : "text-danger line-through"}`}>
                    {line.quantity}x {name}
                  </p>
                  {options.length > 0 && (
                    <p className="text-xs text-ink-600">{options.map((o) => o.name).join(", ")}</p>
                  )}
                  {line.note && <p className="text-xs text-ink-600 italic">“{line.note}”</p>}
                </div>
                <span className="shrink-0 font-semibold text-ink-900 tabular-nums">
                  {available ? formatRupiah(subtotal) : "Habis"}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="mt-2 flex items-center justify-between border-t border-line pt-3">
          <span className="text-base font-bold text-ink-900">Total Pembayaran</span>
          <span data-testid="checkout-total" className="text-xl font-bold text-green-900 tabular-nums">
            {formatRupiah(total)}
          </span>
        </div>
      </div>

      {/* 5. Tombol Submit */}
      <Button
        type="submit"
        disabled={isSubmitting || !isOpen || hasUnavailable}
        className="w-full text-base font-bold"
        size="lg"
      >
        {isSubmitting
          ? "Memproses pesanan..."
          : !isOpen
            ? "Toko sedang tutup"
            : hasUnavailable
              ? "Menu habis di keranjang"
              : `Pesan Sekarang · ${formatRupiah(total)}`}
      </Button>
    </form>
  );
}
