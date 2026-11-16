import { recordAudit, reviewReport } from "@/lib/admin";
import { findCatalogEntry } from "@/lib/discover";
import { findStoredCommunity } from "@/lib/own-communities";
import { findStoredOpportunity } from "@/lib/own-opportunities";
import { recordProductEvent } from "@/lib/product-events";
import { peekRemotePerson } from "@/lib/remote/catalog";
import { remoteIdentityAvailable } from "@/lib/remote/identity";
import {
  createRemoteReport,
  refreshRemoteModeration,
  remoteReportsAsEntries,
  remoteReviewMeta,
  remoteReviewedKeys,
  reviewRemoteReport,
} from "@/lib/remote/moderation";
import { canUseBrowserStorage, readDurable, writeDurable } from "@/lib/storage";

const LEDGER_KEY = "zunela.report-ledger";
const REVIEW_META_KEY = "zunela.admin-reviewed-meta";
const LEGACY_PRIVATE = "zunela.private-reports";
const LEGACY_COMMUNITY = "zunela.community-reports";

export type ReportKind = "privado" | "comunidad" | "comunidad-chat";

export type ReportEntry = {
  key: string;
  kind: ReportKind;
  at: string;
};

export type ReviewMeta = {
  key: string;
  at: string;
  label: string;
};

export function readReportLedger(): ReportEntry[] {
  const local = (() => {
    const stored = readLedgerRaw();
    return stored.length > 0 ? stored : migrateLegacy();
  })();
  const remote = remoteReportsAsEntries();
  if (remote.length === 0) {
    return local;
  }
  const byKey = new Map<string, ReportEntry>();
  for (const item of [...local, ...remote]) {
    byKey.set(item.key, item);
  }
  return [...byKey.values()].sort((a, b) => b.at.localeCompare(a.at));
}

export async function refreshRemoteReportState() {
  if (!remoteIdentityAvailable()) {
    return;
  }
  await refreshRemoteModeration();
}

export function reportKeys(kind?: ReportKind) {
  return readReportLedger()
    .filter((item) => (kind ? item.kind === kind : true))
    .map((item) => item.key);
}

export function pendingReportEntries(reviewedKeys: Set<string>) {
  const remoteReviewed = new Set(remoteReviewedKeys());
  return readReportLedger().filter(
    (item) => !reviewedKeys.has(item.key) && !remoteReviewed.has(item.key),
  );
}

export function recordCommunityReport(communityId: string, postId: string) {
  const key = `${communityId}:${postId}`;
  return appendReport("comunidad", key, "Reportó una publicación.");
}

export function recordPrivateReport(personId: string, messageId: string) {
  const key = `${personId}:${messageId}`;
  return appendReport("privado", key, "Reportó un mensaje privado.");
}

export function recordCommunityChatReport(communityId: string, messageId: string) {
  const key = `chat:${communityId}:${messageId}`;
  return appendReport("comunidad-chat", key, "Reportó un mensaje en un chat de comunidad.");
}

export async function recordCommunityReportAsync(communityId: string, postId: string) {
  const key = `${communityId}:${postId}`;
  const label = resolveReportLabel("comunidad", key);
  if (remoteIdentityAvailable()) {
    const reason = await createRemoteReport("comunidad", key, label);
    if (reason) {
      return reason;
    }
    recordProductEvent("Reportó una publicación.");
    return null;
  }
  appendReport("comunidad", key, "Reportó una publicación.");
  return null;
}

export async function recordPrivateReportAsync(personId: string, messageId: string) {
  const key = `${personId}:${messageId}`;
  const label = resolveReportLabel("privado", key);
  if (remoteIdentityAvailable()) {
    const reason = await createRemoteReport("privado", key, label);
    if (reason) {
      return reason;
    }
    recordProductEvent("Reportó un mensaje privado.");
    return null;
  }
  appendReport("privado", key, "Reportó un mensaje privado.");
  return null;
}

export async function recordCommunityChatReportAsync(communityId: string, messageId: string) {
  const key = `chat:${communityId}:${messageId}`;
  const label = resolveReportLabel("comunidad-chat", key);
  if (remoteIdentityAvailable()) {
    const reason = await createRemoteReport("comunidad-chat", key, label);
    if (reason) {
      return reason;
    }
    recordProductEvent("Reportó un mensaje en un chat de comunidad.");
    return null;
  }
  appendReport("comunidad-chat", key, "Reportó un mensaje en un chat de comunidad.");
  return null;
}

export async function reviewReportAsync(key: string, label: string) {
  if (remoteIdentityAvailable()) {
    const already = remoteReviewedKeys().includes(key);
    if (!already) {
      const reason = await reviewRemoteReport(key, label);
      if (reason) {
        return reason;
      }
    }
    saveReviewMeta(key, label);
    recordAudit(`Revisó el reporte: ${label}.`);
    return null;
  }
  reviewReport(key, label);
  saveReviewMeta(key, label);
  return null;
}

export function saveReviewMeta(key: string, label: string) {
  if (!canUseBrowserStorage()) {
    return;
  }
  const current = readReviewMetaLocal();
  if (current.some((item) => item.key === key)) {
    return;
  }
  const next = [{ key, label, at: new Date().toISOString() }, ...current].slice(0, 40);
  writeDurable(REVIEW_META_KEY, JSON.stringify(next));
}

