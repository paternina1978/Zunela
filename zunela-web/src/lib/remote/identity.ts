/**
 * Puente del slice identidad (Auth + profiles + affinities).
 * Sin proyecto Supabase configurado, todas las funciones fallan cerradas
 * y la UI debe seguir usando access/profile/affinity locales.
 */

import type { AffinityDraft } from "@/lib/affinity";
import { isRemoteBackendEnabled } from "@/lib/backend-mode";
import type { ProfileDraft } from "@/lib/profile";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function remoteIdentityAvailable() {
  return isRemoteBackendEnabled() && Boolean(getSupabaseBrowserClient());
}

export type RemoteRegisterResult =
  | { ok: true; pendingEmailConfirm: boolean }
  | { ok: false; message: string };

export async function remoteRegister(
  email: string,
  password: string,
  visibleName: string,
): Promise<RemoteRegisterResult> {
  const client = getSupabaseBrowserClient();
  if (!client) {
    return { ok: false, message: "El backend remoto no está configurado." };
  }
  const emailRedirectTo =
    typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;
  const { data, error } = await client.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: { visible_name: visibleName.trim() },
      emailRedirectTo,
    },
  });
  if (error) {
    return { ok: false, message: error.message };
  }
  // Cloud con confirmación de correo: no hay sesión hasta el enlace.
  return { ok: true, pendingEmailConfirm: !data.session };
}

export async function remoteLogin(email: string, password: string): Promise<string | null> {
  const client = getSupabaseBrowserClient();
  if (!client) {
    return "El backend remoto no está configurado.";
  }
  const { error } = await client.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  return error ? error.message : null;
}

export type RemoteOAuthProvider = "google" | "apple" | "github" | "facebook" | "azure";

/** Redirige al proveedor OAuth (Google/Gmail, etc.). Requiere el provider activo en Supabase. */
export async function remoteSignInWithOAuth(
  provider: RemoteOAuthProvider,
): Promise<string | null> {
  const client = getSupabaseBrowserClient();
  if (!client) {
    return "El backend remoto no está configurado.";
  }
  const redirectTo =
    typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;
  const { error } = await client.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      queryParams:
        provider === "google"
          ? {
              access_type: "offline",
              prompt: "select_account",
            }
          : undefined,
    },
  });
  return error ? error.message : null;
}

/** Completa nombre visible tras OAuth si el perfil quedó vacío. */
export async function ensureRemoteVisibleNameFromAuth(): Promise<void> {
  const client = getSupabaseBrowserClient();
  if (!client) {
    return;
  }
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return;
  }
  const { data: profile } = await client
    .from("profiles")
    .select("visible_name")
    .eq("id", user.id)
    .maybeSingle();
  const current =
    typeof profile?.visible_name === "string" ? profile.visible_name.trim() : "";
  if (current) {
    return;
  }
  const meta = user.user_metadata ?? {};
  const fromMeta = [meta.visible_name, meta.full_name, meta.name, meta.preferred_username]
    .find((value) => typeof value === "string" && value.trim().length >= 2);
  const fallback = user.email?.split("@")[0]?.trim() || "Persona";
  const visibleName = (typeof fromMeta === "string" ? fromMeta : fallback).trim().slice(0, 80);
  await client.from("profiles").update({ visible_name: visibleName }).eq("id", user.id);
}

export async function remoteSignOut(): Promise<string | null> {
  const client = getSupabaseBrowserClient();
  if (!client) {
    return null;
  }
  const { error } = await client.auth.signOut();
  return error ? error.message : null;
}

/** Sesión remota activa (email + nombre visible). */
export async function remoteCurrentUser(): Promise<{ email: string; visibleName: string } | null> {
  const client = getSupabaseBrowserClient();
  if (!client) {
    return null;
  }
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user?.email) {
    return null;
  }
  const metaName =
    typeof user.user_metadata?.visible_name === "string" ? user.user_metadata.visible_name.trim() : "";
  if (metaName) {
    return { email: user.email, visibleName: metaName };
  }
  const { data } = await client.from("profiles").select("visible_name").eq("id", user.id).maybeSingle();
  return {
    email: user.email,
    visibleName: typeof data?.visible_name === "string" ? data.visible_name : "",
  };
}

