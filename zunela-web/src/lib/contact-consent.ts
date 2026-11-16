import { readActivePlan } from "@/lib/account";
import {
  acceptCounterpartContact,
  clearContactGrant,
  contactIsGranted,
  contactIsShared,
  counterpartAcceptedContact,
  refreshRemoteContactState,
  revealedContact,
  saveContactGrant,
} from "@/lib/contact-store";
import { findCatalogEntry } from "@/lib/discover";
import { activeConnectionIds, readBlockedIds } from "@/lib/matches";
import { peekRemotePerson } from "@/lib/remote/catalog";
import { isRemotePersonId } from "@/lib/remote/connections";
import { grantRemoteContact, revokeRemoteContact } from "@/lib/remote/contacts";
import { remoteIdentityAvailable } from "@/lib/remote/identity";
import { recordProductEvent } from "@/lib/product-events";
import { readSession } from "@/lib/session";

export {
  contactIsGranted,
  contactIsShared,
  counterpartAcceptedContact,
  refreshRemoteContactState,
  revealedContact,
} from "@/lib/contact-store";
export type { RevealedContact } from "@/lib/contact-store";

function contactGate(personId: string) {
  if (readBlockedIds().includes(personId) || !activeConnectionIds().includes(personId)) {
    return "Esta conversación no está abierta.";
  }
  if (readActivePlan() !== "prueba") {
    return "Compartir un contacto externo es de la prueba Premium.";
  }
  return null;
}

export function grantContactConsent(personId: string) {
  if (typeof sessionStorage === "undefined") {
    return "No se pudo guardar el permiso en este navegador.";
  }
  if (isRemotePersonId(personId)) {
    return "Usa la autorización remota para este contacto.";
  }
  const gate = contactGate(personId);
  if (gate) {
    return gate;
  }
  if (!contactIsGranted(personId)) {
    saveContactGrant(personId);
  }
  return null;
}

export async function grantContactConsentAsync(personId: string) {
  if (remoteIdentityAvailable() && isRemotePersonId(personId)) {
    const gate = contactGate(personId);
    if (gate) {
      return gate;
    }
    const email = readSession()?.email?.trim() ?? "";
    const reason = await grantRemoteContact(personId, email);
    if (reason) {
      return reason;
    }
    const name =
      findCatalogEntry(personId)?.title ?? peekRemotePerson(personId)?.title ?? "una persona";
    recordProductEvent(`Autorizó compartir su contacto con ${name}.`);
    return null;
  }
  return grantContactConsent(personId);
}

export function confirmCounterpartContact(personId: string) {
  const gate = contactGate(personId);
  if (gate) {
    return gate;
  }
  return acceptCounterpartContact(personId);
}

export function revokeContactConsent(personId: string) {
  if (isRemotePersonId(personId)) {
    return;
  }
  clearContactGrant(personId);
}

export async function revokeContactConsentAsync(personId: string) {
  if (remoteIdentityAvailable() && isRemotePersonId(personId)) {
    const reason = await revokeRemoteContact(personId);
    if (reason) {
      return reason;
    }
    const name =
      findCatalogEntry(personId)?.title ?? peekRemotePerson(personId)?.title ?? "una persona";
    recordProductEvent(`Revocó el permiso de contacto con ${name}.`);
    return null;
  }
  revokeContactConsent(personId);
  return null;
}
