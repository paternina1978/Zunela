import { readAdminParams, recordAudit } from "@/lib/admin";
import { foldText } from "@/lib/affinity";
import { isKnownInterest } from "@/lib/catalog";
import { readActivePlan } from "@/lib/account";
import { blockedOutboundText } from "@/lib/chat-rules";
import { CATALOG, readSentInterest, saveSentInterest, type CatalogEntry, type CommunityAccess } from "@/lib/discover";
import { notifyOtherUserAsync, recordNotice, recordNoticeAsync } from "@/lib/notices";
import { recordProductEvent } from "@/lib/product-events";
import { peekRemotePerson, remoteAuthUserId } from "@/lib/remote/catalog";
import {
  admitRemoteCommunityRequest,
  approveRemoteCommunity,
  getRemoteCommunity,
  inviteRemoteToCommunity,
  isRemoteCommunityId,
  joinRemoteCommunity,
  leaveRemoteCommunity,
  listRemoteCommunities,
  peekRemoteCommunity,
  publishRemoteCommunity,
  rejectRemoteCommunityRequest,
  requestRemoteCommunityAccess,
  setRemoteCommunityMemberRole,
} from "@/lib/remote/communities";
import { remoteIdentityAvailable } from "@/lib/remote/identity";
import { readProfile } from "@/lib/profile";
import { readSession } from "@/lib/session";
import { canUseBrowserStorage, readDurable, writeDurable } from "@/lib/storage";

const OWN_KEY = "zunela.own-communities";

export type CommunityMemberRole = "organizador" | "moderador" | "miembro";

export type CommunityMember = {
  personId: string;
  name: string;
  role: CommunityMemberRole;
};

export type CommunityRequest = {
  id: string;
  name: string;
  mine: boolean;
  /** UUID del solicitante cuando la solicitud es remota. */
  applicantId?: string;
};

export type OwnCommunity = {
  id: string;
  title: string;
  summary: string;
  city: string;
  modality: "presencial" | "remota" | "ambas";
  interest: string;
  rule: string;
  access: CommunityAccess;
  organizerName: string;
  status: "revision" | "publicada";
  invitedIds: string[];
  members: CommunityMember[];
  requests: CommunityRequest[];
  createdAt?: string;
  /** UUID del organizador cuando la ficha vive en Supabase. */
  organizerId?: string;
};

let remoteCommunityCache: OwnCommunity[] = [];
let myRemoteUserId: string | null = null;

export type CommunityInput = {
  title: string;
  summary: string;
  city: string;
  modality: string;
  interest: string;
  rule: string;
  access: string;
};

const DEMO_MEMBER_NAMES = ["Natalia Quiroz", "Mateo Álvarez"];
const DEMO_REQUEST_NAMES = ["Sofía Cárdenas", "Luis Peña"];

export function readOwnCommunities(): OwnCommunity[] {
  if (!canUseBrowserStorage()) {
    return [];
  }
  const raw = readDurable(OWN_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map(normalizeCommunity).filter((item): item is OwnCommunity => Boolean(item));
  } catch {
    return [];
  }
}

export function publicCommunitiesCreated() {
  return communityQuotaStatus().used;
}

export function communityQuotaStatus() {
  const params = readAdminParams();
  const days = params.communityQuotaDays;
  const limit = params.communityQuota;
  const windowMs = days * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const since = now - windowMs;
  const mineRemote = remoteCommunityCache.filter(
    (item) => item.organizerId && myRemoteUserId && item.organizerId === myRemoteUserId,
  );
  const publicOnes = [...readOwnCommunities(), ...mineRemote]
    .filter((item) => item.access === "publica")
    .map((item) => {
      const created = item.createdAt ? new Date(item.createdAt).getTime() : 0;
      return Number.isFinite(created) && created > 0 ? created : now;
    })
    .filter((created) => created >= since)
    .sort((a, b) => a - b);

  const used = publicOnes.length;
  const oldestInWindow = publicOnes[0] ?? null;
  const resetsAt =
    used >= limit && oldestInWindow
      ? new Date(oldestInWindow + windowMs).toISOString()
      : oldestInWindow
        ? new Date(oldestInWindow + windowMs).toISOString()
        : new Date(now + windowMs).toISOString();

  return {
    used,
    limit,
    days,
    remaining: Math.max(0, limit - used),
    resetsAt,
    full: used >= limit,
  };
}

