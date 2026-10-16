import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Dashboard Pemilik · Rumah Makan Sipil",
};

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-cream-50 text-ink-900">
      <Suspense fallback={<div className="h-14 md:hidden w-full animate-pulse bg-cream-100" />}>
        <AdminDashboardNav />
      </Suspense>
      <div className="md:pl-64">
        <main className="mx-auto max-w-7xl px-4 pt-4 pb-24 md:pb-12 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

async function AdminDashboardNav() {
  const admin = await requireAdmin();
  return <AdminNav userEmail={admin.email} />;
}
