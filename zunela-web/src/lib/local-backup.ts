import { hashSecret } from "@/lib/access";
import { recordAudit } from "@/lib/admin";
import {
  CHAT_BODY_KEYS,
  IDENTITY_KEYS,
  PILOT_KEYS,
} from "@/lib/account-data";
import { recordProductEvent } from "@/lib/product-events";
import { canUseBrowserStorage, clearDurableKeys, readDurable, writeDurable } from "@/lib/storage";

const BACKUP_VERSION = 2 as const;

const BACKUP_KEYS = [...IDENTITY_KEYS, ...PILOT_KEYS.filter((key) => !CHAT_BODY_KEYS.includes(key))];

export type LocalBackup = {
  version: typeof BACKUP_VERSION;
  generado: string;
  huella: string;
  keys: Record<string, string>;
  nota: string;
};

export async function buildLocalBackup(): Promise<LocalBackup | string> {
  if (!canUseBrowserStorage()) {
    return "No hay almacenamiento local en este navegador.";
  }
  const keys: Record<string, string> = {};
  for (const key of BACKUP_KEYS) {
    const value = readDurable(key);
    if (value !== null) {
      keys[key] = value;
    }
  }
  if (Object.keys(keys).length === 0) {
    return "No hay datos locales para respaldar.";
  }
  const payload = {
    version: BACKUP_VERSION,
    generado: new Date().toISOString(),
    keys,
    nota: "Respaldo local ZUNELA v2. Incluye acceso (huella de contraseña), perfil, matches y preferencias. No incluye cuerpos de chat. No lo compartas.",
  };
  return {
    ...payload,
    huella: await hashSecret(stablePayload(payload)),
  };
}

export async function restoreLocalBackup(raw: string): Promise<string | null> {
  if (!canUseBrowserStorage()) {
    return "No hay almacenamiento local en este navegador.";
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return "El archivo no es un JSON válido.";
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return "El respaldo no tiene el formato esperado.";
  }
  const backup = parsed as Partial<LocalBackup>;
  if (backup.version !== BACKUP_VERSION) {
    return "Esta copia no es compatible (se espera versión 2).";
  }
  if (typeof backup.generado !== "string" || typeof backup.huella !== "string") {
    return "Faltan datos de verificación en el respaldo.";
  }
  if (!backup.keys || typeof backup.keys !== "object" || Array.isArray(backup.keys)) {
    return "El respaldo no trae claves restaurables.";
  }
  const keys: Record<string, string> = {};
  for (const [key, value] of Object.entries(backup.keys)) {
    if (!BACKUP_KEYS.includes(key) || typeof value !== "string") {
      continue;
    }
    keys[key] = value;
  }
  if (Object.keys(keys).length === 0) {
    return "El respaldo no trae datos reconocidos.";
  }
  const expected = await hashSecret(
    stablePayload({
      version: BACKUP_VERSION,
      generado: backup.generado,
      keys,
      nota:
        typeof backup.nota === "string"
          ? backup.nota
          : "Respaldo local ZUNELA v2. Incluye acceso (huella de contraseña), perfil, matches y preferencias. No incluye cuerpos de chat. No lo compartas.",
    }),
  );
  if (expected !== backup.huella) {
    return "La huella no coincide. El archivo pudo alterarse.";
  }

  clearDurableKeys([...IDENTITY_KEYS, ...PILOT_KEYS]);
  for (const [key, value] of Object.entries(keys)) {
    writeDurable(key, value);
  }
  recordAudit("Restauró un respaldo local verificable.");
  recordProductEvent("Restauró copia local.");
  return null;
}

export function noteLocalBackup() {
  recordProductEvent("Descargó un respaldo local verificable.");
}

function stablePayload(value: {
  version: number;
  generado: string;
  keys: Record<string, string>;
  nota: string;
}) {
  const orderedKeys = Object.keys(value.keys)
    .sort()
    .reduce<Record<string, string>>((acc, key) => {
      acc[key] = value.keys[key];
      return acc;
    }, {});
  return JSON.stringify({
    version: value.version,
    generado: value.generado,
    keys: orderedKeys,
    nota: value.nota,
  });
}
