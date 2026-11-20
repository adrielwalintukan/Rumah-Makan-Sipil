/** Pita teks berjalan (dekoratif, aria-hidden): tagline dua kali agar putaran -50% mulus. Berhenti saat hover/reduced-motion. */
export function Marquee({ text }: { text: string }) {
  const unit = Array.from({ length: 4 }, (_, i) => (
    <span key={i} className="flex items-center gap-6 pr-6">
      <span className="outline-text font-display text-4xl font-bold tracking-tight uppercase lg:text-6xl">{text}</span>
      <span className="size-3 shrink-0 rounded-full bg-brown-500 lg:size-4" />
    </span>
  ));
  return (
    <div aria-hidden className="marquee -mx-4 my-6 overflow-hidden border-y border-green-900/15 py-3 text-green-900 lg:mx-0 lg:my-8">
      <div className="marquee-track">
        <div className="flex">{unit}</div>
        <div className="flex">{unit}</div>
      </div>
    </div>
  );
}
