import { readAccess } from "@/lib/access";

const SESSION_KEY = "zunela.session";
const SIGNED_OUT_KEY = "zunela.signed-out";

export type SessionDraft = {
  email: string;
  visibleName: string;
};

export function saveSession(session: SessionDraft) {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  sessionStorage.removeItem(SIGNED_OUT_KEY);
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.setItem(SIGNED_OUT_KEY, "1");
}

export function readSession(): SessionDraft | null {
  if (typeof sessionStorage === "undefined") {
    return null;
  }
  if (sessionStorage.getItem(SIGNED_OUT_KEY) === "1") {
    return null;
  }
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) {
    return restoreSessionFromAccess();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SessionDraft>;
    if (typeof parsed.email !== "string") {
      return restoreSessionFromAccess();
    }
    return {
      email: parsed.email,
      visibleName: typeof parsed.visibleName === "string" ? parsed.visibleName : "",
    };
  } catch {
    return restoreSessionFromAccess();
  }
}

/** Si hay acceso durable y la pestaña no tiene sesión, reabre el recorrido (salvo cierre explícito). */
function restoreSessionFromAccess(): SessionDraft | null {
  if (typeof sessionStorage === "undefined") {
    return null;
  }
  if (sessionStorage.getItem(SIGNED_OUT_KEY) === "1") {
    return null;
  }
  const access = readAccess();
  if (!access?.email) {
    return null;
  }
  const session = {
    email: access.email,
    visibleName: access.visibleName || "",
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}
