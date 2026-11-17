/**
 * Chat privado remoto (UUID). Exige conexión accepted entre las partes (validado en app).
 */

import { isRemotePersonId, remoteHasAcceptedConnection } from "@/lib/remote/connections";
import { remoteIdentityAvailable } from "@/lib/remote/identity";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type RemotePrivateMessage = {
  id: string;
  from: "me" | "them";
  body: string;
  at: string;
};

type MessageRow = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
};

export async function fetchRemoteThread(personId: string): Promise<RemotePrivateMessage[]> {
  const client = getSupabaseBrowserClient();
  if (!client || !remoteIdentityAvailable() || !isRemotePersonId(personId)) {
    return [];
  }
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return [];
  }

  const { data, error } = await client
    .from("private_messages")
    .select("*")
    .or(
      `and(sender_id.eq.${user.id},recipient_id.eq.${personId}),and(sender_id.eq.${personId},recipient_id.eq.${user.id})`,
    )
    .order("created_at", { ascending: true });

  if (error || !data) {
    return [];
  }

  return (data as MessageRow[]).map((row) => ({
    id: row.id,
    from: row.sender_id === user.id ? ("me" as const) : ("them" as const),
    body: row.body,
    at: row.created_at,
  }));
}

export async function sendRemotePrivateMessage(
  personId: string,
  body: string,
): Promise<string | null> {
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
  if (!isRemotePersonId(personId)) {
    return "Esta conversación no usa el chat remoto.";
  }
  if (!(await remoteHasAcceptedConnection(personId))) {
    return "Solo puedes escribir cuando la conexión está aceptada.";
  }
  if (!body.trim()) {
    return "Escribe un mensaje antes de enviar.";
  }

  const { error } = await client.from("private_messages").insert({
    sender_id: user.id,
    recipient_id: personId,
    body: body.trim(),
  });
  return error ? error.message : null;
}

/** Mensajes enviados por mí hoy (UTC local del navegador vía ISO day start). */
export async function countRemoteSentToday(): Promise<number> {
  const client = getSupabaseBrowserClient();
  if (!client || !remoteIdentityAvailable()) {
    return 0;
  }
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return 0;
  }
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { count, error } = await client
    .from("private_messages")
    .select("id", { count: "exact", head: true })
    .eq("sender_id", user.id)
    .gte("created_at", start.toISOString());
  if (error) {
    return 0;
  }
  return count ?? 0;
}
