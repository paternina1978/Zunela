import { EMPTY_AFFINITY, readAffinity, type AffinityDraft } from "@/lib/affinity";
import { type CatalogEntry } from "@/lib/discover";
import { departmentOfCity } from "@/lib/locations";
import { readProfile, type ProfileDraft } from "@/lib/profile";

export const SELF_PERSON_ID = "yo-local";

/** Ficha local del usuario para Descubrir / vista piloto (sin multiusuario). */
export function buildSelfEntry(
  profile = readProfile(),
  affinity = readAffinity() ?? EMPTY_AFFINITY,
): CatalogEntry | null {
  if (!profile?.visibleName.trim()) {
    return null;
  }
  return catalogFromSelf(profile, affinity);
}

export function isSelfPersonId(id: string) {
  return id === SELF_PERSON_ID || id === "yo";
}

function catalogFromSelf(profile: ProfileDraft, affinity: AffinityDraft): CatalogEntry {
  const city = profile.city.trim() || "Colombia";
  return {
    id: SELF_PERSON_ID,
    kind: "persona",
    title: profile.visibleName.trim(),
    subtitle: profile.profession.trim() || "Sin profesión pública",
    city,
    department: departmentOfCity(city),
    modality: affinity.modality === "ambas" ? "ambas" : affinity.modality,
    interests: affinity.interests.length > 0 ? affinity.interests : ["Afinidad local"],
    goals: affinity.goals.length > 0 ? affinity.goals : ["Conectar con gente afín"],
    offers: affinity.offers.length > 0 ? affinity.offers : profile.knowledge.slice(0, 4),
    availability:
      affinity.availability.length > 0 ? affinity.availability : ["Horario flexible"],
    summary:
      profile.presentation.trim() ||
      "Así te verían otras personas en el piloto, según tu perfil e intereses.",
    visibility: {
      profession: profile.visibility.profession,
      offers: "after-match",
      goals: "public",
      availability: "after-match",
      summary: profile.visibility.presentation,
    },
  };
}

export function selfPreviewReady(profile = readProfile()) {
  return Boolean(profile?.visibleName.trim() && profile.city.trim());
}

