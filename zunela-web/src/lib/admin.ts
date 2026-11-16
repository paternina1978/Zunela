import { remoteIdentityAvailable } from "@/lib/remote/identity";
import {
  clearRemoteAuditCache,
  createRemoteAudit,
  fetchRemoteAudit,
  peekRemoteAudit,
} from "@/lib/remote/audit";
import {
  clearRemoteSettingsCache,
  peekRemoteAdminParams,
  peekRemoteParamVersions,
  refreshRemoteSettings,
  saveRemoteAdminParams,
} from "@/lib/remote/settings";
import {
  clearRemoteSuspendedCache,
  fetchRemoteSuspendedIds,
  peekRemoteSuspendedIds,
  setRemoteSuspended,
} from "@/lib/remote/suspensions";
import { canUseBrowserStorage, readDurable, writeDurable } from "@/lib/storage";

const PARAMS_KEY = "zunela.admin-params";
const VERSIONS_KEY = "zunela.admin-param-versions";
const LOG_KEY = "zunela.admin-log";
const SUSPEND_KEY = "zunela.admin-suspended";
const REVIEW_KEY = "zunela.admin-reviewed";

export type AttachmentPolicy = "ninguno";

export type AdminParams = {
  dailyMessages: number;
  premiumDailyMessages: number;
  communityQuota: number;
  communityQuotaDays: number;
  matchExpiryDays: number;
  trialDays: number;
  attachments: AttachmentPolicy;
  reportAlert: number;
  affinityThreshold: number;
};

export type ParamVersion = AdminParams & {
  version: number;
  at: string | null;
};

export type AuditEntry = {
  id: string;
  at: string;
  text: string;
};

export const DEFAULT_ADMIN_PARAMS: AdminParams = {
  dailyMessages: 20,
  premiumDailyMessages: 60,
  communityQuota: 2,
  communityQuotaDays: 30,
  matchExpiryDays: 7,
  trialDays: 10,
  attachments: "ninguno",
  reportAlert: 3,
  affinityThreshold: 0,
};

export function readAdminParams(): AdminParams {
  if (remoteIdentityAvailable()) {
    const remote = peekRemoteAdminParams();
    if (remote) {
      return remote;
    }
    // Sin hidratar aún: defaults (no mezclar localStorage de otro navegador).
    return DEFAULT_ADMIN_PARAMS;
  }
  if (!canUseBrowserStorage()) {
    return DEFAULT_ADMIN_PARAMS;
  }
  const raw = readDurable(PARAMS_KEY);
  if (!raw) {
    return DEFAULT_ADMIN_PARAMS;
  }
  try {
    return normalizeParams(JSON.parse(raw) as Partial<AdminParams>);
  } catch {
    return DEFAULT_ADMIN_PARAMS;
  }
}

export function readParamVersions(): ParamVersion[] {
  if (remoteIdentityAvailable()) {
    const remote = peekRemoteParamVersions();
    if (remote.length > 0) {
      return remote;
    }
    const current = readAdminParams();
    return [{ version: 1, at: null, ...current }];
  }
  const stored = readStoredVersions();
  if (stored.length > 0) {
    return stored;
  }
  const current = readAdminParams();
  return [{ version: 1, at: null, ...current }];
}

export function saveAdminParams(next: AdminParams): AdminParams | string {
  if (remoteIdentityAvailable()) {
    return "Usa el guardado remoto de parámetros.";
  }
  if (!canUseBrowserStorage()) {
    return DEFAULT_ADMIN_PARAMS;
  }
  const previous = readAdminParams();
  const safe = normalizeParams(next);
  if (sameParams(safe, previous)) {
    return "Esos valores ya están vigentes.";
  }
  const stored = readStoredVersions();
  const history = stored.length > 0 ? stored : [{ version: 1, at: null, ...previous }];
  const entry: ParamVersion = {
    version: history[0].version + 1,
    at: new Date().toISOString(),
    ...safe,
  };
  writeDurable(PARAMS_KEY, JSON.stringify(safe));
  writeDurable(VERSIONS_KEY, JSON.stringify([entry, ...history].slice(0, 12)));
  appendLog(paramAuditText(entry.version, safe));
  return safe;
}

