import { foldText, type AffinityDraft, type Modality } from "@/lib/affinity";
import { blockedOutboundText } from "@/lib/chat-rules";
import { isRemoteCommunityId } from "@/lib/remote/communities";
import {
  countRemoteCommunitySentToday,
  fetchRemoteCommunityChat,
  fetchRemoteCommunityPosts,
  peekRemoteCommunityChat,
  peekRemoteCommunityPosts,
  peekRemoteCommunitySentToday,
  publishRemoteCommunityPost,
  sendRemoteCommunityMessage,
} from "@/lib/remote/community-content";
import { remoteIdentityAvailable } from "@/lib/remote/identity";
import { readDurable, writeDurable } from "@/lib/storage";

const INTEREST_KEY = "zunela.sent-interest";
const CHAT_KEY = "zunela.community-chat";
const OWN_POSTS_KEY = "zunela.community-posts";
const REPORTS_KEY = "zunela.community-reports";

export type DiscoverKind = "persona" | "oportunidad" | "comunidad";

export type OpportunityFacts = {
  category: string;
  objective: string;
  creatorId: string;
  spotsLabel: string;
  rules: string[];
  roles: string[];
  ownStatus?: "revision" | "publicada";
  organizerName?: string;
  organizerDetail?: string;
};

export type CommunityPost = {
  id: string;
  authorId: string;
  body: string;
  when: string;
};

export type CommunityAccess = "publica" | "privada" | "invitacion";

export type CommunityFacts = {
  memberCount: number;
  rules: string[];
  members: { personId: string; role: string }[];
  posts: CommunityPost[];
  access?: CommunityAccess;
  organizerName?: string;
  invitedIds?: string[];
};

export type CommunityMessage = {
  id: string;
  author: string;
  body: string;
  at?: string;
};

export type OwnCommunityPost = {
  id: string;
  body: string;
};

export type CatalogEntry = {
  id: string;
  kind: DiscoverKind;
  title: string;
  subtitle: string;
  city: string;
  department: string;
  modality: Exclude<Modality, "ambas"> | "ambas";
  interests: string[];
  goals: string[];
  offers: string[];
  availability: string[];
  summary: string;
  opportunity?: OpportunityFacts;
  community?: CommunityFacts;
  visibility?: Partial<
    Record<"profession" | "offers" | "goals" | "availability" | "summary", "public" | "after-match">
  >;
};

export type ScoredEntry = CatalogEntry & {
  score: number;
  reasons: string[];
};

export type SentInterest = {
  personas: string[];
  oportunidades: string[];
  comunidades: string[];
  roles: Record<string, string>;
};

const EMPTY_SENT: SentInterest = {
  personas: [],
  oportunidades: [],
  comunidades: [],
  roles: {},
};

