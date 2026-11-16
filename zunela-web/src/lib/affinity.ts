import { recordProductEvent } from "@/lib/product-events";
import { readDurable, writeDurable } from "@/lib/storage";

const AFFINITY_KEY = "zunela.affinity";

export type Modality = "presencial" | "remota" | "ambas";
export type Reach = "ciudad" | "departamento" | "nacional" | "remoto";

export type AffinityDraft = {
  interests: string[];
  goals: string[];
  offers: string[];
  modality: Modality;
  reach: Reach;
  availability: string[];
};

export const EMPTY_AFFINITY: AffinityDraft = {
  interests: [],
  goals: [],
  offers: [],
  modality: "ambas",
  reach: "ciudad",
  availability: ["Horario flexible"],
};

export const INTEREST_GROUPS = [
  {
    title: "Negocios",
    items: [
      "Emprendimiento",
      "Ventas",
      "Marketing",
      "Finanzas",
      "Inmobiliario",
      "Comercio",
      "Networking",
    ],
  },
  {
    title: "Conocimiento",
    items: [
      "Inteligencia artificial",
      "Programación",
      "Diseño",
      "Idiomas",
      "Liderazgo",
      "Educación",
    ],
  },
  {
    title: "Actividad",
    items: ["Senderismo", "Deporte", "Música", "Voluntariado", "Viajes", "Cocina"],
  },
];

export const GOAL_OPTIONS = [
  "Socio para un proyecto",
  "Equipo de ventas",
  "Mentoría",
  "Aprender una habilidad",
  "Apoyo en diseño",
  "Apoyo en tecnología",
  "Apoyo en mercadeo",
  "Actividad en grupo",
  "Clientes o proyectos",
  "Comunidad para aprender",
];

export const OFFER_OPTIONS = [
  "Ventas",
  "Diseño",
  "Desarrollo",
  "Mercadeo",
  "Finanzas",
  "Docencia",
  "Gestión de proyectos",
  "Redacción",
  "Logística",
  "Consultoría",
  "Organizar actividades",
];

export const AVAILABILITY_OPTIONS = [
  "Entre semana",
  "Fines de semana",
  "Mañanas",
  "Tardes",
  "Noches",
  "Horario flexible",
];

export const MODALITY_OPTIONS: { value: Modality; label: string }[] = [
  { value: "presencial", label: "Presencial" },
  { value: "remota", label: "Remota" },
  { value: "ambas", label: "Ambas" },
];

export const REACH_OPTIONS: { value: Reach; label: string }[] = [
  { value: "ciudad", label: "Mi ciudad" },
  { value: "departamento", label: "Mi departamento" },
  { value: "nacional", label: "Colombia" },
  { value: "remoto", label: "Remoto" },
];

export function foldText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export function readAffinity(): AffinityDraft | null {
  const raw = readDurable(AFFINITY_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AffinityDraft>;
    return {
      ...EMPTY_AFFINITY,
      ...parsed,
      interests: asStringList(parsed.interests),
      goals: asStringList(parsed.goals),
      offers: asStringList(parsed.offers),
      availability: asStringList(parsed.availability),
    };
  } catch {
    return null;
  }
}

export function saveAffinity(affinity: AffinityDraft) {
  writeDurable(AFFINITY_KEY, JSON.stringify(affinity));
  recordProductEvent("Guardó intereses y objetivos.");
}

function asStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}
