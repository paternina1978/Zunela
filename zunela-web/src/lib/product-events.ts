import { remoteIdentityAvailable } from "@/lib/remote/identity";
import {
  clearRemoteProductEventCache,
  createRemoteProductEvent,
  fetchRemoteProductEvents,
  peekRemoteProductEvents,
} from "@/lib/remote/events";
import { canUseBrowserStorage, readDurable, writeDurable } from "@/lib/storage";

const EVENTS_KEY = "zunela.product-events";
/** Retención local del piloto (~ventana §12.1 sin saturar el navegador). */
const EVENT_LIMIT = 120;

export type ProductEvent = {
  id: string;
  at: string;
  text: string;
};

export function readProductEvents(): ProductEvent[] {
  if (remoteIdentityAvailable()) {
    return peekRemoteProductEvents();
  }
  if (!canUseBrowserStorage()) {
    return [];
  }
  const raw = readDurable(EVENTS_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isProductEvent).slice(0, EVENT_LIMIT);
  } catch {
    return [];
  }
}

/** Guarda actividad del piloto. En remoto: fire-and-forget; sin duplicar en localStorage. */
export function recordProductEvent(text: string) {
  const safe = sanitizeEventText(text);
  if (!safe) {
    return;
  }
  if (remoteIdentityAvailable()) {
    void createRemoteProductEvent(safe);
    return;
  }
  if (!canUseBrowserStorage()) {
    return;
  }
  const next: ProductEvent[] = [
    { id: `evt-${Date.now()}`, at: new Date().toISOString(), text: safe },
    ...readProductEvents(),
  ].slice(0, EVENT_LIMIT);
  writeDurable(EVENTS_KEY, JSON.stringify(next));
}

export async function recordProductEventAsync(text: string): Promise<string | null> {
  const safe = sanitizeEventText(text);
  if (!safe) {
    return "Evento inválido.";
  }
  if (remoteIdentityAvailable()) {
    return createRemoteProductEvent(safe);
  }
  recordProductEvent(safe);
  return null;
}

export async function refreshRemoteProductEvents() {
  if (!remoteIdentityAvailable()) {
    clearRemoteProductEventCache();
    return [];
  }
  return fetchRemoteProductEvents();
}

function sanitizeEventText(text: string) {
  const safe = text.trim().slice(0, 280);
  if (!safe || hasContact(safe)) {
    return "";
  }
  return safe;
}

function hasContact(value: string) {
  return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(value) || /(?:\d[\s.-]?){7,}/.test(value);
}

function isProductEvent(value: unknown): value is ProductEvent {
  if (!value || typeof value !== "object") {
    return false;
  }
  const entry = value as Partial<ProductEvent>;
  return typeof entry.id === "string" && typeof entry.at === "string" && typeof entry.text === "string";
}