export async function refreshRemoteAdminParams() {
  if (!remoteIdentityAvailable()) {
    clearRemoteSettingsCache();
    return readAdminParams();
  }
  await refreshRemoteSettings();
  return readAdminParams();
}

export async function saveAdminParamsAsync(next: AdminParams): Promise<AdminParams | string> {
  const safe = normalizeParams(next);
  if (remoteIdentityAvailable()) {
    const saved = await saveRemoteAdminParams(safe);
    if (typeof saved === "string") {
      return saved;
    }
    const versions = peekRemoteParamVersions();
    const version = versions[0]?.version ?? 1;
    appendLog(paramAuditText(version, saved));
    return saved;
  }
  return saveAdminParams(safe);
}

export function readAttachmentPolicy(): AttachmentPolicy {
  return readAdminParams().attachments;
}

export function readReportAlert() {
  return readAdminParams().reportAlert;
}

export function readAffinityThreshold() {
  return readAdminParams().affinityThreshold;
}

/** Score 0–1 frente al umbral 0–100 de administración. */
export function meetsAffinityThreshold(score: number, threshold = readAffinityThreshold()) {
  return score * 100 >= threshold;
}

export function blockedAttachment() {
  return "No se envió: esta prueba no admite adjuntos. El chat es solo texto.";
}

export function readDailyMessageLimit(plan: "gratis" | "prueba" = "gratis") {
  const params = readAdminParams();
  return plan === "prueba" ? params.premiumDailyMessages : params.dailyMessages;
}

export function readSuspendedIds() {
  if (remoteIdentityAvailable()) {
    return peekRemoteSuspendedIds();
  }
  if (!canUseBrowserStorage()) {
    return [];
  }
  return readIds(SUSPEND_KEY);
}

export function setUserSuspended(id: string, name: string, suspended: boolean) {
  if (remoteIdentityAvailable()) {
    return;
  }
  if (!canUseBrowserStorage()) {
    return;
  }
  const current = readSuspendedIds();
  const next = suspended
    ? current.includes(id)
      ? current
      : [...current, id]
    : current.filter((item) => item !== id);
  writeDurable(SUSPEND_KEY, JSON.stringify(next));
  appendLog(suspended ? `Suspendió a ${name}.` : `Reactivó a ${name}.`);
}

export async function refreshRemoteSuspendedIds() {
  if (!remoteIdentityAvailable()) {
    clearRemoteSuspendedCache();
    return [];
  }
  return fetchRemoteSuspendedIds();
}

export async function setUserSuspendedAsync(
  id: string,
  name: string,
  suspended: boolean,
): Promise<string | null> {
  if (remoteIdentityAvailable()) {
    const reason = await setRemoteSuspended(id, suspended);
    if (reason) {
      return reason;
    }
    recordAudit(suspended ? `Suspendió a ${name}.` : `Reactivó a ${name}.`);
    return null;
  }
  setUserSuspended(id, name, suspended);
  return null;
}

export function readReviewedReports() {
  if (!canUseBrowserStorage()) {
    return [];
  }
  return readIds(REVIEW_KEY);
}

export function reviewReport(key: string, label: string) {
  if (!canUseBrowserStorage()) {
    return;
  }
  const current = readReviewedReports();
  if (current.includes(key)) {
    return;
  }
  writeDurable(REVIEW_KEY, JSON.stringify([...current, key]));
  appendLog(`Revisó el reporte: ${label}.`);
}

export function readAudit() {
  if (remoteIdentityAvailable()) {
    return peekRemoteAudit();
  }
  if (!canUseBrowserStorage()) {
    return [];
  }
  const raw = readDurable(LOG_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isAuditEntry);
  } catch {
    return [];
  }
}

export function recordAudit(text: string) {
  const safe = sanitizeAuditText(text);
  if (!safe) {
    return;
  }
  if (remoteIdentityAvailable()) {
    // Solo staff puede insertar (RLS). Fire-and-forget.
    void createRemoteAudit(safe);
    return;
  }
  if (!canUseBrowserStorage()) {
    return;
  }
  appendLog(safe);
}

export async function refreshRemoteAudit() {
  if (!remoteIdentityAvailable()) {
    clearRemoteAuditCache();
    return [];
  }
  return fetchRemoteAudit();
}

