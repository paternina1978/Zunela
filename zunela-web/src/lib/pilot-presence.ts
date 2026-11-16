import { remoteIdentityAvailable } from "@/lib/remote/identity";
import {
  clearRemotePresenceCache,
  fetchRemotePilotPresence,
  peekRemotePilotPresence,
  touchRemotePilotPresence,
} from "@/lib/remote/presence";
import { canUseBrowserStorage, readDurable, writeDurable } from "@/lib/storage";

const PRESENCE_KEY = "zunela.pilot-presence";
const DAY_MS = 24 * 60 * 60 * 1000;

export type PilotPresence = {
  firstSeenAt: string;
  lastSeenAt: string;
};

export function touchPilotPresence(): PilotPresence | null {
  if (remoteIdentityAvailable()) {
    void touchRemotePilotPresence();
    return peekRemotePilotPresence() ?? readLocalPresence();
  }
  if (!canUseBrowserStorage()) {
    return null;
  }
  const now = new Date().toISOString();
  const current = readLocalPresence();
  if (!current) {
    const next = { firstSeenAt: now, lastSeenAt: now };
    writeDurable(PRESENCE_KEY, JSON.stringify(next));
    return next;
  }
  const next = { ...current, lastSeenAt: now };
  writeDurable(PRESENCE_KEY, JSON.stringify(next));
  return next;
}

export async function touchPilotPresenceAsync(): Promise<PilotPresence | null> {
  if (remoteIdentityAvailable()) {
    return touchRemotePilotPresence();
  }
  return touchPilotPresence();
}

export function readPilotPresence(): PilotPresence | null {
  if (remoteIdentityAvailable()) {
    return peekRemotePilotPresence();
  }
  return readLocalPresence();
}

export async function refreshRemotePilotPresence() {
  if (!remoteIdentityAvailable()) {
    clearRemotePresenceCache();
    return null;
  }
  return fetchRemotePilotPresence();
}

export function retentionFlags(presence = readPilotPresence()) {
  if (!presence) {
    return { daysActive: 0, d7: false, d30: false };
  }
  const first = new Date(presence.firstSeenAt).getTime();
  const last = new Date(presence.lastSeenAt).getTime();
  if (!Number.isFinite(first) || !Number.isFinite(last) || last < first) {
    return { daysActive: 0, d7: false, d30: false };
  }
  const daysActive = Math.max(0, Math.floor((last - first) / DAY_MS));
  return {
    daysActive,
    d7: daysActive >= 7,
    d30: daysActive >= 30,
  };
}

function readLocalPresence(): PilotPresence | null {
  if (!canUseBrowserStorage()) {
    return null;
  }
  const raw = readDurable(PRESENCE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<PilotPresence>;
    if (typeof parsed.firstSeenAt !== "string" || typeof parsed.lastSeenAt !== "string") {
      return null;
    }
    return { firstSeenAt: parsed.firstSeenAt, lastSeenAt: parsed.lastSeenAt };
  } catch {
    return null;
  }
}
