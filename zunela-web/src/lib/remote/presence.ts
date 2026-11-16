/**
 * Presencia piloto remota (retención D7/D30).
 */

import { remoteIdentityAvailable } from "@/lib/remote/identity";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type RemotePilotPresence = {
  firstSeenAt: string;
  lastSeenAt: string;
};

type PresenceRow = {
  user_id: string;
  first_seen_at: string;
  last_seen_at: string;
};

let presenceCache: RemotePilotPresence | null = null;

export function peekRemotePilotPresence(): RemotePilotPresence | null {
  return presenceCache;
}

export function clearRemotePresenceCache() {
  presenceCache = null;
}

export async function fetchRemotePilotPresence(): Promise<RemotePilotPresence | null> {
  const client = getSupabaseBrowserClient();
  if (!client || !remoteIdentityAvailable()) {
    presenceCache = null;
    return null;
  }
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    presenceCache = null;
    return null;
  }
  const { data, error } = await client
    .from("pilot_presence")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !data) {
    presenceCache = null;
    return null;
  }
  const row = data as PresenceRow;
  presenceCache = {
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
  };
  return presenceCache;
}

export async function touchRemotePilotPresence(): Promise<RemotePilotPresence | null> {
  const client = getSupabaseBrowserClient();
  if (!client || !remoteIdentityAvailable()) {
    return null;
  }
  const { data, error } = await client.rpc("touch_pilot_presence");
  if (error || !data) {
    return null;
  }
  const row = data as PresenceRow;
  presenceCache = {
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
  };
  return presenceCache;
}
