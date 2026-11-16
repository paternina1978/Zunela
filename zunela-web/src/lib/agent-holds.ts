import { recordAudit } from "@/lib/admin";
import { AGENT_CATALOG } from "@/lib/agent-catalog";

const HOLDS_KEY = "zunela.agent-holds";

export function readHeldAgents() {
  if (typeof sessionStorage === "undefined") {
    return [];
  }
  const raw = sessionStorage.getItem(HOLDS_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is string => knownAgent(item));
  } catch {
    return [];
  }
}

export function toggleAgentHold(code: string) {
  if (!knownAgent(code) || typeof sessionStorage === "undefined") {
    return readHeldAgents();
  }
  const current = readHeldAgents();
  const held = current.includes(code);
  const next = held ? current.filter((item) => item !== code) : [code, ...current];
  sessionStorage.setItem(HOLDS_KEY, JSON.stringify(next));
  const agent = AGENT_CATALOG.find((item) => item.code === code);
  const name = agent?.name ?? code;
  recordAudit(
    held
      ? `Quitó la suspensión de ${code} ${name}. El agente sigue apagado.`
      : `Suspendió ${code} ${name}. No hay ejecución ni lectura de datos ocultos.`,
  );
  return next;
}

function knownAgent(value: unknown): value is string {
  return typeof value === "string" && AGENT_CATALOG.some((agent) => agent.code === value);
}
