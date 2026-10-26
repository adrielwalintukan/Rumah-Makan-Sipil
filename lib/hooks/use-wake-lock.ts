"use client";

import * as React from "react";

function subscribe() {
  return () => {};
}

function getWakeLockSnapshot() {
  return typeof navigator !== "undefined" && "wakeLock" in navigator;
}

function getServerSnapshot() {
  return false;
}

export function useWakeLock() {
  const isSupported = React.useSyncExternalStore(
    subscribe,
    getWakeLockSnapshot,
    getServerSnapshot
  );
  const [isActive, setIsActive] = React.useState(false);
  const sentinelRef = React.useRef<WakeLockSentinel | null>(null);

  const request = React.useCallback(async () => {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) {
      return false;
    }

    try {
      if (sentinelRef.current && !sentinelRef.current.released) {
        return true;
      }

      const sentinel = await navigator.wakeLock.request("screen");
      sentinelRef.current = sentinel;
      setIsActive(true);

      sentinel.addEventListener("release", () => {
        setIsActive(false);
        sentinelRef.current = null;
      });

      return true;
    } catch {
      setIsActive(false);
      return false;
    }
  }, []);

  const release = React.useCallback(async () => {
    if (sentinelRef.current && !sentinelRef.current.released) {
      await sentinelRef.current.release();
      sentinelRef.current = null;
      setIsActive(false);
    }
  }, []);

  // Tangani saat tab kembali aktif setelah diminimalkan / background
  React.useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible" && !sentinelRef.current) {
        await request();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (sentinelRef.current && !sentinelRef.current.released) {
        sentinelRef.current.release().catch(() => {});
      }
    };
  }, [request]);

  return { isSupported, isActive, request, release };
}
