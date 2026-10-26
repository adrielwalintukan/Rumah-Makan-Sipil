"use client";

import * as React from "react";

/**
 * Hook reaktif untuk media query responsif yang aman untuk SSR & Turbopack.
 * Menggunakan useSyncExternalStore agar tidak memicu re-render atau layout-shift tak terduga.
 */
export function useMediaQuery(query: string, serverFallback = false): boolean {
  const subscribe = React.useCallback(
    (callback: () => void) => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        return () => {};
      }
      const mql = window.matchMedia(query);
      mql.addEventListener("change", callback);
      return () => mql.removeEventListener("change", callback);
    },
    [query]
  );

  const getSnapshot = React.useCallback(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return serverFallback;
    }
    return window.matchMedia(query).matches;
  }, [query, serverFallback]);

  const getServerSnapshot = React.useCallback(() => {
    return serverFallback;
  }, [serverFallback]);

  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 640px)", false);
}
