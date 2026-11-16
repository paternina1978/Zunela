import { evaluateAiAccess } from "@/lib/ai-policy";
import { readPilotMetrics, type PilotMetric } from "@/lib/pilot-metrics";

export type A09Aggregate = {
  agente: "A09";
  origen: "agregados-locales";
  modelo: null;
  metricas: { id: string; etiqueta: string; valor: string }[];
  incluyePersonas: false;
  incluyeChats: false;
  sqlLibre: false;
};

export type A08CaseBrief = {
  key: string;
  asignadoA: "moderacion-piloto";
  etiqueta: string;
  lecturaPropuesta: string;
  sancionAutomatica: false;
  cuerpoMensaje: null;
};

export type A08Bundle = {
  agente: "A08";
  origen: "expedientes-asignados";
  modelo: null;
  casos: A08CaseBrief[];
  sancionAutomatica: false;
};

export function attemptA09() {
  const acceso = evaluateAiAccess("A09", "consultar", { record: true });
  const salida = buildA09(readPilotMetrics());
  return {
    acceso,
    salida,
    nota: acceso.ok
      ? "Lectura agregada local. Sin chats ni identificadores."
      : `Acceso bloqueado (${acceso.gate ?? "regla"}). Se muestra la forma agregada local.`,
  };
}

export function attemptA08(cases: { key: string; label: string; detail: string }[]) {
  const acceso = evaluateAiAccess("A08", "revisar", { record: true });
  const salida = buildA08(cases);
  return {
    acceso,
    salida,
    nota: acceso.ok
      ? "Expedientes asignados. Una persona decide; no hay sanción automática."
      : `Acceso bloqueado (${acceso.gate ?? "regla"}). La lista local no aplica sanciones.`,
  };
}

export function buildA09(metrics: PilotMetric[]): A09Aggregate {
  return {
    agente: "A09",
    origen: "agregados-locales",
    modelo: null,
    metricas: metrics.map((item) => ({
      id: item.id,
      etiqueta: item.label,
      valor: item.value,
    })),
    incluyePersonas: false,
    incluyeChats: false,
    sqlLibre: false,
  };
}

export function buildA08(cases: { key: string; label: string; detail: string }[]): A08Bundle {
  return {
    agente: "A08",
    origen: "expedientes-asignados",
    modelo: null,
    sancionAutomatica: false,
    casos: cases.map((item) => ({
      key: item.key,
      asignadoA: "moderacion-piloto",
      etiqueta: item.label,
      lecturaPropuesta: proposeReading(item.label, item.detail),
      sancionAutomatica: false,
      cuerpoMensaje: null,
    })),
  };
}

function proposeReading(label: string, detail: string) {
  if (/comunidad|publicaci/i.test(`${label} ${detail}`)) {
    return "Revisar la publicación o el espacio. No suspender de oficio.";
  }
  if (/mensaje|chat|privado/i.test(`${label} ${detail}`)) {
    return "Revisar el reporte de chat sin abrir el cuerpo del mensaje en este resumen.";
  }
  return "Revisar el expediente asignado. Decisión humana; sin sanción automática.";
}
