import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as React from "react";
import { renderToString } from "react-dom/server";
import ErrorPage from "./error";

// Helper rekursif untuk mencari elemen dalam tree React element
function findElement(
  element: unknown,
  predicate: (el: { props?: Record<string, unknown> }) => boolean
): { props?: Record<string, unknown> } | null {
  if (!element || typeof element !== "object") return null;
  const candidate = element as { props?: Record<string, unknown> };
  if (predicate(candidate)) return candidate;

  if (candidate.props?.children) {
    const children = Array.isArray(candidate.props.children)
      ? candidate.props.children
      : [candidate.props.children];
    for (const child of children) {
      const found = findElement(child, predicate);
      if (found) return found;
    }
  }
  return null;
}

describe("Root Error Boundary (app/error.tsx)", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Inisialisasi dispatcher React untuk pengujian hooks tanpa jsdom
    const internals = (
      React as unknown as {
        __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE?: {
          H: Record<string, unknown> | null;
        };
      }
    ).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;

    if (internals) {
      internals.H = {
        useEffect: (fn: () => void) => fn(),
      };
    }
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("merender pesan ramah dan elemen visual sesuai design system", () => {
    const resetMock = vi.fn();
    const testError = new Error("Database connection timed out at internal_service:5432");

    const html = renderToString(
      <ErrorPage error={testError} reset={resetMock} />
    );

    // Judul dan teks ramah
    expect(html).toContain("Ada Sedikit Kendala");
    expect(html).toContain(
      "Maaf, halaman ini sedang sulit dihubungi. Silakan coba muat ulang atau periksa sambungan internet kamu."
    );

    // Styling design system
    expect(html).toContain("font-display");
    expect(html).toContain("text-green-900");
    expect(html).toContain("bg-cream-50");

    // Tombol aksi
    expect(html).toContain("Coba Lagi");
    expect(html).toContain("Kembali ke Menu Utama");
    expect(html).toContain('href="/"');

    // Bebas dari error teknis atau stack trace rahasia
    expect(html).not.toContain("Database connection timed out");
    expect(html).not.toContain("internal_service:5432");

    // Aturan Antislop: Bebas dari karakter em dash
    expect(html).not.toContain("—");
  });

  it("memanggil reset() saat tombol Coba Lagi ditekan", () => {
    const resetMock = vi.fn();
    const testError = new Error("Crash");

    const element = ErrorPage({ error: testError, reset: resetMock });
    const retryButton = findElement(
      element,
      (el) => el.props?.children === "Coba Lagi"
    );

    expect(retryButton).toBeDefined();
    expect(typeof retryButton?.props?.onClick).toBe("function");

    // Panggil handler onClick tombol Coba Lagi
    (retryButton?.props?.onClick as () => void)();
    expect(resetMock).toHaveBeenCalledTimes(1);
  });

  it("mencatat error ke console untuk diagnosis", () => {
    const resetMock = vi.fn();
    const testError = new Error("Crash untuk logger");

    ErrorPage({ error: testError, reset: resetMock });
    expect(consoleErrorSpy).toHaveBeenCalledWith(testError);
  });
});