export const CATALOG: CatalogEntry[] = [
  {
    id: "laura-gomez",
    kind: "persona",
    title: "Laura Gómez",
    subtitle: "Desarrolladora",
    city: "Medellín",
    department: "Antioquia",
    modality: "ambas",
    interests: ["Programación", "Inteligencia artificial"],
    goals: ["Mentoría", "Aprender una habilidad"],
    offers: ["Desarrollo", "Consultoría"],
    availability: ["Entre semana", "Horario flexible"],
    summary: "Construye productos y comparte lo que va aprendiendo de inteligencia artificial.",
  },
  {
    id: "camila-restrepo",
    kind: "persona",
    title: "Camila Restrepo",
    subtitle: "Diseñadora de producto",
    city: "Medellín",
    department: "Antioquia",
    modality: "remota",
    interests: ["Diseño", "Programación", "Emprendimiento"],
    goals: ["Socio para un proyecto", "Apoyo en tecnología"],
    offers: ["Diseño", "Desarrollo"],
    availability: ["Tardes", "Horario flexible"],
    summary: "Busca a alguien técnico para un proyecto propio y puede aportar diseño.",
    visibility: { offers: "after-match" },
  },
  {
    id: "valentina-ruiz",
    kind: "persona",
    title: "Valentina Ruiz",
    subtitle: "Docente y mentora",
    city: "Medellín",
    department: "Antioquia",
    modality: "remota",
    interests: ["Educación", "Liderazgo"],
    goals: ["Mentoría"],
    offers: ["Docencia", "Consultoría"],
    availability: ["Mañanas", "Entre semana"],
    summary: "Acompaña a personas que quieren ordenar un proyecto o aprender una habilidad.",
  },
  {
    id: "andres-molina",
    kind: "persona",
    title: "Andrés Molina",
    subtitle: "Comercial",
    city: "Bogotá",
    department: "Cundinamarca",
    modality: "presencial",
    interests: ["Ventas", "Emprendimiento", "Networking"],
    goals: ["Equipo de ventas", "Clientes o proyectos"],
    offers: ["Ventas"],
    availability: ["Entre semana", "Mañanas"],
    summary: "Arma equipos comerciales y busca personas con experiencia de venta.",
    visibility: { availability: "after-match" },
  },
  {
    id: "santiago-perez",
    kind: "persona",
    title: "Santiago Pérez",
    subtitle: "Organizador de salidas",
    city: "Cali",
    department: "Valle del Cauca",
    modality: "presencial",
    interests: ["Senderismo", "Viajes"],
    goals: ["Actividad en grupo"],
    offers: ["Organizar actividades"],
    availability: ["Fines de semana"],
    summary: "Coordina salidas cortas con grupos pequeños y reglas claras.",
  },
  {
    id: "juan-ortiz",
    kind: "persona",
    title: "Juan Pablo Ortiz",
    subtitle: "Mercadeo",
    city: "Barranquilla",
    department: "Atlántico",
    modality: "ambas",
    interests: ["Marketing", "Comercio"],
    goals: ["Clientes o proyectos", "Apoyo en mercadeo"],
    offers: ["Mercadeo", "Redacción"],
    availability: ["Tardes", "Horario flexible"],
    summary: "Ayuda a emprendedores a contar su oferta y busca proyectos concretos.",
  },
  {
    id: "op-practica-codigo",
    kind: "oportunidad",
    title: "Práctica de programación",
    subtitle: "Conocimiento · del catálogo",
    city: "Medellín",
    department: "Antioquia",
    modality: "ambas",
    interests: ["Programación", "Inteligencia artificial"],
    goals: ["Aprender una habilidad", "Mentoría"],
    offers: ["Desarrollo"],
    availability: ["Entre semana", "Noches"],
    summary: "Grupo para resolver ejercicios y revisar proyectos. Puedes participar; no publica una oportunidad propia.",
    opportunity: {
      category: "Conocimiento",
      objective: "Practicar programación resolviendo ejercicios y revisando proyectos con otras personas.",
      creatorId: "laura-gomez",
      spotsLabel: "8 de 12 cupos",
      rules: [
        "Los ejercicios y las revisiones ocurren dentro de esta oportunidad.",
        "Participar no abre un chat privado con quien organiza.",
        "No se publican datos de contacto ni soluciones de tareas ajenas.",
        "El cupo de ejemplo es de 12 personas.",
      ],
      roles: ["Resolver ejercicios", "Revisar proyectos"],
    },
  },
  {
    id: "op-mentoria-negocio",
    kind: "oportunidad",
    title: "Mentoría para un proyecto",
    subtitle: "Negocios · del catálogo",
    city: "Bogotá",
    department: "Cundinamarca",
    modality: "remota",
    interests: ["Emprendimiento", "Liderazgo"],
    goals: ["Mentoría", "Socio para un proyecto"],
    offers: ["Consultoría"],
    availability: ["Horario flexible"],
    summary: "Sesiones cortas para ordenar una idea de negocio con alguien que ya la haya recorrido.",
    opportunity: {
      category: "Negocios",
      objective: "Ordenar una idea de negocio en sesiones cortas, sin prometer ingresos ni inversión.",
      creatorId: "valentina-ruiz",
      spotsLabel: "5 de 8 cupos",
      rules: [
        "Las sesiones son remotas y la hora se acuerda dentro de la oportunidad.",
        "No hay promesa de ingresos, clientes ni inversión.",
        "El correo y el teléfono de quien organiza siguen ocultos.",
        "El cupo de ejemplo es de 8 personas.",
      ],
      roles: ["Traer una idea concreta", "Aportar experiencia"],
    },
  },
  {
    id: "op-equipo-ventas",
    kind: "oportunidad",
    title: "Equipo de ventas de un producto digital",
    subtitle: "Negocios · del catálogo",
    city: "Bogotá",
    department: "Cundinamarca",
    modality: "presencial",
    interests: ["Ventas", "Emprendimiento"],
    goals: ["Equipo de ventas"],
    offers: ["Ventas"],
    availability: ["Entre semana", "Mañanas"],
    summary: "Un equipo existente busca personas para presentar un producto. El cupo y las reglas están definidos.",
    opportunity: {
      category: "Negocios",
      objective: "Sumarse a un equipo que ya presenta un producto digital, con cupo y alcance definidos.",
      creatorId: "andres-molina",
      spotsLabel: "4 de 6 cupos",
      rules: [
        "El producto, el cupo y el alcance se explican antes de confirmar.",
        "No se prometen ingresos garantizados.",
        "La presentación es presencial en Bogotá.",
        "El cupo de ejemplo es de 6 personas.",
      ],
      roles: ["Presentar el producto", "Conseguir reuniones"],
    },
  },
  {
    id: "op-senderismo",
    kind: "oportunidad",
    title: "Salida de senderismo",
    subtitle: "Actividad · del catálogo",
    city: "Medellín",
    department: "Antioquia",
    modality: "presencial",
    interests: ["Senderismo", "Deporte"],
    goals: ["Actividad en grupo"],
    offers: ["Organizar actividades"],
    availability: ["Fines de semana"],
    summary: "Caminata de un día con punto de encuentro, cupo y normas de la salida.",
    opportunity: {
      category: "Actividad",
      objective: "Caminar un día con un grupo pequeño, punto de encuentro y normas publicadas.",
      creatorId: "santiago-perez",
      spotsLabel: "11 de 15 cupos",
      rules: [
        "El punto de encuentro es Medellín; la hora y el nivel van en esta ficha.",
        "Cada persona lleva su hidratación y acepta las normas de la salida.",
        "El cupo se cierra al llegar al límite.",
        "El cupo de ejemplo es de 15 personas.",
      ],
      roles: ["Caminar con el grupo", "Apoyar la logística"],
    },
  },
  {
    id: "op-apoyo-diseno",
    kind: "oportunidad",
    title: "Apoyo de diseño para una feria",
    subtitle: "Colaboración · del catálogo",
    city: "Cali",
    department: "Valle del Cauca",
    modality: "presencial",
    interests: ["Diseño", "Comercio"],
    goals: ["Apoyo en diseño"],
    offers: ["Diseño"],
    availability: ["Tardes"],
    summary: "Hace falta ayuda con piezas visuales para un stand. La oportunidad ya está publicada en el catálogo.",
    opportunity: {
      category: "Colaboración",
      objective: "Ayudar con piezas visuales para un stand que ya está definido.",
      creatorId: "camila-restrepo",
      spotsLabel: "2 de 4 cupos",
      rules: [
        "El alcance son las piezas del stand, no encargos extra.",
        "El material de referencia se comparte dentro de la oportunidad.",
        "El contacto personal de quien organiza sigue oculto.",
        "El cupo de ejemplo es de 4 personas.",
      ],
      roles: ["Piezas para el stand", "Revisión visual"],
    },
  },
  {
    id: "com-programadores",
    kind: "comunidad",
    title: "Programadores en Medellín",
    subtitle: "Comunidad pública",
    city: "Medellín",
    department: "Antioquia",
    modality: "ambas",
    interests: ["Programación", "Inteligencia artificial"],
    goals: ["Aprender una habilidad", "Comunidad para aprender"],
    offers: ["Desarrollo"],
    availability: ["Noches", "Horario flexible"],
    summary: "Espacio público para preguntas, recursos y encuentros. No muestra datos de contacto.",
    community: {
      memberCount: 18,
      rules: [
        "El acceso es público: cualquiera puede ver la ficha y unirse.",
        "Las preguntas y los recursos se publican dentro de la comunidad.",
        "No se comparten correos, teléfonos ni redes.",
        "Puedes reportar una publicación; un moderador la revisa.",
      ],
      members: [{ personId: "laura-gomez", role: "Organiza" }],
      posts: [
        {
          id: "post-js",
          authorId: "laura-gomez",
          body: "El jueves revisamos un ejercicio corto. Trae una duda concreta, sin pegar datos de clientes.",
          when: "Ayer",
        },
      ],
    },
  },
  {
    id: "com-mentores",
    kind: "comunidad",
    title: "Mentores de proyectos",
    subtitle: "Comunidad pública",
    city: "Bogotá",
    department: "Cundinamarca",
    modality: "remota",
    interests: ["Emprendimiento", "Liderazgo", "Educación"],
    goals: ["Mentoría"],
    offers: ["Consultoría", "Docencia"],
    availability: ["Horario flexible"],
    summary: "Comunidad abierta para pedir y ofrecer orientación, sin publicar comunidades privadas.",
    community: {
      memberCount: 11,
      rules: [
        "Puedes pedir orientación para ordenar un proyecto.",
        "No hay promesas de ingresos, clientes ni inversión.",
        "El contacto personal de los miembros sigue oculto.",
        "Puedes reportar una publicación; un moderador la revisa.",
      ],
      members: [{ personId: "valentina-ruiz", role: "Organiza" }],
      posts: [
        {
          id: "post-guia",
          authorId: "valentina-ruiz",
          body: "Si pides mentoría, cuenta el punto en el que estás y qué decisión necesitas tomar.",
          when: "Hace 2 días",
        },
      ],
    },
  },
  {
    id: "com-senderismo",
    kind: "comunidad",
    title: "Senderismo con cupo",
    subtitle: "Comunidad pública",
    city: "Cali",
    department: "Valle del Cauca",
    modality: "presencial",
    interests: ["Senderismo", "Viajes"],
    goals: ["Actividad en grupo"],
    offers: ["Organizar actividades"],
    availability: ["Fines de semana"],
    summary: "Salidas anunciadas con reglas y cupo. La conversación del grupo llega después de entrar.",
    community: {
      memberCount: 15,
      rules: [
        "Cada salida publica punto de encuentro, hora y cupo.",
        "Confirma aquí antes de ir; el cupo se cierra al llenarse.",
        "El chat del grupo solo está disponible para quien ya entró.",
        "Puedes reportar una publicación; un moderador la revisa.",
      ],
      members: [{ personId: "santiago-perez", role: "Organiza" }],
      posts: [
        {
          id: "post-salida",
          authorId: "santiago-perez",
          body: "La próxima salida se anuncia en esta ficha con el cupo. No pidas el punto de encuentro por privado.",
          when: "Hace 3 días",
        },
      ],
    },
  },
  {
    id: "com-marketing",
    kind: "comunidad",
    title: "Mercadeo para emprendedores",
    subtitle: "Comunidad pública",
    city: "Barranquilla",
    department: "Atlántico",
    modality: "ambas",
    interests: ["Marketing", "Emprendimiento", "Comercio"],
    goals: ["Apoyo en mercadeo", "Comunidad para aprender"],
    offers: ["Mercadeo"],
    availability: ["Tardes"],
    summary: "Ideas, ejemplos y dudas de mercadeo. El contacto personal sigue oculto.",
    community: {
      memberCount: 9,
      rules: [
        "Se comparten ideas y ejemplos, no bases de contactos.",
        "El correo y el teléfono de los miembros no se publican.",
        "Las comunidades privadas no aparecen en este listado.",
        "Puedes reportar una publicación; un moderador la revisa.",
      ],
      members: [{ personId: "juan-ortiz", role: "Organiza" }],
      posts: [
        {
          id: "post-oferta",
          authorId: "juan-ortiz",
          body: "Esta semana vemos cómo contar una oferta en un párrafo, sin publicar datos de clientes.",
          when: "Hoy",
        },
      ],
    },
  },
];

