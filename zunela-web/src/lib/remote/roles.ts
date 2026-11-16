/**
 * Roles remotos (memberships). Fail-closed: sin fila → usuario.
 */

import { remoteIdentityAvailable } from "@/lib/remote/identity";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type RemoteAppRole = "usuario" | "moderador" | "administrador";

type MembershipRow = {
  user_id: string;
  role: RemoteAppRole;
};

let cachedRole: RemoteAppRole | null = null;

export function peekRemoteRole(): RemoteAppRole | null {
  return cachedRole;
}

export function clearRemoteRoleCache() {
  cachedRole = null;
}

function normalizeRole(value: string | null | undefined): RemoteAppRole {
  if (value === "administrador" || value === "moderador") {
    return value;
  }
  return "usuario";
}

export async function fetchRemoteRole(): Promise<RemoteAppRole> {
  const client = getSupabaseBrowserClient();
  if (!client || !remoteIdentityAvailable()) {
    cachedRole = null;
    return "usuario";
  }
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    cachedRole = null;
    return "usuario";
  }
  const { data, error } = await client
    .from("memberships")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !data) {
    cachedRole = "usuario";
    return "usuario";
  }
  cachedRole = normalizeRole((data as MembershipRow).role);
  return cachedRole;
}

export async function assignRemoteRole(
  userId: string,
  role: RemoteAppRole,
): Promise<string | null> {
  const client = getSupabaseBrowserClient();
  if (!client || !remoteIdentityAvailable()) {
    return "El backend remoto no está configurado.";
  }
  const mine = await fetchRemoteRole();
  if (mine !== "administrador") {
    return "Solo un administrador puede asignar roles.";
  }
  const { error } = await client
    .from("memberships")
    .update({ role })
    .eq("user_id", userId);
  return error ? error.message : null;
}

export async function listRemoteMemberships(): Promise<{ userId: string; role: RemoteAppRole }[]> {
  const client = getSupabaseBrowserClient();
  if (!client || !remoteIdentityAvailable()) {
    return [];
  }
  const mine = peekRemoteRole() ?? (await fetchRemoteRole());
  if (mine === "usuario") {
    return [];
  }
  const { data, error } = await client.from("memberships").select("user_id, role");
  if (error || !data) {
    return [];
  }
  return (data as MembershipRow[]).map((row) => ({
    userId: row.user_id,
    role: normalizeRole(row.role),
  }));
}

/** ¿Ya hay al menos un administrador en memberships? */
export async function remoteAdminExists(): Promise<boolean> {
  const client = getSupabaseBrowserClient();
  if (!client || !remoteIdentityAvailable()) {
    return false;
  }
  const { data, error } = await client.rpc("admin_exists");
  if (error) {
    return true; // fail-closed: no ofrecer bootstrap si no se puede comprobar
  }
  return data === true;
}

/**
 * Primera elevación a administrador (RPC). Falla si ya existe un admin.
 * No es auto-elevación recurrente.
 */
export async function bootstrapFirstAdminRemote(): Promise<string | null> {
  const client = getSupabaseBrowserClient();
  if (!client || !remoteIdentityAvailable()) {
    return "El backend remoto no está configurado.";
  }
  const { error } = await client.rpc("bootstrap_first_admin");
  if (error) {
    if (/admin already exists/i.test(error.message)) {
      return "Ya hay un administrador. Pídele que te asigne el rol.";
    }
    return error.message;
  }
  await fetchRemoteRole();
  return null;
}
