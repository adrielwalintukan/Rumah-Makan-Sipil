const rupiah = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

/** Format Rupiah bulat sesuai design-system §3: `Rp15.000`. */
export function formatRupiah(amount: number): string {
  if (!Number.isInteger(amount)) throw new Error(`Nominal harus bilangan bulat Rupiah: ${amount}`);
  return `${amount < 0 ? "-" : ""}Rp${rupiah.format(Math.abs(amount))}`;
}