/** Envío de enlace de recuperación (Supabase Auth). */
export async function remoteRequestPasswordReset(email: string): Promise<string | null> {
  const client = getSupabaseBrowserClient();
  if (!client) {
    return "El backend remoto no está configurado.";
  }
  const redirectTo =
    typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;
  const { error } = await client.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo,
  });
  return error ? error.message : null;
}

export async function remoteFetchProfile(): Promise<ProfileDraft | null> {
  const client = getSupabaseBrowserClient();
  if (!client) {
    return null;
  }
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return null;
  }
  const { data, error } = await client.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (error || !data) {
    return null;
  }
  return mapProfile(data);
}

export async function remoteSaveProfile(profile: ProfileDraft): Promise<string | null> {
  const client = getSupabaseBrowserClient();
  if (!client) {
    return "El backend remoto no está configurado.";
  }
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return "No hay sesión remota.";
  }
  const { error } = await client.from("profiles").upsert({
    id: user.id,
    visible_name: profile.visibleName,
    legal_name: profile.legalName,
    country: profile.country,
    city: profile.city,
    profession: profile.profession,
    knowledge: profile.knowledge,
    presentation: profile.presentation,
    photo_url: profile.photoDataUrl,
    visibility: profile.visibility,
  });
  return error ? error.message : null;
}

export async function remoteFetchAffinity(): Promise<AffinityDraft | null> {
  const client = getSupabaseBrowserClient();
  if (!client) {
    return null;
  }
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return null;
  }
  const { data, error } = await client
    .from("affinities")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return mapAffinity(data);
}

export async function remoteSaveAffinity(affinity: AffinityDraft): Promise<string | null> {
  const client = getSupabaseBrowserClient();
  if (!client) {
    return "El backend remoto no está configurado.";
  }
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return "No hay sesión remota.";
  }
  const { error } = await client.from("affinities").upsert({
    user_id: user.id,
    interests: affinity.interests,
    goals: affinity.goals,
    offers: affinity.offers,
    modality: affinity.modality,
    reach: affinity.reach,
    availability: affinity.availability,
  });
  return error ? error.message : null;
}

function mapProfile(row: Record<string, unknown>): ProfileDraft {
  const visibility = (row.visibility ?? {}) as ProfileDraft["visibility"];
  return {
    visibleName: String(row.visible_name ?? ""),
    legalName: String(row.legal_name ?? ""),
    country: String(row.country ?? "Colombia"),
    city: String(row.city ?? ""),
    profession: String(row.profession ?? ""),
    knowledge: Array.isArray(row.knowledge) ? row.knowledge.map(String) : [],
    presentation: String(row.presentation ?? ""),
    photoDataUrl: typeof row.photo_url === "string" ? row.photo_url : null,
    visibility: {
      photo: visibility.photo === "public" ? "public" : "after-match",
      profession: visibility.profession === "public" ? "public" : "after-match",
      city: visibility.city === "after-match" ? "after-match" : "public",
      country: visibility.country === "after-match" ? "after-match" : "public",
      knowledge: visibility.knowledge === "public" ? "public" : "after-match",
      presentation: visibility.presentation === "public" ? "public" : "after-match",
    },
  };
}

function mapAffinity(row: Record<string, unknown>): AffinityDraft {
  const modality = row.modality;
  const reach = row.reach;
  return {
    interests: Array.isArray(row.interests) ? row.interests.map(String) : [],
    goals: Array.isArray(row.goals) ? row.goals.map(String) : [],
    offers: Array.isArray(row.offers) ? row.offers.map(String) : [],
    modality:
      modality === "presencial" || modality === "remota" || modality === "ambas"
        ? modality
        : "ambas",
    reach:
      reach === "ciudad" || reach === "departamento" || reach === "nacional" || reach === "remoto"
        ? reach
        : "ciudad",
    availability: Array.isArray(row.availability) ? row.availability.map(String) : ["Horario flexible"],
  };
}
