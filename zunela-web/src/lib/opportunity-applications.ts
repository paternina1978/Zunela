import { findCatalogEntry } from "@/lib/discover";
import { findOwnOpportunity, findStoredOpportunity } from "@/lib/own-opportunities";
import { recordProductEvent } from "@/lib/product-events";
import { remoteIdentityAvailable } from "@/lib/remote/identity";
import {
  applyRemoteToOpportunity,
  fetchRemoteApplications,
  isRemoteOpportunityId,
  reviewRemoteApplication,
  withdrawRemoteApplication,
} from "@/lib/remote/opportunities";
import { readProfile } from "@/lib/profile";
import { readSession } from "@/lib/session";
import { canUseBrowserStorage, readDurable, writeDurable } from "@/lib/storage";

const APP_KEY = "zunela.opportunity-applications";

export type ApplicationStatus = "pendiente" | "aceptada" | "rechazada";

export type OpportunityApplication = {
  id: string;
  opportunityId: string;
  applicantName: string;
  role: string;
  status: ApplicationStatus;
  at: string;
  mine: boolean;
};

const DEMO_NAMES = ["Camila Restrepo", "Julián Castro", "Diana Mejía"];

const remoteApplicationCache = new Map<string, OpportunityApplication[]>();

export function readApplications(opportunityId?: string) {
  if (opportunityId && isRemoteOpportunityId(opportunityId)) {
    return remoteApplicationCache.get(opportunityId) ?? [];
  }
  const all = readAll();
  return opportunityId ? all.filter((item) => item.opportunityId === opportunityId) : all;
}

export async function readApplicationsAsync(opportunityId: string) {
  if (remoteIdentityAvailable() && isRemoteOpportunityId(opportunityId)) {
    const rows = await fetchRemoteApplications(opportunityId);
    remoteApplicationCache.set(opportunityId, rows);
    return rows;
  }
  return readApplications(opportunityId);
}

export function myApplication(opportunityId: string) {
  return readApplications(opportunityId).find((item) => item.mine) ?? null;
}

export function acceptedCount(opportunityId: string) {
  return readApplications(opportunityId).filter((item) => item.status === "aceptada").length;
}

export function spotsTotal(opportunityId: string) {
  const stored = findStoredOpportunity(opportunityId);
  if (stored) {
    return stored.spots;
  }
  const entry = findCatalogEntry(opportunityId);
  const label = entry?.opportunity?.spotsLabel ?? "";
  const match = label.match(/de\s+(\d+)\s+cupos/i);
  return match ? Number(match[1]) : 0;
}

export function baselineTaken(opportunityId: string) {
  if (findStoredOpportunity(opportunityId) || isRemoteOpportunityId(opportunityId)) {
    return 0;
  }
  const entry = findCatalogEntry(opportunityId);
  const label = entry?.opportunity?.spotsLabel ?? "";
  const match = label.match(/(\d+)\s+de\s+\d+\s+cupos/i);
  return match ? Number(match[1]) : 0;
}

export function filledSpots(opportunityId: string) {
  return baselineTaken(opportunityId) + acceptedCount(opportunityId);
}

export function spotsLabelFor(opportunityId: string) {
  const total = spotsTotal(opportunityId);
  if (total < 1) {
    return findCatalogEntry(opportunityId)?.opportunity?.spotsLabel ?? "Cupo por confirmar";
  }
  return `${filledSpots(opportunityId)} de ${total} cupos`;
}

export function canApplyToOpportunity(opportunityId: string) {
  const own = findOwnOpportunity(opportunityId);
  if (own) {
    if (own.status === "revision") {
      return "Esta publicación está en revisión y todavía no recibe participantes.";
    }
    return "Tú organizas esta oportunidad.";
  }
  const entry = findCatalogEntry(opportunityId);
  const remoteOnly = isRemoteOpportunityId(opportunityId);
  if ((!entry || entry.kind !== "oportunidad") && !remoteOnly) {
    return "No se encontró la oportunidad.";
  }
  const existing = myApplication(opportunityId);
  if (existing && existing.status !== "rechazada") {
    return "Ya tienes una postulación en esta oportunidad.";
  }
  const total = spotsTotal(opportunityId);
  if (total > 0 && filledSpots(opportunityId) >= total) {
    return "El cupo de esta oportunidad ya está completo.";
  }
  return null;
}

