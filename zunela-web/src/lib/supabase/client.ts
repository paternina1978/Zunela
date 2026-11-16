"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isRemoteBackendEnabled } from "@/lib/backend-mode";

let browserClient: SupabaseClient | null = null;

/** Cliente de navegador. `null` si el backend remoto no está habilitado. */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (!isRemoteBackendEnabled()) {
    return null;
  }
  if (browserClient) {
    return browserClient;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim();
  browserClient = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return browserClient;
}
