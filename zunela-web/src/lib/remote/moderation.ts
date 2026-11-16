/**
 * Reportes y apelaciones remotas (piloto multiusuario).
 * Revisar no aplica sanción automática.
 */

import type { Appeal, AppealKind } from "@/lib/appeals";
import type { ReportEntry, ReportKind, ReviewMeta } from "@/lib/reports";
import { remoteIdentityAvailable } from "@/lib/remote/identity";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type ReportRow = {
  id: string;
  reporter_id: string;
  kind: ReportKind;
  target_key: string;
  label: string;
  status: "pendiente" | "revisado";
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

type AppealRow = {
  id: string;
  appellant_id: string;
  community_id: string;
  community_title: string;
  kind: AppealKind;
  note: string;
  status: "pendiente" | "revisada";
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

let reportCache: ReportRow[] = [];
let appealCache: AppealRow[] = [];

export function peekRemoteReports(): ReportRow[] {
  return reportCache;
}

export function peekRemoteAppeals(): AppealRow[] {
  return appealCache;
}

export async function fetchRemoteReports(): Promise<ReportRow[]> {
  const client = getSupabaseBrowserClient();
  if (!client || !remoteIdentityAvailable()) {
    reportCache = [];
    return [];
  }
  const { data, error } = await client
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false });
  reportCache = error || !data ? [] : (data as ReportRow[]);
  return reportCache;
}

export async function fetchRemoteAppeals(): Promise<AppealRow[]> {
  const client = getSupabaseBrowserClient();
  if (!client || !remoteIdentityAvailable()) {
    appealCache = [];
    return [];
  }
  const { data, error } = await client
    .from("appeals")
    .select("*")
    .order("created_at", { ascending: false });
  appealCache = error || !data ? [] : (data as AppealRow[]);
  return appealCache;
}

export function remoteReportsAsEntries(): ReportEntry[] {
  return reportCache.map((row) => ({
    key: row.target_key,
    kind: row.kind,
    at: row.created_at,
  }));
}

export function remoteReviewedKeys(): string[] {
  return reportCache.filter((row) => row.status === "revisado").map((row) => row.target_key);
}

export function remoteReviewMeta(): ReviewMeta[] {
  return reportCache
    .filter((row) => row.status === "revisado" && row.reviewed_at)
    .map((row) => ({
      key: row.target_key,
      at: row.reviewed_at as string,
      label: row.label || row.target_key,
    }));
}

export function remoteAppealsAsLocal(): Appeal[] {
  return appealCache.map((row) => ({
    id: row.id,
    communityId: row.community_id,
    communityTitle: row.community_title,
    kind: row.kind,
    note: row.note,
    status: row.status,
  }));
}

export async function createRemoteReport(
  kind: ReportKind,
  targetKey: string,
  label: string,
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
  const { error } = await client.from("reports").upsert(
    {
      reporter_id: user.id,
      kind,
      target_key: targetKey,
      label,
      status: "pendiente",
    },
    { onConflict: "reporter_id,target_key", ignoreDuplicates: true },
  );
  if (error) {
    return error.message;
  }
  await fetchRemoteReports();
  return null;
}

export async function reviewRemoteReport(
  targetKey: string,
  label: string,
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
  const { error } = await client
    .from("reports")
    .update({
      status: "revisado",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      label: label || undefined,
    })
    .eq("target_key", targetKey)
    .eq("status", "pendiente");
  if (error) {
    return error.message;
  }
  await fetchRemoteReports();
  return null;
}

export async function createRemoteAppeal(input: {
  communityId: string;
  communityTitle: string;
  kind: AppealKind;
  note: string;
}): Promise<Appeal | string> {
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
  const { data: open } = await client
    .from("appeals")
    .select("id")
    .eq("appellant_id", user.id)
    .eq("community_id", input.communityId)
    .eq("kind", input.kind)
    .eq("status", "pendiente")
    .maybeSingle();
  if (open) {
    return "Ya hay una apelación pendiente de este tipo en esta comunidad.";
  }
  const { data, error } = await client
    .from("appeals")
    .insert({
      appellant_id: user.id,
      community_id: input.communityId,
      community_title: input.communityTitle,
      kind: input.kind,
      note: input.note.trim(),
      status: "pendiente",
    })
    .select("*")
    .single();
  if (error || !data) {
    return error?.message ?? "No se pudo guardar la apelación.";
  }
  await fetchRemoteAppeals();
  const row = data as AppealRow;
  return {
    id: row.id,
    communityId: row.community_id,
    communityTitle: row.community_title,
    kind: row.kind,
    note: row.note,
    status: row.status,
  };
}

export async function reviewRemoteAppeal(id: string): Promise<string | null> {
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
  const { error } = await client
    .from("appeals")
    .update({
      status: "revisada",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pendiente");
  if (error) {
    return error.message;
  }
  await fetchRemoteAppeals();
  return null;
}

export async function refreshRemoteModeration() {
  await Promise.all([fetchRemoteReports(), fetchRemoteAppeals()]);
}