export function applyToOpportunity(opportunityId: string, role: string) {
  if (isRemoteOpportunityId(opportunityId)) {
    return "Usa el envío remoto para esta postulación.";
  }
  const reason = canApplyToOpportunity(opportunityId);
  if (reason) {
    return reason;
  }
  const entry = findCatalogEntry(opportunityId);
  if (!entry || entry.kind !== "oportunidad") {
    return "No se encontró la oportunidad.";
  }
  const profile = readProfile();
  const session = readSession();
  const applicantName = profile?.visibleName || session?.visibleName || "Tu sesión";
  const current = readAll().filter((item) => !(item.opportunityId === opportunityId && item.mine));
  const application: OpportunityApplication = {
    id: `app-${Date.now()}`,
    opportunityId,
    applicantName,
    role: role.trim(),
    status: "pendiente",
    at: new Date().toISOString(),
    mine: true,
  };
  writeAll([application, ...current]);
  recordProductEvent(`Postuló a «${entry.title}».`);
  return null;
}

export async function applyToOpportunityAsync(opportunityId: string, role: string) {
  if (remoteIdentityAvailable() && isRemoteOpportunityId(opportunityId)) {
    const stored = findStoredOpportunity(opportunityId);
    if (stored?.status === "revision") {
      return "Esta publicación está en revisión y todavía no recibe participantes.";
    }
    const reason = canApplyToOpportunity(opportunityId);
    if (reason) {
      return reason;
    }
    const profile = readProfile();
    const session = readSession();
    const applicantName = profile?.visibleName || session?.visibleName || "Tu sesión";
    const remoteReason = await applyRemoteToOpportunity(opportunityId, role, applicantName);
    if (remoteReason) {
      return remoteReason;
    }
    await readApplicationsAsync(opportunityId);
    const title = stored?.title ?? findCatalogEntry(opportunityId)?.title ?? "oportunidad";
    recordProductEvent(`Postuló a «${title}».`);
    return null;
  }
  return applyToOpportunity(opportunityId, role);
}

export function withdrawApplication(opportunityId: string) {
  if (isRemoteOpportunityId(opportunityId)) {
    return;
  }
  const current = readAll();
  const mine = current.find((item) => item.opportunityId === opportunityId && item.mine);
  if (!mine) {
    return;
  }
  writeAll(current.filter((item) => item.id !== mine.id));
  recordProductEvent("Retiró una postulación a una oportunidad.");
}

export async function withdrawApplicationAsync(opportunityId: string) {
  if (remoteIdentityAvailable() && isRemoteOpportunityId(opportunityId)) {
    const reason = await withdrawRemoteApplication(opportunityId);
    if (reason) {
      return reason;
    }
    await readApplicationsAsync(opportunityId);
    recordProductEvent("Retiró una postulación a una oportunidad.");
    return null;
  }
  withdrawApplication(opportunityId);
  return null;
}

export function reviewApplication(applicationId: string, status: "aceptada" | "rechazada") {
  if (isRemoteOpportunityId(applicationId)) {
    return "Usa la revisión remota para esta postulación.";
  }
  const current = readAll();
  const target = current.find((item) => item.id === applicationId);
  if (!target || target.mine) {
    return "Solo puedes revisar postulaciones de otras personas en tus oportunidades.";
  }
  const own = findOwnOpportunity(target.opportunityId);
  if (!own || own.status !== "publicada") {
    return "La oportunidad no está publicada.";
  }
  if (status === "aceptada") {
    const total = spotsTotal(target.opportunityId);
    const othersAccepted = current.filter(
      (item) =>
        item.opportunityId === target.opportunityId &&
        item.status === "aceptada" &&
        item.id !== target.id,
    ).length;
    if (total > 0 && othersAccepted >= total) {
      return "No quedan cupos para aceptar más postulaciones.";
    }
  }
  writeAll(
    current.map((item) => (item.id === applicationId ? { ...item, status } : item)),
  );
  recordProductEvent(
    status === "aceptada"
      ? `Aceptó la postulación de ${target.applicantName}.`
      : `Rechazó la postulación de ${target.applicantName}.`,
  );
  return null;
}

