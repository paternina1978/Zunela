import { readAdminParams } from "@/lib/admin";
import { clearContactGrant } from "@/lib/contact-store";
import { revokeRemoteContact } from "@/lib/remote/contacts";
import { readBackendMode } from "@/lib/backend-mode";
import { findCatalogEntry, isDemoCatalogId, readSentInterest, saveSentInterest } from "@/lib/discover";
import { remoteAuthUserId } from "@/lib/remote/catalog";
import { notifyOtherUserAsync, recordNotice, recordNoticeAsync } from "@/lib/notices";
import { readProfile } from "@/lib/profile";
import { readSession } from "@/lib/session";
import { recordProductEvent } from "@/lib/product-events";
import {
  fetchRemoteMatchSnapshot,
  isRemotePersonId,
  remoteAccept,
  remoteBlock,
  remoteDecline,
  remoteOfferInterest,
  remoteUnblock,
  remoteWithdraw,
  type RemoteMatchSnapshot,
} from "@/lib/remote/connections";
import { remoteIdentityAvailable } from "@/lib/remote/identity";
import { canUseBrowserStorage, readDurable, writeDurable } from "@/lib/storage";

const MATCH_KEY = "zunela.matches";
const DAY_MS = 24 * 60 * 60 * 1000;

/** Solo demo local. */
const SAMPLE_INCOMING = ["valentina-ruiz", "andres-molina"];

function allowDemoMatches() {
  return readBackendMode() === "local";
}

function stripDemoIds(ids: string[]) {
  if (allowDemoMatches()) {
    return ids;
  }
  return ids.filter((id) => !isDemoCatalogId(id) && !SAMPLE_INCOMING.includes(id));
}

export type MatchBook = {
  incoming: string[];
  accepted: string[];
  declined: string[];
  blocked: string[];
  expired: string[];
  pendingAt: Record<string, string>;
};

const EMPTY_BOOK: MatchBook = {
  incoming: [],
  accepted: [],
  declined: [],
  blocked: [],
  expired: [],
  pendingAt: {},
};

let remoteSnapshot: RemoteMatchSnapshot | null = null;

/** Carga conexiones UUID desde Supabase y las fusiona en lecturas locales. */
export async function refreshRemoteMatchCache() {
  if (!remoteIdentityAvailable()) {
    remoteSnapshot = null;
    return;
  }
  remoteSnapshot = await fetchRemoteMatchSnapshot();
  if (!remoteSnapshot) {
    return;
  }
  const sent = readSentInterest();
  const remoteIds = new Set(remoteSnapshot.sentPersonas);
  const localOnly = sent.personas.filter((id) => !isRemotePersonId(id));
  saveSentInterest({
    ...sent,
    personas: [...new Set([...localOnly, ...remoteSnapshot.sentPersonas])],
  });
  void remoteIds;
}

export function readMatchBook(): MatchBook {
  if (!canUseBrowserStorage()) {
    return mergeWithRemote(EMPTY_BOOK);
  }
  const raw = readDurable(MATCH_KEY);
  if (!raw) {
    if (!allowDemoMatches()) {
      writeDurable(MATCH_KEY, JSON.stringify(EMPTY_BOOK));
      return mergeWithRemote(EMPTY_BOOK);
    }
    const now = new Date().toISOString();
    const seeded: MatchBook = {
      incoming: [...SAMPLE_INCOMING],
      accepted: [],
      declined: [],
      blocked: [],
      expired: [],
      pendingAt: Object.fromEntries(SAMPLE_INCOMING.map((id) => [id, now])),
    };
    writeDurable(MATCH_KEY, JSON.stringify(seeded));
    return mergeWithRemote(seeded);
  }
  try {
    const parsed = JSON.parse(raw) as Partial<MatchBook>;
    let book: MatchBook = {
      incoming: asIds(parsed.incoming),
      accepted: asIds(parsed.accepted),
      declined: asIds(parsed.declined),
      blocked: asIds(parsed.blocked),
      expired: asIds(parsed.expired),
      pendingAt: asPendingMap(parsed.pendingAt),
    };
    if (!allowDemoMatches()) {
      const cleaned: MatchBook = {
        incoming: stripDemoIds(book.incoming),
        accepted: stripDemoIds(book.accepted),
        declined: stripDemoIds(book.declined),
        blocked: stripDemoIds(book.blocked),
        expired: stripDemoIds(book.expired),
        pendingAt: Object.fromEntries(
          Object.entries(book.pendingAt).filter(([id]) => !isDemoCatalogId(id)),
        ),
      };
      if (
        cleaned.incoming.length !== book.incoming.length ||
        cleaned.accepted.length !== book.accepted.length
      ) {
        writeDurable(MATCH_KEY, JSON.stringify(cleaned));
      }
      book = cleaned;
    }
    return mergeWithRemote(expirePending(ensurePendingStarts(book)));
  } catch {
    return mergeWithRemote(EMPTY_BOOK);
  }
}

