/**
 * Parámetros globales remotos (app_settings).
 */

import type { AdminParams, ParamVersion } from "@/lib/admin";
import { remoteIdentityAvailable } from "@/lib/remote/identity";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type SettingsRow = {
  id: number;
  payload: Partial<AdminParams>;
  version: number;
  updated_by: string | null;
  updated_at: string;
};

type VersionRow = {
  id: string;
  version: number;
  payload: Partial<AdminParams>;
  updated_by: string | null;
  created_at: string;
};

let paramsCache: AdminParams | null = null;
let versionsCache: ParamVersion[] = [];

export function peekRemoteAdminParams(): AdminParams | null {
  return paramsCache;
}

export function peekRemoteParamVersions(): ParamVersion[] {
  return versionsCache;
}

export function clearRemoteSettingsCache() {
  paramsCache = null;
  versionsCache = [];
}

export async function fetchRemoteAdminParams(): Promise<AdminParams | null> {
  const client = getSupabaseBrowserClient();
  if (!client || !remoteIdentityAvailable()) {
    paramsCache = null;
    return null;
  }
  const { data, error } = await client.from("app_settings").select("*").eq("id", 1).maybeSingle();
  if (error || !data) {
    paramsCache = null;
    return null;
  }
  const row = data as SettingsRow;
  paramsCache = normalizeRemotePayload(row.payload);
  return paramsCache;
}

export async function fetchRemoteParamVersions(): Promise<ParamVersion[]> {
  const client = getSupabaseBrowserClient();
  if (!client || !remoteIdentityAvailable()) {
    versionsCache = [];
    return [];
  }
  const { data, error } = await client
    .from("app_settings_versions")
    .select("*")
    .order("version", { ascending: false })
    .limit(12);
  if (error || !data) {
    versionsCache = [];
    return [];
  }
  versionsCache = (data as VersionRow[]).map((row) => ({
    ...normalizeRemotePayload(row.payload),
    version: row.version,
    at: row.created_at,
  }));
  return versionsCache;
}

export async function refreshRemoteSettings() {
  await Promise.all([fetchRemoteAdminParams(), fetchRemoteParamVersions()]);
}

export async function saveRemoteAdminParams(
  next: AdminParams,
): Promise<AdminParams | string> {
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

  const current = await fetchRemoteAdminParams();
  if (!current) {
    return "No se pudieron leer los parámetros remotos.";
  }
  const safe = normalizeRemotePayload(next);
  if (sameRemoteParams(safe, current)) {
    return "Esos valores ya están vigentes.";
  }

  const { data: row, error: readError } = await client
    .from("app_settings")
    .select("version")
    .eq("id", 1)
    .maybeSingle();
  if (readError || !row) {
    return readError?.message ?? "No hay fila de parámetros.";
  }
  const nextVersion = Number((row as { version: number }).version) + 1;

  const { error: versionError } = await client.from("app_settings_versions").insert({
    version: nextVersion,
    payload: safe,
    updated_by: user.id,
  });
  if (versionError) {
    return versionError.message;
  }

  const { error: updateError } = await client
    .from("app_settings")
    .update({
      payload: safe,
      version: nextVersion,
      updated_by: user.id,
    })
    .eq("id", 1);
  if (updateError) {
    return updateError.message;
  }

  await refreshRemoteSettings();
  return safe;
}

function normalizeRemotePayload(value: Partial<AdminParams>): AdminParams {
  const clamp = (n: number | undefined, min: number, max: number, fallback: number) => {
    if (typeof n !== "number" || !Number.isFinite(n)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, Math.round(n)));
  };
  return {
    dailyMessages: clamp(value.dailyMessages, 1, 100, 20),
    premiumDailyMessages: clamp(value.premiumDailyMessages, 1, 200, 60),
    communityQuota: clamp(value.communityQuota, 1, 20, 2),
    communityQuotaDays: clamp(value.communityQuotaDays, 1, 90, 30),
    matchExpiryDays: clamp(value.matchExpiryDays, 1, 30, 7),
    trialDays: clamp(value.trialDays, 1, 30, 10),
    attachments: "ninguno",
    reportAlert: clamp(value.reportAlert, 1, 20, 3),
    affinityThreshold: clamp(value.affinityThreshold, 0, 100, 0),
  };
}

function sameRemoteParams(left: AdminParams, right: AdminParams) {
  return (
    left.dailyMessages === right.dailyMessages &&
    left.premiumDailyMessages === right.premiumDailyMessages &&
    left.communityQuota === right.communityQuota &&
    left.communityQuotaDays === right.communityQuotaDays &&
    left.matchExpiryDays === right.matchExpiryDays &&
    left.trialDays === right.trialDays &&
    left.attachments === right.attachments &&
    left.reportAlert === right.reportAlert &&
    left.affinityThreshold === right.affinityThreshold
  );
}
