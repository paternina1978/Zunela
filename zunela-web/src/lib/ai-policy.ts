import { recordAudit } from "@/lib/admin";
import { AGENT_CATALOG } from "@/lib/agent-catalog";
import { readActivePlan } from "@/lib/account";
import { agentIsHeld, checkAiQuota, isEmergencyAiOff, recordAiBlock } from "@/lib/ai-runtime";
import { isAdmin } from "@/lib/roles";

const POLICY_KEY = "zunela.ai-policy";

/** El módulo sigue apagado: la matriz solo define elegibilidad futura. */
export const AI_MODULE_ENABLED = false;

export type AiPlanSlot = "gratis" | "prueba" | "administrador";
export type AiAction = "consultar" | "borrador" | "preparar" | "revisar";

export type AgentPolicyRow = {
  code: string;
  gratis: AiAction[];
  prueba: AiAction[];
  administrador: AiAction[];
};

export type AiAccessResult = {
  ok: boolean;
  reason: string;
  gate?: "emergencia" | "suspension" | "matriz" | "cupo" | "presupuesto" | "modulo";
};

export const AI_ACTIONS: { id: AiAction; label: string }[] = [
  { id: "consultar", label: "Consultar" },
  { id: "borrador", label: "Borrador" },
  { id: "preparar", label: "Preparar" },
  { id: "revisar", label: "Revisar" },
];

export const AI_SLOTS: { id: AiPlanSlot; label: string }[] = [
  { id: "gratis", label: "Gratis" },
  { id: "prueba", label: "Prueba Premium" },
  { id: "administrador", label: "Administrador" },
];

const USER_DEFAULT: AiAction[] = ["consultar", "borrador"];
const ADMIN_DEFAULT: AiAction[] = ["consultar", "revisar", "preparar"];

export function defaultAiPolicy(): AgentPolicyRow[] {
  return AGENT_CATALOG.map((agent) => {
    if (agent.audience === "administracion") {
      return { code: agent.code, gratis: [], prueba: [], administrador: [...ADMIN_DEFAULT] };
    }
    return { code: agent.code, gratis: [], prueba: [...USER_DEFAULT], administrador: [] };
  });
}

export function readAiPolicy(): AgentPolicyRow[] {
  if (typeof sessionStorage === "undefined") {
    return defaultAiPolicy();
  }
  const raw = sessionStorage.getItem(POLICY_KEY);
  if (!raw) {
    return defaultAiPolicy();
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return defaultAiPolicy();
    }
    return mergePolicy(parsed);
  } catch {
    return defaultAiPolicy();
  }
}

export function saveAiPolicy(next: AgentPolicyRow[]): AgentPolicyRow[] | string {
  if (typeof sessionStorage === "undefined") {
    return "No se pudo guardar en este navegador.";
  }
  const safe = mergePolicy(next);
  sessionStorage.setItem(POLICY_KEY, JSON.stringify(safe));
  recordAudit(
    `Guardó la matriz de permisos de IA (${safe.length} agentes). El módulo sigue apagado y no hay proveedor.`,
  );
  return safe;
}

export function evaluateAiAccess(
  code: string,
  action: AiAction,
  options?: { record?: boolean },
): AiAccessResult {
  const result = checkAiAccess(code, action);
  if (!result.ok && options?.record) {
    const tipo =
      result.gate === "cupo" || result.gate === "presupuesto" ? result.gate : "bloqueo";
    recordAiBlock(code, action, result.reason, tipo);
  }
  return result;
}

function checkAiAccess(code: string, action: AiAction): AiAccessResult {
  if (isEmergencyAiOff()) {
    return {
      ok: false,
      gate: "emergencia",
      reason: "Apagado de emergencia activo. No hay ejecuciones de IA.",
    };
  }
  const agent = AGENT_CATALOG.find((item) => item.code === code);
  if (!agent) {
    return { ok: false, reason: "Ese agente no está en el catálogo." };
  }
  if (agentIsHeld(code)) {
    return {
      ok: false,
      gate: "suspension",
      reason: `${code} está suspendido. No hay ejecución ni lectura de datos ocultos.`,
    };
  }
  const row = readAiPolicy().find((item) => item.code === code) ?? {
    code,
    gratis: [],
    prueba: [],
    administrador: [],
  };
  const slot = resolveSlot(agent.audience);
  if (!slot) {
    return {
      ok: false,
      gate: "matriz",
      reason: "Tu rol no puede usar agentes de administración.",
    };
  }
  if (!row[slot].includes(action)) {
    return {
      ok: false,
      gate: "matriz",
      reason: `La matriz no permite «${action}» para ${code} en ${slotLabel(slot)}.`,
    };
  }
  const quota = checkAiQuota();
  if (!quota.ok) {
    return {
      ok: false,
      gate: quota.tipo,
      reason: quota.reason,
    };
  }
  if (!AI_MODULE_ENABLED) {
    return {
      ok: false,
      gate: "modulo",
      reason: "El módulo de IA está apagado. No hay modelo ni ejecución.",
    };
  }
  return { ok: true, reason: "Permitido." };
}

function resolveSlot(audience: "usuario" | "administracion"): AiPlanSlot | null {
  if (audience === "administracion") {
    return isAdmin() ? "administrador" : null;
  }
  return readActivePlan() === "prueba" ? "prueba" : "gratis";
}

function slotLabel(slot: AiPlanSlot) {
  return AI_SLOTS.find((item) => item.id === slot)?.label ?? slot;
}

function mergePolicy(value: unknown[]): AgentPolicyRow[] {
  const byCode = new Map<string, Partial<AgentPolicyRow>>();
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const row = item as Partial<AgentPolicyRow>;
    if (typeof row.code !== "string") {
      continue;
    }
    byCode.set(row.code, row);
  }
  return defaultAiPolicy().map((base) => {
    const stored = byCode.get(base.code);
    if (!stored) {
      return base;
    }
    return {
      code: base.code,
      gratis: cleanActions(stored.gratis, base.gratis),
      prueba: cleanActions(stored.prueba, base.prueba),
      administrador: cleanActions(stored.administrador, base.administrador),
    };
  });
}

function cleanActions(value: unknown, fallback: AiAction[]): AiAction[] {
  if (!Array.isArray(value)) {
    return fallback;
  }
  const allowed = new Set(AI_ACTIONS.map((item) => item.id));
  return value.filter((item): item is AiAction => typeof item === "string" && allowed.has(item as AiAction));
}
