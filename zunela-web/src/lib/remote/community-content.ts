/**
 * Chat y posts de comunidades remotas (UUID).
 */

import type { CommunityMessage, CommunityPost, OwnCommunityPost } from "@/lib/discover";
import { isRemoteCommunityId } from "@/lib/remote/communities";
import { remoteIdentityAvailable } from "@/lib/remote/identity";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type PostRow = {
  id: string;
  community_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

type MessageRow = {
  id: string;
  community_id: string;
  author_id: string;
  author_name: string;
  body: string;
  created_at: string;
};

const postsCache = new Map<string, { mine: OwnCommunityPost[]; others: CommunityPost[] }>();
const chatCache = new Map<string, CommunityMessage[]>();
let remoteCommunitySentToday = 0;

export function peekRemoteCommunityPosts(communityId: string) {
  return postsCache.get(communityId) ?? { mine: [], others: [] };
}

export function peekRemoteCommunityChat(communityId: string) {
  return chatCache.get(communityId) ?? [];
}

export function peekRemoteCommunitySentToday() {
  return remoteCommunitySentToday;
}

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString("es-CO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function fetchRemoteCommunityPosts(communityId: string) {
  const client = getSupabaseBrowserClient();
  if (!client || !remoteIdentityAvailable() || !isRemoteCommunityId(communityId)) {
    return { mine: [] as OwnCommunityPost[], others: [] as CommunityPost[] };
  }
  const {
    data: { user },
  } = await client.auth.getUser();
  const { data, error } = await client
    .from("community_posts")
    .select("*")
    .eq("community_id", communityId)
    .order("created_at", { ascending: false });
  if (error || !data) {
    const empty = { mine: [] as OwnCommunityPost[], others: [] as CommunityPost[] };
    postsCache.set(communityId, empty);
    return empty;
  }
  const mine: OwnCommunityPost[] = [];
  const others: CommunityPost[] = [];
  for (const row of data as PostRow[]) {
    if (user && row.author_id === user.id) {
      mine.push({ id: row.id, body: row.body });
    } else {
      others.push({
        id: row.id,
        authorId: row.author_id,
        body: row.body,
        when: formatWhen(row.created_at),
      });
    }
  }
  const result = { mine, others };
  postsCache.set(communityId, result);
  return result;
}

export async function publishRemoteCommunityPost(
  communityId: string,
  body: string,
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
  if (!isRemoteCommunityId(communityId)) {
    return "Esta comunidad no usa posts remotos.";
  }
  const { error } = await client.from("community_posts").insert({
    community_id: communityId,
    author_id: user.id,
    body: body.trim(),
  });
  return error ? error.message : null;
}

export async function fetchRemoteCommunityChat(communityId: string): Promise<CommunityMessage[]> {
  const client = getSupabaseBrowserClient();
  if (!client || !remoteIdentityAvailable() || !isRemoteCommunityId(communityId)) {
    return [];
  }
  const { data, error } = await client
    .from("community_messages")
    .select("*")
    .eq("community_id", communityId)
    .order("created_at", { ascending: true });
  if (error || !data) {
    chatCache.set(communityId, []);
    return [];
  }
  const messages = (data as MessageRow[]).map((row) => ({
    id: row.id,
    author: row.author_name,
    body: row.body,
    at: row.created_at,
  }));
  chatCache.set(communityId, messages);
  return messages;
}

export async function sendRemoteCommunityMessage(
  communityId: string,
  authorName: string,
  body: string,
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
  if (!isRemoteCommunityId(communityId)) {
    return "Esta comunidad no usa chat remoto.";
  }
  const { error } = await client.from("community_messages").insert({
    community_id: communityId,
    author_id: user.id,
    author_name: authorName,
    body: body.trim(),
  });
  return error ? error.message : null;
}

export async function countRemoteCommunitySentToday(): Promise<number> {
  const client = getSupabaseBrowserClient();
  if (!client || !remoteIdentityAvailable()) {
    remoteCommunitySentToday = 0;
    return 0;
  }
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    remoteCommunitySentToday = 0;
    return 0;
  }
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { count, error } = await client
    .from("community_messages")
    .select("id", { count: "exact", head: true })
    .eq("author_id", user.id)
    .gte("created_at", start.toISOString());
  remoteCommunitySentToday = error ? 0 : (count ?? 0);
  return remoteCommunitySentToday;
}

export async function refreshRemoteCommunityContent(communityId?: string) {
  await countRemoteCommunitySentToday();
  if (communityId && isRemoteCommunityId(communityId)) {
    await Promise.all([
      fetchRemoteCommunityPosts(communityId),
      fetchRemoteCommunityChat(communityId),
    ]);
  }
}
