/**
 * Comunidades remotas (UUID): ficha, miembros, solicitudes e invitaciones.
 * Chat/posts siguen locales.
 */

import type {
  CommunityMember,
  CommunityMemberRole,
  CommunityRequest,
  CommunityInput,
  OwnCommunity,
} from "@/lib/own-communities";
import { isRemotePersonId } from "@/lib/remote/connections";
import { remoteIdentityAvailable } from "@/lib/remote/identity";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { CommunityAccess } from "@/lib/discover";

export type CommunityRow = {
  id: string;
  organizer_id: string;
  title: string;
  summary: string;
  city: string;
  modality: OwnCommunity["modality"];
  interest: string;
  rule: string;
  access: CommunityAccess;
  organizer_name: string;
  status: OwnCommunity["status"];
  created_at: string;
};

type MemberRow = {
  id: string;
  community_id: string;
  person_id: string;
  name: string;
  role: CommunityMemberRole;
};

type RequestRow = {
  id: string;
  community_id: string;
  applicant_id: string;
  applicant_name: string;
};

type InviteRow = {
  community_id: string;
  person_id: string;
};

const communityCache = new Map<string, OwnCommunity>();

export function isRemoteCommunityId(id: string) {
  return isRemotePersonId(id);
}

export function peekRemoteCommunity(id: string): OwnCommunity | null {
  return communityCache.get(id) ?? null;
}

function remember(item: OwnCommunity) {
  communityCache.set(item.id, item);
  return item;
}

export async function listRemoteCommunities(): Promise<OwnCommunity[]> {
  const client = getSupabaseBrowserClient();
  if (!client || !remoteIdentityAvailable()) {
    return [];
  }
  const { data, error } = await client
    .from("communities")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data) {
    return [];
  }
  const rows = data as CommunityRow[];
  const enriched: OwnCommunity[] = [];
  for (const row of rows) {
    enriched.push(await hydrateCommunity(row));
  }
  return enriched;
}

export async function getRemoteCommunity(id: string): Promise<OwnCommunity | null> {
  const client = getSupabaseBrowserClient();
  if (!client || !remoteIdentityAvailable() || !isRemoteCommunityId(id)) {
    return null;
  }
  const { data, error } = await client.from("communities").select("*").eq("id", id).maybeSingle();
  if (error || !data) {
    return null;
  }
  return hydrateCommunity(data as CommunityRow);
}

async function hydrateCommunity(row: CommunityRow): Promise<OwnCommunity> {
  const client = getSupabaseBrowserClient();
  if (!client) {
    return remember(rowToBase(row, [], [], []));
  }
  const [{ data: members }, { data: requests }, { data: invites }] = await Promise.all([
    client.from("community_members").select("*").eq("community_id", row.id),
    client.from("community_requests").select("*").eq("community_id", row.id),
    client.from("community_invites").select("*").eq("community_id", row.id),
  ]);
  const {
    data: { user },
  } = await client.auth.getUser();
  const me = user?.id;
  return remember(
    rowToBase(
      row,
      ((members ?? []) as MemberRow[]).map((m) => ({
        personId: m.person_id,
        name: m.name,
        role: m.role,
      })),
      ((requests ?? []) as RequestRow[]).map((r) => ({
        id: r.id,
        name: r.applicant_name,
        mine: Boolean(me && r.applicant_id === me),
        applicantId: r.applicant_id,
      })),
      ((invites ?? []) as InviteRow[]).map((i) => i.person_id),
    ),
  );
}

function rowToBase(
  row: CommunityRow,
  members: CommunityMember[],
  requests: CommunityRequest[],
  invitedIds: string[],
): OwnCommunity {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    city: row.city,
    modality: row.modality,
    interest: row.interest,
    rule: row.rule ?? "",
    access: row.access,
    organizerName: row.organizer_name,
    status: row.status,
    invitedIds,
    members:
      members.length > 0
        ? members
        : [{ personId: row.organizer_id, name: row.organizer_name, role: "organizador" }],
    requests,
    createdAt: row.created_at,
    organizerId: row.organizer_id,
  };
}

export async function publishRemoteCommunity(
  input: CommunityInput & { organizerName: string },
): Promise<OwnCommunity | string> {
  const client = getSupabaseBrowserClient();
  if (!client || !remoteIdentityAvailable()) {
    return "El backend remoto no está configurado.";
  }
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return "No hay sesión remota.";
  }

  const { data, error } = await client
    .from("communities")
    .insert({
      organizer_id: user.id,
      title: input.title.trim(),
      summary: input.summary.trim(),
      city: input.city.trim(),
      modality: input.modality,
      interest: input.interest,
      rule: input.rule.trim(),
      access: input.access,
      organizer_name: input.organizerName,
      status: "revision",
    })
    .select("*")
    .single();

  if (error || !data) {
    return error?.message ?? "No se pudo crear la comunidad.";
  }

  const row = data as CommunityRow;
  const { error: memberError } = await client.from("community_members").insert({
    community_id: row.id,
    person_id: user.id,
    name: input.organizerName,
    role: "organizador",
  });
  if (memberError) {
    return memberError.message;
  }
  return hydrateCommunity(row);
}

