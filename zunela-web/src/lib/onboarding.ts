import { readAffinity } from "@/lib/affinity";
import { readProfile } from "@/lib/profile";
import { readSession } from "@/lib/session";

export function profileIsReady(profile = readProfile()) {
  return Boolean(
    profile?.visibleName.trim() &&
      profile.country.trim() &&
      profile.city.trim().length >= 2 &&
      profile.profession.trim().length >= 2,
  );
}

export function affinityIsReady(affinity = readAffinity()) {
  return Boolean(affinity && affinity.interests.length > 0 && affinity.goals.length > 0);
}

export function sessionIsReady() {
  return Boolean(readSession());
}

/** Destino del recorrido MVP: acceso → perfil → intereses → resto. */
export function nextOnboardingPath(pathname: string): string | null {
  if (isPublicPath(pathname)) {
    return null;
  }

  if (!sessionIsReady()) {
    return pathname === "/" ? null : "/";
  }

  if (pathname === "/") {
    if (!profileIsReady()) {
      return "/perfil";
    }
    if (!affinityIsReady()) {
      return "/intereses";
    }
    return null;
  }

  // Cuenta y perfil siempre accesibles con sesión (pausa, rol, membresía).
  if (pathname.startsWith("/cuenta") || pathname.startsWith("/perfil")) {
    return null;
  }

  if (!profileIsReady()) {
    return "/perfil";
  }

  if (pathname.startsWith("/intereses")) {
    return null;
  }

  if (!affinityIsReady()) {
    return "/intereses";
  }

  // Admin e IA solo tras completar el recorrido básico.
  return null;
}

export function onboardingMessage(target: string) {
  if (target === "/") {
    return "Entra o crea tu cuenta para continuar el recorrido.";
  }
  if (target === "/perfil") {
    return "Completa tu perfil visible antes de seguir.";
  }
  return "Elige al menos un interés y un objetivo para abrir Descubrir.";
}

function isPublicPath(pathname: string) {
  return pathname.startsWith("/api");
}
