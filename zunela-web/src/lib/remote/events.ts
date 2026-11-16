/**
 * Eventos de producto remotos (sin cuerpo de chat ni contacto).
 */

import { remoteIdentityAvailable } from "@/lib/remote/identity";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type RemoteProductEvent = {
  id: string;
  at: string;
  text: string;
};

type EventRow = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
};

const EVENT_LIMIT = 120;

let eventCache: RemoteProductEvent[] = [];

export function peekRemoteProductEvents(): RemoteProductEvent[] {
  return eventCache;
}

export function clearRemoteProductEventCache() {
  eventCache = [];
}

export async function fetchRemoteProductEvents(): Promise<RemoteProductEvent[]> {
  const client = getSupabaseBrowserClient();
  if (!client || !remoteIdentityAvailable()) {
    eventCache = [];
    return [];
  }
  const { data, error } = await client
    .from("product_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(EVENT_LIMIT);
  if (error || !data) {
    eventCache = [];
    return [];
  }
  eventCache = (data as EventRow[]).map((row) => ({
    id: row.id,
    at: row.created_at,
    text: row.body,
  }));
  return eventCache;
}

export async function createRemoteProductEvent(text: string): Promise<string | null> {
  const client = getSupabaseBrowserClient();
  if (!client || !remoteIdentityAvailable()) {
    return "El backend remoto no está configurado.";
  }
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return "No hay sesión remota.";
  }
  const body = text.trim().slice(0, 280);
  if (!body) {
    return "Evento vacío.";
  }
  const { error } = await client.from("product_events").insert({
    user_id: user.id,
    body,
  });
  if (error) {
    return error.message;
  }
  return null;
}
