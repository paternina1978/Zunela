import { readAffinity } from "@/lib/affinity";
import { readMatchBook } from "@/lib/matches";
import { readPilotPresence, retentionFlags } from "@/lib/pilot-presence";
import { readProductEvents } from "@/lib/product-events";
import { readProfile } from "@/lib/profile";
import { reportAttentionStats } from "@/lib/reports";
import { canUseBrowserStorage } from "@/lib/storage";

export type PilotMetric = {
  id: string;
  label: string;
  value: string;
  detail: string;
};

export function readPilotMetrics(): PilotMetric[] {
  if (!canUseBrowserStorage()) {
    return [];
  }
  const events = readProductEvents();
  const profile = readProfile();
  const affinity = readAffinity();
  const matches = readMatchBook();
  const presence = readPilotPresence();
  const retention = retentionFlags(presence);
  const interests = events.filter((item) => /interés|interes/i.test(item.text)).length;
  const messages = events.filter((item) => /mensaje/i.test(item.text)).length;
  const attention = reportAttentionStats();
  const trial = events.some((item) => /prueba Premium/i.test(item.text));
  const approvals = events.filter((item) => /No aplicó/i.test(item.text)).length;
  const activated = Boolean(profile?.visibleName && (affinity?.interests.length ?? 0) > 0);

  return [
    {
      id: "activacion",
      label: "Activación",
      value: activated ? "Lista" : "Pendiente",
      detail: activated
        ? "Perfil e intereses guardados en este navegador."
        : "Falta perfil o intereses para completar la activación.",
    },
    {
      id: "descubrimiento",
      label: "Descubrimiento útil",
      value: String(interests),
      detail: "Intereses enviados o participaciones registradas, sin textos de chat.",
    },
    {
      id: "match",
      label: "Conexiones",
      value: String(matches.accepted.length),
      detail: `${matches.incoming.length} solicitudes pendientes en este navegador.`,
    },
    {
      id: "conversacion",
      label: "Conversación",
      value: String(messages),
      detail: "Mensajes enviados o avisos de actividad. No se guarda el cuerpo del mensaje.",
    },
    {
      id: "seguridad",
      label: "Seguridad",
      value: String(attention.open),
      detail:
        attention.averageMinutes === null
          ? `${attention.reviewed} revisados · sin tiempo medio aún. Sin el contenido denunciado.`
          : `${attention.reviewed} revisados · atención media ${attention.averageMinutes} min. Sin el contenido denunciado.`,
    },
    {
      id: "retencion-d7",
      label: "Retención D7",
      value: retention.d7 ? "Sí" : "No",
      detail: presence
        ? `${retention.daysActive} días entre primera y última visita en este navegador.`
        : "Aún no hay marca de presencia del piloto.",
    },
    {
      id: "retencion-d30",
      label: "Retención D30",
      value: retention.d30 ? "Sí" : "No",
      detail: presence
        ? `Primera visita ${new Date(presence.firstSeenAt).toLocaleDateString("es-CO")}.`
        : "Aún no hay marca de presencia del piloto.",
    },
    {
      id: "prueba",
      label: "Prueba Premium",
      value: trial ? "Iniciada" : "No",
      detail: "Solo el hecho de la prueba. No hay cobro ni tarifa en este navegador.",
    },
    {
      id: "aprobaciones",
      label: "Aprobaciones fallidas",
      value: String(approvals),
      detail: "Cambios externos que no se aplicaron por permiso, vencimiento o IA apagada.",
    },
  ];
}
