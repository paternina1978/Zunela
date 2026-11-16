import { CATALOG, isPublicField, type CatalogEntry } from "@/lib/discover";
import { isRemoteBackendEnabled } from "@/lib/backend-mode";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type PublicPerson = {
  id: string;
  nombre: string;
  ciudad: string;
  profesion: string | null;
  intereses: string[];
  objetivos: string[] | null;
  ofrece: string[] | null;
  disponibilidad: string[] | null;
  resumen: string | null;
  contacto: null;
};

export function publicPerson(id: string): PublicPerson | null {
  const person = CATALOG.find((entry) => entry.id === id && entry.kind === "persona");
  if (!person) {
    return null;
  }
  return toPublicPerson(person);
}

/** Perfil remoto con JWT de usuario; fail-closed sin token o sin backend. */
export async function publicPersonRemote(
  id: string,
  accessToken: string | null,
): Promise<PublicPerson | null> {
  const local = publicPerson(id);
  if (local) {
    return local;
  }
  if (!isRemoteBackendEnabled() || !accessToken) {
    return null;
  }
  const client = getSupabaseServerClient(accessToken);
  if (!client) {
    return null;
  }
  const { data: profile, error } = await client.from("profiles").select("*").eq("id", id).maybeSingle();
  if (error || !profile) {
    return null;
  }
  const { data: affinity } = await client
    .from("affinities")
    .select("*")
    .eq("user_id", id)
    .maybeSingle();
  const visibility = (profile.visibility ?? {}) as {
    profession?: string;
    presentation?: string;
  };
  const entry: CatalogEntry = {
    id: String(profile.id),
    kind: "persona",
    title: String(profile.visible_name ?? ""),
    subtitle: String(profile.profession ?? ""),
    city: String(profile.city ?? "Colombia"),
    department: "",
    modality: "ambas",
    interests: Array.isArray(affinity?.interests) ? affinity.interests.map(String) : [],
    goals: Array.isArray(affinity?.goals) ? affinity.goals.map(String) : [],
    offers: Array.isArray(affinity?.offers) ? affinity.offers.map(String) : [],
    availability: Array.isArray(affinity?.availability)
      ? affinity.availability.map(String)
      : [],
    summary: String(profile.presentation ?? ""),
    visibility: {
      profession: visibility.profession === "public" ? "public" : "after-match",
      offers: "after-match",
      goals: "public",
      availability: "after-match",
      summary: visibility.presentation === "public" ? "public" : "after-match",
    },
  };
  if (!entry.title.trim()) {
    return null;
  }
  return toPublicPerson(entry);
}

function toPublicPerson(person: CatalogEntry): PublicPerson {
  return {
    id: person.id,
    nombre: person.title,
    ciudad: person.city,
    profesion: isPublicField(person, "profession") ? person.subtitle : null,
    intereses: person.interests,
    objetivos: isPublicField(person, "goals") ? person.goals : null,
    ofrece: isPublicField(person, "offers") ? person.offers : null,
    disponibilidad: isPublicField(person, "availability") ? person.availability : null,
    resumen: isPublicField(person, "summary") ? person.summary : null,
    contacto: null,
  };
}

export function publicCommunities() {
  return CATALOG.filter((entry) => entry.kind === "comunidad" && isListedCommunity(entry)).map(
    (entry) => ({
      id: entry.id,
      titulo: entry.title,
      ciudad: entry.city,
      acceso: "publica" as const,
      miembros: (entry.community?.members ?? []).map((member) => ({
        nombre: CATALOG.find((person) => person.id === member.personId)?.title ?? "Persona",
        rol: member.role,
      })),
    }),
  );
}

function isListedCommunity(entry: CatalogEntry) {
  const access = entry.community?.access ?? "publica";
  return access === "publica";
}