export function formatQuotaReset(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "pronto";
  }
  return date.toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function findOwnCommunity(id: string) {
  const local = readOwnCommunities().find((item) => item.id === id);
  if (local) {
    return local;
  }
  const remote = peekRemoteCommunity(id) ?? remoteCommunityCache.find((item) => item.id === id);
  if (remote && myRemoteUserId && remote.organizerId === myRemoteUserId) {
    return remote;
  }
  return null;
}

/** Cualquier comunidad remota/local por id. */
export function findStoredCommunity(id: string) {
  return (
    findOwnCommunity(id) ??
    peekRemoteCommunity(id) ??
    remoteCommunityCache.find((item) => item.id === id) ??
    null
  );
}

export async function refreshRemoteCommunityCache() {
  if (!remoteIdentityAvailable()) {
    remoteCommunityCache = [];
    myRemoteUserId = null;
    return [];
  }
  myRemoteUserId = await remoteAuthUserId();
  remoteCommunityCache = await listRemoteCommunities();
  return remoteCommunityCache;
}

export function listCachedRemoteCommunities() {
  return remoteCommunityCache;
}

export async function findStoredCommunityAsync(id: string) {
  if (remoteIdentityAvailable() && isRemoteCommunityId(id)) {
    return (await getRemoteCommunity(id)) ?? findStoredCommunity(id);
  }
  return findStoredCommunity(id);
}

export function ownCommunityEntry(item: OwnCommunity): CatalogEntry {
  const known = CATALOG.find((entry) => foldText(entry.city) === foldText(item.city));
  const accessRule =
    item.access === "privada"
      ? "El acceso es privado: hay que solicitarlo y un organizador o moderador lo acepta."
      : item.access === "invitacion"
        ? "El acceso es por invitación. Esta comunidad no aparece en Descubrir."
        : "El acceso es público: la ficha se puede ver y quien quiera puede unirse.";
  return {
    id: item.id,
    kind: "comunidad",
    title: item.title,
    subtitle: communitySubtitle(item),
    city: item.city,
    department: known?.department ?? "",
    modality: item.modality,
    interests: [item.interest],
    goals: [],
    offers: [],
    availability: [],
    summary: item.summary,
    community: {
      memberCount: Math.max(item.members.length, 1),
      rules: [
        accessRule,
        item.rule,
        "Correo, teléfono y redes no se publican.",
        item.status === "revision"
          ? "Esta comunidad está en revisión."
          : "La comunidad ya fue revisada en esta prueba.",
      ].filter((rule) => rule.length > 0),
      members: item.members.map((member) => ({
        personId: member.personId,
        role: memberRoleLabel(member.role),
      })),
      posts: [],
      access: item.access,
      organizerName: item.organizerName,
      invitedIds: item.invitedIds,
    },
  };
}

function validateCommunityInput(input: CommunityInput): string | null {
  const access = input.access;
  if (!isAccess(access)) {
    return "Elige el tipo de acceso.";
  }
  const premium = readActivePlan() === "prueba";
  if (access !== "publica" && !premium) {
    return "Las comunidades privadas y por invitación requieren la prueba Premium.";
  }
  const quota = communityQuotaStatus();
  if (access === "publica" && !premium && quota.full) {
    return `El plan Gratis permite ${quota.limit} comunidades públicas cada ${quota.days} días. El cupo se renueva el ${formatQuotaReset(quota.resetsAt)}.`;
  }
  const title = input.title.trim();
  const summary = input.summary.trim();
  const rule = input.rule.trim();
  const city = input.city.trim();
  if (title.length < 4 || title.length > 80) {
    return "El título necesita entre 4 y 80 caracteres.";
  }
  if (summary.length < 12 || summary.length > 400) {
    return "La descripción necesita entre 12 y 400 caracteres.";
  }
  if (!city) {
    return "Elige una ciudad.";
  }
  if (input.modality !== "presencial" && input.modality !== "remota" && input.modality !== "ambas") {
    return "Elige la modalidad.";
  }
  if (!isKnownInterest(input.interest)) {
    return "Elige un interés del catálogo.";
  }
  const blocked = [title, summary, rule].map(blockedCommunityField).find((reason) => reason);
  return blocked ?? null;
}