function paramAuditText(version: number, safe: AdminParams) {
  return `Guardó la versión ${version} de parámetros: Gratis ${safe.dailyMessages} / Premium ${safe.premiumDailyMessages} mensajes al día, ${safe.communityQuota} comunidades públicas cada ${safe.communityQuotaDays} días, match expira a ${safe.matchExpiryDays} días, prueba de ${safe.trialDays} días, adjuntos ${safe.attachments}, aviso a ${safe.reportAlert} reportes, umbral de afinidad ${safe.affinityThreshold}.`;
}

function sanitizeAuditText(text: string) {
  const safe = text.trim().slice(0, 280);
  if (!safe || hasContact(safe)) {
    return "";
  }
  return safe;
}

function hasContact(value: string) {
  return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(value) || /(?:\d[\s.-]?){7,}/.test(value);
}

function appendLog(text: string) {
  const next: AuditEntry[] = [
    { id: `log-${Date.now()}`, at: new Date().toISOString(), text },
    ...readLocalAudit(),
  ].slice(0, 20);
  writeDurable(LOG_KEY, JSON.stringify(next));
}

function readLocalAudit(): AuditEntry[] {
  if (!canUseBrowserStorage()) {
    return [];
  }
  const raw = readDurable(LOG_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isAuditEntry);
  } catch {
    return [];
  }
}

function readStoredVersions(): ParamVersion[] {
  if (!canUseBrowserStorage()) {
    return [];
  }
  const raw = readDurable(VERSIONS_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isParamVersion).map((entry) => ({
      ...normalizeParams(entry),
      version: entry.version,
      at: entry.at,
    }));
  } catch {
    return [];
  }
}

function normalizeParams(value: Partial<AdminParams>): AdminParams {
  return {
    dailyMessages: clamp(value.dailyMessages, 1, 100, DEFAULT_ADMIN_PARAMS.dailyMessages),
    premiumDailyMessages: clamp(
      value.premiumDailyMessages,
      1,
      200,
      DEFAULT_ADMIN_PARAMS.premiumDailyMessages,
    ),
    communityQuota: clamp(value.communityQuota, 1, 20, DEFAULT_ADMIN_PARAMS.communityQuota),
    communityQuotaDays: clamp(
      value.communityQuotaDays,
      1,
      90,
      DEFAULT_ADMIN_PARAMS.communityQuotaDays,
    ),
    matchExpiryDays: clamp(value.matchExpiryDays, 1, 30, DEFAULT_ADMIN_PARAMS.matchExpiryDays),
    trialDays: clamp(value.trialDays, 1, 30, DEFAULT_ADMIN_PARAMS.trialDays),
    attachments: "ninguno",
    reportAlert: clamp(value.reportAlert, 1, 20, DEFAULT_ADMIN_PARAMS.reportAlert),
    affinityThreshold: clamp(value.affinityThreshold, 0, 100, DEFAULT_ADMIN_PARAMS.affinityThreshold),
  };
}

function sameParams(left: AdminParams, right: AdminParams) {
  return (
    left.dailyMessages === right.dailyMessages &&
    left.premiumDailyMessages === right.premiumDailyMessages &&
    left.communityQuota === right.communityQuota &&
    left.communityQuotaDays === right.communityQuotaDays &&
    left.matchExpiryDays === right.matchExpiryDays &&
    left.trialDays === right.trialDays &&
    left.attachments === right.attachments &&
    left.reportAlert === right.reportAlert &&
    left.affinityThreshold === right.affinityThreshold
  );
}

function isParamVersion(value: unknown): value is ParamVersion {
  if (!value || typeof value !== "object") {
    return false;
  }
  const entry = value as Partial<ParamVersion>;
  if (
    typeof entry.version !== "number" ||
    (entry.at !== null && typeof entry.at !== "string") ||
    typeof entry.dailyMessages !== "number" ||
    typeof entry.communityQuota !== "number" ||
    typeof entry.trialDays !== "number"
  ) {
    return false;
  }
  return true;
}

function readIds(key: string) {
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

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(number)));
}

function isAuditEntry(value: unknown): value is AuditEntry {
  if (!value || typeof value !== "object") {
    return false;
  }
  const entry = value as Partial<AuditEntry>;
  return typeof entry.id === "string" && typeof entry.at === "string" && typeof entry.text === "string";
}
