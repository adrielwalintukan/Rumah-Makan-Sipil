/* eslint-disable @next/next/no-img-element */
"use client";

import * as React from "react";
import {
  AlertCircle,
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock,
  Download,
  Maximize2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatRupiah } from "@/lib/format";

export interface PaymentCardProps {
  order: {
    public_token: string;
    daily_number: number;
    customer_name: string;
    payment_method: "qris" | "cash";
    payment_status: "belum_bayar" | "menunggu_verifikasi" | "lunas";
    total: number;
  };
  qrisImageUrl: string | null;
  onPaymentStatusChange?: (newStatus: "belum_bayar" | "menunggu_verifikasi" | "lunas") => void;
}

export function PaymentCard({ order, qrisImageUrl, onPaymentStatusChange }: PaymentCardProps) {
  const [localClaimedStatus, setLocalClaimedStatus] = React.useState<
    "belum_bayar" | "menunggu_verifikasi" | "lunas" | null
  >(null);
  const [isClaiming, setIsClaiming] = React.useState(false);
  const [claimError, setClaimError] = React.useState<string | null>(null);
  const [isZoomed, setIsZoomed] = React.useState(false);

  const paymentStatus =
    order.payment_status === "lunas"
      ? "lunas"
      : localClaimedStatus ?? order.payment_status;

  const dailyNum = String(order.daily_number).padStart(3, "0");

  const handleClaimPaid = async () => {
    setIsClaiming(true);
    setClaimError(null);

    try {
      const res = await fetch(`/api/orders/${order.public_token}/claim-paid`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setClaimError(data.error || "Gagal memperbarui status. Silakan coba lagi.");
        setIsClaiming(false);
        return;
      }

      const data = await res.json();
      const nextStatus = data.payment_status || "menunggu_verifikasi";
      setLocalClaimedStatus(nextStatus);
      onPaymentStatusChange?.(nextStatus);
    } catch {
      setClaimError("Terjadi kesalahan koneksi. Silakan periksa jaringan dan coba lagi.");
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-line bg-card p-5">
      {/* Header status bayar */}
      <div className="flex items-center justify-between border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold tracking-wide text-ink-900">PEMBAYARAN</span>
          <span className="rounded-md border border-line bg-cream-50 px-2 py-0.5 text-xs font-bold text-ink-600 uppercase">
            {order.payment_method === "qris" ? "QRIS" : "Cash"}
          </span>
        </div>
        {paymentStatus === "belum_bayar" && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-danger/30 bg-danger-bg px-2.5 py-0.5 text-xs font-semibold text-danger">
            <AlertCircle className="size-3.5" aria-hidden />
            Belum Bayar
          </span>
        )}
        {paymentStatus === "menunggu_verifikasi" && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning-bg px-2.5 py-0.5 text-xs font-semibold text-warning">
            <Clock className="size-3.5" aria-hidden />
            Menunggu Verifikasi
          </span>
        )}
        {paymentStatus === "lunas" && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success-bg px-2.5 py-0.5 text-xs font-semibold text-success">
            <CheckCircle2 className="size-3.5" aria-hidden />
            Lunas
          </span>
        )}
      </div>

      {paymentStatus === "lunas" ? (
        /* Sudah lunas: QR, panduan, dan instruksi bayar tidak relevan lagi, cukup konfirmasi. */
        <div role="status" className="flex flex-col items-center gap-2 rounded-lg border border-success/30 bg-success-bg px-4 py-6 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-card text-success shadow-xs ring-4 ring-success/15">
            <CheckCircle2 className="size-8" aria-hidden />
          </span>
          <p className="mt-1 font-display text-xl font-bold text-green-900">Pembayaran Lunas</p>
          <p data-testid="payment-total-amount" className="font-display text-3xl font-bold text-green-900 tabular-nums">
            {formatRupiah(order.total)}
          </p>
          <p className="max-w-xs text-sm text-ink-600">
            {order.payment_method === "qris"
              ? "Pembayaran QRIS kamu sudah diverifikasi kasir. Terima kasih!"
              : "Pembayaran tunai kamu sudah diterima kasir. Terima kasih!"}
          </p>
        </div>
      ) : (
        <>
        {/* Kotak Total Besar */}
        <div className="flex flex-col items-center justify-center rounded-lg border border-line/60 bg-cream-50 p-4 text-center">
          <span className="text-xs font-bold tracking-wider text-ink-600 uppercase">Total yang Harus Dibayar</span>
          <span data-testid="payment-total-amount" className="font-display text-3xl font-bold text-green-900 tabular-nums">
            {formatRupiah(order.total)}
          </span>
          {order.payment_method === "qris" && paymentStatus === "belum_bayar" && (
            <span className="mt-1 text-xs font-medium text-danger">
              Masukkan nominal persis {formatRupiah(order.total)} saat transfer
            </span>
          )}
        </div>

        {/* Konten Metode Bayar: QRIS */}
        {order.payment_method === "qris" && (
          <div className="flex flex-col gap-4">
            {qrisImageUrl ? (
              <div className="flex flex-col items-center gap-3">
                <div
                  onClick={() => setIsZoomed(true)}
                  className="group relative flex size-60 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-line bg-white p-2 shadow-xs transition hover:border-green-700"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      setIsZoomed(true);
                    }
                  }}
                  aria-label="Perbesar gambar QRIS"
                >
                  <img
                    src={qrisImageUrl}
                    alt="Kode QRIS DANA Bisnis Rumah Makan Sipil"
                    className="size-full object-contain"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-white/90 px-3 py-1.5 text-xs font-semibold text-ink-900 shadow">
                      <Maximize2 className="size-4" aria-hidden />
                      Perbesar
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsZoomed(true)}
                    className="gap-1.5 text-xs"
                  >
                    <Maximize2 className="size-3.5" aria-hidden />
                    Perbesar
                  </Button>
                  <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
                    <a href={qrisImageUrl} download="qris-rumah-makan-sipil.png" target="_blank" rel="noreferrer">
                      <Download className="size-3.5" aria-hidden />
                      Simpan QR
                    </a>
                  </Button>
                </div>
              </div>
            ) : (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning-bg p-3.5 text-sm text-ink-900"
              >
                <AlertTriangle className="size-5 shrink-0 text-warning" aria-hidden />
                <div>
                  <p className="font-semibold text-warning">QRIS digital belum tersedia di layar</p>
                  <p className="text-xs text-ink-600 mt-0.5">
                    Silakan scan QRIS fisik yang ada di meja kasir atau bayar langsung secara tunai.
                  </p>
                </div>
              </div>
            )}

            {/* Panduan Pembayaran QRIS */}
            <div className="rounded-md bg-cream-50/70 p-3 text-xs text-ink-600">
              <p className="font-semibold text-ink-900 mb-1.5">Cara Membayar dengan QRIS:</p>
              <ol className="list-inside list-decimal space-y-1">
                <li>Buka aplikasi m-Banking atau e-Wallet apa saja (GoPay, OVO, ShopeePay, DANA, BCA, dll.).</li>
                <li>Scan kode QR di atas (atau simpan gambar lalu pilih dari galeri).</li>
                <li>
                  Ketikkan nominal transfer persis <strong>{formatRupiah(order.total)}</strong>.
                </li>
                <li>Selesaikan pembayaran, lalu ketuk tombol <strong>&quot;Saya sudah bayar&quot;</strong> di bawah.</li>
              </ol>
            </div>

            {claimError && (
              <p role="alert" className="text-center text-xs font-medium text-danger">
                {claimError}
              </p>
            )}

            {/* Tombol aksi atau status */}
            {paymentStatus === "belum_bayar" && (
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="accent"
                  size="lg"
                  disabled={isClaiming}
                  onClick={handleClaimPaid}
                  className="w-full text-base font-bold"
                >
                  {isClaiming ? "Mengonfirmasi..." : "Saya sudah bayar"}
                </Button>
                <p className="text-center text-[11px] text-ink-400">
                  Tekan tombol ini setelah kamu menyelesaikan transfer di aplikasi e-wallet / m-banking.
                </p>
              </div>
            )}

            {paymentStatus === "menunggu_verifikasi" && (
              <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning-bg p-4 text-sm text-ink-900">
                <Clock className="size-5 shrink-0 text-warning" aria-hidden />
                <div>
                  <p className="font-bold text-ink-900">Menunggu Verifikasi Kasir</p>
                  <p className="text-xs text-ink-600 mt-1">
                    Kamu telah mengonfirmasi pembayaran. Pemilik warung akan memeriksa notifikasi masuk di DANA Bisnis.
                    Pesananmu akan segera dimasak setelah diverifikasi.
                  </p>
                </div>
              </div>
            )}

          </div>
        )}

        {/* Konten Metode Bayar: Cash */}
        {order.payment_method === "cash" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-3 rounded-lg border border-line bg-cream-50 p-4 text-sm text-ink-900">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-brown-700 text-white">
                <Banknote className="size-5" aria-hidden />
              </div>
              <div className="flex-1">
                <p className="font-bold text-ink-900">Bayar di Kasir</p>
                <p className="text-xs text-ink-600 mt-1">
                  Silakan lakukan pembayaran tunai ke kasir. Sebutkan nama{" "}
                  <strong className="text-ink-900 font-semibold">{order.customer_name}</strong> dan nomor antrean{" "}
                  <strong className="text-green-900 font-bold">#{dailyNum}</strong> saat membayar atau mengambil
                  makanan.
                </p>
              </div>
            </div>

            {paymentStatus === "belum_bayar" && (
              <p className="text-center text-xs text-ink-400">
                Kasir akan menandai pesanan lunas saat uang tunai diterima.
              </p>
            )}
          </div>
        )}

        </>
      )}

      {/* Modal Zoom Gambar QRIS */}
      {isZoomed && qrisImageUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Gambar QRIS ukuran penuh"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs"
          onClick={() => setIsZoomed(false)}
        >
          <div
            className="relative flex max-w-sm flex-col items-center gap-4 rounded-xl border border-line bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsZoomed(false)}
              className="absolute top-3 right-3 inline-flex size-9 items-center justify-center rounded-full hover:bg-cream-100 text-ink-900"
              aria-label="Tutup gambar"
            >
              <X className="size-5" />
            </button>

            <div className="text-center">
              <p className="font-display text-lg font-bold text-green-900">QRIS Rumah Makan Sipil</p>
              <p className="text-xs text-ink-600">Nominal persis: {formatRupiah(order.total)}</p>
            </div>

            <div className="size-72 overflow-hidden rounded-lg border border-line p-2">
              <img
                src={qrisImageUrl}
                alt="Kode QRIS DANA Bisnis ukuran besar"
                className="size-full object-contain"
              />
            </div>

            <Button asChild variant="outline" className="w-full gap-2">
              <a href={qrisImageUrl} download="qris-rumah-makan-sipil.png" target="_blank" rel="noreferrer">
                <Download className="size-4" aria-hidden />
                Unduh Gambar QRIS
              </a>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