function mergeWithRemote(local: MatchBook): MatchBook {
  if (!remoteSnapshot) {
    return local;
  }
  const remote = remoteSnapshot.book;
  const stripRemote = (ids: string[]) => ids.filter((id) => !isRemotePersonId(id));
  const pendingAt = { ...local.pendingAt };
  for (const id of Object.keys(pendingAt)) {
    if (isRemotePersonId(id)) {
      delete pendingAt[id];
    }
  }
  Object.assign(pendingAt, remote.pendingAt);
  return {
    incoming: [...stripRemote(local.incoming), ...remote.incoming],
    accepted: [...stripRemote(local.accepted), ...remote.accepted],
    declined: [...stripRemote(local.declined), ...remote.declined],
    blocked: [...stripRemote(local.blocked), ...remote.blocked],
    expired: [...stripRemote(local.expired), ...remote.expired],
    pendingAt,
  };
}

export function readBlockedIds() {
  return readMatchBook().blocked;
}

export function canOfferMatchInterest(personId: string) {
  const book = readMatchBook();
  if (book.blocked.includes(personId)) {
    return "Esta persona está bloqueada.";
  }
  if (book.declined.includes(personId)) {
    return "Rechazaste esta solicitud. No se reactiva sola.";
  }
  return null;
}

/** Marca una solicitud saliente para el ciclo de expiración. */
export function noteOutgoingInterest(personId: string) {
  if (isRemotePersonId(personId)) {
    return;
  }
  const book = readLocalMatchBook();
  if (book.accepted.includes(personId) || book.blocked.includes(personId) || book.declined.includes(personId)) {
    return;
  }
  const pendingAt = { ...book.pendingAt, [personId]: book.pendingAt[personId] ?? new Date().toISOString() };
  saveMatchBook({
    ...book,
    expired: book.expired.filter((id) => id !== personId),
    pendingAt,
  });
}

export async function noteOutgoingInterestAsync(personId: string): Promise<string | null> {
  if (remoteIdentityAvailable() && isRemotePersonId(personId)) {
    const reason = await remoteOfferInterest(personId);
    if (reason) {
      return reason;
    }
    await refreshRemoteMatchCache();
    const sent = readSentInterest();
    if (!sent.personas.includes(personId)) {
      saveSentInterest({ ...sent, personas: [...sent.personas, personId] });
    }
    recordProductEvent(`Envió interés a ${publicName(personId)}.`);
    const myName = readProfile()?.visibleName || readSession()?.visibleName || "Alguien";
    const me = await remoteAuthUserId();
    if (me) {
      await notifyOtherUserAsync(personId, "match", `${myName} te envió interés.`, `match-in-${me}`);
    }
    return null;
  }
  noteOutgoingInterest(personId);
  return null;
}

export function blockPerson(personId: string) {
  if (isRemotePersonId(personId)) {
    return;
  }
  const book = readLocalMatchBook();
  const blocked = book.blocked.includes(personId) ? book.blocked : [...book.blocked, personId];
  const pendingAt = { ...book.pendingAt };
  delete pendingAt[personId];
  saveMatchBook({
    ...book,
    blocked,
    accepted: book.accepted.filter((id) => id !== personId),
    incoming: book.incoming.filter((id) => id !== personId),
    expired: book.expired.filter((id) => id !== personId),
    pendingAt,
  });
  const sent = readSentInterest();
  if (sent.personas.includes(personId)) {
    saveSentInterest({
      ...sent,
      personas: sent.personas.filter((id) => id !== personId),
    });
  }
  clearContactGrant(personId);
  recordProductEvent(`Bloqueó a ${publicName(personId)}.`);
}

export async function blockPersonAsync(personId: string): Promise<string | null> {
  if (remoteIdentityAvailable() && isRemotePersonId(personId)) {
    const reason = await remoteBlock(personId);
    if (reason) {
      return reason;
    }
    await refreshRemoteMatchCache();
    await revokeRemoteContact(personId);
    recordProductEvent(`Bloqueó a ${publicName(personId)}.`);
    return null;
  }
  blockPerson(personId);
  return null;
}