export function scoreCatalog(entry: CatalogEntry, affinity: AffinityDraft, city: string): ScoredEntry {
  const sharedInterests = overlap(affinity.interests, entry.interests);
  const complementary = overlap(affinity.goals, entry.offers);
  const sharedGoals = overlap(affinity.goals, entry.goals);
  const skillHits = overlap(affinity.offers, entry.goals);
  const availabilityHits = overlap(affinity.availability, entry.availability);

  const interestScore = ratio(sharedInterests.length, affinity.interests.length);
  const goalScore = ratio(
    new Set([...complementary, ...sharedGoals].map(foldText)).size,
    affinity.goals.length,
  );
  const skillScore = affinity.offers.length === 0 ? 0 : ratio(skillHits.length, affinity.offers.length);
  const modalityScore = modalityFit(affinity.modality, entry.modality);
  const reachScore = reachFit(affinity, entry, city);
  const availabilityScore =
    affinity.availability.length === 0 ? 0.5 : ratio(availabilityHits.length, affinity.availability.length);

  const score =
    interestScore * 0.3 +
    goalScore * 0.3 +
    skillScore * 0.2 +
    ((modalityScore + reachScore) / 2) * 0.15 +
    availabilityScore * 0.05;

  const reasons: string[] = [];
  if (sharedInterests.length === 1) {
    reasons.push(`Comparten un interés: ${sharedInterests[0].toLowerCase()}`);
  } else if (sharedInterests.length > 1) {
    reasons.push(`Comparten ${sharedInterests.length} intereses`);
  }
  if (complementary.length > 0) {
    reasons.push("Sus habilidades se complementan");
  } else if (sharedGoals.length > 0) {
    reasons.push("Buscan un objetivo parecido");
  }
  if (skillHits.length > 0) {
    reasons.push("Lo que ofreces encaja con lo que busca");
  }
  if (foldText(entry.city) === foldText(city) && city) {
    reasons.push(`También está en ${entry.city}`);
  } else if (modalityScore === 1 && affinity.modality === "remota" && entry.modality !== "presencial") {
    reasons.push("Pueden trabajar en remoto");
  }

  if (reasons.length === 0) {
    reasons.push("Aparece en el catálogo para explorar");
  }

  return { ...entry, score, reasons: reasons.slice(0, 3) };
}

