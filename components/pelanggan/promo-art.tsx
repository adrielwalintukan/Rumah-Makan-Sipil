/**
 * Ilustrasi banner menu (design-system §6.8). SVG inline berwarna token brand:
 * tanpa file gambar, tajam di semua layar, dan dekoratif (aria-hidden).
 */

/** Glyph WhatsApp resmi (Simple Icons, CC0); warnanya mengikuti `currentColor`. */
export function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  );
}

/** Kotak nasi terbuka berisi nasi, telur, dan sayur, dengan uap hangat. */
export function DosArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 140" aria-hidden className={className}>
      <ellipse cx="80" cy="128" rx="58" ry="7" fill="#000" opacity=".18" />
      <g fill="none" stroke="#FBF8F2" strokeWidth="3" strokeLinecap="round" opacity=".75">
        <path d="M62 30c-5-6 5-10 0-17" />
        <path d="M80 26c-5-6 5-10 0-17" />
        <path d="M98 30c-5-6 5-10 0-17" />
      </g>
      <polygon points="30,64 46,38 142,38 128,64" fill="#E4CDB3" />
      <ellipse cx="66" cy="64" rx="30" ry="11" fill="#FFFFFF" />
      <circle cx="58" cy="58" r="2" fill="#F4EEE3" />
      <circle cx="74" cy="56" r="2" fill="#F4EEE3" />
      <path d="M92 62c4-14 16-18 26-14-4 10-14 16-26 14Z" fill="#3A6E4E" />
      <path d="M96 60c6-5 12-8 18-10" stroke="#264A34" strokeWidth="1.5" fill="none" />
      <circle cx="112" cy="62" r="12" fill="#FFFFFF" />
      <circle cx="112" cy="62" r="5.5" fill="#F2B33D" />
      <rect x="26" y="64" width="108" height="58" rx="7" fill="#F1E3D3" />
      <rect x="26" y="64" width="108" height="10" rx="3" fill="#E4CDB3" />
      <rect x="54" y="86" width="52" height="22" rx="11" fill="#A86A32" />
      <text x="80" y="101.5" textAnchor="middle" fontSize="12" fontWeight="800" fill="#FFFFFF" fontFamily="inherit">
        DOS
      </text>
    </svg>
  );
}

/** HP berisi daftar menu, dengan notifikasi "Siap!" yang melayang. */
export function PhoneArt({ className }: { className?: string }) {
  const rows = [44, 68, 92];
  return (
    <svg viewBox="0 0 160 140" aria-hidden className={className}>
      <ellipse cx="82" cy="134" rx="44" ry="5" fill="#000" opacity=".18" />
      <rect x="44" y="6" width="74" height="126" rx="14" fill="#1F3D2B" />
      <rect x="50" y="16" width="62" height="108" rx="8" fill="#FBF8F2" />
      <rect x="71" y="10" width="20" height="3" rx="1.5" fill="#3A6E4E" />
      <rect x="50" y="16" width="62" height="20" rx="8" fill="#264A34" />
      <rect x="56" y="24" width="26" height="4" rx="2" fill="#FBF8F2" />
      {rows.map((y) => (
        <g key={y}>
          <rect x="55" y={y} width="52" height="20" rx="4" fill="#FFFFFF" stroke="#E7E1D6" />
          <rect x="58" y={y + 3} width="14" height="14" rx="3" fill="#F4EEE3" />
          <rect x="76" y={y + 5} width="20" height="3" rx="1.5" fill="#1C1B18" opacity=".7" />
          <rect x="76" y={y + 11} width="12" height="3" rx="1.5" fill="#7A4E24" />
          <circle cx="101" cy={y + 14} r="3.5" fill="#2E5A3F" />
        </g>
      ))}
      <rect x="55" y="114" width="52" height="7" rx="3.5" fill="#2E5A3F" />
      <g>
        <rect x="100" y="26" width="54" height="24" rx="12" fill="#E2F3E8" stroke="#1F7A45" strokeOpacity=".25" />
        <circle cx="113" cy="38" r="7" fill="#1F7A45" />
        <path d="M109.5 38l2.5 2.5 4.5-5" stroke="#FFFFFF" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <text x="124" y="42" fontSize="11" fontWeight="800" fill="#1F7A45" fontFamily="inherit">
          Siap!
        </text>
      </g>
      <g fill="#FBF8F2" opacity=".8">
        <circle cx="26" cy="40" r="3" />
        <circle cx="34" cy="96" r="2" />
        <circle cx="140" cy="88" r="2.5" />
      </g>
    </svg>
  );
}

// Pola modul QR dekoratif 7×7 (bukan QR yang bisa dipindai).
const QR_BITS = ["1011010", "0110101", "1101011", "0010110", "1101101", "0110010", "1011101"];

