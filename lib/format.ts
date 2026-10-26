const rupiah = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

/** Format Rupiah bulat sesuai design-system §3: `Rp15.000`. */
export function formatRupiah(amount: number): string {
  if (!Number.isInteger(amount)) throw new Error(`Nominal harus bilangan bulat Rupiah: ${amount}`);
  return `${amount < 0 ? "-" : ""}Rp${rupiah.format(Math.abs(amount))}`;
}

/** Format nomor antrean harian dengan padding 3 digit: 1 -> #001, 7 -> #007 */
export function formatDailyNumber(num: number): string {
  return `#${String(num).padStart(3, "0")}`;
}

/** Format waktu relatif atau jam HH:mm untuk kartu pesanan (WITA) */
export function formatRelativeTime(dateString: string, now: Date = new Date()): string {
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "baru saja";
  if (diffMinutes < 60) return `${diffMinutes} mnt lalu`;

  return date
    .toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Makassar",
    })
    .replace(".", ":");
}
