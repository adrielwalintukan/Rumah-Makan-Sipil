"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Lock, LogIn, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMessage("Silakan masukkan email dan kata sandi.");
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error || !data.user) {
        setErrorMessage("Email atau kata sandi tidak valid. Silakan coba lagi.");
        setIsLoading(false);
        return;
      }

      // Verifikasi hak akses admin
      const { data: adminRow, error: adminError } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (adminError || !adminRow) {
        await supabase.auth.signOut();
        setErrorMessage("Akun ini tidak memiliki hak akses pemilik.");
        setIsLoading(false);
        return;
      }

      router.push("/admin");
      router.refresh();
    } catch {
      setErrorMessage("Terjadi gangguan koneksi. Silakan periksa jaringan kamu.");
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger-bg p-3.5 text-sm font-medium text-danger"
        >
          <AlertCircle className="size-5 shrink-0" aria-hidden />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="admin-email" className="text-xs font-bold tracking-wider text-ink-700 uppercase">
          Email Pemilik
        </label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
          <input
            id="admin-email"
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="pemilik@rumahmakansipil.com"
            disabled={isLoading}
            className="h-12 w-full rounded-md border border-line bg-card pl-10 pr-3.5 text-base text-ink-900 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-100 disabled:opacity-50"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="admin-password" className="text-xs font-bold tracking-wider text-ink-700 uppercase">
          Kata Sandi
        </label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
          <input
            id="admin-password"
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            disabled={isLoading}
            className="h-12 w-full rounded-md border border-line bg-card pl-10 pr-3.5 text-base text-ink-900 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-100 disabled:opacity-50"
          />
        </div>
      </div>

      <Button
        type="submit"
        disabled={isLoading}
        className="mt-2 h-12 w-full text-base font-bold"
      >
        <LogIn className="size-4 mr-2" aria-hidden />
        {isLoading ? "Memeriksa kredensial..." : "Masuk ke Dashboard"}
      </Button>
    </form>
  );
}
