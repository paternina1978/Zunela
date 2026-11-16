/**
 * Consentimientos de contacto bilaterales (UUID).
 * Sin simulación de la otra parte: ambas cuentas deben autorizar.
 */

import type { RevealedContact } from "@/lib/contact-store";
import { isRemotePersonId } from "@/lib/remote/connections";
import { remoteIdentityAvailable } from "@/lib/remote/identity";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type ConsentRow = {
  id: string;
  granter_id: string;
  grantee_id: string;
  contact_email: string;
  contact_phone: string;
  created_at: string;
};

export type RemoteContactState = {
  mine: boolean;
  theirs: boolean;
  revealed: RevealedContact | null;
};

const EMPTY: RemoteContactState = { mine: false, theirs: false, revealed: null };
const stateCache = new Map<string, RemoteContactState>();

export function peekRemoteContactState(personId: string): RemoteContactState {
  return stateCache.get(personId) ?? EMPTY;
}

export async function fetchRemoteContactState(personId: string): Promise<RemoteContactState> {
  const client = getSupabaseBrowserClient();
  if (!client || !remoteIdentityAvailable() || !isRemotePersonId(personId)) {
    stateCache.set(personId, EMPTY);
    return EMPTY;
  }
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    stateCache.set(personId, EMPTY);
    return EMPTY;
  }

  const [{ data: mineRow }, { data: theirsRow }] = await Promise.all([
    client
      .from("contact_consents")
      .select("*")
      .eq("granter_id", user.id)
      .eq("grantee_id", personId)
      .maybeSingle(),
    client
      .from("contact_consents")
      .select("*")
      .eq("granter_id", personId)
      .eq("grantee_id", user.id)
      .maybeSingle(),
  ]);

  const mine = Boolean(mineRow);
  const theirs = Boolean(theirsRow);
  let revealed: RevealedContact | null = null;
  if (mine && theirs && theirsRow) {
    const row = theirsRow as ConsentRow;
    revealed = {
      email: row.contact_email.trim() || "Sin correo compartido",
      phone: row.contact_phone.trim() || "Sin teléfono compartido",
      note: "Visible solo con consentimiento de las dos partes. Puedes revocar el tuyo cuando quieras.",
    };
  }
  const state = { mine, theirs, revealed };
  stateCache.set(personId, state);
  return state;
}

export async function grantRemoteContact(
  personId: string,
  contactEmail: string,
  contactPhone = "",
): Promise<string | null> {
  const client = getSupabaseBrowserClient();
  if (!client || !remoteIdentityAvailable()) {
    return "El backend remoto no está configurado.";
  }
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return "No hay sesión remota.";
  }
  if (!isRemotePersonId(personId) || personId === user.id) {
    return "No se puede autorizar este contacto.";
  }
  const email = contactEmail.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return "Se necesita un correo de sesión para compartir contacto.";
  }
  const { error } = await client.from("contact_consents").upsert(
    {
      granter_id: user.id,
      grantee_id: personId,
      contact_email: email,
      contact_phone: contactPhone.trim(),
    },
    { onConflict: "granter_id,grantee_id" },
  );
  if (error) {
    return error.message;
  }
  await fetchRemoteContactState(personId);
  return null;
}

export async function revokeRemoteContact(personId: string): Promise<string | null> {
  const client = getSupabaseBrowserClient();
  if (!client || !remoteIdentityAvailable()) {
    return "El backend remoto no está configurado.";
  }
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return "No hay sesión remota.";
  }
  const { error } = await client
    .from("contact_consents")
    .delete()
    .eq("granter_id", user.id)
    .eq("grantee_id", personId);
  if (error) {
    return error.message;
  }
  await fetchRemoteContactState(personId);
  return null;
}