export function readReviewMeta() {
  const local = readReviewMetaLocal();
  const remote = remoteReviewMeta();
  if (remote.length === 0) {
    return local;
  }
  const byKey = new Map<string, ReviewMeta>();
  for (const item of [...local, ...remote]) {
    byKey.set(item.key, item);
  }
  return [...byKey.values()];
}

function readReviewMetaLocal() {
  if (!canUseBrowserStorage()) {
    return [] as ReviewMeta[];
  }
  const raw = readDurable(REVIEW_META_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isReviewMeta);
  } catch {
    return [];
  }
}

function resolveReportLabel(kind: ReportKind, key: string) {
  return reportLabel({ key, kind, at: new Date().toISOString() });
}

/** Minutos de atención de reportes ya revisados (con marca de tiempo). */
export function reportAttentionStats() {
  const ledger = new Map(readReportLedger().map((item) => [item.key, item]));
  const reviewed = readReviewMeta();
  const minutes = reviewed.flatMap((item) => {
    const open = ledger.get(item.key);
    if (!open) {
      return [];
    }
    const opened = new Date(open.at).getTime();
    const closed = new Date(item.at).getTime();
    if (!Number.isFinite(opened) || !Number.isFinite(closed) || closed < opened) {
      return [];
    }
    return [Math.max(1, Math.round((closed - opened) / 60_000))];
  });
  const open = pendingReportEntries(new Set(reviewed.map((item) => item.key))).length;
  if (minutes.length === 0) {
    return { reviewed: reviewed.length, averageMinutes: null as number | null, open };
  }
  const averageMinutes = Math.round(minutes.reduce((sum, value) => sum + value, 0) / minutes.length);
  return { reviewed: reviewed.length, averageMinutes, open };
}

export function reportLabel(entry: ReportEntry) {
  if (entry.kind === "comunidad-chat") {
    const communityId = entry.key.split(":")[1] ?? "";
    return (
      findCatalogEntry(communityId)?.title ??
      findStoredCommunity(communityId)?.title ??
      "Chat de comunidad"
    );
  }
  const [id] = entry.key.split(":");
  const title =
    findCatalogEntry(id)?.title ??
    peekRemotePerson(id)?.title ??
    findStoredCommunity(id)?.title ??
    findStoredOpportunity(id)?.title;
  if (entry.kind === "privado") {
    return title ?? "Mensaje privado";
  }
  return title ?? "Comunidad";
}

export function reportDetail(entry: ReportEntry) {
  if (entry.kind === "privado") {
    return "Mensaje reportado en un chat de conexión. El contacto sigue oculto.";
  }
  if (entry.kind === "comunidad-chat") {
    return "Mensaje reportado en el chat de una comunidad. Sin el texto denunciado.";
  }
  return "Publicación reportada en una comunidad. Sin el texto denunciado.";
}

function appendReport(kind: ReportKind, key: string, eventText: string) {
  if (!canUseBrowserStorage()) {
    return false;
  }
  const current = readReportLedger();
  if (current.some((item) => item.key === key)) {
    return false;
  }
  const next = [{ key, kind, at: new Date().toISOString() }, ...current].slice(0, 40);
  writeDurable(LEDGER_KEY, JSON.stringify(next));
  syncLegacyKey(kind, key);
  recordProductEvent(eventText);
  return true;
}

function syncLegacyKey(kind: ReportKind, key: string) {
  if (kind === "comunidad-chat") {
    return;
  }
  const storageKey = kind === "privado" ? LEGACY_PRIVATE : LEGACY_COMMUNITY;
  const current = readStringIds(storageKey);
  if (current.includes(key)) {
    return;
  }
  writeDurable(storageKey, JSON.stringify([...current, key]));
}

function migrateLegacy(): ReportEntry[] {
  const now = new Date().toISOString();
  const migrated: ReportEntry[] = [
    ...readStringIds(LEGACY_PRIVATE).map((key) => ({ key, kind: "privado" as const, at: now })),
    ...readStringIds(LEGACY_COMMUNITY).map((key) => ({ key, kind: "comunidad" as const, at: now })),
  ];
  if (migrated.length > 0 && canUseBrowserStorage()) {
    writeDurable(LEDGER_KEY, JSON.stringify(migrated));
  }
  return migrated;
}

function readLedgerRaw(): ReportEntry[] {
  if (!canUseBrowserStorage()) {
    return [];
  }
  const raw = readDurable(LEDGER_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isReportEntry);
  } catch {
    return [];
  }
}

function readStringIds(key: string) {
  if (!canUseBrowserStorage()) {
    return [] as string[];
  }
  const raw = readDurable(key);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function isReportEntry(value: unknown): value is ReportEntry {
  if (!value || typeof value !== "object") {
    return false;
  }
  const item = value as Partial<ReportEntry>;
  return (
    typeof item.key === "string" &&
    (item.kind === "privado" || item.kind === "comunidad" || item.kind === "comunidad-chat") &&
    typeof item.at === "string"
  );
}

function isReviewMeta(value: unknown): value is ReviewMeta {
  if (!value || typeof value !== "object") {
    return false;
  }
  const item = value as Partial<ReviewMeta>;
  return typeof item.key === "string" && typeof item.at === "string" && typeof item.label === "string";
}
