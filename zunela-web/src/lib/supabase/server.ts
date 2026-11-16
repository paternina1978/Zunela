import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isRemoteBackendEnabled } from "@/lib/backend-mode";

/** Cliente de servidor con el JWT del usuario (Authorization Bearer). */
export function getSupabaseServerClient(accessToken: string): SupabaseClient | null {
  if (!isRemoteBackendEnabled()) {
    return null;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key || !accessToken.trim()) {
    return null;
  }
  return createClient(url, key, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken.trim()}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
