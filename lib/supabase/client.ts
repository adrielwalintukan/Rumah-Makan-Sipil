import { createBrowserClient } from "@supabase/ssr";

/**
 * Klien Supabase browser untuk komponen client.
 * Membaca dan menulis token sesi ke cookie browser.
 */
export function createBrowserSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL atau NEXT_PUBLIC_SUPABASE_ANON_KEY belum diisi.");
  }

  return createBrowserClient(url, key);
}
