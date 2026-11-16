export type AgentAudience = "usuario" | "administracion";

export type AgentEntry = {
  code: string;
  name: string;
  audience: AgentAudience;
  purpose: string;
  phase: string;
  permission: string;
};

export const AGENT_CATALOG: AgentEntry[] = [
  {
    code: "A00",
    name: "Coordinador ZUNELA",
    audience: "usuario",
    purpose: "Entender la intención y elegir un especialista.",
    phase: "Fase 2",
    permission: "Consulta derechos. No escribe datos de negocio.",
  },
  {
    code: "A01",
    name: "Copiloto de perfil",
    audience: "usuario",
    purpose: "Mejorar presentación, intereses y metas.",
    phase: "Fase 2",
    permission: "Solo un borrador del propio perfil, con confirmación.",
  },
  {
    code: "A02",
    name: "Afinidad y match",
    audience: "usuario",
    purpose: "Buscar perfiles visibles y explicar la coincidencia.",
    phase: "Fase 2–3",
    permission: "No crea match ni abre chat.",
  },
  {
    code: "A03",
    name: "Asistente de oportunidades",
    audience: "usuario",
    purpose: "Ordenar un borrador de oportunidad.",
    phase: "Fase 2",
    permission: "No publica. Hace falta confirmación y revisión.",
  },
  {
    code: "A04",
    name: "Gestor de comunidades",
    audience: "usuario",
    purpose: "Proponer temas, reglas y actividades.",
    phase: "Fase 3",
    permission: "No agrega miembros ni publica invitaciones.",
  },
  {
    code: "A05",
    name: "Copiloto de networking",
    audience: "usuario",
    purpose: "Preparar mensajes y planes de colaboración.",
    phase: "Fase 3",
    permission: "Solo borradores. No envía mensajes.",
  },
  {
    code: "A06",
    name: "Orientador de conocimiento",
    audience: "usuario",
    purpose: "Sugerir recursos y rutas de aprendizaje.",
    phase: "Fase 3",
    permission: "No promete acreditaciones ni resultados.",
  },
  {
    code: "A07",
    name: "Traducción",
    audience: "usuario",
    purpose: "Traducir contenido ya autorizado.",
    phase: "Fase 4",
    permission: "No altera el original ni envía chats sin base de tratamiento.",
  },
  {
    code: "A08",
    name: "Confianza y moderación",
    audience: "administracion",
    purpose: "Resumir casos asignados y proponer una lectura.",
    phase: "Fase 2–3",
    permission: "No suspende ni borra. Decide una persona.",
  },
  {
    code: "A09",
    name: "Analista gerencial",
    audience: "administracion",
    purpose: "Leer cifras agregadas del piloto.",
    phase: "Fase 2–3",
    permission: "Sin chats, sin datos personales y sin SQL libre.",
  },
  {
    code: "A10",
    name: "Operaciones",
    audience: "administracion",
    purpose: "Diagnosticar y preparar cambios.",
    phase: "Fase 3",
    permission: "Ningún cambio se aplica sin aprobación.",
  },
];
