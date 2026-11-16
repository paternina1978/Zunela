import { recordAudit } from "@/lib/admin";
import { readHeldAgents } from "@/lib/agent-holds";
import { readAiLimits } from "@/lib/ai-control";

const KILL_KEY = "zunela.ai-emergency-off";
const TRACE_KEY = "zunela.ai-traces";
const RUNS_KEY = "zunela.ai-runs";
const LEDGER_KEY = "zunela.ai-usage-ledger";

export type AiTrace = {
  id: string;
  at: string;
  agent: string;
  action: string;
  status: "bloqueado";
  reason: string;
};

export type AiRunRecord = {
  id: string;
  at: string;
  agent: string;
  estado: "rechazado";
  tokens: 0;
  costo: 0;
};

export type AiLedgerEntry = {
  id: string;
  at: string;
  tipo: "bloqueo" | "cupo" | "presupuesto";
  detalle: string;
  tokens: 0;
  unidades: 0;
};

export type AiSafeTool = {
  id: string;
  name: string;
  vista: string;
  escribe: boolean;
  nota: string;
};

/** Herramientas previstas: solo vistas autorizadas; ninguna se ejecuta en esta prueba. */
export const AI_SAFE_TOOLS: AiSafeTool[] = [
  {
    id: "perfil.propio.lectura",
    name: "Leer perfil propio visible",
    vista: "nombre, ciudad e intereses públicos del titular",
    escribe: false,
    nota: "No incluye correo, teléfono ni datos ocultos.",
  },
  {
    id: "oportunidad.borrador",
    name: "Proponer borrador de oportunidad",
    vista: "campos del formulario del titular",
    escribe: false,
    nota: "No publica. Requiere confirmación humana.",
  },
  {
    id: "afinidad.explicacion",
    name: "Explicar afinidad visible",
    vista: "intereses y objetivos ya públicos en catálogo",
    escribe: false,
    nota: "No abre match ni chat.",
  },
  {
    id: "piloto.metricas",
    name: "Leer métricas agregadas del piloto",
    vista: "conteos sin identificadores personales",
    escribe: false,
    nota: "Solo administración. Sin chats ni SQL libre.",
  },
  {
    id: "moderacion.resumen",
    name: "Resumir expediente asignado",
    vista: "metadatos del caso, sin cuerpo de mensajes",
    escribe: false,
    nota: "No suspende ni borra. Decide una persona.",
  },
  {
    id: "operaciones.preparar",
    name: "Preparar cambio operativo",
    vista: "parámetros ya versionados",
    escribe: false,
    nota: "Ningún cambio se aplica sin aprobación.",
  },
];

export function isEmergencyAiOff() {
  if (typeof sessionStorage === "undefined") {
    return false;
  }
  return sessionStorage.getItem(KILL_KEY) === "1";
}

export function setEmergencyAiOff(next: boolean) {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  if (next) {
    sessionStorage.setItem(KILL_KEY, "1");
  } else {
    sessionStorage.removeItem(KILL_KEY);
  }
  recordAudit(
    next
      ? "Activó el apagado de emergencia de IA. No hay nuevas ejecuciones."
      : "Quitó el apagado de emergencia. El módulo sigue sin proveedor y no ejecuta.",
  );
}

export function readAiTraces(): AiTrace[] {
  return readList(TRACE_KEY, isTrace);
}

export function readAiRuns(): AiRunRecord[] {
  return readList(RUNS_KEY, isRun);
}

export function readAiUsageLedger(): AiLedgerEntry[] {
  return readList(LEDGER_KEY, isLedger);
}

export function readAiBudgetSnapshot() {
  const limits = readAiLimits();
  const used = countSuccessfulRuns();
  return {
    presupuesto: limits.budgetUnits,
    consumido: 0,
    disponible: limits.budgetUnits,
    moneda: "sin tarifa",
    diarioUsado: used.daily,
    mensualUsado: used.monthly,
    diarioLimite: limits.dailyRequests,
    mensualLimite: limits.monthlyRequests,
  };
}

/**
 * Middleware de cuota y presupuesto (IA-004).
 * Sin ejecuciones exitosas el consumo es 0; cupo 0 o presupuesto 0 bloquean sin generar gasto.
 */
