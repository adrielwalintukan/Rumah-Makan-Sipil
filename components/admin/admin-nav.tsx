"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  DollarSign,
  History,
  LogOut,
  MoreHorizontal,
  QrCode,
  Settings,
  Utensils,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

interface AdminNavProps {
  userEmail?: string;
}

export function AdminNav({ userEmail }: AdminNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const supabase = createBrowserSupabaseClient();
      await supabase.auth.signOut();
      router.push("/admin/login");
      router.refresh();
    } catch {
      setIsLoggingOut(false);
    }
  };

  // Navigasi bottom tab untuk mobile (< 768 px)
  const mobileTabs = [
    {
      label: "Pesanan",
      href: "/admin",
      icon: Utensils,
      isActive: pathname === "/admin",
    },
    {
      label: "Menu",
      href: "/admin/menu",
      icon: BookOpen,
      isActive: pathname.startsWith("/admin/menu"),
    },
    {
      label: "Keuangan",
      href: "/admin/keuangan",
      icon: DollarSign,
      isActive: pathname.startsWith("/admin/keuangan"),
    },
    {
      label: "Lainnya",
      href: "/admin/pengaturan",
      icon: MoreHorizontal,
      isActive:
        pathname.startsWith("/admin/pengaturan") ||
        pathname.startsWith("/admin/laporan") ||
        pathname.startsWith("/admin/riwayat") ||
        pathname.startsWith("/admin/qr"),
    },
  ];

  // Navigasi sidebar untuk desktop (≥ 768 px)
  const desktopLinks = [
    { label: "Pesanan Live", href: "/admin", icon: Utensils, exact: true },
    { label: "Kelola Menu", href: "/admin/menu", icon: BookOpen },
    { label: "Riwayat Pesanan", href: "/admin/riwayat", icon: History },
    { label: "Laporan", href: "/admin/laporan", icon: BarChart3 },
    { label: "Catatan Keuangan", href: "/admin/keuangan", icon: DollarSign },
    { label: "Poster QR", href: "/admin/qr", icon: QrCode },
    { label: "Pengaturan Toko", href: "/admin/pengaturan", icon: Settings },
  ];

  return (
    <>
      {/* Top Bar Ringkas (Mobile & Desktop) */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-card/95 px-4 backdrop-blur-xs md:hidden">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-green-700 text-xs font-bold text-white">
            RMS
          </div>
          <span className="font-display text-base font-bold text-green-900">Dashboard</span>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          aria-label="Keluar dari akun"
          className="inline-flex size-9 items-center justify-center rounded-md border border-line text-ink-600 hover:bg-cream-100 hover:text-danger active:scale-95 transition"
        >
          <LogOut className="size-4" aria-hidden />
        </button>
      </header>

      {/* Sidebar Desktop (≥ 768 px) */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 md:border-r md:border-line md:bg-card">
        {/* Header Sidebar */}
        <div className="flex h-16 items-center gap-3 border-b border-line px-5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-green-700 font-display text-sm font-bold text-white shadow-xs">
            RMS
          </div>
          <div className="min-w-0">
            <h2 className="truncate font-display text-base font-bold text-green-900 leading-tight">
              Rumah Makan Sipil
            </h2>
            <span className="inline-block rounded-full bg-cream-100 px-2 py-0.5 text-[10px] font-semibold text-ink-600 uppercase tracking-wider">
              Pemilik Warung
            </span>
          </div>
        </div>

        {/* Menu Navigasi Desktop */}
        <nav aria-label="Navigasi admin" className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="flex flex-col gap-1">
            {desktopLinks.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                      active
                        ? "bg-green-700 text-white shadow-xs"
                        : "text-ink-700 hover:bg-cream-100 hover:text-ink-900"
                    }`}
                  >
                    <Icon className="size-4.5 shrink-0" aria-hidden />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer Sidebar (User Info & Logout) */}
        <div className="border-t border-line p-3">
          {userEmail && (
            <p className="truncate px-3.5 py-1 text-xs text-ink-400" title={userEmail}>
              {userEmail}
            </p>
          )}
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex w-full items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-danger hover:bg-danger-bg transition-colors"
          >
            <LogOut className="size-4 shrink-0" aria-hidden />
            <span>{isLoggingOut ? "Keluar..." : "Keluar (Logout)"}</span>
          </button>
        </div>
      </aside>

      {/* Bottom Tab Bar (Mobile < 768 px) */}
      <nav
        aria-label="Navigasi mobile admin"
        className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-line bg-card/95 pb-safe backdrop-blur-xs md:hidden"
      >
        {mobileTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Link
              key={tab.label}
              href={tab.href}
              className={`flex flex-col items-center justify-center min-w-[64px] h-full gap-1 transition-colors ${
                tab.isActive
                  ? "text-green-800 font-bold"
                  : "text-ink-600 hover:text-ink-900 font-medium"
              }`}
            >
              <Icon className="size-5" aria-hidden />
              <span className="text-[11px] leading-none tracking-tight">{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