export function publishOwnCommunity(input: CommunityInput) {
  const invalid = validateCommunityInput(input);
  if (invalid) {
    return invalid;
  }
  const access = input.access as CommunityAccess;
  const title = input.title.trim();
  const summary = input.summary.trim();
  const rule = input.rule.trim();
  const city = input.city.trim();
  const profile = readProfile();
  const session = readSession();
  const organizerName = profile?.visibleName || session?.visibleName || "Tu sesión";
  const item: OwnCommunity = {
    id: `com-propia-${Date.now()}`,
    title,
    summary,
    city,
    modality: input.modality as OwnCommunity["modality"],
    interest: input.interest,
    rule,
    access,
    organizerName,
    status: "revision",
    invitedIds: [],
    members: [{ personId: "sesion", name: organizerName, role: "organizador" }],
    requests: [],
    createdAt: new Date().toISOString(),
  };
  writeDurable(OWN_KEY, JSON.stringify([item, ...readOwnCommunities()]));
  const sent = readSentInterest();
  if (!sent.comunidades.includes(item.id)) {
    saveSentInterest({ ...sent, comunidades: [...sent.comunidades, item.id] });
  }
  recordAudit(`Creó la comunidad «${title}» (${accessLabel(access)}). Quedó en revisión.`);
  recordProductEvent(`Envió a revisión la comunidad «${title}».`);
  return item;
}

export async function publishOwnCommunityAsync(input: CommunityInput) {
  if (remoteIdentityAvailable()) {
    const invalid = validateCommunityInput(input);
    if (invalid) {
      return invalid;
    }
    const profile = readProfile();
    const session = readSession();
    const organizerName = profile?.visibleName || session?.visibleName || "Tu sesión";
    const result = await publishRemoteCommunity({
      ...input,
      title: input.title.trim(),
      summary: input.summary.trim(),
      city: input.city.trim(),
      rule: input.rule.trim(),
      organizerName,
    });
    if (typeof result === "string") {
      return result;
    }
    remoteCommunityCache = [result, ...remoteCommunityCache.filter((item) => item.id !== result.id)];
    const sent = readSentInterest();
    if (!sent.comunidades.includes(result.id)) {
      saveSentInterest({ ...sent, comunidades: [...sent.comunidades, result.id] });
    }
    recordAudit(
      `Creó la comunidad «${result.title}» (${accessLabel(result.access)}). Quedó en revisión.`,
    );
    recordProductEvent(`Envió a revisión la comunidad «${result.title}».`);
    return result;
  }
  return publishOwnCommunity(input);
}

export function approveOwnCommunity(id: string) {
  if (isRemoteCommunityId(id)) {
    return;
  }
  const items = readOwnCommunities();
  const current = items.find((item) => item.id === id);
  if (!current || current.status === "publicada") {
    return;
  }
  const seeded = seedPublishedMembership(current);
  writeCommunities(items.map((item) => (item.id === id ? seeded : item)));
  recordAudit(`Aprobó la comunidad «${current.title}».`);
}

export async function approveOwnCommunityAsync(id: string) {
  if (remoteIdentityAvailable() && isRemoteCommunityId(id)) {
    const current = findStoredCommunity(id);
    const reason = await approveRemoteCommunity(id);
    if (reason) {
      return reason;
    }
    await refreshRemoteCommunityCache();
    if (current) {
      recordAudit(`Aprobó la comunidad «${current.title}».`);
    }
    return null;
  }
  approveOwnCommunity(id);
  return null;
}

export function ensurePublishedCommunityExtras(id: string) {
  if (isRemoteCommunityId(id)) {
    return findStoredCommunity(id);
  }
  const items = readOwnCommunities();
  const current = items.find((item) => item.id === id);
  if (!current || current.status !== "publicada") {
    return current;
  }
  const seeded = seedPublishedMembership(current);
  if (seeded === current) {
    return current;
  }
  writeCommunities(items.map((item) => (item.id === id ? seeded : item)));
  return seeded;
}

