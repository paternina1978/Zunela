/**
 * Suspensiones remotas (profiles.suspended). Solo admin escribe.
 */

import { remoteIdentityAvailable } from "@/lib/remote/identity";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

let suspendedCache: string[] = [];

export function peekRemoteSuspendedIds(): string[] {
  return suspendedCache;
}

export function clearRemoteSuspendedCache() {
  suspendedCache = [];
}

export async function fetchRemoteSuspendedIds(): Promise<string[]> {
  const client = getSupabaseBrowserClient();
  if (!client || !remoteIdentityAvailable()) {
    suspendedCache = [];
    return [];
  }
  const { data, error } = await client.from("profiles").select("id").eq("suspended", true);
  if (error || !data) {
    suspendedCache = [];
    return [];
  }
  suspendedCache = data.map((row) => String((row as { id: string }).id));
  return suspendedCache;
}

export async function setRemoteSuspended(
  userId: string,
  suspended: boolean,
): Promise<string | null> {
  const client = getSupabaseBrowserClient();
  if (!client || !remoteIdentityAvailable()) {
    return "El backend remoto no está configurado.";
  }
  const { error } = await client.from("profiles").update({ suspended }).eq("id", userId);
  if (error) {
    return error.message;
  }
  await fetchRemoteSuspendedIds();
  return null;
}
