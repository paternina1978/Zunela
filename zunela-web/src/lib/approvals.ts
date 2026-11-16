import { readHeldAgents } from "@/lib/agent-holds";
import { recordAudit } from "@/lib/admin";
import { recordProductEvent } from "@/lib/product-events";

const APPROVALS_KEY = "zunela.approvals";
const TTL_MS = 90_000;

export type ApprovalAction = "cambiar-limite" | "suspender-cuenta";

export type ApprovalRequest = {
  id: string;
  action: ApprovalAction;
  label: string;
  createdAt: string;
  expiresAt: string;
  status: "pendiente" | "vencida" | "rechazada";
  reason: string;
};

const ACTION_LABELS: Record<ApprovalAction, string> = {
  "cambiar-limite": "Cambiar un límite de IA",
  "suspender-cuenta": "Suspender una cuenta de ejemplo",
};

export function readApprovals(): ApprovalRequest[] {
  return readAll().map(refreshStatus);
}

export function prepareApproval(action: ApprovalAction): ApprovalRequest | string {
  if (typeof sessionStorage === "undefined") {
    return "No se pudo preparar la solicitud en este navegador.";
  }
  if (!(action in ACTION_LABELS)) {
    return "Esa acción no está disponible.";
  }
  const now = Date.now();
  const request: ApprovalRequest = {
    id: `apr-${now}`,
    action,
    label: ACTION_LABELS[action],
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + TTL_MS).toISOString(),
    status: "pendiente",
    reason: "",
  };
  sessionStorage.setItem(APPROVALS_KEY, JSON.stringify([request, ...readAll()].slice(0, 12)));
  recordProductEvent(`Preparó la aprobación «${request.label}».`);
  recordAudit(`Preparó la aprobación ${request.id}: ${request.label}. Todavía no se aplicó.`);
  return request;
}

export function expireApproval(id: string) {
  const current = readAll();
  const next = current.map((item) => {
    if (item.id !== id) {
      return item;
    }
    return {
      ...item,
      expiresAt: new Date(Date.now() - 1000).toISOString(),
      status: "vencida" as const,
      reason: "La aprobación venció. No se aplicó el cambio.",
    };
  });
  sessionStorage.setItem(APPROVALS_KEY, JSON.stringify(next));
  recordAudit(`Marcó vencida la aprobación ${id}. No se aplicó el cambio.`);
  return readApprovals().find((item) => item.id === id) ?? null;
}

export function commitApproval(id: string): ApprovalRequest | string {
  if (typeof sessionStorage === "undefined") {
    return "No se pudo aplicar la solicitud en este navegador.";
  }
  const current = readAll();
  const index = current.findIndex((item) => item.id === id);
  if (index < 0) {
    return "No hay una aprobación con ese identificador.";
  }
  const item = refreshStatus(current[index]);
  const failure = commitFailure(item);
  const saved: ApprovalRequest = {
    ...item,
    status: item.status === "vencida" ? "vencida" : "rechazada",
    reason: failure,
  };
  const next = [...current];
  next[index] = saved;
  sessionStorage.setItem(APPROVALS_KEY, JSON.stringify(next));
  recordProductEvent(`No aplicó «${saved.label}».`);
  recordAudit(`No aplicó ${saved.id}: ${saved.reason}`);
  return saved;
}

function commitFailure(item: ApprovalRequest) {
  if (item.status === "vencida" || Date.parse(item.expiresAt) <= Date.now()) {
    return "La aprobación venció. No se aplicó el cambio.";
  }
  if (!hasPermission(item.action)) {
    return "Falta permiso. No se aplicó el cambio.";
  }
  if (!aiServiceAvailable()) {
    return "El servicio de IA no responde. No se aplicó el cambio.";
  }
  return "No se aplicó el cambio.";
}

function hasPermission(action: ApprovalAction) {
  const held = new Set(readHeldAgents());
  if (action === "cambiar-limite") {
    return !held.has("A10");
  }
  return !held.has("A08");
}

function aiServiceAvailable() {
  return false;
}

function refreshStatus(item: ApprovalRequest): ApprovalRequest {
  if (item.status !== "pendiente") {
    return item;
  }
  if (Date.parse(item.expiresAt) <= Date.now()) {
    return {
      ...item,
      status: "vencida",
      reason: item.reason || "La aprobación venció. No se aplicó el cambio.",
    };
  }
  return item;
}

function readAll(): ApprovalRequest[] {
  if (typeof sessionStorage === "undefined") {
    return [];
  }
  const raw = sessionStorage.getItem(APPROVALS_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isApproval);
  } catch {
    return [];
  }
}

function isApproval(value: unknown): value is ApprovalRequest {
  if (!value || typeof value !== "object") {
    return false;
  }
  const item = value as Partial<ApprovalRequest>;
  return (
    typeof item.id === "string" &&
    (item.action === "cambiar-limite" || item.action === "suspender-cuenta") &&
    typeof item.label === "string" &&
    typeof item.createdAt === "string" &&
    typeof item.expiresAt === "string" &&
    (item.status === "pendiente" || item.status === "vencida" || item.status === "rechazada") &&
    typeof item.reason === "string"
  );
}