export function requestCommunityAccess(id: string) {
  if (isRemoteCommunityId(id)) {
    return "Usa la solicitud remota para esta comunidad.";
  }
  const items = readOwnCommunities();
  const current = items.find((item) => item.id === id);
  if (!current || current.access !== "privada") {
    return "Esta comunidad no recibe solicitudes.";
  }
  if (readSentInterest().comunidades.includes(id)) {
    return null;
  }
  if (current.requests.some((request) => request.mine)) {
    return null;
  }
  const profile = readProfile();
  const session = readSession();
  const request: CommunityRequest = {
    id: `req-sesion-${Date.now()}`,
    name: profile?.visibleName || session?.visibleName || "Tu sesión",
    mine: true,
  };
  writeCommunities(
    items.map((item) =>
      item.id === id ? { ...item, requests: [...item.requests, request] } : item,
    ),
  );
  recordAudit(`Solicitó acceso a «${current.title}».`);
  recordNotice("comunidad", `Solicitaste acceso a «${current.title}».`, `req-${id}`);
  return null;
}

export async function requestCommunityAccessAsync(id: string) {
  if (remoteIdentityAvailable() && isRemoteCommunityId(id)) {
    const current = findStoredCommunity(id);
    if (!current || current.access !== "privada") {
      return "Esta comunidad no recibe solicitudes.";
    }
    if (current.requests.some((request) => request.mine) || readSentInterest().comunidades.includes(id)) {
      return null;
    }
    const profile = readProfile();
    const session = readSession();
    const name = profile?.visibleName || session?.visibleName || "Tu sesión";
    const reason = await requestRemoteCommunityAccess(id, name);
    if (reason) {
      return reason;
    }
    await refreshRemoteCommunityCache();
    await recordNoticeAsync("comunidad", `Solicitaste acceso a «${current.title}».`, `req-${id}`);
    recordAudit(`Solicitó acceso a «${current.title}».`);
    return null;
  }
  return requestCommunityAccess(id);
}

export function admitCommunityRequest(communityId: string, requestId?: string) {
  if (isRemoteCommunityId(communityId)) {
    return "Usa la admisión remota para esta comunidad.";
  }
  const items = readOwnCommunities();
  const current = items.find((item) => item.id === communityId);
  if (!current || current.requests.length === 0) {
    return "No hay solicitudes pendientes.";
  }
  const target =
    (requestId ? current.requests.find((item) => item.id === requestId) : null) ??
    current.requests.find((item) => item.mine) ??
    current.requests[0];
  if (!target) {
    return "No se encontró la solicitud.";
  }
  const personId = target.mine ? "sesion" : `demo-${target.id}`;
  const alreadyMember = current.members.some((member) => member.personId === personId);
  const members = alreadyMember
    ? current.members
    : [...current.members, { personId, name: target.name, role: "miembro" as const }];
  writeCommunities(
    items.map((item) =>
      item.id === communityId
        ? {
            ...item,
            members,
            requests: item.requests.filter((request) => request.id !== target.id),
          }
        : item,
    ),
  );
  if (target.mine) {
    const sent = readSentInterest();
    if (!sent.comunidades.includes(communityId)) {
      saveSentInterest({ ...sent, comunidades: [...sent.comunidades, communityId] });
    }
    recordNotice("comunidad", `Te aceptaron en «${current.title}».`, `admit-${communityId}`);
  }
  recordAudit(`Admitió a ${target.name} en «${current.title}».`);
  recordProductEvent(`Admitió una solicitud en «${current.title}».`);
  return null;
}

export async function admitCommunityRequestAsync(communityId: string, requestId?: string) {
  if (remoteIdentityAvailable() && isRemoteCommunityId(communityId)) {
    const current = findStoredCommunity(communityId);
    if (!current || current.requests.length === 0) {
      return "No hay solicitudes pendientes.";
    }
    const target =
      (requestId ? current.requests.find((item) => item.id === requestId) : null) ??
      current.requests[0];
    if (!target) {
      return "No se encontró la solicitud.";
    }
    const reason = await admitRemoteCommunityRequest(communityId, target.id);
    if (reason) {
      return reason;
    }
    await refreshRemoteCommunityCache();
    recordAudit(`Admitió a ${target.name} en «${current.title}».`);
    recordProductEvent(`Admitió una solicitud en «${current.title}».`);
    if (target.applicantId) {
      await notifyOtherUserAsync(
        target.applicantId,
        "comunidad",
        `Te aceptaron en «${current.title}».`,
        `admit-${communityId}`,
      );
    }
    return null;
  }
  return admitCommunityRequest(communityId, requestId);
}

