"use client";

import * as React from "react";

export type ToastVariant = "default" | "success" | "danger";

export interface ToastProps {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: ToastVariant;
  duration?: number;
}

export type ToastOptions = Omit<ToastProps, "id">;

const TOAST_LIMIT = 5;
const TOAST_TIMEOUT = 3000;

let memoryToasts: ToastProps[] = [];
let listeners: Array<() => void> = [];
const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

function notifyListeners() {
  for (const listener of listeners) {
    listener();
  }
}

export function dismissToast(id: string) {
  const timeout = toastTimeouts.get(id);
  if (timeout) {
    clearTimeout(timeout);
    toastTimeouts.delete(id);
  }
  memoryToasts = memoryToasts.filter((t) => t.id !== id);
  notifyListeners();
}

export function clearToasts() {
  for (const timeout of toastTimeouts.values()) {
    clearTimeout(timeout);
  }
  toastTimeouts.clear();
  memoryToasts = [];
  notifyListeners();
}

export function getToasts(): ToastProps[] {
  return [...memoryToasts];
}

let toastCount = 0;
function generateToastId(): string {
  toastCount = (toastCount + 1) % Number.MAX_SAFE_INTEGER;
  return `toast-${Date.now()}-${toastCount}`;
}

export function toast(options: ToastOptions) {
  const id = generateToastId();
  const duration = options.duration ?? TOAST_TIMEOUT;

  const item: ToastProps = {
    ...options,
    id,
    variant: options.variant ?? "default",
    duration,
  };

  memoryToasts = [...memoryToasts.slice(-(TOAST_LIMIT - 1)), item];
  notifyListeners();

  if (duration !== Infinity && duration > 0) {
    const timeout = setTimeout(() => {
      dismissToast(id);
    }, duration);
    toastTimeouts.set(id, timeout);
  }

  return {
    id,
    dismiss: () => dismissToast(id),
  };
}

export function useToast() {
  const toasts = React.useSyncExternalStore(
    (listener) => {
      listeners.push(listener);
      return () => {
        listeners = listeners.filter((l) => l !== listener);
      };
    },
    () => memoryToasts,
    () => memoryToasts
  );

  return {
    toasts,
    toast,
    dismiss: dismissToast,
    clear: clearToasts,
  };
}
