/**
 * Perfiles remotos para Descubrir (solo con sesión Supabase).
 * Respeta visibility pública; no expone correo ni contacto.
 */

import { type AffinityDraft } from "@/lib/affinity";
import { type CatalogEntry } from "@/lib/discover";
import { departmentOfCity } from "@/lib/locations";
import { type FieldVisibility, type ProfileDraft } from "@/lib/profile";
import { remoteIdentityAvailable } from "@/lib/remote/identity";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const personCache = new Map<string, CatalogEntry>();

export function peekRemotePerson(id: string): CatalogEntry | null {
  return personCache.get(id) ?? null;
}

export function listCachedRemotePeople(): CatalogEntry[] {
  return [...personCache.values()];
}

function remember(entry: CatalogEntry) {
  personCache.set(entry.id, entry);
  return entry;
}

type ProfileRow = {
  id: string;
  visible_name: string;
  legal_name?: string;
  country?: string;
  city?: string;
  profession?: string;
  knowledge?: string[];
  presentation?: string;
  photo_url?: string | null;
  visibility?: ProfileDraft["visibility"];
  suspended?: boolean;
};

type AffinityRow = {
  user_id: string;
  interests?: string[];
  goals?: string[];
  offers?: string[];
  modality?: string;
  reach?: string;
  availability?: string[];
};

export async function listRemotePeople(
  excludeUserId?: string | null,
  options?: { includeSuspended?: boolean },
): Promise<CatalogEntry[]> {
  const client = getSupabaseBrowserClient();
  if (!client || !remoteIdentityAvailable()) {
    return [];
  }

  const { data: profiles, error } = await client.from("profiles").select("*");
  if (error || !profiles) {
    return [];
  }

  const { data: affinities } = await client.from("affinities").select("*");
  const byUser = new Map<string, AffinityRow>();
  for (const row of affinities ?? []) {
    byUser.set(String((row as AffinityRow).user_id), row as AffinityRow);
  }

  const includeSuspended = options?.includeSuspended === true;
  return (profiles as ProfileRow[])
    .filter((row) => row.id && row.visible_name?.trim())
    .filter((row) => includeSuspended || row.suspended !== true)
    .filter((row) => !excludeUserId || row.id !== excludeUserId)
    .map((row) => {
      const entry = toCatalogEntry(row, byUser.get(row.id));
      if (row.suspended === true) {
        personCache.delete(row.id);
        return entry;
      }
      return remember(entry);
    });
}

export async function getRemotePerson(id: string): Promise<CatalogEntry | null> {
  const client = getSupabaseBrowserClient();
  if (!client || !remoteIdentityAvailable()) {
    return null;
  }
  const { data: profile, error } = await client.from("profiles").select("*").eq("id", id).maybeSingle();
  if (error || !profile) {
    return null;
  }
  const row = profile as ProfileRow;
  if (row.suspended === true) {
    personCache.delete(id);
    return null;
  }
  const { data: affinity } = await client
    .from("affinities")
    .select("*")
    .eq("user_id", id)
    .maybeSingle();
  return remember(toCatalogEntry(row, (affinity as AffinityRow | null) ?? undefined));
}

export async function remoteAuthUserId(): Promise<string | null> {
  const client = getSupabaseBrowserClient();
  if (!client) {
    return null;
  }
  const {
    data: { user },
  } = await client.auth.getUser();
  return user?.id ?? null;
}

function toCatalogEntry(row: ProfileRow, affinity?: AffinityRow): CatalogEntry {
  const visibility = normalizeVisibility(row.visibility);
  const city = (row.city || "").trim() || "Colombia";
  const modality = mapModality(affinity?.modality);
  const interests = Array.isArray(affinity?.interests) ? affinity!.interests!.map(String) : [];
  const goals = Array.isArray(affinity?.goals) ? affinity!.goals!.map(String) : [];
  const offers = Array.isArray(affinity?.offers) ? affinity!.offers!.map(String) : [];
  const availability = Array.isArray(affinity?.availability)
    ? affinity!.availability!.map(String)
    : ["Horario flexible"];
  const knowledge = Array.isArray(row.knowledge) ? row.knowledge.map(String) : [];

  return {
    id: row.id,
    kind: "persona",
    title: row.visible_name.trim(),
    subtitle: row.profession?.trim() || "Sin profesión pública",
    city,
    department: departmentOfCity(city),
    modality,
    interests: interests.length > 0 ? interests : knowledge.slice(0, 4),
    goals: goals.length > 0 ? goals : ["Conectar con gente afín"],
    offers: offers.length > 0 ? offers : knowledge.slice(0, 4),
    availability,
    summary: row.presentation?.trim() || "Perfil del piloto compartido.",
    visibility: {
      profession: visibility.profession,
      offers: "after-match",
      goals: "public",
      availability: "after-match",
      summary: visibility.presentation,
    },
  };
}

function normalizeVisibility(
  value: ProfileDraft["visibility"] | undefined,
): ProfileDraft["visibility"] {
  const pick = (field: FieldVisibility | undefined, fallback: FieldVisibility): FieldVisibility =>
    field === "public" || field === "after-match" ? field : fallback;
  return {
    photo: pick(value?.photo, "after-match"),
    profession: pick(value?.profession, "after-match"),
    city: pick(value?.city, "public"),
    country: pick(value?.country, "public"),
    knowledge: pick(value?.knowledge, "after-match"),
    presentation: pick(value?.presentation, "after-match"),
  };
}

function mapModality(value: string | undefined): AffinityDraft["modality"] {
  if (value === "presencial" || value === "remota" || value === "ambas") {
    return value;
  }
  return "ambas";
}