export function rejectCommunityRequest(communityId: string, requestId: string) {
  if (isRemoteCommunityId(communityId)) {
    return "Usa el rechazo remoto para esta comunidad.";
  }
  const items = readOwnCommunities();
  const current = items.find((item) => item.id === communityId);
  if (!current) {
    return "No se encontró la comunidad.";
  }
  const target = current.requests.find((item) => item.id === requestId);
  if (!target) {
    return "No se encontró la solicitud.";
  }
  writeCommunities(
    items.map((item) =>
      item.id === communityId
        ? { ...item, requests: item.requests.filter((request) => request.id !== requestId) }
        : item,
    ),
  );
  if (target.mine) {
    recordNotice("comunidad", `No te admitieron en «${current.title}».`, `reject-${communityId}`);
  }
  recordAudit(`Rechazó la solicitud de ${target.name} en «${current.title}».`);
  return null;
}

export async function rejectCommunityRequestAsync(communityId: string, requestId: string) {
  if (remoteIdentityAvailable() && isRemoteCommunityId(communityId)) {
    const current = findStoredCommunity(communityId);
    if (!current) {
      return "No se encontró la comunidad.";
    }
    const target = current.requests.find((item) => item.id === requestId);
    if (!target) {
      return "No se encontró la solicitud.";
    }
    const reason = await rejectRemoteCommunityRequest(communityId, requestId);
    if (reason) {
      return reason;
    }
    await refreshRemoteCommunityCache();
    recordAudit(`Rechazó la solicitud de ${target.name} en «${current.title}».`);
    if (target.applicantId) {
      await notifyOtherUserAsync(
        target.applicantId,
        "comunidad",
        `No te admitieron en «${current.title}».`,
        `reject-${communityId}`,
      );
    }
    return null;
  }
  return rejectCommunityRequest(communityId, requestId);
}

export function setCommunityMemberRole(
  communityId: string,
  personId: string,
  role: Exclude<CommunityMemberRole, "organizador">,
) {
  if (isRemoteCommunityId(communityId)) {
    return "Usa el cambio de rol remoto para esta comunidad.";
  }
  const items = readOwnCommunities();
  const current = items.find((item) => item.id === communityId);
  if (!current) {
    return "No se encontró la comunidad.";
  }
  const member = current.members.find((item) => item.personId === personId);
  if (!member) {
    return "No se encontró el miembro.";
  }
  if (member.role === "organizador" || personId === "sesion") {
    return "El organizador no cambia de rol en esta prueba.";
  }
  writeCommunities(
    items.map((item) =>
      item.id === communityId
        ? {
            ...item,
            members: item.members.map((entry) =>
              entry.personId === personId ? { ...entry, role } : entry,
            ),
          }
        : item,
    ),
  );
  recordAudit(
    role === "moderador"
      ? `Nombró moderador a ${member.name} en «${current.title}».`
      : `Dejó como miembro a ${member.name} en «${current.title}».`,
  );
  recordProductEvent(`Actualizó un rol en «${current.title}».`);
  return null;
}

export async function setCommunityMemberRoleAsync(
  communityId: string,
  personId: string,
  role: Exclude<CommunityMemberRole, "organizador">,
) {
  if (remoteIdentityAvailable() && isRemoteCommunityId(communityId)) {
    const current = findStoredCommunity(communityId);
    if (!current) {
      return "No se encontró la comunidad.";
    }
    const member = current.members.find((item) => item.personId === personId);
    if (!member) {
      return "No se encontró el miembro.";
    }
    if (member.role === "organizador" || (myRemoteUserId && personId === myRemoteUserId)) {
      return "El organizador no cambia de rol en esta prueba.";
    }
    const reason = await setRemoteCommunityMemberRole(communityId, personId, role);
    if (reason) {
      return reason;
    }
    await refreshRemoteCommunityCache();
    recordAudit(
      role === "moderador"
        ? `Nombró moderador a ${member.name} en «${current.title}».`
        : `Dejó como miembro a ${member.name} en «${current.title}».`,
    );
    recordProductEvent(`Actualizó un rol en «${current.title}».`);
    return null;
  }
  return setCommunityMemberRole(communityId, personId, role);
}

export function sessionCommunityRole(communityId: string): CommunityMemberRole | null {
  const stored = findStoredCommunity(communityId);
  if (!stored) {
    return null;
  }
  if (myRemoteUserId) {
    return stored.members.find((member) => member.personId === myRemoteUserId)?.role ?? null;
  }
  return stored.members.find((member) => member.personId === "sesion")?.role ?? null;
}

