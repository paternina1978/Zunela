/**
 * Catálogos editables remotos (app_catalogs). Solo admin escribe.
 */

import { remoteIdentityAvailable } from "@/lib/remote/identity";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type RemoteCatalogState = {
  interestDisabled: string[];
  interestExtras: { label: string; group: string }[];
  goalDisabled: string[];
  goalExtras: string[];
  offerDisabled: string[];
  offerExtras: string[];
};

const EMPTY: RemoteCatalogState = {
  interestDisabled: [],
  interestExtras: [],
  goalDisabled: [],
  goalExtras: [],
  offerDisabled: [],
  offerExtras: [],
};

let catalogCache: RemoteCatalogState | null = null;

export function peekRemoteCatalogState(): RemoteCatalogState | null {
  return catalogCache;
}

export function clearRemoteCatalogCache() {
  catalogCache = null;
}

export async function fetchRemoteCatalogState(): Promise<RemoteCatalogState | null> {
  const client = getSupabaseBrowserClient();
  if (!client || !remoteIdentityAvailable()) {
    catalogCache = null;
    return null;
  }
  const { data, error } = await client.from("app_catalogs").select("payload").eq("id", 1).maybeSingle();
  if (error || !data) {
    catalogCache = null;
    return null;
  }
  catalogCache = normalizePayload((data as { payload: unknown }).payload);
  return catalogCache;
}

export async function saveRemoteCatalogState(
  next: RemoteCatalogState,
): Promise<RemoteCatalogState | string> {
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
  const safe = normalizePayload(next);
  const { error } = await client
    .from("app_catalogs")
    .update({
      payload: safe,
      updated_by: user.id,
    })
    .eq("id", 1);
  if (error) {
    return error.message;
  }
  catalogCache = safe;
  return safe;
}

function normalizePayload(value: unknown): RemoteCatalogState {
  if (!value || typeof value !== "object") {
    return { ...EMPTY };
  }
  const raw = value as Partial<RemoteCatalogState>;
  return {
    interestDisabled: asStrings(raw.interestDisabled),
    interestExtras: asInterestExtras(raw.interestExtras),
    goalDisabled: asStrings(raw.goalDisabled),
    goalExtras: asStrings(raw.goalExtras),
    offerDisabled: asStrings(raw.offerDisabled),
    offerExtras: asStrings(raw.offerExtras),
  };
}

function asStrings(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function asInterestExtras(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const row = item as { label?: unknown; group?: unknown };
      if (typeof row.label !== "string" || !row.label.trim()) {
        return null;
      }
      return {
        label: row.label.trim(),
        group: typeof row.group === "string" && row.group.trim() ? row.group.trim() : "Otros",
      };
    })
    .filter((item): item is { label: string; group: string } => Boolean(item));
}
