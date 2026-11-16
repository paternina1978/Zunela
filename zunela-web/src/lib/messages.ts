import { readActivePlan } from "@/lib/account";
import { readDailyMessageLimit } from "@/lib/admin";
import {
  communitySentTodayCount,
  findCatalogEntry,
  refreshRemoteCommunitySentToday,
} from "@/lib/discover";
import { activeConnectionIds } from "@/lib/matches";
import { notifyOtherUserAsync, recordNotice, recordNoticeAsync } from "@/lib/notices";
import { recordProductEvent } from "@/lib/product-events";
import { blockedOutboundText } from "@/lib/chat-rules";
import { remoteAuthUserId } from "@/lib/remote/catalog";
import { isRemotePersonId } from "@/lib/remote/connections";
import { remoteIdentityAvailable } from "@/lib/remote/identity";
import {
  countRemoteSentToday,
  fetchRemoteThread,
  sendRemotePrivateMessage,
} from "@/lib/remote/messages";
import { readProfile } from "@/lib/profile";
import { recordPrivateReport, recordPrivateReportAsync, reportKeys } from "@/lib/reports";
import { readSession } from "@/lib/session";
import { readDurable, writeDurable } from "@/lib/storage";

const CHAT_KEY = "zunela.private-chat";
const REPORT_KEY = "zunela.private-reports";

export const FREE_DAILY_LIMIT = 20;

export type PrivateMessage = {
  id: string;
  from: "me" | "them";
  body: string;
  at: string;
};

let remoteSentToday = 0;
const remoteThreadCache = new Map<string, PrivateMessage[]>();

const SEEDS: Record<string, string> = {
  "valentina-ruiz":
    "Hola. Vi que buscas mentoría. Podemos ordenar la idea en este chat, sin compartir correos.",
};

export function isChatOpen(personId: string) {
  return activeConnectionIds().includes(personId);
}

export function readThread(personId: string) {
  if (isRemotePersonId(personId)) {
    return remoteThreadCache.get(personId) ?? [];
  }
  const all = readMap();
  if (!all[personId] && isChatOpen(personId) && SEEDS[personId]) {
    all[personId] = [
      {
        id: `seed-${personId}`,
        from: "them",
        body: SEEDS[personId],
        at: new Date().toISOString(),
      },
    ];
    writeDurable(CHAT_KEY, JSON.stringify(all));
    const name = findCatalogEntry(personId)?.title ?? "Alguien";
    recordNotice("mensaje", `${name} escribió en una conexión.`, `mensaje-seed-${personId}`);
  }
  return all[personId] ?? [];
}

export async function refreshRemoteMessageState(personId?: string) {
  if (!remoteIdentityAvailable()) {
    remoteSentToday = 0;
    remoteThreadCache.clear();
    return;
  }
  remoteSentToday = await countRemoteSentToday();
  await refreshRemoteCommunitySentToday();
  if (personId && isRemotePersonId(personId)) {
    remoteThreadCache.set(personId, await fetchRemoteThread(personId));
  }
}

export async function readThreadAsync(personId: string) {
  if (remoteIdentityAvailable() && isRemotePersonId(personId)) {
    const thread = await fetchRemoteThread(personId);
    remoteThreadCache.set(personId, thread);
    return thread;
  }
  return readThread(personId);
}

export function sentTodayCount() {
  const start = startOfToday();
  return Object.values(readMap())
    .flat()
    .filter((message) => message.from === "me" && new Date(message.at).getTime() >= start).length;
}

/** Cupo diario del plan: chat privado + chats de comunidad. */
export function outboundTodayCount(authorName?: string) {
  const name =
    authorName?.trim() ||
    readProfile()?.visibleName.trim() ||
    readSession()?.visibleName.trim() ||
    "Tú";
  return sentTodayCount() + remoteSentToday + communitySentTodayCount(name);
}

export function sendPrivateMessage(personId: string, body: string) {
  if (isRemotePersonId(personId)) {
    return "Usa el envío remoto para esta conversación.";
  }
  if (!isChatOpen(personId)) {
    return "Esta conversación no está abierta.";
  }
  const reason = blockedPrivateMessage(body);
  if (reason) {
    return reason;
  }
  const limit = readDailyMessageLimit(readActivePlan());
  if (outboundTodayCount() >= limit) {
    return `Llegaste al límite de ${limit} mensajes de hoy (privado y comunidad).`;
  }
  const all = readMap();
  const thread = all[personId] ?? [];
  thread.push({
    id: `me-${Date.now()}`,
    from: "me",
    body: body.trim(),
    at: new Date().toISOString(),
  });
  all[personId] = thread;
  writeDurable(CHAT_KEY, JSON.stringify(all));
  recordProductEvent("Envió un mensaje en una conexión.");
  recordNotice("mensaje", "Enviaste un mensaje en una conexión.", `mensaje-${personId}`);
  return null;
}

export async function sendPrivateMessageAsync(personId: string, body: string) {
  if (remoteIdentityAvailable() && isRemotePersonId(personId)) {
    if (!isChatOpen(personId)) {
      return "Esta conversación no está abierta.";
    }
    const reason = blockedPrivateMessage(body);
    if (reason) {
      return reason;
    }
    const limit = readDailyMessageLimit(readActivePlan());
    if (outboundTodayCount() >= limit) {
      return `Llegaste al límite de ${limit} mensajes de hoy (privado y comunidad).`;
    }
    const remoteReason = await sendRemotePrivateMessage(personId, body);
    if (remoteReason) {
      return remoteReason;
    }
    await refreshRemoteMessageState(personId);
    recordProductEvent("Envió un mensaje en una conexión.");
    await recordNoticeAsync("mensaje", "Enviaste un mensaje en una conexión.", `mensaje-out-${personId}`);
    const myName = readProfile()?.visibleName || readSession()?.visibleName || "Alguien";
    const me = await remoteAuthUserId();
    if (me) {
      await notifyOtherUserAsync(personId, "mensaje", `${myName} escribió en una conexión.`, `mensaje-${me}`);
    }
    return null;
  }
  return sendPrivateMessage(personId, body);
}

export function blockedPrivateMessage(value: string) {
  return blockedOutboundText(value, { scope: "chat" });
}

export function readPrivateReports() {
  const fromLedger = reportKeys("privado");
  if (fromLedger.length > 0) {
    return fromLedger;
  }
  return readIds(REPORT_KEY);
}

export function reportPrivateMessage(personId: string, messageId: string) {
  recordPrivateReport(personId, messageId);
}

export async function reportPrivateMessageAsync(personId: string, messageId: string) {
  return recordPrivateReportAsync(personId, messageId);
}

function readMap() {
  const raw = readDurable(CHAT_KEY);
  if (!raw) {
    return {} as Record<string, PrivateMessage[]>;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed as Record<string, PrivateMessage[]>;
  } catch {
    return {};
  }
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

function startOfToday() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start.getTime();
}