export async function joinCommunityAsync(communityId: string) {
  if (remoteIdentityAvailable() && isRemoteCommunityId(communityId)) {
    const stored = findStoredCommunity(communityId);
    if (!stored || stored.access !== "publica" || stored.status !== "publicada") {
      return "No puedes unirte a esta comunidad.";
    }
    const profile = readProfile();
    const session = readSession();
    const name = profile?.visibleName || session?.visibleName || "Tu sesión";
    const reason = await joinRemoteCommunity(communityId, name);
    if (reason) {
      return reason;
    }
    await refreshRemoteCommunityCache();
    return null;
  }
  return null;
}

export async function leaveCommunityAsync(communityId: string) {
  if (remoteIdentityAvailable() && isRemoteCommunityId(communityId)) {
    const reason = await leaveRemoteCommunity(communityId);
    if (reason) {
      return reason;
    }
    await refreshRemoteCommunityCache();
    return null;
  }
  return null;
}

export function inviteToCommunity(id: string, personId: string) {
  if (isRemoteCommunityId(id)) {
    return "Usa la invitación remota para esta comunidad.";
  }
  const person = CATALOG.find((entry) => entry.id === personId && entry.kind === "persona");
  if (!person) {
    return "Elige a una persona del catálogo.";
  }
  const items = readOwnCommunities();
  const current = items.find((item) => item.id === id);
  if (!current || current.access !== "invitacion") {
    return "Esta comunidad no usa invitaciones.";
  }
  if (current.invitedIds.includes(personId)) {
    return null;
  }
  const members = current.members.some((member) => member.personId === personId)
    ? current.members
    : [...current.members, { personId, name: person.title, role: "miembro" as const }];
  writeCommunities(
    items.map((item) =>
      item.id === id
        ? { ...item, invitedIds: [...item.invitedIds, personId], members }
        : item,
    ),
  );
  recordAudit(`Invitó a ${person.title} a «${current.title}». El correo no se comparte.`);
  recordNotice("comunidad", `Invitaste a ${person.title} a «${current.title}».`, `invite-${id}`);
  return null;
}

export async function inviteToCommunityAsync(id: string, personId: string) {
  if (remoteIdentityAvailable() && isRemoteCommunityId(id)) {
    const current = findStoredCommunity(id);
    if (!current || current.access !== "invitacion") {
      return "Esta comunidad no usa invitaciones.";
    }
    const person =
      CATALOG.find((entry) => entry.id === personId && entry.kind === "persona") ??
      peekRemotePerson(personId);
    if (!person || person.kind !== "persona") {
      return "Elige a una persona del catálogo.";
    }
    if (current.invitedIds.includes(personId)) {
      return null;
    }
    const reason = await inviteRemoteToCommunity(id, personId, person.title);
    if (reason) {
      return reason;
    }
    await refreshRemoteCommunityCache();
    recordAudit(`Invitó a ${person.title} a «${current.title}». El correo no se comparte.`);
    recordNotice("comunidad", `Invitaste a ${person.title} a «${current.title}».`, `invite-${id}`);
    return null;
  }
  return inviteToCommunity(id, personId);
}

export function accessLabel(access: CommunityAccess) {
  if (access === "privada") return "privada";
  if (access === "invitacion") return "por invitación";
  return "pública";
}

export function memberRoleLabel(role: CommunityMemberRole) {
  if (role === "organizador") {
    return "Organiza";
  }
  if (role === "moderador") {
    return "Modera";
  }
  return "Miembro";
}

function seedPublishedMembership(current: OwnCommunity) {
  let members = current.members.length > 0 ? [...current.members] : [];
  if (!members.some((member) => member.personId === "sesion")) {
    members = [
      { personId: "sesion", name: current.organizerName, role: "organizador" },
      ...members,
    ];
  }
  const hasDemoMembers = members.some((member) => member.personId.startsWith("demo-"));
  if (!hasDemoMembers) {
    members = [
      ...members,
      ...DEMO_MEMBER_NAMES.map((name, index) => ({
        personId: `demo-member-${current.id}-${index}`,
        name,
        role: (index === 0 ? "moderador" : "miembro") as CommunityMemberRole,
      })),
    ];
  }
  let requests = [...current.requests];
  if (current.access === "privada" && requests.filter((item) => !item.mine).length === 0) {
    requests = [
      ...requests,
      ...DEMO_REQUEST_NAMES.map((name, index) => ({
        id: `req-demo-${current.id}-${index}`,
        name,
        mine: false,
      })),
    ];
  }
  const sameMembers =
    members.length === current.members.length &&
    members.every(
      (member, index) =>
        current.members[index]?.personId === member.personId &&
        current.members[index]?.role === member.role,
    );
  const sameRequests =
    requests.length === current.requests.length &&
    requests.every((request, index) => current.requests[index]?.id === request.id);
  if (sameMembers && sameRequests) {
    return current;
  }
  return { ...current, members, requests, status: "publicada" as const };
}