export async function approveRemoteCommunity(id: string): Promise<string | null> {
  const client = getSupabaseBrowserClient();
  if (!client || !remoteIdentityAvailable()) {
    return "El backend remoto no está configurado.";
  }
  if (!isRemoteCommunityId(id)) {
    return "Esta comunidad no es remota.";
  }
  const { error } = await client
    .from("communities")
    .update({ status: "publicada" })
    .eq("id", id)
    .eq("status", "revision");
  return error ? error.message : null;
}

export async function joinRemoteCommunity(
  communityId: string,
  name: string,
): Promise<string | null> {
  const client = getSupabaseBrowserClient();
  if (!client || !remoteIdentityAvailable()) {
    return "El backend remoto no está configurado.";
  }
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return "No hay sesión remota.";
  }
  const { error } = await client.from("community_members").upsert(
    {
      community_id: communityId,
      person_id: user.id,
      name,
      role: "miembro",
    },
    { onConflict: "community_id,person_id", ignoreDuplicates: true },
  );
  return error ? error.message : null;
}

export async function leaveRemoteCommunity(communityId: string): Promise<string | null> {
  const client = getSupabaseBrowserClient();
  if (!client || !remoteIdentityAvailable()) {
    return "El backend remoto no está configurado.";
  }
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return "No hay sesión remota.";
  }
  const { data: member } = await client
    .from("community_members")
    .select("role")
    .eq("community_id", communityId)
    .eq("person_id", user.id)
    .maybeSingle();
  if (member && (member as { role: string }).role === "organizador") {
    return "El organizador no puede salir de la comunidad en esta prueba.";
  }
  const { error } = await client
    .from("community_members")
    .delete()
    .eq("community_id", communityId)
    .eq("person_id", user.id);
  return error ? error.message : null;
}

export async function requestRemoteCommunityAccess(
  communityId: string,
  applicantName: string,
): Promise<string | null> {
  const client = getSupabaseBrowserClient();
  if (!client || !remoteIdentityAvailable()) {
    return "El backend remoto no está configurado.";
  }
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return "No hay sesión remota.";
  }
  const { error } = await client.from("community_requests").upsert(
    {
      community_id: communityId,
      applicant_id: user.id,
      applicant_name: applicantName,
    },
    { onConflict: "community_id,applicant_id" },
  );
  return error ? error.message : null;
}

export async function admitRemoteCommunityRequest(
  communityId: string,
  requestId: string,
): Promise<string | null> {
  const client = getSupabaseBrowserClient();
  if (!client || !remoteIdentityAvailable()) {
    return "El backend remoto no está configurado.";
  }
  const { data: request, error: fetchError } = await client
    .from("community_requests")
    .select("*")
    .eq("id", requestId)
    .eq("community_id", communityId)
    .maybeSingle();
  if (fetchError || !request) {
    return fetchError?.message ?? "No se encontró la solicitud.";
  }
  const row = request as RequestRow;
  const { error: memberError } = await client.from("community_members").upsert(
    {
      community_id: communityId,
      person_id: row.applicant_id,
      name: row.applicant_name,
      role: "miembro",
    },
    { onConflict: "community_id,person_id" },
  );
  if (memberError) {
    return memberError.message;
  }
  const { error } = await client.from("community_requests").delete().eq("id", requestId);
  return error ? error.message : null;
}

export async function rejectRemoteCommunityRequest(
  communityId: string,
  requestId: string,
): Promise<string | null> {
  const client = getSupabaseBrowserClient();
  if (!client || !remoteIdentityAvailable()) {
    return "El backend remoto no está configurado.";
  }
  const { error } = await client
    .from("community_requests")
    .delete()
    .eq("id", requestId)
    .eq("community_id", communityId);
  return error ? error.message : null;
}

export async function setRemoteCommunityMemberRole(
  communityId: string,
  personId: string,
  role: Exclude<CommunityMemberRole, "organizador">,
): Promise<string | null> {
  const client = getSupabaseBrowserClient();
  if (!client || !remoteIdentityAvailable()) {
    return "El backend remoto no está configurado.";
  }
  const { error } = await client
    .from("community_members")
    .update({ role })
    .eq("community_id", communityId)
    .eq("person_id", personId)
    .neq("role", "organizador");
  return error ? error.message : null;
}

export async function inviteRemoteToCommunity(
  communityId: string,
  personId: string,
  personName: string,
): Promise<string | null> {
  const client = getSupabaseBrowserClient();
  if (!client || !remoteIdentityAvailable()) {
    return "El backend remoto no está configurado.";
  }
  if (!isRemotePersonId(personId)) {
    return "Solo puedes invitar perfiles remotos (UUID).";
  }
  const { error: inviteError } = await client.from("community_invites").upsert({
    community_id: communityId,
    person_id: personId,
  });
  if (inviteError) {
    return inviteError.message;
  }
  const { error } = await client.from("community_members").upsert(
    {
      community_id: communityId,
      person_id: personId,
      name: personName,
      role: "miembro",
    },
    { onConflict: "community_id,person_id", ignoreDuplicates: true },
  );
  return error ? error.message : null;
}
