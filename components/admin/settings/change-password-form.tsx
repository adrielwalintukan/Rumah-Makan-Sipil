"use client";

import * as React from "react";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

function translateAuthError(message?: string): string {
  if (!message) return "Gagal memperbarui password akun pemilik.";
  const lower = message.toLowerCase();
  if (lower.includes("should be different") || lower.includes("same as old")) {
    return "Password baru harus berbeda dengan password lama.";
  }
  if (
    lower.includes("at least 6 characters") ||
    lower.includes("at least 8 characters") ||
    lower.includes("weak password")
  ) {
    return "Password terlalu lemah atau kurang panjang (minimal 8 karakter).";
  }
  if (
    lower.includes("reauthenticate") ||
    lower.includes("jwt") ||
    lower.includes("session")
  ) {
    return "Sesi login telah berakhir. Silakan login ulang.";
  }
  return message;
}

export function ChangePasswordForm() {
  const [newPassword, setNewPassword] = React.useState<string>("");
  const [confirmPassword, setConfirmPassword] = React.useState<string>("");

  const [showNewPassword, setShowNewPassword] = React.useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    React.useState<boolean>(false);

  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<{
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setFieldErrors({});

    const errors: { newPassword?: string; confirmPassword?: string } = {};

    if (!newPassword || newPassword.length < 8) {
      errors.newPassword = "Password baru minimal 8 karakter.";
    }

    if (!confirmPassword) {
      errors.confirmPassword = "Konfirmasi password wajib diisi.";
    } else if (newPassword !== confirmPassword) {
      errors.confirmPassword = "Konfirmasi password tidak cocok.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setErrorMessage(translateAuthError(error.message));
        return;
      }

      setSuccessMessage("Password berhasil diperbarui.");
      toast({
        title: "Password diperbarui",
        description: "Password akun admin berhasil diperbarui.",
        variant: "success",
      });
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat memperbarui password.";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-line bg-card p-4 sm:p-6 shadow-xs">
      <div className="border-b border-line pb-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-cream-100 text-green-800">
            <Lock className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-ink-900">
              Keamanan Akun
            </h2>
            <p className="text-xs text-ink-600">
              Perbarui kata sandi akun pemilik untuk menjaga keamanan dashboard warung.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        {errorMessage && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger-bg p-3.5 text-sm font-medium text-danger"
          >
            <AlertCircle className="size-5 shrink-0 mt-0.5" aria-hidden="true" />
            <span className="leading-snug">{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div
            role="status"
            className="flex items-start gap-2.5 rounded-lg border border-green-700/30 bg-green-100/50 p-3.5 text-sm font-medium text-green-900"
          >
            <CheckCircle2
              className="size-5 shrink-0 mt-0.5 text-green-700"
              aria-hidden="true"
            />
            <span className="leading-snug">{successMessage}</span>
          </div>
        )}

        {/* Password Baru */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="new-password"
            className="text-sm font-semibold text-ink-900"
          >
            Password Baru <span className="text-danger">*</span>
          </label>
          <div className="relative">
            <Input
              id="new-password"
              name="newPassword"
              type={showNewPassword ? "text" : "password"}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                if (fieldErrors.newPassword) {
                  setFieldErrors((prev) => ({
                    ...prev,
                    newPassword: undefined,
                  }));
                }
              }}
              placeholder="Minimal 8 karakter"
              disabled={isLoading}
              aria-invalid={!!fieldErrors.newPassword}
              aria-describedby={
                fieldErrors.newPassword
                  ? "new-password-error"
                  : "new-password-help"
              }
              className={cn(
                "min-h-[44px] pr-12",
                fieldErrors.newPassword && "border-danger ring-3 ring-danger/10"
              )}
            />
            <button
              type="button"
              onClick={() => setShowNewPassword((prev) => !prev)}
              disabled={isLoading}
              aria-label={
                showNewPassword
                  ? "Sembunyikan password baru"
                  : "Tampilkan password baru"
              }
              className="absolute right-0 top-0 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-r-md text-ink-600 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700"
            >
              {showNewPassword ? (
                <EyeOff className="size-4 shrink-0" aria-hidden="true" />
              ) : (
                <Eye className="size-4 shrink-0" aria-hidden="true" />
              )}
            </button>
          </div>
          <p id="new-password-help" className="text-xs text-ink-600">
            Gunakan kombinasi huruf, angka, atau simbol minimal 8 karakter.
          </p>
          {fieldErrors.newPassword && (
            <p
              id="new-password-error"
              role="alert"
              className="text-xs text-danger font-medium flex items-center gap-1"
            >
              <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
              {fieldErrors.newPassword}
            </p>
          )}
        </div>

        {/* Konfirmasi Password Baru */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="confirm-password"
            className="text-sm font-semibold text-ink-900"
          >
            Konfirmasi Password Baru <span className="text-danger">*</span>
          </label>
          <div className="relative">
            <Input
              id="confirm-password"
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (fieldErrors.confirmPassword) {
                  setFieldErrors((prev) => ({
                    ...prev,
                    confirmPassword: undefined,
                  }));
                }
              }}
              placeholder="Ulangi password baru"
              disabled={isLoading}
              aria-invalid={!!fieldErrors.confirmPassword}
              aria-describedby={
                fieldErrors.confirmPassword
                  ? "confirm-password-error"
                  : undefined
              }
              className={cn(
                "min-h-[44px] pr-12",
                fieldErrors.confirmPassword &&
                  "border-danger ring-3 ring-danger/10"
              )}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              disabled={isLoading}
              aria-label={
                showConfirmPassword
                  ? "Sembunyikan konfirmasi password"
                  : "Tampilkan konfirmasi password"
              }
              className="absolute right-0 top-0 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-r-md text-ink-600 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700"
            >
              {showConfirmPassword ? (
                <EyeOff className="size-4 shrink-0" aria-hidden="true" />
              ) : (
                <Eye className="size-4 shrink-0" aria-hidden="true" />
              )}
            </button>
          </div>
          {fieldErrors.confirmPassword && (
            <p
              id="confirm-password-error"
              role="alert"
              className="text-xs text-danger font-medium flex items-center gap-1"
            >
              <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
              {fieldErrors.confirmPassword}
            </p>
          )}
        </div>

        {/* Tombol Ganti Password */}
        <div className="flex justify-end pt-3 border-t border-line">
          <Button
            type="submit"
            disabled={isLoading}
            className="min-h-[44px] min-w-[150px] gap-2 font-bold"
          >
            {isLoading ? (
              <>
                <Loader2
                  className="size-4 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
                <span>Menyimpan...</span>
              </>
            ) : (
              <span>Ganti Password</span>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
