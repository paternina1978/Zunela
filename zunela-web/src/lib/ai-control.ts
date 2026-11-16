import { recordAudit } from "@/lib/admin";

const LIMITS_KEY = "zunela.ai-limits";

export type AiLimits = {
  dailyRequests: number;
  monthlyRequests: number;
  contextTokens: number;
  maxSteps: number;
  concurrency: number;
  budgetUnits: number;
};

export const DEFAULT_AI_LIMITS: AiLimits = {
  dailyRequests: 5,
  monthlyRequests: 40,
  contextTokens: 4000,
  maxSteps: 4,
  concurrency: 1,
  budgetUnits: 0,
};

export function readAiLimits(): AiLimits {
  if (typeof sessionStorage === "undefined") {
    return DEFAULT_AI_LIMITS;
  }
  const raw = sessionStorage.getItem(LIMITS_KEY);
  if (!raw) {
    return DEFAULT_AI_LIMITS;
  }
  try {
    return normalize(JSON.parse(raw) as Partial<AiLimits>, DEFAULT_AI_LIMITS);
  } catch {
    return DEFAULT_AI_LIMITS;
  }
}

export function saveAiLimits(next: AiLimits): AiLimits | string {
  if (typeof sessionStorage === "undefined") {
    return "No se pudo guardar en este navegador.";
  }
  const previous = readAiLimits();
  const safe = normalize(next, previous);
  if (safe.monthlyRequests < safe.dailyRequests) {
    return "El límite mensual no puede quedar por debajo del diario.";
  }
  sessionStorage.setItem(LIMITS_KEY, JSON.stringify(safe));
  recordAudit(
    `Límites de IA: ${safe.dailyRequests} solicitudes al día, ${safe.monthlyRequests} al mes, contexto ${safe.contextTokens}, ${safe.maxSteps} pasos, concurrencia ${safe.concurrency}, presupuesto de referencia ${safe.budgetUnits}. El módulo sigue apagado.`,
  );
  return safe;
}

function normalize(value: Partial<AiLimits>, fallback: AiLimits): AiLimits {
  return {
    dailyRequests: clamp(value.dailyRequests, 0, 100, fallback.dailyRequests),
    monthlyRequests: clamp(value.monthlyRequests, 0, 1000, fallback.monthlyRequests),
    contextTokens: clamp(value.contextTokens, 200, 16000, fallback.contextTokens),
    maxSteps: clamp(value.maxSteps, 1, 8, fallback.maxSteps),
    concurrency: clamp(value.concurrency, 1, 3, fallback.concurrency),
    budgetUnits: clamp(value.budgetUnits, 0, 10000, fallback.budgetUnits),
  };
}

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(number)));
}