export function unblockPerson(personId: string) {
  if (isRemotePersonId(personId)) {
    return;
  }
  const book = readLocalMatchBook();
  saveMatchBook({
    ...book,
    blocked: book.blocked.filter((id) => id !== personId),
  });
  recordProductEvent(`Desbloqueó a ${publicName(personId)}.`);
}

export async function unblockPersonAsync(personId: string): Promise<string | null> {
  if (remoteIdentityAvailable() && isRemotePersonId(personId)) {
    const reason = await remoteUnblock(personId);
    if (reason) {
      return reason;
    }
    await refreshRemoteMatchCache();
    recordProductEvent(`Desbloqueó a ${publicName(personId)}.`);
    return null;
  }
  unblockPerson(personId);
  return null;
}

export function acceptMatch(personId: string) {
  if (isRemotePersonId(personId)) {
    return;
  }
  const book = readLocalMatchBook();
  if (book.blocked.includes(personId) || book.declined.includes(personId)) {
    return;
  }
  const already = book.accepted.includes(personId);
  const accepted = already ? book.accepted : [...book.accepted, personId];
  const pendingAt = { ...book.pendingAt };
  delete pendingAt[personId];
  saveMatchBook({
    ...book,
    accepted,
    declined: book.declined.filter((id) => id !== personId),
    expired: book.expired.filter((id) => id !== personId),
    incoming: book.incoming.filter((id) => id !== personId),
    pendingAt,
  });
  const sent = readSentInterest();
  if (!sent.personas.includes(personId)) {
    saveSentInterest({ ...sent, personas: [...sent.personas, personId] });
  }
  recordProductEvent(`Aceptó la conexión con ${publicName(personId)}.`);
  if (!already) {
    recordNotice("match", `Aceptaste la conexión con ${publicName(personId)}.`);
  }
}

export async function acceptMatchAsync(personId: string): Promise<string | null> {
  if (remoteIdentityAvailable() && isRemotePersonId(personId)) {
    const reason = await remoteAccept(personId);
    if (reason) {
      return reason;
    }
    await refreshRemoteMatchCache();
    recordProductEvent(`Aceptó la conexión con ${publicName(personId)}.`);
    await recordNoticeAsync("match", `Aceptaste la conexión con ${publicName(personId)}.`);
    const myName = readProfile()?.visibleName || readSession()?.visibleName || "Alguien";
    const me = await remoteAuthUserId();
    if (me) {
      await notifyOtherUserAsync(personId, "match", `${myName} aceptó la conexión.`, `match-accepted-${me}`);
    }
    return null;
  }
  acceptMatch(personId);
  return null;
}

export function declineMatch(personId: string) {
  if (isRemotePersonId(personId)) {
    return;
  }
  const book = readLocalMatchBook();
  const pendingAt = { ...book.pendingAt };
  delete pendingAt[personId];
  saveMatchBook({
    ...book,
    declined: book.declined.includes(personId) ? book.declined : [...book.declined, personId],
    accepted: book.accepted.filter((id) => id !== personId),
    incoming: book.incoming.filter((id) => id !== personId),
    expired: book.expired.filter((id) => id !== personId),
    pendingAt,
  });
  const sent = readSentInterest();
  if (sent.personas.includes(personId)) {
    saveSentInterest({
      ...sent,
      personas: sent.personas.filter((id) => id !== personId),
    });
  }
  clearContactGrant(personId);
  recordProductEvent(`Rechazó la solicitud de ${publicName(personId)}.`);
}

export async function declineMatchAsync(personId: string): Promise<string | null> {
  if (remoteIdentityAvailable() && isRemotePersonId(personId)) {
    const reason = await remoteDecline(personId);
    if (reason) {
      return reason;
    }
    await refreshRemoteMatchCache();
    await revokeRemoteContact(personId);
    recordProductEvent(`Rechazó la solicitud de ${publicName(personId)}.`);
    return null;
  }
  declineMatch(personId);
  return null;
}

export function activeConnectionIds() {
  const sent = new Set(readSentInterest().personas);
  const blocked = new Set(readMatchBook().blocked);
  return readMatchBook().accepted.filter((id) => sent.has(id) && !blocked.has(id));
}

export function withdrawMatch(personId: string) {
  if (isRemotePersonId(personId)) {
    return;
  }
  const sent = readSentInterest();
  saveSentInterest({
    ...sent,
    personas: sent.personas.filter((id) => id !== personId),
  });
  const book = readLocalMatchBook();
  const pendingAt = { ...book.pendingAt };
  delete pendingAt[personId];
  saveMatchBook({
    ...book,
    accepted: book.accepted.filter((id) => id !== personId),
    pendingAt,
  });
  clearContactGrant(personId);
  recordProductEvent(`Retiró la conexión con ${publicName(personId)}.`);
}

