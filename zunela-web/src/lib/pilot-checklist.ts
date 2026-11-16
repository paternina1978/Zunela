import { readAccess } from "@/lib/access";
import { readAffinity } from "@/lib/affinity";
import { readAdminParams, readAudit, readSuspendedIds } from "@/lib/admin";
import { readAppeals } from "@/lib/appeals";
import { AI_MODULE_ENABLED, evaluateAiAccess } from "@/lib/ai-policy";
import { activeConnectionIds, readMatchBook } from "@/lib/matches";
import { readPilotMetrics } from "@/lib/pilot-metrics";
import { readProductEvents } from "@/lib/product-events";
import { readProfile } from "@/lib/profile";
import { reportAttentionStats } from "@/lib/reports";
import { remoteIdentityAvailable } from "@/lib/remote/identity";
import { canAccessAdminPanel, readRole, roleLabel } from "@/lib/roles";
import { readSession } from "@/lib/session";

export type ChecklistStatus = "ok" | "parcial" | "pendiente";

export type PilotChecklistItem = {
  id: string;
  label: string;
  status: ChecklistStatus;
  detail: string;
};

/** Criterios §13 del Documento Maestro, leídos contra el prototipo local. */
export function readPilotChecklist(): PilotChecklistItem[] {
  if (typeof sessionStorage === "undefined") {
    return [];
  }

  const access = readAccess();
  const session = readSession();
  const profile = readProfile();
  const affinity = readAffinity();
  const book = readMatchBook();
  const events = readProductEvents();
  const metrics = readPilotMetrics();
  const attention = reportAttentionStats();
  const params = readAdminParams();
  const audit = readAudit();
  const role = readRole();
  const aiProbe = evaluateAiAccess("A01", "preparar");

  const registered = Boolean(access?.email && session?.email);
  const interestsDone = Boolean(affinity && affinity.interests.length > 0 && affinity.goals.length > 0);
  const profileDone = Boolean(profile?.visibleName && profile?.city);
  const discovered = events.some((item) => /interés|interes|Postuló|comunidad/i.test(item.text));
  const chatOnlyConnected = activeConnectionIds().every((id) => book.accepted.includes(id));
  const remote = remoteIdentityAvailable();
  const copied = events.some((item) => /copia de sus datos|respaldo local/i.test(item.text));
  const restored = events.some((item) => /Restauró copia local|Restauró un respaldo/i.test(item.text));
  const erased = events.some((item) =>
    /Eliminó la cuenta|eliminacion de cuenta remota/i.test(item.text),
  );

  return [
    {
      id: "registro-intereses",
      label: "Registro e intereses sin contacto a terceros",
      status: registered && interestsDone && profileDone ? "ok" : registered || interestsDone ? "parcial" : "pendiente",
      detail: registered && interestsDone && profileDone
        ? "Cuenta, perfil e intereses listos en este navegador."
        : "Completa acceso, perfil visible e intereses/objetivos.",
    },
    {
      id: "descubrimiento",
      label: "Descubrimiento con explicación de afinidad",
      status: profileDone && interestsDone ? (discovered ? "ok" : "parcial") : "pendiente",
      detail: "Las fichas muestran razones de coincidencia; no es probabilidad de éxito.",
    },
    {
      id: "match-chat",
      label: "Chat privado solo con conexión",
      status: chatOnlyConnected ? "ok" : "parcial",
      detail: `${book.accepted.length} conexiones. El hilo privado exige aceptación bilateral.`,
    },
    {
      id: "oportunidad-gratis",
      label: "Gratis participa; crear es Premium",
      status: "ok",
      detail: "Participar en catálogo es Gratis; crear propia pide prueba Premium y revisión.",
    },
    {
      id: "cuota-comunidades",
      label: "Cuota de comunidades públicas",
      status: params.communityQuota >= 1 && params.communityQuotaDays >= 1 ? "ok" : "pendiente",
      detail: `${params.communityQuota} cada ${params.communityQuotaDays} días (cliente + API fail-closed).`,
    },
    {
      id: "chat-reportes",
      label: "Chat con reglas, bloqueo y reporte",
      status: "ok",
      detail:
        attention.averageMinutes === null
          ? `${attention.open} reportes abiertos · sin tiempo medio aún.`
          : `${attention.open} abiertos · atención media ${attention.averageMinutes} min (${attention.reviewed} revisados).`,
    },
    {
      id: "admin",
      label: "Admin: suspender, moderar, parámetros, auditoría",
      status: canAccessAdminPanel() ? "ok" : "parcial",
      detail: `Rol ${roleLabel(role)}. ${readSuspendedIds().length} suspensiones · ${readAppeals().length} apelaciones · ${audit.length} en bitácora.`,
    },
    {
      id: "privacidad",
      label: "Datos privados fuera de búsqueda y avisos",
      status: "ok",
      detail: "Contacto oculto por defecto; consentimiento bilateral en el chat.",
    },
    {
      id: "recuperacion",
      label: "Recuperación, bloqueo, eliminación y respaldo",
      status: copied || restored || erased ? "ok" : "parcial",
      detail: copied || restored || erased
        ? remote
          ? "Hay rastro de copia remota, respaldo local o borrado."
          : "Hay rastro de respaldo, restauración o borrado en este navegador."
        : remote
          ? "Remoto: descarga la copia del servidor o elimina la cuenta (RPC 018). Respaldo v2 sigue local."
          : "Local: descarga el respaldo v2, restáuralo o borra la cuenta.",
    },
    {
      id: "metricas",
      label: "Métricas de piloto sin texto de chat",
      status: metrics.length > 0 ? "ok" : "pendiente",
      detail: `${events.length} eventos de producto en esta sesión.`,
    },
    {
      id: "ia-gratis",
      label: "IA fail-closed para Gratis y sin datos ocultos",
      status: !AI_MODULE_ENABLED || !aiProbe.ok ? "ok" : "pendiente",
      detail: !AI_MODULE_ENABLED
        ? "Módulo de IA apagado. Stubs y API responden fail-closed."
        : aiProbe.ok
          ? "Revisar matriz: A01 preparó acceso inesperado."
          : aiProbe.reason,
    },
    {
      id: "aprobaciones",
      label: "Aprobaciones externas fallan cerradas",
      status: "ok",
      detail: "Sin permiso, vencidas o IA apagada no aplican cambios externos.",
    },
  ];
}

export function checklistStatusLabel(status: ChecklistStatus) {
  if (status === "ok") {
    return "Listo";
  }
  if (status === "parcial") {
    return "Parcial";
  }
  return "Pendiente";
}
