/** Cara pesan: tiga langkah dari alur di PRD/user-flows (pilih menu, bayar QRIS atau tunai, pantau nomor antrean). */
const STEPS = [
  { n: "01", title: "Pilih menu", body: "Ketuk tambah pada menu favoritmu, atur pilihan dan catatan bila perlu." },
  { n: "02", title: "Isi data & bayar", body: "Masukkan nama, lalu bayar lewat QRIS atau tunai di kasir." },
  { n: "03", title: "Pantau pesanan", body: "Dapat nomor antrean dan lihat status pesananmu langsung dari HP." },
];

export function HowToOrder() {
  return (
    <section aria-labelledby="judul-cara-pesan" className="mt-16 border-t border-green-900/15 pt-8 lg:mt-24">
      <h2 id="judul-cara-pesan" className="reveal-mask font-display text-4xl leading-none font-extrabold tracking-tight text-green-900 lg:text-6xl">
        <span>Cara pesan</span>
      </h2>
      <ol className="mt-8 grid gap-8 lg:grid-cols-3 lg:gap-10">
        {STEPS.map((s) => (
          <li key={s.n} className="reveal-fade border-t border-green-900/15 pt-4">
            <span className="font-display text-6xl leading-none font-extrabold text-brown-500/80 lg:text-7xl">{s.n}</span>
            <h3 className="mt-3 text-xl font-bold text-green-900">{s.title}</h3>
            <p className="mt-1 max-w-xs text-ink-600">{s.body}</p>
          </li>
        ))}
      </ol>
      <p aria-hidden className="outline-text mt-14 text-center font-display text-[length:clamp(5rem,28vw,18rem)] leading-[0.8] font-extrabold tracking-tighter select-none [--stroke:rgb(31_61_43/0.28)]">
        SIPIL
      </p>
    </section>
  );
}