export async function reviewApplicationAsync(
  applicationId: string,
  status: "aceptada" | "rechazada",
  opportunityId?: string,
) {
  const remoteOpp =
    opportunityId && isRemoteOpportunityId(opportunityId)
      ? opportunityId
      : [...remoteApplicationCache.entries()].find(([, rows]) =>
          rows.some((row) => row.id === applicationId),
        )?.[0];

  if (remoteIdentityAvailable() && remoteOpp) {
    const apps = remoteApplicationCache.get(remoteOpp) ?? (await readApplicationsAsync(remoteOpp));
    const target = apps.find((item) => item.id === applicationId);
    if (!target || target.mine) {
      return "Solo puedes revisar postulaciones de otras personas en tus oportunidades.";
    }
    const own = findOwnOpportunity(remoteOpp);
    if (!own || own.status !== "publicada") {
      return "La oportunidad no está publicada.";
    }
    if (status === "aceptada") {
      const total = spotsTotal(remoteOpp);
      const othersAccepted = apps.filter(
        (item) => item.status === "aceptada" && item.id !== target.id,
      ).length;
      if (total > 0 && othersAccepted >= total) {
        return "No quedan cupos para aceptar más postulaciones.";
      }
    }
    const reason = await reviewRemoteApplication(applicationId, status);
    if (reason) {
      return reason;
    }
    await readApplicationsAsync(remoteOpp);
    recordProductEvent(
      status === "aceptada"
        ? `Aceptó la postulación de ${target.applicantName}.`
        : `Rechazó la postulación de ${target.applicantName}.`,
    );
    return null;
  }
  return reviewApplication(applicationId, status);
}

/** Semilla de postulaciones demo para que el organizador pueda practicar la revisión. */
export function ensureOrganizerDemoApplicants(opportunityId: string) {
  if (isRemoteOpportunityId(opportunityId)) {
    return;
  }
  const own = findOwnOpportunity(opportunityId);
  if (!own || own.status !== "publicada") {
    return;
  }
  const current = readAll();
  if (current.some((item) => item.opportunityId === opportunityId && !item.mine)) {
    return;
  }
  const seeded: OpportunityApplication[] = DEMO_NAMES.slice(0, 2).map((name, index) => ({
    id: `app-demo-${opportunityId}-${index}`,
    opportunityId,
    applicantName: name,
    role: own.role || "Participante",
    status: "pendiente",
    at: new Date().toISOString(),
    mine: false,
  }));
  writeAll([...seeded, ...current]);
}

function readAll(): OpportunityApplication[] {
  if (!canUseBrowserStorage()) {
    return [];
  }
  const raw = readDurable(APP_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isApplication);
  } catch {
    return [];
  }
}

function writeAll(items: OpportunityApplication[]) {
  writeDurable(APP_KEY, JSON.stringify(items.slice(0, 80)));
}

function isApplication(value: unknown): value is OpportunityApplication {
  if (!value || typeof value !== "object") {
    return false;
  }
  const item = value as Partial<OpportunityApplication>;
  return (
    typeof item.id === "string" &&
    typeof item.opportunityId === "string" &&
    typeof item.applicantName === "string" &&
    typeof item.role === "string" &&
    (item.status === "pendiente" || item.status === "aceptada" || item.status === "rechazada") &&
    typeof item.at === "string" &&
    typeof item.mine === "boolean"
  );
}