export function findCatalogEntry(id: string) {
  return CATALOG.find((entry) => entry.id === id) ?? null;
}

export function isPublicField(
  entry: CatalogEntry,
  field: "profession" | "offers" | "goals" | "availability" | "summary",
  options?: { connected?: boolean },
) {
  if (entry.visibility?.[field] !== "after-match") {
    return true;
  }
  return Boolean(options?.connected);
}

export function isAfterMatchField(
  entry: CatalogEntry,
  field: "profession" | "offers" | "goals" | "availability" | "summary",
) {
  return entry.visibility?.[field] === "after-match";
}

export function readSentInterest(): SentInterest {
  const raw = readDurable(INTEREST_KEY);
  if (!raw) {
    return EMPTY_SENT;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<SentInterest>;
    return {
      personas: asIds(parsed.personas),
      oportunidades: asIds(parsed.oportunidades),
      comunidades: asIds(parsed.comunidades),
      roles: asRoles(parsed.roles),
    };
  } catch {
    return EMPTY_SENT;
  }
}

export function saveSentInterest(sent: SentInterest) {
  writeDurable(INTEREST_KEY, JSON.stringify(sent));
}

export function readCommunityChat(id: string): CommunityMessage[] {
  if (isRemoteCommunityId(id)) {
    return peekRemoteCommunityChat(id);
  }
  const stored = readRecord<CommunityMessage[]>(CHAT_KEY);
  return stored[id] ?? [];
}

