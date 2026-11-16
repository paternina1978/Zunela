import { recordAudit } from "@/lib/admin";
import { foldText } from "@/lib/affinity";
import { isKnownInterest } from "@/lib/catalog";
import { readActivePlan } from "@/lib/account";
import { CATALOG, type CatalogEntry } from "@/lib/discover";
import { recordProductEvent } from "@/lib/product-events";
import { remoteIdentityAvailable } from "@/lib/remote/identity";
import { remoteAuthUserId } from "@/lib/remote/catalog";
import {
  approveRemoteOpportunity,
  getRemoteOpportunity,
  isRemoteOpportunityId,
  listRemoteOpportunities,
  peekRemoteOpportunity,
  publishRemoteOpportunity,
} from "@/lib/remote/opportunities";
import { readProfile } from "@/lib/profile";
import { readSession } from "@/lib/session";
import { canUseBrowserStorage, readDurable, writeDurable } from "@/lib/storage";

const OWN_KEY = "zunela.own-opportunities";

export const OPPORTUNITY_CATEGORIES = ["Conocimiento", "Negocios", "Actividad", "Colaboración"] as const;

export type OpportunityCategory = (typeof OPPORTUNITY_CATEGORIES)[number];

export type OwnOpportunity = {
  id: string;
  title: string;
  category: OpportunityCategory;
  objective: string;
  city: string;
  modality: "presencial" | "remota" | "ambas";
  spots: number;
  interest: string;
  role: string;
  rule: string;
  organizerName: string;
  organizerDetail: string;
  status: "revision" | "publicada";
  /** UUID del organizador cuando la ficha vive en Supabase. */
  organizerId?: string;
};

let remoteOpportunityCache: OwnOpportunity[] = [];
let myRemoteUserId: string | null = null;

export type OpportunityInput = {
  title: string;
  category: string;
  objective: string;
  city: string;
  modality: string;
  spots: number;
  interest: string;
  role: string;
  rule: string;
};

export function readOwnOpportunities(): OwnOpportunity[] {
  if (!canUseBrowserStorage()) {
    return [];
  }
  const raw = readDurable(OWN_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isOwnOpportunity) : [];
  } catch {
    return [];
  }
}

export function ownOpportunityEntry(item: OwnOpportunity): CatalogEntry {
  const known = CATALOG.find((entry) => foldText(entry.city) === foldText(item.city));
  const rules = [
    item.rule,
    "Correo, teléfono y redes no se publican.",
    "Participar no abre un chat privado.",
    item.status === "revision"
      ? "Esta publicación está en revisión."
      : "La publicación ya fue revisada en esta prueba.",
  ].filter((rule) => rule.length > 0);

  return {
    id: item.id,
    kind: "oportunidad",
    title: item.title,
    subtitle: `${item.category} · tuya`,
    city: item.city,
    department: known?.department ?? "",
    modality: item.modality,
    interests: [item.interest],
    goals: [],
    offers: [],
    availability: [],
    summary: item.objective,
    opportunity: {
      category: item.category,
      objective: item.objective,
      creatorId: item.organizerId ?? "sesion",
      spotsLabel: `0 de ${item.spots} cupos`,
      rules,
      roles: item.role ? [item.role] : [],
      ownStatus: item.status,
      organizerName: item.organizerName,
      organizerDetail: item.organizerDetail,
    },
  };
}

export function findOwnOpportunity(id: string) {
  const local = readOwnOpportunities().find((item) => item.id === id);
  if (local) {
    return local;
  }
  const remote = peekRemoteOpportunity(id) ?? remoteOpportunityCache.find((item) => item.id === id);
  if (remote && myRemoteUserId && remote.organizerId === myRemoteUserId) {
    return remote;
  }
  return null;
}

/** Cualquier oportunidad remota/local por id (catálogo o propia). */
export function findStoredOpportunity(id: string) {
  return (
    findOwnOpportunity(id) ??
    peekRemoteOpportunity(id) ??
    remoteOpportunityCache.find((item) => item.id === id) ??
    null
  );
}

export async function refreshRemoteOpportunityCache() {
  if (!remoteIdentityAvailable()) {
    remoteOpportunityCache = [];
    myRemoteUserId = null;
    return [];
  }
  myRemoteUserId = await remoteAuthUserId();
  remoteOpportunityCache = await listRemoteOpportunities();
  return remoteOpportunityCache;
}

export function listCachedRemoteOpportunities() {
  return remoteOpportunityCache;
}

export async function findStoredOpportunityAsync(id: string) {
  if (remoteIdentityAvailable() && isRemoteOpportunityId(id)) {
    return (await getRemoteOpportunity(id)) ?? findStoredOpportunity(id);
  }
  return findStoredOpportunity(id);
}

function validateOpportunityInput(input: OpportunityInput): string | null {
  const title = input.title.trim();
  const objective = input.objective.trim();
  const role = input.role.trim();
  const rule = input.rule.trim();
  const city = input.city.trim();
  if (title.length < 4 || title.length > 80) {
    return "El título necesita entre 4 y 80 caracteres.";
  }
  if (!isCategory(input.category)) {
    return "Elige una categoría.";
  }
  if (objective.length < 12 || objective.length > 400) {
    return "El objetivo necesita entre 12 y 400 caracteres.";
  }
  if (!city) {
    return "Elige una ciudad.";
  }
  if (input.modality !== "presencial" && input.modality !== "remota" && input.modality !== "ambas") {
    return "Elige la modalidad.";
  }
  if (!Number.isInteger(input.spots) || input.spots < 2 || input.spots > 30) {
    return "El cupo va de 2 a 30 personas.";
  }
  if (!isKnownInterest(input.interest)) {
    return "Elige un interés del catálogo.";
  }
  const blocked = [title, objective, role, rule].map(opportunityFieldError).find(Boolean);
  if (blocked) {
    return blocked;
  }
  if (role.length > 60) {
    return "El rol puede tener hasta 60 caracteres.";
  }
  return null;
}