export function checkAiQuota(): { ok: true } | { ok: false; reason: string; tipo: "cupo" | "presupuesto" } {
  const limits = readAiLimits();
  const used = countSuccessfulRuns();
  if (limits.budgetUnits <= 0) {
    return {
      ok: false,
      tipo: "presupuesto",
      reason: "No hay presupuesto de referencia. No se genera gasto adicional.",
    };
  }
  if (limits.dailyRequests <= 0 || used.daily >= limits.dailyRequests) {
    return {
      ok: false,
      tipo: "cupo",
      reason: "Cupo diario agotado o en cero. No se genera gasto adicional.",
    };
  }
  if (limits.monthlyRequests <= 0 || used.monthly >= limits.monthlyRequests) {
    return {
      ok: false,
      tipo: "cupo",
      reason: "Cupo mensual agotado o en cero. No se genera gasto adicional.",
    };
  }
  return { ok: true };
}

/** Registra un bloqueo saneado: sin correo, sin cuerpo de prompt ni datos personales. */
export function recordAiBlock(
  agent: string,
  action: string,
  reason: string,
  tipo: AiLedgerEntry["tipo"] = "bloqueo",
) {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  const at = new Date().toISOString();
  const id = `ai-${Date.now()}`;
  const safeReason = sanitizeReason(reason);
  const trace: AiTrace = {
    id,
    at,
    agent: sanitizeToken(agent),
    action: sanitizeToken(action),
    status: "bloqueado",
    reason: safeReason,
  };
  const run: AiRunRecord = {
    id,
    at,
    agent: trace.agent,
    estado: "rechazado",
    tokens: 0,
    costo: 0,
  };
  const ledger: AiLedgerEntry = {
    id,
    at,
    tipo,
    detalle: `${trace.agent} · ${trace.action} · ${safeReason}`,
    tokens: 0,
    unidades: 0,
  };
  prepend(TRACE_KEY, trace, 40);
  prepend(RUNS_KEY, run, 40);
  prepend(LEDGER_KEY, ledger, 40);
}

export function probeAiGate(agent: string, action: string, reason: string) {
  recordAiBlock(agent, action, reason);
  return {
    ok: false as const,
    reason: sanitizeReason(reason),
    ejecucion: null,
    consumo: { ejecuciones: 0, tokens: 0 },
  };
}

export function agentIsHeld(code: string) {
  return readHeldAgents().includes(code);
}

/** En esta prueba no hay runs exitosos; el contador queda en cero. */
function countSuccessfulRuns() {
  return { daily: 0, monthly: 0 };
}

function sanitizeReason(value: string) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[correo]")
    .replace(/\b3\d{9}\b/g, "[teléfono]")
    .slice(0, 180);
}

function sanitizeToken(value: string) {
  return value.replace(/[^A-Za-z0-9._-]/g, "").slice(0, 32) || "desconocido";
}

function prepend(key: string, entry: unknown, limit: number) {
  let current: unknown[] = [];
  const raw = sessionStorage.getItem(key);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        current = parsed;
      }
    } catch {
      current = [];
    }
  }
  sessionStorage.setItem(key, JSON.stringify([entry, ...current].slice(0, limit)));
}

function readList<T>(key: string, guard: (value: unknown) => value is T): T[] {
  if (typeof sessionStorage === "undefined") {
    return [];
  }
  const raw = sessionStorage.getItem(key);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(guard);
  } catch {
    return [];
  }
}

function isTrace(value: unknown): value is AiTrace {
  if (!value || typeof value !== "object") {
    return false;
  }
  const entry = value as Partial<AiTrace>;
  return (
    typeof entry.id === "string" &&
    typeof entry.at === "string" &&
    typeof entry.agent === "string" &&
    typeof entry.action === "string" &&
    entry.status === "bloqueado" &&
    typeof entry.reason === "string"
  );
}

function isRun(value: unknown): value is AiRunRecord {
  if (!value || typeof value !== "object") {
    return false;
  }
  const entry = value as Partial<AiRunRecord>;
  return (
    typeof entry.id === "string" &&
    typeof entry.at === "string" &&
    typeof entry.agent === "string" &&
    entry.estado === "rechazado" &&
    entry.tokens === 0 &&
    entry.costo === 0
  );
}

function isLedger(value: unknown): value is AiLedgerEntry {
  if (!value || typeof value !== "object") {
    return false;
  }
  const entry = value as Partial<AiLedgerEntry>;
  return (
    typeof entry.id === "string" &&
    typeof entry.at === "string" &&
    (entry.tipo === "bloqueo" || entry.tipo === "cupo" || entry.tipo === "presupuesto") &&
    typeof entry.detalle === "string" &&
    entry.tokens === 0 &&
    entry.unidades === 0
  );
}
