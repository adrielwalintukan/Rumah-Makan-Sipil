"use client";

import * as React from "react";
import { CheckCircle, AlertCircle, Info, X } from "lucide-react";
import {
  useToast,
  type ToastProps,
  type ToastOptions,
  type ToastVariant,
  toast,
  dismissToast,
  clearToasts,
  getToasts,
} from "@/lib/use-toast";
import { cn } from "@/lib/utils";

export { toast, useToast, dismissToast, clearToasts, getToasts };
export type { ToastProps, ToastOptions, ToastVariant };

export interface ToastItemProps {
  toast: ToastProps;
  onDismiss: (id: string) => void;
}

export function ToastItem({ toast: item, onDismiss }: ToastItemProps) {
  const { id, title, description, variant = "default" } = item;

  const Icon =
    variant === "success"
      ? CheckCircle
      : variant === "danger"
      ? AlertCircle
      : Info;

  const variantStyles = {
    success: {
      border: "border-green-700",
      iconColor: "text-green-700",
      titleColor: "text-green-900",
    },
    danger: {
      border: "border-danger",
      iconColor: "text-danger",
      titleColor: "text-danger",
    },
    default: {
      border: "border-line",
      iconColor: "text-ink-900",
      titleColor: "text-ink-900",
    },
  }[variant];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-variant={variant}
      className={cn(
        "pointer-events-auto flex w-full items-start gap-3 rounded-xl border bg-cream-50 p-4 shadow-lg transition-all",
        variantStyles.border
      )}
    >
      <Icon
        className={cn("size-5 shrink-0 mt-0.5", variantStyles.iconColor)}
        aria-hidden="true"
        data-testid="toast-icon"
      />
      <div className="flex-1 min-w-0">
        {title && (
          <h4
            className={cn(
              "text-sm font-semibold leading-tight",
              variantStyles.titleColor
            )}
          >
            {title}
          </h4>
        )}
        {description && (
          <p className="mt-1 text-xs text-ink-600 leading-normal">
            {description}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(id)}
        aria-label="Tutup notifikasi"
        className="flex size-8 shrink-0 items-center justify-center rounded-md text-ink-400 hover:text-ink-900 hover:bg-cream-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export function Toaster() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Notifikasi"
      className="fixed top-4 inset-x-0 mx-auto max-w-sm px-4 z-50 pointer-events-none flex flex-col gap-2 sm:right-4 sm:left-auto sm:inset-x-auto sm:px-0"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
      ))}
    </div>
  );
}
