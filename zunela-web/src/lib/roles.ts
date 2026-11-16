import { recordAudit } from "@/lib/admin";
import { recordProductEvent } from "@/lib/product-events";
import { remoteIdentityAvailable } from "@/lib/remote/identity";
import {
  assignRemoteRole,
  bootstrapFirstAdminRemote,
  clearRemoteRoleCache,
  fetchRemoteRole,
  peekRemoteRole,
  remoteAdminExists,
} from "@/lib/remote/roles";
import { readDurable, removeDurable, writeDurable } from "@/lib/storage";

const ROLE_KEY = "zunela.role";

export type AppRole = "usuario" | "moderador" | "administrador";

export function readRole(): AppRole {
  if (remoteIdentityAvailable()) {
    const remote = peekRemoteRole();
    if (remote) {
      return remote;
    }
    // Sin hidratar aún: fallar cerrado a usuario (no elevar con localStorage).
    return "usuario";
  }
  const raw = readDurable(ROLE_KEY);
  if (raw === "administrador" || raw === "moderador") {
    return raw;
  }
  return "usuario";
}

export async function refreshRemoteRole(): Promise<AppRole> {
  if (!remoteIdentityAvailable()) {
    clearRemoteRoleCache();
    return readRole();
  }
  return fetchRemoteRole();
}

export function isAdmin() {
  return readRole() === "administrador";
}

export function isModerator() {
  return readRole() === "moderador";
}

/** Acceso al panel /admin (moderación o administración completa). */
export function canAccessAdminPanel() {
  const role = readRole();
  return role === "administrador" || role === "moderador";
}

export function canManageUsers() {
  return isAdmin();
}

export function canManageCatalogs() {
  return isAdmin();
}

export function canManageParams() {
  return isAdmin();
}

export function canManageAiControls() {
  return isAdmin();
}

/** Reportes, apelaciones y aprobación de publicaciones propias. */
export function canModerateContent() {
  return canAccessAdminPanel();
}

export function setRole(role: AppRole) {
  if (remoteIdentityAvailable()) {
    // En remoto no hay auto-elevación desde el cliente.
    return;
  }
  if (role === "usuario") {
    removeDurable(ROLE_KEY);
  } else {
    writeDurable(ROLE_KEY, role);
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("zunela-role"));
  }
  recordProductEvent(
    role === "administrador"
      ? "Activó el rol administrador en esta prueba."
      : role === "moderador"
        ? "Activó el rol moderador en esta prueba."
        : "Volvió al rol de usuario en esta prueba.",
  );
  recordAudit(
    role === "administrador"
      ? "Activó el rol administrador en este navegador. Queda guardado al cerrar sesión."
      : role === "moderador"
        ? "Activó el rol moderador en este navegador. Puede revisar reportes y publicaciones, no parámetros."
        : "Quitó el rol elevado en este navegador.",
  );
}

export async function assignRoleAsync(userId: string, role: AppRole) {
  if (remoteIdentityAvailable()) {
    if (!isAdmin()) {
      return "Solo un administrador puede asignar roles.";
    }
    const reason = await assignRemoteRole(userId, role);
    if (reason) {
      return reason;
    }
    await refreshRemoteRole();
    recordAudit(`Asignó rol ${role} a un usuario.`);
    recordProductEvent(`Asignó el rol ${role}.`);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("zunela-role"));
    }
    return null;
  }
  setRole(role);
  return null;
}

export async function checkRemoteAdminExists() {
  if (!remoteIdentityAvailable()) {
    return false;
  }
  return remoteAdminExists();
}

/** Solo la primera vez: crea el administrador inicial del proyecto. */
export async function bootstrapFirstAdminAsync() {
  if (!remoteIdentityAvailable()) {
    return "El bootstrap remoto solo aplica con Supabase.";
  }
  const reason = await bootstrapFirstAdminRemote();
  if (reason) {
    return reason;
  }
  recordAudit("Activó el primer administrador del proyecto (bootstrap).");
  recordProductEvent("Bootstrap del primer administrador.");
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("zunela-role"));
  }
  return null;
}

export function clearRole() {
  if (remoteIdentityAvailable()) {
    clearRemoteRoleCache();
    return;
  }
  removeDurable(ROLE_KEY);
}

export function roleLabel(role: AppRole = readRole()) {
  if (role === "administrador") {
    return "Administrador";
  }
  if (role === "moderador") {
    return "Moderador";
  }
  return "Usuario";
}