function organizerLabels() {
  const profile = readProfile();
  const session = readSession();
  const name = profile?.visibleName || session?.visibleName || "Tu sesión";
  const profession =
    profile && profile.visibility.profession === "public" && profile.profession
      ? profile.profession
      : "Profesión reservada";
  return { name, profession };
}

export function publishOwnOpportunity(input: OpportunityInput) {
  if (readActivePlan() !== "prueba") {
    return "Publicar una oportunidad propia requiere la prueba Premium.";
  }
  const invalid = validateOpportunityInput(input);
  if (invalid) {
    return invalid;
  }
  const title = input.title.trim();
  const { name, profession } = organizerLabels();
  const city = input.city.trim();
  const item: OwnOpportunity = {
    id: `op-propia-${Date.now()}`,
    title,
    category: input.category as OpportunityCategory,
    objective: input.objective.trim(),
    city,
    modality: input.modality as OwnOpportunity["modality"],
    spots: input.spots,
    interest: input.interest,
    role: input.role.trim(),
    rule: input.rule.trim(),
    organizerName: name,
    organizerDetail: `${profession} · ${city}`,
    status: "revision",
  };
  writeDurable(OWN_KEY, JSON.stringify([item, ...readOwnOpportunities()]));
  recordAudit(`Publicó «${title}». Quedó en revisión.`);
  recordProductEvent(`Envió a revisión la oportunidad «${title}».`);
  return item;
}

export async function publishOwnOpportunityAsync(input: OpportunityInput) {
  if (remoteIdentityAvailable()) {
    if (readActivePlan() !== "prueba") {
      return "Publicar una oportunidad propia requiere la prueba Premium.";
    }
    const invalid = validateOpportunityInput(input);
    if (invalid) {
      return invalid;
    }
    const { name, profession } = organizerLabels();
    const city = input.city.trim();
    const result = await publishRemoteOpportunity({
      ...input,
      title: input.title.trim(),
      objective: input.objective.trim(),
      city,
      role: input.role.trim(),
      rule: input.rule.trim(),
      organizerName: name,
      organizerDetail: `${profession} · ${city}`,
    });
    if (typeof result === "string") {
      return result;
    }
    remoteOpportunityCache = [result, ...remoteOpportunityCache.filter((item) => item.id !== result.id)];
    recordAudit(`Publicó «${result.title}». Quedó en revisión.`);
    recordProductEvent(`Envió a revisión la oportunidad «${result.title}».`);
    return result;
  }
  return publishOwnOpportunity(input);
}

export function approveOwnOpportunity(id: string) {
  if (isRemoteOpportunityId(id)) {
    return;
  }
  const items = readOwnOpportunities();
  const current = items.find((item) => item.id === id);
  if (!current || current.status === "publicada") {
    return;
  }
  writeDurable(
    OWN_KEY,
    JSON.stringify(items.map((item) => (item.id === id ? { ...item, status: "publicada" as const } : item))),
  );
  recordAudit(`Aprobó la oportunidad «${current.title}».`);
}

export async function approveOwnOpportunityAsync(id: string) {
  if (remoteIdentityAvailable() && isRemoteOpportunityId(id)) {
    const current = findOwnOpportunity(id);
    const reason = await approveRemoteOpportunity(id);
    if (reason) {
      return reason;
    }
    await refreshRemoteOpportunityCache();
    if (current) {
      recordAudit(`Aprobó la oportunidad «${current.title}».`);
    }
    return null;
  }
  approveOwnOpportunity(id);
  return null;
}

export function opportunityFieldError(value: string) {
  if (!value) {
    return null;
  }
  if (/[^\s@]+@[^\s@]+\.[^\s@]+/.test(value)) {
    return "Quita el correo. No se publica en una oportunidad.";
  }
  if (/(?:\d[\s.-]?){7,}/.test(value)) {
    return "Quita el teléfono. No se publica en una oportunidad.";
  }
  if (/https?:\/\/|www\./i.test(value)) {
    return "Quita el enlace. No se publica en una oportunidad.";
  }
  if (/ingresos?\s+garantiz|ganancias?\s+segur|rentabilidad\s+asegur|vas a ganar|ganar[aá]s|inversi[oó]n\s+segura/i.test(value)) {
    return "Quita la promesa de ingresos. Una oportunidad no puede asegurar ganancias.";
  }
  return null;
}

function isCategory(value: string): value is OpportunityCategory {
  return OPPORTUNITY_CATEGORIES.some((item) => item === value);
}

function isOwnOpportunity(value: unknown): value is OwnOpportunity {
  if (!value || typeof value !== "object") {
    return false;
  }
  const item = value as Partial<OwnOpportunity>;
  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    isCategory(item.category ?? "") &&
    typeof item.objective === "string" &&
    typeof item.city === "string" &&
    (item.modality === "presencial" || item.modality === "remota" || item.modality === "ambas") &&
    typeof item.spots === "number" &&
    typeof item.interest === "string" &&
    typeof item.role === "string" &&
    typeof item.rule === "string" &&
    typeof item.organizerName === "string" &&
    typeof item.organizerDetail === "string" &&
    (item.status === "revision" || item.status === "publicada")
  );
}