export function saveCommunityChat(id: string, messages: CommunityMessage[]) {
  if (isRemoteCommunityId(id)) {
    return;
  }
  const stored = readRecord<CommunityMessage[]>(CHAT_KEY);
  stored[id] = messages;
  writeDurable(CHAT_KEY, JSON.stringify(stored));
}

export async function readCommunityChatAsync(id: string) {
  if (remoteIdentityAvailable() && isRemoteCommunityId(id)) {
    return fetchRemoteCommunityChat(id);
  }
  return readCommunityChat(id);
}

export async function sendCommunityChatAsync(
  id: string,
  authorName: string,
  body: string,
): Promise<string | null> {
  if (remoteIdentityAvailable() && isRemoteCommunityId(id)) {
    const reason = await sendRemoteCommunityMessage(id, authorName, body);
    if (reason) {
      return reason;
    }
    await fetchRemoteCommunityChat(id);
    await countRemoteCommunitySentToday();
    return null;
  }
  const current = readCommunityChat(id);
  saveCommunityChat(id, [
    ...current,
    {
      id: `msg-${Date.now()}`,
      author: authorName,
      body: body.trim(),
      at: new Date().toISOString(),
    },
  ]);
  return null;
}

/** Mensajes propios enviados hoy en chats de comunidad (cupo diario compartido con el plan). */
export function communitySentTodayCount(authorName: string) {
  const foldedAuthor = foldText(authorName);
  if (!foldedAuthor) {
    return 0;
  }
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const startMs = start.getTime();
  const all = readRecord<CommunityMessage[]>(CHAT_KEY);
  let count = 0;
  for (const thread of Object.values(all)) {
    for (const message of thread) {
      if (foldText(message.author) !== foldedAuthor) {
        continue;
      }
      const stamp = messageStamp(message);
      if (stamp >= startMs) {
        count += 1;
      }
    }
  }
  return count + peekRemoteCommunitySentToday();
}

