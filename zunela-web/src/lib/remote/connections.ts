/**
 * Conexiones remotas (match) entre perfiles UUID de Supabase.
 * Proyecta al shape MatchBook + lista de intereses enviados.
 */

import type { MatchBook } from "@/lib/matches";
import { remoteIdentityAvailable } from "@/lib/remote/identity";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type RemoteMatchSnapshot = {
  book: MatchBook;
  sentPersonas: string[];
};

type ConnectionRow = {
  id: string;
  from_user: string;
  to_user: string;
  status: "pending" | "accepted" | "declined" | "blocked" | "expired";
  created_at: string;
  updated_at?: string;
};

const EMPTY: MatchBook = {
  incoming: [],
  accepted: [],
  declined: [],
  blocked: [],
  expired: [],
  pendingAt: {},
};

export function isRemotePersonId(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export async function fetchRemoteMatchSnapshot(): Promise<RemoteMatchSnapshot | null> {
  const client = getSupabaseBrowserClient();
  if (!client || !remoteIdentityAvailable()) {
    return null;
  }
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return null;
  }
  const me = user.id;
  const { data, error } = await client
    .from("connections")
    .select("*")
    .or(`from_user.eq.${me},to_user.eq.${me}`);
  if (error || !data) {
    return { book: { ...EMPTY }, sentPersonas: [] };
  }
  return projectRows(me, data as ConnectionRow[]);
}

export async function remoteOfferInterest(personId: string): Promise<string | null> {
  const client = getSupabaseBrowserClient();
  if (!client) {
    return "El backend remoto no está configurado.";
  }
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return "No hay sesión remota.";
  }
  if (personId === user.id) {
    return "No puedes enviarte interés a ti mismo.";
  }

  const { data: existing } = await client
    .from("connections")
    .select("*")
    .or(
      `and(from_user.eq.${user.id},to_user.eq.${personId}),and(from_user.eq.${personId},to_user.eq.${user.id})`,
    )
    .maybeSingle();

  if (existing) {
    const row = existing as ConnectionRow;
    if (row.status === "blocked") {
      return "Esta persona está bloqueada.";
    }
    if (row.status === "declined") {
      return "La solicitud fue rechazada. No se reactiva sola.";
    }
    if (row.status === "accepted" || row.status === "pending") {
      return null;
    }
  }

  const { error } = await client.from("connections").upsert(
    {
      from_user: user.id,
      to_user: personId,
      status: "pending",
    },
    { onConflict: "from_user,to_user" },
  );
  return error ? error.message : null;
}

export async function remoteAccept(personId: string): Promise<string | null> {
  return updateIncoming(personId, "accepted");
}

export async function remoteDecline(personId: string): Promise<string | null> {
  return updateIncoming(personId, "declined");
}

export async function remoteWithdraw(personId: string): Promise<string | null> {
  const client = getSupabaseBrowserClient();
  if (!client) {
    return "El backend remoto no está configurado.";
  }
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return "No hay sesión remota.";
  }

  const { data: rows } = await client
    .from("connections")
    .select("*")
    .or(
      `and(from_user.eq.${user.id},to_user.eq.${personId}),and(from_user.eq.${personId},to_user.eq.${user.id})`,
    );

  for (const row of (rows ?? []) as ConnectionRow[]) {
    if (row.from_user === user.id && row.status === "pending") {
      const { error } = await client.from("connections").delete().eq("id", row.id);
      if (error) {
        return error.message;
      }
      continue;
    }
    if (row.status === "accepted") {
      const { error } = await client.from("connections").delete().eq("id", row.id);
      if (error) {
        return error.message;
      }
    }
  }
  return null;
}

export async function remoteBlock(personId: string): Promise<string | null> {
  const client = getSupabaseBrowserClient();
  if (!client) {
    return "El backend remoto no está configurado.";
  }
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return "No hay sesión remota.";
  }

  await client
    .from("connections")
    .delete()
    .or(
      `and(from_user.eq.${user.id},to_user.eq.${personId}),and(from_user.eq.${personId},to_user.eq.${user.id})`,
    );

  const { error } = await client.from("connections").insert({
    from_user: user.id,
    to_user: personId,
    status: "blocked",
  });
  return error ? error.message : null;
}

export async function remoteUnblock(personId: string): Promise<string | null> {
  const client = getSupabaseBrowserClient();
  if (!client) {
    return "El backend remoto no está configurado.";
  }
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return "No hay sesión remota.";
  }
  const { error } = await client
    .from("connections")
    .delete()
    .eq("from_user", user.id)
    .eq("to_user", personId)
    .eq("status", "blocked");
  return error ? error.message : null;
}

async function updateIncoming(
  personId: string,
  status: "accepted" | "declined",
): Promise<string | null> {
  const client = getSupabaseBrowserClient();
  if (!client) {
    return "El backend remoto no está configurado.";
  }
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return "No hay sesión remota.";
  }

  const { data: row } = await client
    .from("connections")
    .select("*")
    .eq("from_user", personId)
    .eq("to_user", user.id)
    .eq("status", "pending")
    .maybeSingle();

  if (!row) {
    return "No hay una solicitud pendiente de esa persona.";
  }

  const { error } = await client
    .from("connections")
    .update({ status })
    .eq("id", (row as ConnectionRow).id);
  return error ? error.message : null;
}

function projectRows(me: string, rows: ConnectionRow[]): RemoteMatchSnapshot {
  const book: MatchBook = {
    incoming: [],
    accepted: [],
    declined: [],
    blocked: [],
    expired: [],
    pendingAt: {},
  };
  const sent = new Set<string>();

  for (const row of rows) {
    const other = row.from_user === me ? row.to_user : row.from_user;
    if (row.from_user === me && row.status !== "blocked") {
      sent.add(other);
    }
    if (row.status === "pending") {
      if (row.to_user === me) {
        book.incoming.push(other);
        book.pendingAt[other] = row.created_at;
      } else if (row.from_user === me) {
        book.pendingAt[other] = row.created_at;
      }
    } else if (row.status === "accepted") {
      book.accepted.push(other);
      sent.add(other);
    } else if (row.status === "declined") {
      book.declined.push(other);
    } else if (row.status === "blocked") {
      if (row.from_user === me) {
        book.blocked.push(other);
      }
    } else if (row.status === "expired") {
      book.expired.push(other);
    }
  }

  return {
    book: {
      ...book,
      incoming: unique(book.incoming),
      accepted: unique(book.accepted),
      declined: unique(book.declined),
      blocked: unique(book.blocked),
      expired: unique(book.expired),
    },
    sentPersonas: [...sent],
  };
}

function unique(ids: string[]) {
  return [...new Set(ids)];
}