export async function withdrawMatchAsync(personId: string): Promise<string | null> {
  if (remoteIdentityAvailable() && isRemotePersonId(personId)) {
    const reason = await remoteWithdraw(personId);
    if (reason) {
      return reason;
    }
    await refreshRemoteMatchCache();
    const sent = readSentInterest();
    saveSentInterest({
      ...sent,
      personas: sent.personas.filter((id) => id !== personId),
    });
    await revokeRemoteContact(personId);
    recordProductEvent(`Retiró la conexión con ${publicName(personId)}.`);
    return null;
  }
  withdrawMatch(personId);
  return null;
}

/** Libro solo durable local (sin fusionar remoto). */
function readLocalMatchBook(): MatchBook {
  if (!canUseBrowserStorage()) {
    return EMPTY_BOOK;
  }
  const raw = readDurable(MATCH_KEY);
  if (!raw) {
    return EMPTY_BOOK;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<MatchBook>;
    return {
      incoming: asIds(parsed.incoming),
      accepted: asIds(parsed.accepted),
      declined: asIds(parsed.declined),
      blocked: asIds(parsed.blocked),
      expired: asIds(parsed.expired),
      pendingAt: asPendingMap(parsed.pendingAt),
    };
  } catch {
    return EMPTY_BOOK;
  }
}

function ensurePendingStarts(book: MatchBook) {
  const pendingAt = { ...book.pendingAt };
  const now = new Date().toISOString();
  let changed = false;
  for (const id of book.incoming) {
    if (isRemotePersonId(id)) {
      continue;
    }
    if (!pendingAt[id]) {
      pendingAt[id] = now;
      changed = true;
    }
  }
  for (const id of readSentInterest().personas.filter((item) => !isRemotePersonId(item))) {
    if (
      !book.accepted.includes(id) &&
      !book.declined.includes(id) &&
      !book.blocked.includes(id) &&
      !pendingAt[id]
    ) {
      pendingAt[id] = now;
      changed = true;
    }
  }
  if (!changed) {
    return book;
  }
  const next = { ...book, pendingAt };
  saveMatchBook(next);
  return next;
}

function expirePending(book: MatchBook) {
  const days = readAdminParams().matchExpiryDays;
  const cutoff = Date.now() - days * DAY_MS;
  const sent = new Set(readSentInterest().personas.filter((id) => !isRemotePersonId(id)));
  const accepted = new Set(book.accepted);
  const declined = new Set(book.declined);
  const blocked = new Set(book.blocked);
  let changed = false;
  const pendingAt = { ...book.pendingAt };
  const expired = new Set(book.expired);
  const incoming = book.incoming.filter((id) => {
    if (isRemotePersonId(id)) {
      return true;
    }
    if (accepted.has(id) || declined.has(id) || blocked.has(id)) {
      return false;
    }
    const at = pendingAt[id];
    if (at && new Date(at).getTime() < cutoff) {
      expired.add(id);
      delete pendingAt[id];
      changed = true;
      return false;
    }
    return true;
  });

  const dropSent: string[] = [];
  for (const id of sent) {
    if (accepted.has(id) || declined.has(id) || blocked.has(id) || incoming.includes(id)) {
      continue;
    }
    const at = pendingAt[id];
    if (at && new Date(at).getTime() < cutoff) {
      expired.add(id);
      delete pendingAt[id];
      dropSent.push(id);
      changed = true;
    }
  }

  if (dropSent.length > 0) {
    const current = readSentInterest();
    saveSentInterest({
      ...current,
      personas: current.personas.filter((id) => !dropSent.includes(id)),
    });
  }

  const next: MatchBook = {
    ...book,
    incoming,
    expired: [...expired],
    pendingAt,
  };

  if (changed || incoming.length !== book.incoming.length || next.expired.length !== book.expired.length) {
    saveMatchBook(next);
    for (const id of dropSent) {
      recordProductEvent(`Expiró la solicitud enviada a ${publicName(id)}.`);
    }
  }
  return next;
}

function publicName(personId: string) {
  return findCatalogEntry(personId)?.title ?? "una persona";
}

function saveMatchBook(book: MatchBook) {
  writeDurable(MATCH_KEY, JSON.stringify(book));
}

function asIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function asPendingMap(value: unknown) {
  if (!value || typeof value !== "object") {
    return {};
  }
  const next: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === "string" && entry.length > 0) {
      next[key] = entry;
    }
  }
  return next;
}
