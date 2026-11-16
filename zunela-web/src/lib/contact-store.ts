import { findCatalogEntry } from "@/lib/discover";
import { recordProductEvent } from "@/lib/product-events";
import { peekRemotePerson } from "@/lib/remote/catalog";
import { isRemotePersonId } from "@/lib/remote/connections";
import {
  fetchRemoteContactState,
  peekRemoteContactState,
  type RemoteContactState,
} from "@/lib/remote/contacts";
import { remoteIdentityAvailable } from "@/lib/remote/identity";
import { canUseBrowserStorage, readDurable, writeDurable } from "@/lib/storage";

const CONTACT_KEY = "zunela.contact-requests";

export type ContactConsent = {
  personId: string;
  mine: boolean;
  theirs: boolean;
};

export type RevealedContact = {
  email: string;
  phone: string;
  note: string;
};

/** Autorizaste compartir tu contacto (aún puede faltar la otra parte). */
export function contactIsGranted(personId: string) {
  if (isRemotePersonId(personId)) {
    return peekRemoteContactState(personId).mine;
  }
  return Boolean(readConsent(personId)?.mine);
}

/** Las dos partes aceptaron: se puede mostrar el contacto de prueba. */
export function contactIsShared(personId: string) {
  if (isRemotePersonId(personId)) {
    const state = peekRemoteContactState(personId);
    return Boolean(state.mine && state.theirs);
  }
  const row = readConsent(personId);
  return Boolean(row?.mine && row.theirs);
}

export function counterpartAcceptedContact(personId: string) {
  if (isRemotePersonId(personId)) {
    return peekRemoteContactState(personId).theirs;
  }
  return Boolean(readConsent(personId)?.theirs);
}

export async function refreshRemoteContactState(personId: string): Promise<RemoteContactState | null> {
  if (!remoteIdentityAvailable() || !isRemotePersonId(personId)) {
    return null;
  }
  return fetchRemoteContactState(personId);
}

export function saveContactGrant(personId: string) {
  if (isRemotePersonId(personId)) {
    return;
  }
  const current = readConsent(personId);
  writeConsent({
    personId,
    mine: true,
    theirs: current?.theirs ?? false,
  });
  recordProductEvent(`Autorizó compartir su contacto con ${publicName(personId)}.`);
}

/** Piloto local: registra la aceptación de la contraparte (no hay segundo usuario real). */
export function acceptCounterpartContact(personId: string) {
  if (isRemotePersonId(personId)) {
    return "En remoto la otra persona debe autorizar desde su cuenta.";
  }
  const current = readConsent(personId);
  if (!current?.mine) {
    return "Primero autoriza tu contacto.";
  }
  if (current.theirs) {
    return null;
  }
  writeConsent({ ...current, theirs: true });
  recordProductEvent(`Registró la aceptación de contacto de ${publicName(personId)}.`);
  return null;
}

export function clearContactGrant(personId: string) {
  if (isRemotePersonId(personId)) {
    return;
  }
  if (!canUseBrowserStorage() || !readConsent(personId)) {
    return;
  }
  const next = readConsents().filter((item) => item.personId !== personId);
  writeDurable(CONTACT_KEY, JSON.stringify(next));
  recordProductEvent(`Revocó el permiso de contacto con ${publicName(personId)}.`);
}

export function revealedContact(personId: string): RevealedContact | null {
  if (isRemotePersonId(personId)) {
    return peekRemoteContactState(personId).revealed;
  }
  if (!contactIsShared(personId)) {
    return null;
  }
  const person = findCatalogEntry(personId);
  if (!person || person.kind !== "persona") {
    return null;
  }
  const local = person.id.replace(/-/g, ".");
  return {
    email: `${local}@ejemplo.zunela.co`,
    phone: "+57 300 000 0000",
    note: "Datos de prueba. Solo se muestran con consentimiento de las dos partes.",
  };
}

function writeConsent(row: ContactConsent) {
  if (!canUseBrowserStorage()) {
    return;
  }
  const next = readConsents().filter((item) => item.personId !== row.personId);
  next.push(row);
  writeDurable(CONTACT_KEY, JSON.stringify(next));
}

function readConsent(personId: string) {
  return readConsents().find((item) => item.personId === personId) ?? null;
}

function readConsents(): ContactConsent[] {
  if (!canUseBrowserStorage()) {
    return [];
  }
  const raw = readDurable(CONTACT_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.flatMap((item) => {
      if (typeof item === "string") {
        return [{ personId: item, mine: true, theirs: false }];
      }
      if (!item || typeof item !== "object") {
        return [];
      }
      const record = item as {
        personId?: unknown;
        mine?: unknown;
        theirs?: unknown;
      };
      if (typeof record.personId !== "string") {
        return [];
      }
      const mine = record.mine === true || record.mine === "si";
      const theirs = record.theirs === true;
      if (!mine && !theirs) {
        return [];
      }
      return [{ personId: record.personId, mine, theirs }];
    });
  } catch {
    return [];
  }
}

function publicName(personId: string) {
  return findCatalogEntry(personId)?.title ?? peekRemotePerson(personId)?.title ?? "una persona";
}