/** Kartu QR dengan uang kertas dan koin: dua cara bayar. */
export function PayArt({ className }: { className?: string }) {
  const finders = [
    [30, 36],
    [78, 36],
    [30, 84],
  ];
  return (
    <svg viewBox="0 0 160 140" aria-hidden className={className}>
      <ellipse cx="82" cy="130" rx="60" ry="6" fill="#1F3D2B" opacity=".12" />
      <rect x="18" y="10" width="92" height="114" rx="12" fill="#FFFFFF" stroke="#E7E1D6" />
      <rect x="18" y="10" width="92" height="20" rx="10" fill="#2E5A3F" />
      <text x="64" y="24.5" textAnchor="middle" fontSize="11" fontWeight="800" fill="#FFFFFF" fontFamily="inherit">
        QRIS
      </text>
      {finders.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={x} y={y} width="20" height="20" rx="3" fill="#1C1B18" />
          <rect x={x + 4} y={y + 4} width="12" height="12" rx="2" fill="#FFFFFF" />
          <rect x={x + 7} y={y + 7} width="6" height="6" rx="1" fill="#1C1B18" />
        </g>
      ))}
      {QR_BITS.flatMap((row, r) =>
        [...row].map((bit, c) =>
          bit === "1" && !(r < 3 && c < 3) && !(r < 3 && c > 3) && !(r > 3 && c < 3) ? (
            <rect key={`${r}-${c}`} x={30 + c * 9.7} y={36 + r * 9.7} width="7" height="7" rx="1.5" fill="#1C1B18" />
          ) : null,
        ),
      )}
      <g transform="rotate(-12 116 96)">
        <rect x="86" y="78" width="62" height="34" rx="5" fill="#C7DED0" stroke="#2E5A3F" strokeWidth="2" />
        <circle cx="117" cy="95" r="8" fill="none" stroke="#2E5A3F" strokeWidth="2" />
        <text x="117" y="99" textAnchor="middle" fontSize="10" fontWeight="800" fill="#2E5A3F" fontFamily="inherit">
          Rp
        </text>
      </g>
      <circle cx="138" cy="122" r="9" fill="#A86A32" stroke="#7A4E24" strokeWidth="2" />
      <circle cx="124" cy="126" r="7" fill="#A86A32" stroke="#7A4E24" strokeWidth="2" />
    </svg>
  );
}

/** Mangkuk mie kuah hangat dengan telur, daging, daun bawang, dan sumpit (hero toko). */
export function BowlArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 170" aria-hidden className={className}>
      <ellipse cx="100" cy="158" rx="70" ry="8" fill="#000" opacity=".22" />
      <g fill="none" stroke="#FBF8F2" strokeWidth="3.5" strokeLinecap="round" opacity=".7">
        <path d="M76 52c-6-8 6-13 0-22" />
        <path d="M100 46c-6-8 6-13 0-22" />
        <path d="M124 52c-6-8 6-13 0-22" />
      </g>
      <ellipse cx="100" cy="148" rx="36" ry="8" fill="#E9E0CF" />
      <path d="M20 88c4 58 156 58 160 0Z" fill="#FBF8F2" />
      <path d="M30 108c40 16 100 16 140 0" fill="none" stroke="#A86A32" strokeWidth="5" strokeLinecap="round" />
      <path d="M38 122c34 12 90 12 124 0" fill="none" stroke="#A86A32" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="2 8" />
      <ellipse cx="100" cy="88" rx="80" ry="19" fill="#F4EEE3" />
      <ellipse cx="100" cy="90" rx="71" ry="14" fill="#E3A33B" />
      <g fill="none" stroke="#F6D37A" strokeWidth="3" strokeLinecap="round">
        <path d="M42 92c8-6 14 6 22 0s14 6 22 0" />
        <path d="M96 96c8-6 14 6 22 0s14 6 22 0" />
        <path d="M60 99c8-5 14 5 22 0" />
      </g>
      <rect x="104" y="78" width="30" height="12" rx="4" fill="#A86A32" transform="rotate(-8 119 84)" />
      <rect x="128" y="84" width="24" height="10" rx="4" fill="#7A4E24" transform="rotate(6 140 89)" />
      <ellipse cx="74" cy="84" rx="15" ry="9" fill="#FFFFFF" />
      <circle cx="74" cy="84" r="5.5" fill="#F2B33D" />
      <g fill="#3A6E4E">
        <circle cx="96" cy="86" r="2.5" />
        <circle cx="58" cy="93" r="2" />
        <circle cx="120" cy="96" r="2.5" />
        <circle cx="146" cy="92" r="2" />
        <circle cx="90" cy="96" r="2" />
      </g>
      <g fill="#B42318">
        <circle cx="108" cy="92" r="2" />
        <circle cx="64" cy="88" r="1.8" />
      </g>
      <g stroke="#7A4E24" strokeWidth="5" strokeLinecap="round">
        <path d="M118 84L176 22" />
        <path d="M128 86L190 34" />
      </g>
    </svg>
  );
}
