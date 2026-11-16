/**
 * Slice ciclo de vida de cuenta remota: copia resumida + borrado.
 * Sin cuerpos de chat. Fail-closed si no hay backend.
 */

import type { AccountCopy } from "@/lib/account-data";
import { hashSecret } from "@/lib/access";
import { remoteIdentityAvailable } from "@/lib/remote/identity";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type RemoteSummary = {
  generado?: string;
  correo?: string;
  perfil?: AccountCopy["perfil"];
  intereses?: string[];
  plan?: string;
  conexiones?: number;
  solicitudesPendientes?: number;
  reportesAbiertos?: number;
  oportunidades?: { titulo: string; estado: string }[];
  comunidades?: { titulo: string; acceso: string; estado: string }[];
  nota?: string;
};

export async function exportRemoteAccountCopy(): Promise<AccountCopy | string> {
  const client = getSupabaseBrowserClient();
  if (!client || !remoteIdentityAvailable()) {
    return "El backend remoto no está configurado.";
  }
  const { data, error } = await client.rpc("export_my_account_summary");
  if (error) {
    return error.message;
  }
  const raw = (data ?? {}) as RemoteSummary;
  const copy: Omit<AccountCopy, "huella"> = {
    generado: typeof raw.generado === "string" ? raw.generado : new Date().toISOString(),
    correo: typeof raw.correo === "string" ? raw.correo : "",
    perfil: raw.perfil ?? null,
    intereses: Array.isArray(raw.intereses) ? raw.intereses.map(String) : [],
    plan: typeof raw.plan === "string" ? raw.plan : "gratis",
    conexiones: Number(raw.conexiones) || 0,
    solicitudesPendientes: Number(raw.solicitudesPendientes) || 0,
    reportesAbiertos: Number(raw.reportesAbiertos) || 0,
    oportunidades: Array.isArray(raw.oportunidades)
      ? raw.oportunidades.map((item) => ({
          titulo: String(item.titulo ?? ""),
          estado: String(item.estado ?? ""),
        }))
      : [],
    comunidades: Array.isArray(raw.comunidades)
      ? raw.comunidades.map((item) => ({
          titulo: String(item.titulo ?? ""),
          acceso: String(item.acceso ?? ""),
          estado: String(item.estado ?? ""),
        }))
      : [],
    nota:
      typeof raw.nota === "string"
        ? raw.nota
        : "Copia remota del piloto. No incluye mensajes ni contactos ajenos.",
  };
  return { ...copy, huella: await hashSecret(JSON.stringify(copy)) };
}

/** Elimina auth.users (cascade). Devuelve mensaje de error o null si OK. */
export async function deleteRemoteAccount(): Promise<string | null> {
  const client = getSupabaseBrowserClient();
  if (!client || !remoteIdentityAvailable()) {
    return "El backend remoto no está configurado.";
  }
  const { error } = await client.rpc("delete_my_account");
  if (error) {
    if (/sole administrator/i.test(error.message)) {
      return "No puedes borrar la cuenta: eres el único administrador. Asigna otro admin antes.";
    }
    return error.message;
  }
  await client.auth.signOut();
  return null;
}
