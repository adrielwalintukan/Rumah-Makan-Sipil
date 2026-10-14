import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

// shortcut: halaman placeholder M0, diganti halaman menu di M1 (docs/roadmap.md)
const WHATSAPP_URL = "https://wa.me/62895806567230";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 px-4 py-12 text-center">
      <header className="flex flex-col items-center gap-1">
        <p className="text-sm font-semibold tracking-[0.3em] text-green-900">RUMAH MAKAN</p>
        <h1 className="font-display text-6xl font-extrabold tracking-wide text-green-900">SIPIL</h1>
        <p className="text-xs font-medium tracking-[0.2em] text-ink-600">MAKAN ENAK, SETIAP HARI</p>
        <span aria-hidden className="mt-3 h-0.5 w-12 rounded-full bg-brown-500" />
      </header>

      <section className="w-full rounded-lg border bg-card p-6 shadow-card">
        <h2 className="text-lg font-semibold text-green-900">Pesan dari HP segera hadir</h2>
        <p className="mt-2 text-ink-600">
          Sebentar lagi kamu bisa pesan dan bayar langsung dari sini. Untuk sekarang, hubungi kami lewat
          WhatsApp.
        </p>
        <Button asChild variant="accent" className="mt-5 w-full">
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
            <MessageCircle aria-hidden />
            Hubungi via WhatsApp
          </a>
        </Button>
      </section>
    </main>
  );
}
