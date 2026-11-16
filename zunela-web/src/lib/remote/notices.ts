/**
 * Avisos remotos (notifications). Sin contacto en el texto.
 */

import { remoteIdentityAvailable } from "@/lib/remote/identity";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type RemoteNoticeKind = "match" | "mensaje" | "comunidad" | "cuenta";

export type RemoteNotice = {
  id: string;
  at: string;
  kind: RemoteNoticeKind;
  text: string;
  source: string;
  seen: boolean;
};

type NoticeRow = {
  id: string;
  user_id: string;
  kind: RemoteNoticeKind;
  body: string;
  source: string;
  seen: boolean;
  created_at: string;
};

let noticeCache: RemoteNotice[] = [];

export function peekRemoteNotices(): RemoteNotice[] {
  return noticeCache;
}

export function clearRemoteNoticeCache() {
  noticeCache = [];
}

function rowToNotice(row: NoticeRow): RemoteNotice {
  return {
    id: row.id,
    at: row.created_at,
    kind: row.kind,
    text: row.body,
    source: row.source ?? "",
    seen: row.seen === true,
  };
}

export async function fetchRemoteNotices(): Promise<RemoteNotice[]> {
  const client = getSupabaseBrowserClient();
  if (!client || !remoteIdentityAvailable()) {
    noticeCache = [];
    return [];
  }
  const { data, error } = await client
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(40);
  if (error || !data) {
    noticeCache = [];
    return [];
  }
  noticeCache = (data as NoticeRow[]).map(rowToNotice);
  return noticeCache;
}

export async function createRemoteNotice(
  kind: RemoteNoticeKind,
  text: string,
  source = "",
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
  const { error } = await client.from("notifications").insert({
    user_id: user.id,
    kind,
    body: text.trim(),
    source: source.trim(),
    seen: false,
  });
  if (error && !/duplicate|unique/i.test(error.message)) {
    return error.message;
  }
  await fetchRemoteNotices();
  return null;
}

/** Avisa a otro usuario vía RPC security definer. */
export async function notifyRemoteUser(
  userId: string,
  kind: RemoteNoticeKind,
  text: string,
  source = "",
): Promise<string | null> {
  const client = getSupabaseBrowserClient();
  if (!client || !remoteIdentityAvailable()) {
    return "El backend remoto no está configurado.";
  }
  const { error } = await client.rpc("notify_user", {
    p_user_id: userId,
    p_kind: kind,
    p_body: text.trim(),
    p_source: source.trim(),
  });
  return error ? error.message : null;
}

export async function markRemoteNoticesSeen(ids?: string[]): Promise<string | null> {
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
  let query = client
    .from("notifications")
    .update({ seen: true })
    .eq("user_id", user.id)
    .eq("seen", false);
  if (ids && ids.length > 0) {
    query = query.in("id", ids);
  }
  const { error } = await query;
  if (error) {
    return error.message;
  }
  await fetchRemoteNotices();
  return null;
}

export async function clearRemoteNotices(): Promise<string | null> {
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
  const { error } = await client.from("notifications").delete().eq("user_id", user.id);
  if (error) {
    return error.message;
  }
  noticeCache = [];
  return null;
}
