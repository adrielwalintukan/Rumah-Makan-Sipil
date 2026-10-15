import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Klien anon untuk data publik (menu, pengaturan). Akses dibatasi RLS. */
export function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY belum diisi");
  return createClient(url, key, { auth: { persistSession: false } });
}
