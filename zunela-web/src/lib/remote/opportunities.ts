/**
 * Oportunidades y postulaciones remotas (UUID).
 * Demo local (`op-propia-*`) sigue en localStorage.
 */

import type { OpportunityApplication } from "@/lib/opportunity-applications";
import type { OpportunityInput, OwnOpportunity } from "@/lib/own-opportunities";
import { isRemotePersonId } from "@/lib/remote/connections";
import { remoteIdentityAvailable } from "@/lib/remote/identity";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type OpportunityRow = {
  id: string;
  organizer_id: string;
  title: string;
  category: OwnOpportunity["category"];
  objective: string;
  city: string;
  modality: OwnOpportunity["modality"];
  spots: number;
  interest: string;
  role: string;
  rule: string;
  organizer_name: string;
  organizer_detail: string;
  status: OwnOpportunity["status"];
  created_at?: string;
};

type ApplicationRow = {
  id: string;
  opportunity_id: string;
  applicant_id: string;
  applicant_name: string;
  role: string;
  status: OpportunityApplication["status"];
  created_at: string;
};

const opportunityCache = new Map<string, OwnOpportunity>();

export function isRemoteOpportunityId(id: string) {
  return isRemotePersonId(id);
}

export function peekRemoteOpportunity(id: string): OwnOpportunity | null {
  return opportunityCache.get(id) ?? null;
}

function remember(item: OwnOpportunity) {
  opportunityCache.set(item.id, item);
  return item;
}

export function rowToOwnOpportunity(row: OpportunityRow): OwnOpportunity {
  return remember({
    id: row.id,
    title: row.title,
    category: row.category,
    objective: row.objective,
    city: row.city,
    modality: row.modality,
    spots: row.spots,
    interest: row.interest,
    role: row.role ?? "",
    rule: row.rule ?? "",
    organizerName: row.organizer_name,
    organizerDetail: row.organizer_detail,
    status: row.status,
    organizerId: row.organizer_id,
  });
}

export async function listRemoteOpportunities(): Promise<OwnOpportunity[]> {
  const client = getSupabaseBrowserClient();
  if (!client || !remoteIdentityAvailable()) {
    return [];
  }
  const { data, error } = await client
    .from("opportunities")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data) {
    return [];
  }
  return (data as OpportunityRow[]).map(rowToOwnOpportunity);
}

export async function getRemoteOpportunity(id: string): Promise<OwnOpportunity | null> {
  const client = getSupabaseBrowserClient();
  if (!client || !remoteIdentityAvailable() || !isRemoteOpportunityId(id)) {
    return null;
  }
  const { data, error } = await client.from("opportunities").select("*").eq("id", id).maybeSingle();
  if (error || !data) {
    return null;
  }
  return rowToOwnOpportunity(data as OpportunityRow);
}

export async function publishRemoteOpportunity(
  input: OpportunityInput & {
    organizerName: string;
    organizerDetail: string;
  },
): Promise<OwnOpportunity | string> {
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
    .from("opportunities")
    .insert({
      organizer_id: user.id,
      title: input.title.trim(),
      category: input.category,
      objective: input.objective.trim(),
      city: input.city.trim(),
      modality: input.modality,
      spots: input.spots,
      interest: input.interest,
      role: input.role.trim(),
      rule: input.rule.trim(),
      organizer_name: input.organizerName,
      organizer_detail: input.organizerDetail,
      status: "revision",
    })
    .select("*")
    .single();

  if (error || !data) {
    return error?.message ?? "No se pudo publicar la oportunidad.";
  }
  return rowToOwnOpportunity(data as OpportunityRow);
}

export async function approveRemoteOpportunity(id: string): Promise<string | null> {
  const client = getSupabaseBrowserClient();
  if (!client || !remoteIdentityAvailable()) {
    return "El backend remoto no está configurado.";
  }
  if (!isRemoteOpportunityId(id)) {
    return "Esta oportunidad no es remota.";
  }
  const { error } = await client
    .from("opportunities")
    .update({ status: "publicada" })
    .eq("id", id)
    .eq("status", "revision");
  return error ? error.message : null;
}

export async function fetchRemoteApplications(
  opportunityId: string,
): Promise<OpportunityApplication[]> {
  const client = getSupabaseBrowserClient();
  if (!client || !remoteIdentityAvailable() || !isRemoteOpportunityId(opportunityId)) {
    return [];
  }
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return [];
  }
  const { data, error } = await client
    .from("opportunity_applications")
    .select("*")
    .eq("opportunity_id", opportunityId)
    .order("created_at", { ascending: false });
  if (error || !data) {
    return [];
  }
  return (data as ApplicationRow[]).map((row) => ({
    id: row.id,
    opportunityId: row.opportunity_id,
    applicantName: row.applicant_name,
    role: row.role,
    status: row.status,
    at: row.created_at,
    mine: row.applicant_id === user.id,
  }));
}

export async function applyRemoteToOpportunity(
  opportunityId: string,
  role: string,
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
  if (!isRemoteOpportunityId(opportunityId)) {
    return "Esta oportunidad no usa postulaciones remotas.";
  }

  const { error } = await client.from("opportunity_applications").upsert(
    {
      opportunity_id: opportunityId,
      applicant_id: user.id,
      applicant_name: applicantName,
      role: role.trim(),
      status: "pendiente",
    },
    { onConflict: "opportunity_id,applicant_id" },
  );
  return error ? error.message : null;
}

export async function withdrawRemoteApplication(opportunityId: string): Promise<string | null> {
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
  const { error } = await client
    .from("opportunity_applications")
    .delete()
    .eq("opportunity_id", opportunityId)
    .eq("applicant_id", user.id);
  return error ? error.message : null;
}

export async function reviewRemoteApplication(
  applicationId: string,
  status: "aceptada" | "rechazada",
): Promise<string | null> {
  const client = getSupabaseBrowserClient();
  if (!client || !remoteIdentityAvailable()) {
    return "El backend remoto no está configurado.";
  }
  const { error } = await client
    .from("opportunity_applications")
    .update({ status })
    .eq("id", applicationId);
  return error ? error.message : null;
}

export async function countRemoteAccepted(opportunityId: string): Promise<number> {
  const client = getSupabaseBrowserClient();
  if (!client || !remoteIdentityAvailable() || !isRemoteOpportunityId(opportunityId)) {
    return 0;
  }
  const { count, error } = await client
    .from("opportunity_applications")
    .select("id", { count: "exact", head: true })
    .eq("opportunity_id", opportunityId)
    .eq("status", "aceptada");
  if (error) {
    return 0;
  }
  return count ?? 0;
}
