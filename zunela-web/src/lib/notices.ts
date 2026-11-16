import { readAccount } from "@/lib/account";
import { remoteIdentityAvailable } from "@/lib/remote/identity";
import {
  clearRemoteNotices,
  createRemoteNotice,
  fetchRemoteNotices,
  markRemoteNoticesSeen,
  notifyRemoteUser,
  peekRemoteNotices,
} from "@/lib/remote/notices";
import { canUseBrowserStorage, readDurable, removeDurable, writeDurable } from "@/lib/storage";

const NOTICES_KEY = "zunela.notices";

export type NoticeKind = "match" | "mensaje" | "comunidad" | "cuenta";

export type Notice = {
  id: string;
  at: string;
  kind: NoticeKind;
  text: string;
  source: string;
  seen: boolean;
};

/** Guarda el aviso aunque la preferencia esté apagada; la lista visible sí filtra. */
export function recordNotice(kind: NoticeKind, text: string, source = "") {
  if (!canUseBrowserStorage()) {
    return;
  }
  const safe = text.trim();
  if (!safe || safe.length > 140 || hasContact(safe)) {
    return;
  }
  if (remoteIdentityAvailable()) {
    // Fire-and-forget persistencia remota; la UI se refresca al hidratar.
    void createRemoteNotice(kind, safe, source).then(() => emitNoticesChanged());
  }
  const current = readLocalAll();
  if (source && current.some((item) => item.source === source)) {
    return;
  }
  // En remoto no duplicamos en localStorage salvo fallback offline de la sesión.
  if (remoteIdentityAvailable()) {
    return;
  }
  const next: Notice[] = [
    {
      id: `aviso-${Date.now()}`,
      at: new Date().toISOString(),
      kind,
      text: safe,
      source,
      seen: false,
    },
    ...current,
  ].slice(0, 30);
  writeDurable(NOTICES_KEY, JSON.stringify(next));
  emitNoticesChanged();
}

export async function recordNoticeAsync(kind: NoticeKind, text: string, source = "") {
  const safe = text.trim();
  if (!safe || safe.length > 140 || hasContact(safe)) {
    return "Aviso inválido.";
  }
  if (remoteIdentityAvailable()) {
    const reason = await createRemoteNotice(kind, safe, source);
    if (reason) {
      return reason;
    }
    emitNoticesChanged();
    return null;
  }
  recordNotice(kind, safe, source);
  return null;
}

/** Avisa a otro usuario (UUID) sin escribir en la bandeja local propia. */
export async function notifyOtherUserAsync(
  userId: string,
  kind: NoticeKind,
  text: string,
  source = "",
) {
  if (!remoteIdentityAvailable()) {
    return null;
  }
  const safe = text.trim();
  if (!safe || safe.length > 140 || hasContact(safe)) {
    return "Aviso inválido.";
  }
  return notifyRemoteUser(userId, kind, safe, source);
}

export async function refreshRemoteNotices() {
  if (!remoteIdentityAvailable()) {
    return [];
  }
  return fetchRemoteNotices();
}

export function readVisibleNotices() {
  return readMerged().filter((item) => kindEnabled(item.kind));
}

export function readAllNotices() {
  return readMerged();
}

export function hiddenNoticeCount() {
  return readMerged().filter((item) => !kindEnabled(item.kind)).length;
}

export function unreadVisibleCount() {
  return readVisibleNotices().filter((item) => !item.seen).length;
}

export function markNoticesSeen(ids?: string[]) {
  if (remoteIdentityAvailable()) {
    void markRemoteNoticesSeen(ids).then(() => emitNoticesChanged());
    return;
  }
  if (!canUseBrowserStorage()) {
    return;
  }
  const selected = ids ? new Set(ids) : null;
  const next = readLocalAll().map((item) => {
    if (!kindEnabled(item.kind)) {
      return item;
    }
    if (selected && !selected.has(item.id)) {
      return item;
    }
    return { ...item, seen: true };
  });
  writeDurable(NOTICES_KEY, JSON.stringify(next));
  emitNoticesChanged();
}

export async function markNoticesSeenAsync(ids?: string[]) {
  if (remoteIdentityAvailable()) {
    const reason = await markRemoteNoticesSeen(ids);
    if (reason) {
      return reason;
    }
    emitNoticesChanged();
    return null;
  }
  markNoticesSeen(ids);
  return null;
}

export function clearNotices() {
  if (remoteIdentityAvailable()) {
    void clearRemoteNotices().then(() => emitNoticesChanged());
    return;
  }
  if (!canUseBrowserStorage()) {
    return;
  }
  removeDurable(NOTICES_KEY);
  emitNoticesChanged();
}

export async function clearNoticesAsync() {
  if (remoteIdentityAvailable()) {
    const reason = await clearRemoteNotices();
    if (reason) {
      return reason;
    }
    emitNoticesChanged();
    return null;
  }
  clearNotices();
  return null;
}

export function noticeKindLabel(kind: NoticeKind) {
  if (kind === "match") {
    return "Conexión";
  }
  if (kind === "mensaje") {
    return "Mensaje";
  }
  if (kind === "cuenta") {
    return "Cuenta";
  }
  return "Comunidad";
}

export function kindEnabled(kind: NoticeKind) {
  if (kind === "cuenta") {
    return true;
  }
  const notifications = readAccount().notifications;
  if (kind === "match") {
    return notifications.matches;
  }
  if (kind === "mensaje") {
    return notifications.messages;
  }
  return notifications.communities;
}

function readMerged(): Notice[] {
  if (remoteIdentityAvailable()) {
    return peekRemoteNotices();
  }
  return readLocalAll();
}

function readLocalAll(): Notice[] {
  if (!canUseBrowserStorage()) {
    return [];
  }
  const raw = readDurable(NOTICES_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isNotice).map((item) => ({
      ...item,
      seen: item.seen === true,
    }));
  } catch {
    return [];
  }
}

function emitNoticesChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("zunela-notices"));
  }
}

function hasContact(value: string) {
  return /[^\s@]+@[^\s@]+\.[^\s@]+/.test(value) || /(?:\d[\s.-]?){7,}/.test(value);
}

function isNotice(value: unknown): value is Notice {
  if (!value || typeof value !== "object") {
    return false;
  }
  const notice = value as Partial<Notice>;
  return (
    typeof notice.id === "string" &&
    typeof notice.at === "string" &&
    (notice.kind === "match" ||
      notice.kind === "mensaje" ||
      notice.kind === "comunidad" ||
      notice.kind === "cuenta") &&
    typeof notice.text === "string" &&
    typeof notice.source === "string"
  );
}
