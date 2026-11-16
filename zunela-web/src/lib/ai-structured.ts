import { evaluateAiAccess, type AiAction, type AiAccessResult } from "@/lib/ai-policy";
import { foldText, readAffinity } from "@/lib/affinity";
import { readProfile } from "@/lib/profile";

export type StructuredAgentCode = "A00" | "A01" | "A03";

export type A00Output = {
  agente: "A00";
  origen: "reglas-locales";
  modelo: null;
  intencion: string;
  agenteSugerido: string;
  requiereConfirmacion: true;
  datosUsados: string[];
};

export type A01Output = {
  agente: "A01";
  origen: "reglas-locales";
  modelo: null;
  borrador: {
    nombreVisible: string;
    ciudad: string;
    profesion: string;
    presentacion: string;
    intereses: string[];
  };
  requiereConfirmacion: true;
  publicado: false;
};

export type A03Output = {
  agente: "A03";
  origen: "reglas-locales";
  modelo: null;
  borrador: {
    titulo: string;
    objetivo: string;
    interes: string;
    modalidad: string;
    rol: string;
  };
  validacion: string[];
  requiereConfirmacion: true;
  publicado: false;
};

export type StructuredAttempt<T> = {
  acceso: AiAccessResult;
  salida: T | null;
  nota: string;
};

export const STRUCTURED_SCHEMAS: {
  code: StructuredAgentCode;
  action: AiAction;
  title: string;
  shape: string;
}[] = [
  {
    code: "A00",
    action: "consultar",
    title: "Coordinador · intención",
    shape: '{ intencion, agenteSugerido, requiereConfirmacion, modelo: null }',
  },
  {
    code: "A01",
    action: "borrador",
    title: "Copiloto de perfil · borrador",
    shape: '{ borrador: { nombreVisible, ciudad, profesion, presentacion, intereses }, publicado: false }',
  },
  {
    code: "A03",
    action: "borrador",
    title: "Oportunidades · borrador",
    shape: '{ borrador: { titulo, objetivo, interes, modalidad, rol }, publicado: false }',
  },
];

export function attemptA00(prompt: string): StructuredAttempt<A00Output> {
  const acceso = evaluateAiAccess("A00", "consultar", { record: true });
  const salida = buildA00(prompt);
  return {
    acceso,
    salida,
    nota: acceso.ok
      ? "La salida es local. No hubo modelo."
      : `Acceso bloqueado (${acceso.gate ?? "regla"}). Se muestra solo la forma local de ejemplo.`,
  };
}

export function attemptA01(): StructuredAttempt<A01Output> {
  const acceso = evaluateAiAccess("A01", "borrador", { record: true });
  const salida = buildA01();
  return {
    acceso,
    salida,
    nota: acceso.ok
      ? "Borrador local del propio perfil. Requiere confirmación y no publica."
      : `Acceso bloqueado (${acceso.gate ?? "regla"}). El JSON es solo la forma del borrador local.`,
  };
}

export function attemptA03(input: {
  titulo: string;
  objetivo: string;
  interes: string;
  modalidad: string;
  rol: string;
}): StructuredAttempt<A03Output> {
  const acceso = evaluateAiAccess("A03", "borrador", { record: true });
  const salida = buildA03(input);
  return {
    acceso,
    salida,
    nota: acceso.ok
      ? "Borrador local. No publica la oportunidad."
      : `Acceso bloqueado (${acceso.gate ?? "regla"}). El borrador local no se publica.`,
  };
}

export function buildA00(prompt: string): A00Output {
  const text = foldText(prompt);
  let intencion = "consulta-general";
  let agenteSugerido = "A00";
  if (text.includes("perfil") || text.includes("presentacion")) {
    intencion = "mejorar-perfil";
    agenteSugerido = "A01";
  } else if (text.includes("oportunidad") || text.includes("colabor")) {
    intencion = "crear-oportunidad";
    agenteSugerido = "A03";
  } else if (text.includes("match") || text.includes("afinidad") || text.includes("persona")) {
    intencion = "buscar-afinidad";
    agenteSugerido = "A02";
  } else if (text.includes("comunidad")) {
    intencion = "organizar-comunidad";
    agenteSugerido = "A04";
  } else if (text.includes("mensaje") || text.includes("chat")) {
    intencion = "preparar-mensaje";
    agenteSugerido = "A05";
  }
  return {
    agente: "A00",
    origen: "reglas-locales",
    modelo: null,
    intencion,
    agenteSugerido,
    requiereConfirmacion: true,
    datosUsados: ["texto-de-intencion"],
  };
}

export function buildA01(): A01Output {
  const profile = readProfile();
  const affinity = readAffinity();
  return {
    agente: "A01",
    origen: "reglas-locales",
    modelo: null,
    borrador: {
      nombreVisible: profile?.visibleName ?? "",
      ciudad: profile?.city ?? "",
      profesion: profile?.profession ?? "",
      presentacion: profile?.presentation ?? "",
      intereses: affinity?.interests.slice(0, 6) ?? [],
    },
    requiereConfirmacion: true,
    publicado: false,
  };
}

export function buildA03(input: {
  titulo: string;
  objetivo: string;
  interes: string;
  modalidad: string;
  rol: string;
}): A03Output {
  const validacion: string[] = [];
  if (!input.titulo.trim()) {
    validacion.push("Falta el título.");
  }
  if (!input.objetivo.trim()) {
    validacion.push("Falta el objetivo.");
  }
  if (!input.interes.trim()) {
    validacion.push("Falta el interés.");
  }
  if (input.titulo.length > 80) {
    validacion.push("El título supera 80 caracteres.");
  }
  return {
    agente: "A03",
    origen: "reglas-locales",
    modelo: null,
    borrador: {
      titulo: input.titulo.trim(),
      objetivo: input.objetivo.trim(),
      interes: input.interes.trim(),
      modalidad: input.modalidad.trim() || "ambas",
      rol: input.rol.trim(),
    },
    validacion,
    requiereConfirmacion: true,
    publicado: false,
  };
}
