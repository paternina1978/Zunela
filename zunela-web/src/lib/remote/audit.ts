/**
 * Bitácora remota del panel (audit_log). Solo staff.
 */

import { remoteIdentityAvailable } from "@/lib/remote/identity";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type RemoteAuditEntry = {
  id: string;
  at: string;
  text: string;
};

type AuditRow = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
};

const AUDIT_LIMIT = 40;

let auditCache: RemoteAuditEntry[] = [];

export function peekRemoteAudit(): RemoteAuditEntry[] {
  return auditCache;
}

export function clearRemoteAuditCache() {
  auditCache = [];
}

export async function fetchRemoteAudit(): Promise<RemoteAuditEntry[]> {
  const client = getSupabaseBrowserClient();
  if (!client || !remoteIdentityAvailable()) {
    auditCache = [];
    return [];
  }
  const { data, error } = await client
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(AUDIT_LIMIT);
  if (error || !data) {
    auditCache = [];
    return [];
  }
  auditCache = (data as AuditRow[]).map((row) => ({
    id: row.id,
    at: row.created_at,
    text: row.body,
  }));
  return auditCache;
}

export async function createRemoteAudit(text: string): Promise<string | null> {
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
    return "Entrada vacía.";
  }
  const { error } = await client.from("audit_log").insert({
    user_id: user.id,
    body,
  });
  if (error) {
    return error.message;
  }
  return null;
}
