/**
 * Utilitas notifikasi suara pesanan baru (Issue #12 & PRD US-10).
 * Menggunakan Web Audio API untuk latensi instan dan kualitas chime yang jernih,
 * dengan fallback ke elemen HTML5 Audio (/sounds/pesanan-baru.mp3).
 */

class SoundNotifier {
  private audioCtx: AudioContext | null = null;

  private getAudioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.audioCtx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    return this.audioCtx;
  }

  /**
   * Mengaktifkan/membuka kunci audio melalui gestur pengguna (kebijakan autoplay browser).
   */
  async unlock(): Promise<boolean> {
    try {
      const ctx = this.getAudioContext();
      if (ctx) {
        if (ctx.state === "suspended") {
          await ctx.resume();
        }
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Mainkan bunyi bel/chime notifikasi saat pesanan baru masuk.
   */
  playOrderNotification() {
    try {
      const ctx = this.getAudioContext();
      if (ctx && ctx.state === "running") {
        const now = ctx.currentTime;
        // Dua nada manis (chime C5 dan G5)
        const notes = [
          { freq: 523.25, time: now, duration: 0.25 },
          { freq: 783.99, time: now + 0.12, duration: 0.4 },
        ];

        notes.forEach(({ freq, time, duration }) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, time);

          gain.gain.setValueAtTime(0.25, time);
          gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(time);
          osc.stop(time + duration);
        });
        return;
      }

      // Fallback ke Audio element jika AudioContext tidak aktif
      const audio = new Audio("/sounds/pesanan-baru.mp3");
      audio.play().catch(() => {});
    } catch {
      // Abaikan error audio agar tidak memblokir antarmuka
    }
  }
}

export const soundNotifier = new SoundNotifier();
