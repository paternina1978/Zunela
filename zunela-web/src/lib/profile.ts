import { recordProductEvent } from "@/lib/product-events";
import { readDurable, writeDurable } from "@/lib/storage";

const PROFILE_KEY = "zunela.profile";
const CUSTOM_PROFESSIONS_KEY = "zunela.custom-professions";
const CUSTOM_CITIES_KEY = "zunela.custom-cities";

export type FieldVisibility = "public" | "after-match";

export type ProfileDraft = {
  visibleName: string;
  legalName: string;
  country: string;
  city: string;
  profession: string;
  knowledge: string[];
  presentation: string;
  photoDataUrl: string | null;
  visibility: {
    photo: FieldVisibility;
    profession: FieldVisibility;
    city: FieldVisibility;
    country: FieldVisibility;
    knowledge: FieldVisibility;
    presentation: FieldVisibility;
  };
};

export const EMPTY_PROFILE: ProfileDraft = {
  visibleName: "",
  legalName: "",
  country: "Colombia",
  city: "",
  profession: "",
  knowledge: [],
  presentation: "",
  photoDataUrl: null,
  visibility: {
    photo: "after-match",
    profession: "after-match",
    city: "public",
    country: "public",
    knowledge: "after-match",
    presentation: "after-match",
  },
};

export const COUNTRY_OPTIONS = ["Colombia"] as const;

export const COLOMBIA_CITIES = [
  "Armenia",
  "Barrancabermeja",
  "Barranquilla",
  "Bello",
  "Bogotá",
  "Bucaramanga",
  "Buenaventura",
  "Cali",
  "Cartagena",
  "Chía",
  "Cúcuta",
  "Envigado",
  "Florencia",
  "Ibagué",
  "Itagüí",
  "Manizales",
  "Medellín",
  "Montería",
  "Neiva",
  "Palmira",
  "Pasto",
  "Pereira",
  "Popayán",
  "Riohacha",
  "Santa Marta",
  "Sincelejo",
  "Soacha",
  "Tunja",
  "Valledupar",
  "Villavicencio",
  "Yopal",
  "Zipaquirá",
];

export const PROFESSION_SUGGESTIONS = [
  "Abogado",
  "Administrador",
  "Agricultor",
  "Arquitecto",
  "Auxiliar administrativo",
  "Chef / Cocina",
  "Comercial",
  "Community manager",
  "Conductor",
  "Consultor",
  "Contador",
  "Desarrollador",
  "Diseñador",
  "Docente",
  "Electricista",
  "Emprendedor",
  "Enfermero",
  "Estudiante",
  "Ingeniero",
  "Mecánico",
  "Médico",
  "Mercadeo",
  "Psicólogo",
  "Técnico",
  "Ventas",
];

function readCustomList(key: string): string[] {
  const raw = readDurable(key);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((item) => String(item ?? "").trim())
      .filter((item) => item.length >= 2)
      .slice(0, 80);
  } catch {
    return [];
  }
}

function rememberCustomList(
  key: string,
  baseSuggestions: readonly string[],
  value: string,
): void {
  const trimmed = value.trim();
  if (trimmed.length < 2) {
    return;
  }
  const base = new Set(baseSuggestions.map((item) => item.toLocaleLowerCase("es")));
  if (base.has(trimmed.toLocaleLowerCase("es"))) {
    return;
  }
  const previous = readCustomList(key).filter(
    (item) => item.toLocaleLowerCase("es") !== trimmed.toLocaleLowerCase("es"),
  );
  writeDurable(key, JSON.stringify([trimmed, ...previous].slice(0, 80)));
}

export function readCustomProfessions(): string[] {
  return readCustomList(CUSTOM_PROFESSIONS_KEY);
}

export function rememberCustomProfession(value: string): void {
  rememberCustomList(CUSTOM_PROFESSIONS_KEY, PROFESSION_SUGGESTIONS, value);
}

export function readCustomCities(): string[] {
  return readCustomList(CUSTOM_CITIES_KEY);
}

export function rememberCustomCity(value: string): void {
  rememberCustomList(CUSTOM_CITIES_KEY, COLOMBIA_CITIES, value);
}

export const KNOWLEDGE_SUGGESTIONS = [
  "Excel",
  "Power BI",
  "Python",
  "JavaScript",
  "Diseño UX",
  "Contabilidad",
  "Ventas B2B",
  "Marketing digital",
  "Gestión de proyectos",
  "Inglés",
  "Pedagogía",
  "Fotografía",
];

export function readProfile(): ProfileDraft | null {
  const raw = readDurable(PROFILE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ProfileDraft>;
    return {
      ...EMPTY_PROFILE,
      ...parsed,
      country: typeof parsed.country === "string" && parsed.country.trim() ? parsed.country.trim() : "Colombia",
      legalName: typeof parsed.legalName === "string" ? parsed.legalName : "",
      knowledge: asStringList(parsed.knowledge),
      visibility: {
        ...EMPTY_PROFILE.visibility,
        ...parsed.visibility,
      },
      photoDataUrl:
        typeof parsed.photoDataUrl === "string" ? parsed.photoDataUrl : null,
    };
  } catch {
    return null;
  }
}

export function saveProfile(profile: ProfileDraft) {
  writeDurable(PROFILE_KEY, JSON.stringify(profile));
  recordProductEvent("Guardó el perfil.");
}

export function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "Z";
  }
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function asStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}