function communitySubtitle(item: OwnCommunity) {
  const review = item.status === "revision" ? " · en revisión" : "";
  if (item.access === "privada") return `Comunidad privada${review}`;
  if (item.access === "invitacion") return `Comunidad por invitación${review}`;
  const mine =
    !item.organizerId ||
    (Boolean(myRemoteUserId) && item.organizerId === myRemoteUserId) ||
    item.members.some((member) => member.personId === "sesion" && member.role === "organizador");
  return mine ? `Comunidad pública · tuya${review}` : `Comunidad pública${review}`;
}

function writeCommunities(items: OwnCommunity[]) {
  writeDurable(OWN_KEY, JSON.stringify(items));
}

function blockedCommunityField(value: string) {
  if (!value) {
    return null;
  }
  const reason = blockedOutboundText(value, { scope: "comunidad", maxLength: 400 });
  if (!reason || reason.startsWith("Escribe")) {
    return null;
  }
  return reason.replace("No se envió:", "No se creó:").replace(" en la comunidad.", " en una comunidad.");
}

function isAccess(value: string): value is CommunityAccess {
  return value === "publica" || value === "privada" || value === "invitacion";
}

function normalizeCommunity(value: unknown): OwnCommunity | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const item = value as Partial<OwnCommunity> & { requests?: unknown; members?: unknown };
  if (
    typeof item.id !== "string" ||
    typeof item.title !== "string" ||
    typeof item.summary !== "string" ||
    typeof item.city !== "string" ||
    (item.modality !== "presencial" && item.modality !== "remota" && item.modality !== "ambas") ||
    typeof item.interest !== "string" ||
    typeof item.rule !== "string" ||
    typeof item.access !== "string" ||
    !isAccess(item.access) ||
    typeof item.organizerName !== "string" ||
    (item.status !== "revision" && item.status !== "publicada") ||
    !Array.isArray(item.invitedIds)
  ) {
    return null;
  }
  return {
    id: item.id,
    title: item.title,
    summary: item.summary,
    city: item.city,
    modality: item.modality,
    interest: item.interest,
    rule: item.rule,
    access: item.access,
    organizerName: item.organizerName,
    status: item.status,
    invitedIds: item.invitedIds.filter((entry): entry is string => typeof entry === "string"),
    members: normalizeMembers(item.members, item.organizerName),
    requests: normalizeRequests(item.requests),
    createdAt: typeof item.createdAt === "string" ? item.createdAt : undefined,
    organizerId: typeof item.organizerId === "string" ? item.organizerId : undefined,
  };
}

function normalizeMembers(value: unknown, organizerName: string): CommunityMember[] {
  if (!Array.isArray(value) || value.length === 0) {
    return [{ personId: "sesion", name: organizerName, role: "organizador" }];
  }
  const members = value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }
    const row = entry as Partial<CommunityMember>;
    if (typeof row.personId !== "string" || typeof row.name !== "string") {
      return [];
    }
    const role =
      row.role === "organizador" || row.role === "moderador" || row.role === "miembro"
        ? row.role
        : "miembro";
    return [{ personId: row.personId, name: row.name, role }];
  });
  return members.length > 0
    ? members
    : [{ personId: "sesion", name: organizerName, role: "organizador" }];
}

function normalizeRequests(value: unknown): CommunityRequest[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry, index) => {
    if (typeof entry === "string") {
      return [
        {
          id: `req-legacy-${entry}-${index}`,
          name: entry === "sesion" ? "Tu sesión" : entry,
          mine: entry === "sesion",
        },
      ];
    }
    if (!entry || typeof entry !== "object") {
      return [];
    }
    const row = entry as Partial<CommunityRequest>;
    if (typeof row.id !== "string" || typeof row.name !== "string") {
      return [];
    }
    return [{ id: row.id, name: row.name, mine: row.mine === true }];
  });
}
