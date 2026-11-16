import { recordAudit } from "@/lib/admin";
import { isValidEmail, isValidPassword } from "@/lib/auth-validation";
import { recordProductEvent } from "@/lib/product-events";
import { readDurable, writeDurable } from "@/lib/storage";

const ACCESS_KEY = "zunela.access";
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type AccessRecord = {
  email: string;
  visibleName: string;
  passwordHash: string;
  recoveryHash: string | null;
};

export async function hashSecret(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, "0")).join("");
}

export function readAccess(): AccessRecord | null {
  const raw = readDurable(ACCESS_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<AccessRecord>;
    if (typeof parsed.email !== "string" || typeof parsed.passwordHash !== "string") {
      return null;
    }
    return {
      email: parsed.email,
      visibleName: typeof parsed.visibleName === "string" ? parsed.visibleName : "",
      passwordHash: parsed.passwordHash,
      recoveryHash: typeof parsed.recoveryHash === "string" ? parsed.recoveryHash : null,
    };
  } catch {
    return null;
  }
}

export async function registerAccess(email: string, visibleName: string, password: string) {
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized) || !isValidPassword(password)) {
    return "Revisa el correo y usa al menos 8 caracteres.";
  }
  const current = readAccess();
  saveAccess({
    email: normalized,
    visibleName: visibleName.trim(),
    passwordHash: await hashSecret(password),
    recoveryHash: current && current.email === normalized ? current.recoveryHash : null,
  });
  recordProductEvent("Guardó el acceso en este navegador.");
  return null;
}

export async function loginAccess(email: string, password: string) {
  const access = readAccess();
  if (!access) {
    return "No hay una cuenta en este navegador. Créala en esta pantalla.";
  }
  const passwordHash = await hashSecret(password);
  if (access.email !== normalizeEmail(email) || access.passwordHash !== passwordHash) {
    return "El correo o la contraseña no coinciden.";
  }
  return null;
}

export async function savePasswordHash(email: string, visibleName: string, password: string) {
  if (!isValidPassword(password)) {
    return "Usa al menos 8 caracteres.";
  }
  const current = readAccess();
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) {
    return "Entra o crea la cuenta antes de guardar una contraseña.";
  }
  saveAccess({
    email: normalized,
    visibleName: visibleName.trim() || current?.visibleName || "",
    passwordHash: await hashSecret(password),
    recoveryHash: current && current.email === normalized ? current.recoveryHash : null,
  });
  recordProductEvent("Actualizó la contraseña en este navegador.");
  return null;
}

export async function issueRecoveryCode() {
  const access = readAccess();
  if (!access) {
    return null;
  }
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const raw = [...bytes].map((item) => CODE_ALPHABET[item % CODE_ALPHABET.length]).join("");
  const code = `${raw.slice(0, 4)}-${raw.slice(4)}`;
  saveAccess({ ...access, recoveryHash: await hashSecret(normalizeCode(code)) });
  recordProductEvent("Creó un código de recuperación.");
  recordAudit("Creó un código de recuperación. El código no queda en la bitácora.");
  return code;
}

export async function resetWithRecovery(email: string, code: string, password: string) {
  const access = readAccess();
  if (!access?.recoveryHash) {
    return "No hay un código de recuperación en este navegador.";
  }
  if (!isValidPassword(password)) {
    return "Usa al menos 8 caracteres.";
  }
  const passwordHash = await hashSecret(password);
  const codeHash = await hashSecret(normalizeCode(code));
  if (access.email !== normalizeEmail(email) || access.recoveryHash !== codeHash) {
    return "El correo o el código no coinciden. No se cambió la contraseña.";
  }
  saveAccess({ ...access, passwordHash });
  recordProductEvent("Restableció la contraseña con el código de recuperación.");
  recordAudit("Restableció el acceso con el código. La contraseña no queda en la bitácora.");
  return null;
}

function saveAccess(record: AccessRecord) {
  writeDurable(ACCESS_KEY, JSON.stringify(record));
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizeCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}
