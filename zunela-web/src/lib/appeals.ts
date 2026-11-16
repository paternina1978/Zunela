import { recordAudit } from "@/lib/admin";
import { blockedCommunityText } from "@/lib/discover";
import { recordProductEvent } from "@/lib/product-events";
import { remoteIdentityAvailable } from "@/lib/remote/identity";
import {
  createRemoteAppeal,
  refreshRemoteModeration,
  remoteAppealsAsLocal,
  reviewRemoteAppeal,
} from "@/lib/remote/moderation";
import { canUseBrowserStorage, readDurable, writeDurable } from "@/lib/storage";

const APPEALS_KEY = "zunela.appeals";

export type AppealKind = "reporte" | "bloqueo" | "acceso";

export type Appeal = {
  id: string;
  communityId: string;
  communityTitle: string;
  kind: AppealKind;
  note: string;
  status: "pendiente" | "revisada";
};

export const APPEAL_KINDS: { id: AppealKind; label: string }[] = [
  { id: "reporte", label: "Un reporte" },
  { id: "bloqueo", label: "Un bloqueo" },
  { id: "acceso", label: "El acceso" },
];

export function appealKindLabel(kind: AppealKind) {
  return APPEAL_KINDS.find((item) => item.id === kind)?.label ?? "Una decisión";
}

function readLocalAppeals(): Appeal[] {
  if (!canUseBrowserStorage()) {
    return [];
  }
  const raw = readDurable(APPEALS_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isAppeal) : [];
  } catch {
    return [];
  }
}

export function readAppeals(): Appeal[] {
  const local = readLocalAppeals();
  const remote = remoteAppealsAsLocal();
  if (remote.length === 0) {
    return local;
  }
  const byId = new Map<string, Appeal>();
  for (const item of [...local, ...remote]) {
    byId.set(item.id, item);
  }
  return [...byId.values()];
}

export async function refreshRemoteAppealState() {
  if (!remoteIdentityAvailable()) {
    return;
  }
  await refreshRemoteModeration();
}

export function submitAppeal(input: {
  communityId: string;
  communityTitle: string;
  kind: AppealKind;
  note: string;
}) {
  if (!canUseBrowserStorage()) {
    return "No se pudo guardar en este navegador.";
  }
  const note = input.note.trim();
  const blocked = blockedCommunityText(note);
  if (blocked) {
    return blocked;
  }
  const current = readLocalAppeals();
  const open = current.some(
    (item) =>
      item.status === "pendiente" &&
      item.communityId === input.communityId &&
      item.kind === input.kind,
  );
  if (open) {
    return "Ya hay una apelación pendiente de este tipo en esta comunidad.";
  }
  const appeal: Appeal = {
    id: `appeal-${Date.now()}`,
    communityId: input.communityId,
    communityTitle: input.communityTitle,
    kind: input.kind,
    note,
    status: "pendiente",
  };
  writeDurable(APPEALS_KEY, JSON.stringify([appeal, ...current]));
  recordProductEvent("Presentó una apelación.");
  return appeal;
}

export async function submitAppealAsync(input: {
  communityId: string;
  communityTitle: string;
  kind: AppealKind;
  note: string;
}) {
  const note = input.note.trim();
  const blocked = blockedCommunityText(note);
  if (blocked) {
    return blocked;
  }
  if (remoteIdentityAvailable()) {
    const result = await createRemoteAppeal({ ...input, note });
    if (typeof result === "string") {
      return result;
    }
    recordProductEvent("Presentó una apelación.");
    return result;
  }
  return submitAppeal(input);
}

export function reviewAppeal(id: string) {
  const current = readLocalAppeals();
  const appeal = current.find((item) => item.id === id && item.status === "pendiente");
  if (!appeal) {
    return;
  }
  writeDurable(
    APPEALS_KEY,
    JSON.stringify(current.map((item) => (item.id === id ? { ...item, status: "revisada" as const } : item))),
  );
  recordAudit(`Revisó una apelación en «${appeal.communityTitle}». No hubo sanción.`);
}

export async function reviewAppealAsync(id: string) {
  if (remoteIdentityAvailable()) {
    const current = readAppeals().find((item) => item.id === id && item.status === "pendiente");
    if (!current) {
      return "No se encontró la apelación.";
    }
    // Solo UUID de DB van al remoto; apelaciones locales `appeal-…` quedan en localStorage.
    if (!id.startsWith("appeal-")) {
      const reason = await reviewRemoteAppeal(id);
      if (reason) {
        return reason;
      }
      recordAudit(`Revisó una apelación en «${current.communityTitle}». No hubo sanción.`);
      return null;
    }
  }
  reviewAppeal(id);
  return null;
}

function isAppeal(value: unknown): value is Appeal {
  if (!value || typeof value !== "object") {
    return false;
  }
  const appeal = value as Partial<Appeal>;
  return (
    typeof appeal.id === "string" &&
    typeof appeal.communityId === "string" &&
    typeof appeal.communityTitle === "string" &&
    (appeal.kind === "reporte" || appeal.kind === "bloqueo" || appeal.kind === "acceso") &&
    typeof appeal.note === "string" &&
    (appeal.status === "pendiente" || appeal.status === "revisada")
  );
}