export async function refreshRemoteCommunitySentToday() {
  if (!remoteIdentityAvailable()) {
    return 0;
  }
  return countRemoteCommunitySentToday();
}

function messageStamp(message: CommunityMessage) {
  if (message.at) {
    const parsed = new Date(message.at).getTime();
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  const fromId = Number(message.id.replace(/\D/g, ""));
  return Number.isFinite(fromId) ? fromId : 0;
}

export function readOwnPosts(id: string): OwnCommunityPost[] {
  if (isRemoteCommunityId(id)) {
    return peekRemoteCommunityPosts(id).mine;
  }
  const stored = readRecord<OwnCommunityPost[]>(OWN_POSTS_KEY);
  return stored[id] ?? [];
}

export function saveOwnPosts(id: string, posts: OwnCommunityPost[]) {
  if (isRemoteCommunityId(id)) {
    return;
  }
  const stored = readRecord<OwnCommunityPost[]>(OWN_POSTS_KEY);
  stored[id] = posts;
  writeDurable(OWN_POSTS_KEY, JSON.stringify(stored));
}

export function readRemoteCommunityOtherPosts(id: string): CommunityPost[] {
  if (!isRemoteCommunityId(id)) {
    return [];
  }
  return peekRemoteCommunityPosts(id).others;
}

export async function readOwnPostsAsync(id: string) {
  if (remoteIdentityAvailable() && isRemoteCommunityId(id)) {
    const result = await fetchRemoteCommunityPosts(id);
    return result.mine;
  }
  return readOwnPosts(id);
}

export async function publishCommunityPostAsync(
  id: string,
  body: string,
): Promise<string | null> {
  if (remoteIdentityAvailable() && isRemoteCommunityId(id)) {
    const reason = await publishRemoteCommunityPost(id, body);
    if (reason) {
      return reason;
    }
    await fetchRemoteCommunityPosts(id);
    return null;
  }
  const next = [{ id: `own-${Date.now()}`, body: body.trim() }, ...readOwnPosts(id)];
  saveOwnPosts(id, next);
  return null;
}

export function readCommunityReports(): string[] {
  const raw = readDurable(REPORTS_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function saveCommunityReports(reports: string[]) {
  writeDurable(REPORTS_KEY, JSON.stringify(reports));
}

export function blockedCommunityText(value: string) {
  return blockedOutboundText(value, { scope: "comunidad" });
}

export function sentKey(kind: DiscoverKind): "personas" | "oportunidades" | "comunidades" {
  if (kind === "persona") return "personas";
  if (kind === "oportunidad") return "oportunidades";
  return "comunidades";
}

function overlap(left: string[], right: string[]) {
  const folded = new Set(right.map(foldText));
  return left.filter((item) => folded.has(foldText(item)));
}

function ratio(hits: number, total: number) {
  if (total <= 0) {
    return 0;
  }
  return Math.min(1, hits / total);
}

function modalityFit(user: Modality, entry: CatalogEntry["modality"]) {
  if (user === "ambas" || entry === "ambas" || user === entry) {
    return 1;
  }
  return 0;
}

function reachFit(affinity: AffinityDraft, entry: CatalogEntry, city: string) {
  const sameCity = Boolean(city) && foldText(entry.city) === foldText(city);
  if (affinity.reach === "nacional" || affinity.reach === "remoto") {
    return affinity.reach === "remoto" && entry.modality === "presencial" && !sameCity ? 0.35 : 1;
  }
  if (affinity.reach === "ciudad") {
    return sameCity ? 1 : entry.modality === "remota" ? 0.55 : 0.2;
  }
  const userDepartment = departmentOf(city);
  return userDepartment && foldText(userDepartment) === foldText(entry.department) ? 1 : 0.45;
}

function departmentOf(city: string) {
  return CATALOG.find((entry) => foldText(entry.city) === foldText(city))?.department ?? "";
}

function asIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function readRecord<T>(key: string): Record<string, T> {
  const raw = readDurable(key);
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed as Record<string, T>;
  } catch {
    return {};
  }
}

function asRoles(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0,
    ),
  );
}
