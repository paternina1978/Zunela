/** Modo de persistencia: local (MVP) o supabase (slice identidad). */

export type BackendMode = "local" | "supabase";

export function readBackendMode(): BackendMode {
  const raw = (process.env.NEXT_PUBLIC_ZUNELA_BACKEND || "local").trim().toLowerCase();
  return raw === "supabase" ? "supabase" : "local";
}

/** Remoto solo si el flag y las claves públicas están presentes. */
export function isRemoteBackendEnabled() {
  if (readBackendMode() !== "supabase") {
    return false;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return Boolean(url && key);
}

export function backendModeLabel() {
  if (isRemoteBackendEnabled()) {
    return "Supabase (identidad compartida)";
  }
  if (readBackendMode() === "supabase") {
    return "Supabase pedido, pero faltan URL o anon key — sigue local";
  }
  return "Local (este navegador)";
}
