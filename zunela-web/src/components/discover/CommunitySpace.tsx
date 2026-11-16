"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DiscoverChrome } from "@/components/discover/DiscoverChrome";
import { offlineWriteMessage, useOnline } from "@/hooks/useOnline";
import { APPEAL_KINDS, submitAppealAsync, type AppealKind } from "@/lib/appeals";
import { readActivePlan } from "@/lib/account";
import { blockedAttachment, readDailyMessageLimit } from "@/lib/admin";
import { blockPerson, readBlockedIds } from "@/lib/matches";
import { recordNotice } from "@/lib/notices";
import { recordProductEvent } from "@/lib/product-events";
import { EMPTY_AFFINITY, readAffinity } from "@/lib/affinity";
import {
  blockedCommunityText,
  listedCatalog,
  findCatalogEntry,
  publishCommunityPostAsync,
  readCommunityChatAsync,
  readOwnPostsAsync,
  readRemoteCommunityOtherPosts,
  readSentInterest,
  refreshRemoteCommunitySentToday,
  saveSentInterest,
  scoreCatalog,
  sendCommunityChatAsync,
  type CatalogEntry,
  type CommunityMessage,
  type OwnCommunityPost,
  type ScoredEntry,
} from "@/lib/discover";
import { outboundTodayCount, refreshRemoteMessageState } from "@/lib/messages";
import {
  recordCommunityChatReportAsync,
  recordCommunityReportAsync,
  refreshRemoteReportState,
  reportKeys,
} from "@/lib/reports";
import {
  admitCommunityRequestAsync,
  ensurePublishedCommunityExtras,
  findOwnCommunity,
  findStoredCommunityAsync,
  inviteToCommunityAsync,
  joinCommunityAsync,
  leaveCommunityAsync,
  ownCommunityEntry,
  refreshRemoteCommunityCache,
  rejectCommunityRequestAsync,
  requestCommunityAccessAsync,
  sessionCommunityRole,
  setCommunityMemberRoleAsync,
  type CommunityMember,
  type CommunityRequest,
  type OwnCommunity,
} from "@/lib/own-communities";
import {
  listCachedRemotePeople,
  listRemotePeople,
  peekRemotePerson,
  remoteAuthUserId,
} from "@/lib/remote/catalog";
import { isRemoteCommunityId } from "@/lib/remote/communities";
import { remoteIdentityAvailable } from "@/lib/remote/identity";
import { initialsFromName, readProfile } from "@/lib/profile";
import { readSession } from "@/lib/session";

type CommunitySpaceProps = {
  id: string;
};

export function CommunitySpace({ id }: CommunitySpaceProps) {
  const online = useOnline();
  const [ready, setReady] = useState(false);
  const [entry, setEntry] = useState<ScoredEntry | null>(null);
  const [missing, setMissing] = useState(false);
  const [joined, setJoined] = useState(false);
  const [authorName, setAuthorName] = useState("Tú");
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [ownPosts, setOwnPosts] = useState<OwnCommunityPost[]>([]);
  const [reports, setReports] = useState<string[]>([]);
  const [chatReports, setChatReports] = useState<string[]>([]);
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const [draftPost, setDraftPost] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [postError, setPostError] = useState("");
  const [messageError, setMessageError] = useState("");
  const [requested, setRequested] = useState(false);
  const [inviteId, setInviteId] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [ownCommunity, setOwnCommunity] = useState<OwnCommunity | null>(null);
  const [sessionRole, setSessionRole] = useState<"organizador" | "moderador" | "miembro" | null>(
    null,
  );
  const [manageError, setManageError] = useState("");
  const [dailyLimit, setDailyLimit] = useState(20);
  const [dailyRemaining, setDailyRemaining] = useState(20);

  async function reload(communityId: string) {
    await refreshRemoteCommunityCache();
    if (remoteIdentityAvailable()) {
      const me = await remoteAuthUserId();
      await listRemotePeople(me);
    }
    ensurePublishedCommunityExtras(communityId);
    const own = findOwnCommunity(communityId);
    const stored = own ?? (await findStoredCommunityAsync(communityId));
    const found =
      findCatalogEntry(communityId) ?? (stored ? ownCommunityEntry(stored) : null);
    if (!found || found.kind !== "comunidad" || !found.community) {
      setMissing(true);
      setReady(true);
      return;
    }
    const profile = readProfile();
    const affinity = readAffinity() ?? EMPTY_AFFINITY;
    const session = readSession();
    const role = sessionCommunityRole(communityId);
    setOwnCommunity(own ?? (role === "organizador" || role === "moderador" ? stored : null));
    setSessionRole(role);
    await refreshRemoteCommunitySentToday();
    const posts = await readOwnPostsAsync(found.id);
    const others = readRemoteCommunityOtherPosts(found.id);
    const chat = await readCommunityChatAsync(found.id);
    setEntry(
      scoreCatalog(
        {
          ...found,
          community: found.community
            ? { ...found.community, posts: [...others, ...(found.community.posts ?? [])] }
            : found.community,
        },
        affinity,
        profile?.city ?? "",
      ),
    );
    const memberJoined =
      Boolean(role) ||
      readSentInterest().comunidades.includes(found.id) ||
      Boolean(stored?.members.some((member) => member.personId === "sesion"));
    setJoined(memberJoined);
    const name = profile?.visibleName || session?.visibleName || "Tú";
    setAuthorName(name);
    await refreshRemoteReportState();
    setMessages(chat);
    setOwnPosts(posts);
    setReports(reportKeys("comunidad"));
    setChatReports(reportKeys("comunidad-chat"));
    setBlockedIds(readBlockedIds());
    setRequested(stored?.requests.some((request) => request.mine) ?? false);
    const limit = readDailyMessageLimit(readActivePlan());
    setDailyLimit(limit);
    setDailyRemaining(Math.max(0, limit - outboundTodayCount(name)));
    setManageError("");
    document.title = `${found.title} — ZUNELA`;
    setReady(true);
  }

  useEffect(() => {
    void reload(id);
  }, [id]);

  async function toggleJoin() {
    if (!entry) {
      return;
    }
    if (!online) {
      setManageError(offlineWriteMessage());
      return;
    }
    const current = readSentInterest();
    const already = current.comunidades.includes(entry.id) || Boolean(sessionRole);
    if (isRemoteCommunityId(entry.id)) {
      const remoteReason = already
        ? await leaveCommunityAsync(entry.id)
        : await joinCommunityAsync(entry.id);
      if (remoteReason) {
        setManageError(remoteReason);
        return;
      }
    }
    const comunidades = already
      ? current.comunidades.filter((item) => item !== entry.id)
      : [...current.comunidades, entry.id];
    saveSentInterest({ ...current, comunidades });
    recordProductEvent(already ? `Salió de «${entry.title}».` : `Entró a «${entry.title}».`);
    if (!already) {
      recordNotice("comunidad", `Entraste a «${entry.title}».`, `join-${entry.id}`);
    }
    setManageError("");
    await reload(entry.id);
  }

  async function publishPost() {
    if (!entry) {
      return;
    }
    if (!online) {
      setPostError(offlineWriteMessage());
      return;
    }
    const blocked = blockedCommunityText(draftPost);
    if (blocked) {
      setPostError(blocked);
      return;
    }
    const reason = await publishCommunityPostAsync(entry.id, draftPost);
    if (reason) {
      setPostError(reason);
      return;
    }
    recordProductEvent("Publicó en una comunidad.");
    recordNotice("comunidad", `Publicaste en «${entry.title}».`, `post-${entry.id}`);
    setDraftPost("");
    setPostError("");
    await reload(entry.id);
  }

  async function sendMessage() {
    if (!entry) {
      return;
    }
    if (!online) {
      setMessageError(offlineWriteMessage());
      return;
    }
    const blocked = blockedCommunityText(draftMessage);
    if (blocked) {
      setMessageError(blocked);
      return;
    }
    const plan = readActivePlan();
    const limit = readDailyMessageLimit(plan);
    if (outboundTodayCount(authorName) >= limit) {
      setMessageError(`Llegaste al límite de ${limit} mensajes de hoy (privado y comunidad).`);
      return;
    }
    const reason = await sendCommunityChatAsync(entry.id, authorName, draftMessage);
    if (reason) {
      setMessageError(reason);
      return;
    }
    recordProductEvent("Envió un mensaje en una comunidad.");
    setDraftMessage("");
    setMessageError("");
    await refreshRemoteMessageState();
    await reload(entry.id);
    setDailyRemaining(Math.max(0, limit - outboundTodayCount(authorName)));
  }

  async function askAccess() {
    if (!entry) {
      return;
    }
    if (!online) {
      setManageError(offlineWriteMessage());
      return;
    }
    const reason = await requestCommunityAccessAsync(entry.id);
    if (reason) {
      setManageError(reason);
      return;
    }
    await reload(entry.id);
  }

  async function invite() {
    if (!entry) {
      return;
    }
    if (!online) {
      setInviteError(offlineWriteMessage());
      return;
    }
    const reason = await inviteToCommunityAsync(entry.id, inviteId);
    if (reason) {
      setInviteError(reason);
      return;
    }
    setInviteError("");
    setInviteId("");
    await reload(entry.id);
  }

  async function reportPost(postId: string) {
    if (!entry) {
      return;
    }
    const key = `${entry.id}:${postId}`;
    if (reports.includes(key)) {
      return;
    }
    await recordCommunityReportAsync(entry.id, postId);
    await refreshRemoteReportState();
    setReports([...reports, key]);
  }

  async function reportChatMessage(messageId: string) {
    if (!entry) {
      return;
    }
    const key = `chat:${entry.id}:${messageId}`;
    if (chatReports.includes(key)) {
      return;
    }
    await recordCommunityChatReportAsync(entry.id, messageId);
    await refreshRemoteReportState();
    setChatReports([...chatReports, key]);
  }

  if (!ready) {
    return <div className="h-80" />;
  }

  return (
    <div>
      <DiscoverChrome />

      {missing || !entry?.community ? (
        <div className="mt-10 rounded-[28px] border border-line bg-card/95 p-8 text-center">
          <h1 className="font-display text-3xl text-navy">Comunidad no disponible</h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Esta ficha no está entre las comunidades públicas o ya no admite acceso.
          </p>
        </div>
      ) : (
        <SpaceView
          entry={entry}
          joined={joined}
          authorName={authorName}
          messages={messages}
          ownPosts={ownPosts}
          reports={reports}
          chatReports={chatReports}
          draftPost={draftPost}
          draftMessage={draftMessage}
          postError={postError}
          messageError={messageError}
          dailyLimit={dailyLimit}
          dailyRemaining={dailyRemaining}
          online={online}
          onToggle={toggleJoin}
          onDraftPost={setDraftPost}
          onDraftMessage={setDraftMessage}
          onPublish={publishPost}
          onSend={sendMessage}
          onRefuseAttach={() => setMessageError(blockedAttachment())}
          onReport={reportPost}
          onReportChat={reportChatMessage}
          requested={requested}
          inviteId={inviteId}
          inviteError={inviteError}
          onAskAccess={askAccess}
          onInviteId={setInviteId}
          onInvite={invite}
          blockedIds={blockedIds}
          onBlockMember={(personId) => {
            if (!online) {
              setManageError(offlineWriteMessage());
              return;
            }
            blockPerson(personId);
            setBlockedIds(readBlockedIds());
          }}
          ownCommunity={ownCommunity}
          sessionRole={sessionRole}
          manageError={manageError}
          onAdmitRequest={(requestId) => {
            void (async () => {
              if (!entry) {
                return;
              }
              if (!online) {
                setManageError(offlineWriteMessage());
                return;
              }
              const reason = await admitCommunityRequestAsync(entry.id, requestId);
              if (reason) {
                setManageError(reason);
                return;
              }
              await reload(entry.id);
            })();
          }}
          onRejectRequest={(requestId) => {
            void (async () => {
              if (!entry) {
                return;
              }
              if (!online) {
                setManageError(offlineWriteMessage());
                return;
              }
              const reason = await rejectCommunityRequestAsync(entry.id, requestId);
              if (reason) {
                setManageError(reason);
                return;
              }
              await reload(entry.id);
            })();
          }}
          onSetRole={(personId, role) => {
            void (async () => {
              if (!entry) {
                return;
              }
              if (!online) {
                setManageError(offlineWriteMessage());
                return;
              }
              const reason = await setCommunityMemberRoleAsync(entry.id, personId, role);
              if (reason) {
                setManageError(reason);
                return;
              }
              await reload(entry.id);
            })();
          }}
        />
      )}
    </div>
  );
}

function SpaceView({
  entry,
  joined,
  authorName,
  messages,
  ownPosts,
  reports,
  chatReports,
  draftPost,
  draftMessage,
  postError,
  messageError,
  dailyLimit,
  dailyRemaining,
  online,
  onToggle,
  onDraftPost,
  onDraftMessage,
  onPublish,
  onSend,
  onRefuseAttach,
  onReport,
  onReportChat,
  requested,
  inviteId,
  inviteError,
  onAskAccess,
  onInviteId,
  onInvite,
  blockedIds,
  onBlockMember,
  ownCommunity,
  sessionRole,
  manageError,
  onAdmitRequest,
  onRejectRequest,
  onSetRole,
}: {
  entry: ScoredEntry;
  joined: boolean;
  authorName: string;
  messages: CommunityMessage[];
  ownPosts: OwnCommunityPost[];
  reports: string[];
  chatReports: string[];
  draftPost: string;
  draftMessage: string;
  postError: string;
  messageError: string;
  dailyLimit: number;
  dailyRemaining: number;
  online: boolean;
  onToggle: () => void;
  onDraftPost: (value: string) => void;
  onDraftMessage: (value: string) => void;
  onPublish: () => void;
  onSend: () => void;
  onRefuseAttach: () => void;
  onReport: (postId: string) => void;
  onReportChat: (messageId: string) => void;
  requested: boolean;
  inviteId: string;
  inviteError: string;
  onAskAccess: () => void;
  onInviteId: (value: string) => void;
  onInvite: () => void;
  blockedIds: string[];
  onBlockMember: (personId: string) => void;
  ownCommunity: OwnCommunity | null;
  sessionRole: "organizador" | "moderador" | "miembro" | null;
  manageError: string;
  onAdmitRequest: (requestId: string) => void;
  onRejectRequest: (requestId: string) => void;
  onSetRole: (personId: string, role: "moderador" | "miembro") => void;
}) {
  const facts = entry.community;
  if (!facts) {
    return null;
  }
  const access = facts.access ?? "publica";
  const closed = access !== "publica" && !joined;
  const canManage = sessionRole === "organizador" || sessionRole === "moderador";
  const accessName =
    access === "privada" ? "Comunidad privada" : access === "invitacion" ? "Comunidad por invitación" : "Comunidad pública";

  return (
    <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.8fr)]">
      <article className="rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_24px_60px_rgba(7,21,31,0.1)] sm:p-8">
        <p className="text-[11px] font-semibold tracking-[0.22em] text-gold uppercase">
          {accessName}
        </p>
        <h1 className="mt-3 font-display text-4xl text-navy">{entry.title}</h1>
        <p className="mt-2 text-sm text-muted">
          {entry.city}
          {" · "}
          {modalityLabel(entry.modality)}
          {" · "}
          {facts.memberCount} miembros
        </p>
        <p className="mt-6 text-base leading-7 text-ink">{entry.summary}</p>

        <section className="mt-8">
          <h2 className="text-sm font-semibold text-navy">Acceso</h2>
          <ul className="mt-3 space-y-2">
            {facts.rules.map((rule) => (
              <li key={rule} className="rounded-2xl border border-line px-4 py-3 text-sm leading-6 text-ink">
                {rule}
              </li>
            ))}
          </ul>
        </section>

        {closed ? (
          <section className="mt-8 rounded-2xl bg-cream-deep px-4 py-4">
            <h2 className="text-sm font-semibold text-navy">Contenido reservado</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              {access === "invitacion"
                ? "Las publicaciones, los miembros y el chat solo los ve quien tiene invitación."
                : "Las publicaciones, los miembros y el chat se abren cuando aceptan la solicitud."}
            </p>
          </section>
        ) : (
        <>
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-navy">Miembros</h2>
          <ul className="mt-3 space-y-2">
            {(ownCommunity?.members ??
              facts.members.map((member) => ({
                personId: member.personId,
                name:
                  member.personId === "sesion"
                    ? facts.organizerName || authorName
                    : findCatalogEntry(member.personId)?.title ||
                      peekRemotePerson(member.personId)?.title ||
                      "Miembro",
                role:
                  member.role.toLowerCase().includes("organiza")
                    ? ("organizador" as const)
                    : member.role.toLowerCase().includes("modera")
                      ? ("moderador" as const)
                      : ("miembro" as const),
              }))).map((member) => {
              if (blockedIds.includes(member.personId)) {
                return null;
              }
              const person = findCatalogEntry(member.personId) ?? peekRemotePerson(member.personId);
              return (
                <li
                  key={member.personId}
                  className="rounded-2xl border border-line px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-full bg-teal text-xs font-semibold text-cream">
                      {initialsFromName(member.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      {person && person.kind === "persona" ? (
                        <Link
                          href={`/descubrir/personas/${person.id}`}
                          className="font-semibold text-navy hover:text-teal"
                        >
                          {member.name}
                        </Link>
                      ) : (
                        <p className="font-semibold text-navy">{member.name}</p>
                      )}
                      <p className="text-sm text-muted">
                        {member.role === "organizador"
                          ? "Organiza"
                          : member.role === "moderador"
                            ? "Modera"
                            : "Miembro"}
                        {" · "}
                        {entry.city}
                      </p>
                    </div>
                    {person && person.kind === "persona" ? (
                      <button
                        type="button"
                        onClick={() => onBlockMember(person.id)}
                        className="text-xs font-semibold text-navy"
                      >
                        Bloquear
                      </button>
                    ) : null}
                  </div>
                  {canManage &&
                  member.personId !== "sesion" &&
                  member.role !== "organizador" &&
                  sessionRole === "organizador" ? (
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onSetRole(
                            member.personId,
                            member.role === "moderador" ? "miembro" : "moderador",
                          )
                        }
                        className="h-9 rounded-full border border-line px-3 text-xs font-semibold text-navy"
                      >
                        {member.role === "moderador" ? "Dejar como miembro" : "Nombrar moderador"}
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-sm leading-6 text-muted">
            Roles: organiza, modera o miembro. Bloquear a alguien del catálogo lo saca de Descubrir
            y cierra el chat. Correo, teléfono y redes no se muestran.
          </p>
        </section>

        {canManage && ownCommunity ? (
          <OrganizerPanel
            requests={ownCommunity.requests}
            manageError={manageError}
            onAdmit={onAdmitRequest}
            onReject={onRejectRequest}
          />
        ) : null}

        <AppealForm communityId={entry.id} communityTitle={entry.title} online={online} />

        {access === "invitacion" && joined ? (
          <InvitationList
            invitedIds={facts.invitedIds ?? []}
            inviteId={inviteId}
            inviteError={inviteError}
            online={online}
            onInviteId={onInviteId}
            onInvite={onInvite}
          />
        ) : null}

        <section className="mt-8">
          <h2 className="text-sm font-semibold text-navy">Publicaciones</h2>
          <ul className="mt-3 space-y-3">
            {ownPosts.map((post) => (
              <PostCard
                key={post.id}
                author={authorName}
                body={post.body}
                when="Ahora"
                reported={reports.includes(`${entry.id}:${post.id}`)}
                onReport={() => onReport(post.id)}
              />
            ))}
            {facts.posts.map((post) => {
              const person = findCatalogEntry(post.authorId) ?? peekRemotePerson(post.authorId);
              return (
                <PostCard
                  key={post.id}
                  author={person?.title ?? "Miembro"}
                  body={post.body}
                  when={post.when}
                  reported={reports.includes(`${entry.id}:${post.id}`)}
                  onReport={() => onReport(post.id)}
                />
              );
            })}
          </ul>

          {joined ? (
            <div className="mt-4">
              <label className="block text-sm font-semibold text-navy" htmlFor="community-post">
                Publicar
              </label>
              <textarea
                id="community-post"
                value={draftPost}
                onChange={(event) => onDraftPost(event.target.value)}
                maxLength={280}
                rows={3}
                placeholder="Sin correo, teléfono, enlaces ni redes"
                className="mt-2 w-full rounded-xl border border-line bg-white px-3.5 py-3 text-sm text-ink outline-none placeholder:text-muted/70 focus:border-teal"
              />
              {postError ? <p className="mt-2 text-sm text-danger">{postError}</p> : null}
              <button
                type="button"
                onClick={onPublish}
                disabled={!online}
                className="mt-3 h-11 rounded-xl bg-navy px-4 text-sm font-semibold text-cream disabled:opacity-50"
              >
                Publicar
              </button>
              {!online ? (
                <p className="mt-2 text-xs leading-5 text-muted">Sin conexión: la publicación espera red.</p>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-sm leading-6 text-muted">
              Únete para publicar. Las publicaciones de ejemplo se pueden leer
              antes de entrar.
            </p>
          )}
        </section>
        </>
        )}

        {closed && access === "privada" ? (
          <button
            type="button"
            onClick={onAskAccess}
            disabled={requested || !online}
            className="mt-8 h-12 w-full rounded-xl bg-teal text-sm font-semibold text-white hover:bg-teal-deep disabled:opacity-50"
          >
            {requested ? "Solicitud enviada" : "Solicitar acceso"}
          </button>
        ) : closed ? (
          <p className="mt-8 rounded-2xl bg-cream-deep px-4 py-3 text-sm leading-6 text-navy">
            Esta comunidad solo abre con una invitación. No puedes unirte desde el listado.
          </p>
        ) : (
          <button
            type="button"
            aria-pressed={joined}
            onClick={onToggle}
            disabled={!online}
            className={`mt-8 h-12 w-full rounded-xl text-sm font-semibold disabled:opacity-50 ${
              joined ? "border border-teal bg-white text-teal" : "bg-teal text-white hover:bg-teal-deep"
            }`}
          >
            {joined ? "Salir" : "Unirme"}
          </button>
        )}
        {!online ? (
          <p className="mt-2 text-center text-xs leading-5 text-muted">{offlineWriteMessage()}</p>
        ) : null}
        {joined ? (
          <p className="mt-3 text-center text-sm leading-6 text-teal-deep">
            Entraste. Puedes publicar y usar el chat. El contacto sigue oculto.
          </p>
        ) : null}
      </article>

      <aside className="space-y-6 lg:sticky lg:top-6">
        <div className="rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_24px_60px_rgba(7,21,31,0.1)]">
          <p className="text-[11px] font-semibold tracking-[0.22em] text-gold uppercase">
            Por qué aparece
          </p>
          <h2 className="mt-2 font-display text-2xl text-navy">Coincidencia</h2>
          <ul className="mt-4 space-y-2">
            {entry.reasons.map((reason) => (
              <li key={reason} className="rounded-2xl bg-cream-deep px-4 py-3 text-sm text-navy">
                {reason}
              </li>
            ))}
          </ul>
          <div className="mt-6 rounded-2xl border border-dashed border-line px-4 py-3">
            <p className="text-sm font-semibold text-navy">Plan Gratis</p>
            <p className="mt-1 text-sm leading-6 text-muted">
              Puedes unirte a comunidades públicas. Crear una tiene cupo Gratis con período
              configurable (revisa la fecha de renovación al publicar).{" "}
              <Link href="/descubrir/comunidades/nueva" className="font-semibold text-teal">
                Una privada o por invitación
              </Link>{" "}
              es Premium y no aparece en el listado.
            </p>
          </div>
        </div>

        <div className="rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_24px_60px_rgba(7,21,31,0.1)]">
          <h2 className="font-display text-2xl text-navy">Chat</h2>
          {joined ? (
            <>
              <p className="mt-2 text-sm leading-6 text-muted">
                Moderado (RB-08). Correo, teléfono, enlaces y redes no se envían. Puedes reportar un
                mensaje sin guardar su texto.
              </p>
              <ul className="mt-4 space-y-2">
                {messages.length === 0 ? (
                  <li className="rounded-2xl bg-cream-deep px-4 py-3 text-sm text-muted">
                    Aún no escribes en este chat.
                  </li>
                ) : (
                  messages.map((message) => {
                    const reportKey = `chat:${entry.id}:${message.id}`;
                    const reported = chatReports.includes(reportKey);
                    return (
                      <li key={message.id} className="rounded-2xl bg-cream-deep px-4 py-3">
                        <p className="text-xs font-semibold text-teal">{message.author}</p>
                        <p className="mt-1 text-sm leading-6 text-ink">{message.body}</p>
                        <button
                          type="button"
                          disabled={reported}
                          onClick={() => onReportChat(message.id)}
                          className="mt-2 text-xs font-semibold text-teal disabled:text-muted"
                        >
                          {reported ? "Reportado" : "Reportar"}
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
              <label className="mt-4 block text-sm font-semibold text-navy" htmlFor="community-chat">
                Mensaje
              </label>
              <textarea
                id="community-chat"
                value={draftMessage}
                onChange={(event) => onDraftMessage(event.target.value)}
                maxLength={280}
                rows={3}
                placeholder="Sin correo, teléfono, enlaces ni redes"
                className="mt-2 w-full rounded-xl border border-line bg-white px-3.5 py-3 text-sm text-ink outline-none placeholder:text-muted/70 focus:border-teal"
              />
              {messageError ? <p className="mt-2 text-sm text-danger">{messageError}</p> : null}
              <p className="mt-2 text-xs leading-5 text-muted">
                Cupo de hoy: {dailyRemaining} de {dailyLimit} (privado y comunidad). Solo texto;
                adjuntos cerrados.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onRefuseAttach}
                  className="h-11 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-navy"
                >
                  Adjuntar
                </button>
                <button
                  type="button"
                  onClick={onSend}
                  disabled={!online || dailyRemaining === 0}
                  className="h-11 rounded-xl bg-teal px-4 text-sm font-semibold text-white hover:bg-teal-deep disabled:opacity-50"
                >
                  Enviar
                </button>
              </div>
              {!online ? (
                <p className="mt-2 text-xs leading-5 text-muted">Sin conexión: el envío espera red.</p>
              ) : null}
            </>
          ) : (
            <p className="mt-3 text-sm leading-6 text-muted">
              El chat se abre cuando entras. No sustituye la conexión entre personas.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

function OrganizerPanel({
  requests,
  manageError,
  onAdmit,
  onReject,
}: {
  requests: CommunityRequest[];
  manageError: string;
  onAdmit: (requestId: string) => void;
  onReject: (requestId: string) => void;
}) {
  return (
    <section className="mt-8 rounded-2xl bg-cream-deep px-4 py-4">
      <h2 className="text-sm font-semibold text-navy">Solicitudes y roles</h2>
      <p className="mt-2 text-sm leading-6 text-muted">
        Como organizador o moderador puedes aceptar solicitudes. Solo el organizador nombra
        moderadores en la lista de miembros.
      </p>
      {requests.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No hay solicitudes pendientes.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {requests.map((request) => (
            <li key={request.id} className="rounded-2xl border border-line bg-white px-4 py-3">
              <p className="text-sm font-semibold text-navy">{request.name}</p>
              <p className="text-xs text-muted">{request.mine ? "Tu solicitud" : "Solicitud de prueba"}</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => onAdmit(request.id)}
                  className="h-9 flex-1 rounded-xl bg-teal text-xs font-semibold text-white hover:bg-teal-deep"
                >
                  Admitir
                </button>
                <button
                  type="button"
                  onClick={() => onReject(request.id)}
                  className="h-9 flex-1 rounded-xl border border-line text-xs font-semibold text-navy"
                >
                  Rechazar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {manageError ? <p className="mt-3 text-sm text-danger">{manageError}</p> : null}
    </section>
  );
}

function InvitationList({
  invitedIds,
  inviteId,
  inviteError,
  online,
  onInviteId,
  onInvite,
}: {
  invitedIds: string[];
  inviteId: string;
  inviteError: string;
  online: boolean;
  onInviteId: (value: string) => void;
  onInvite: () => void;
}) {
  const blocked = new Set(readBlockedIds());
  const people = [...listedCatalog(), ...listCachedRemotePeople()]
    .filter((entry) => entry.kind === "persona" && !blocked.has(entry.id))
    .filter((entry, index, all) => all.findIndex((row) => row.id === entry.id) === index);
  const invited = invitedIds
    .map((personId) => people.find((person) => person.id === personId) ?? peekRemotePerson(personId))
    .filter((person): person is CatalogEntry => Boolean(person && person.kind === "persona"));
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold text-navy">Invitaciones</h2>
      <p className="mt-1 text-sm leading-6 text-muted">
        Invitas por el nombre público. El correo no se envía ni se muestra.
      </p>
      {invited.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {invited.map((person) => (
            <li key={person.id} className="rounded-2xl bg-cream-deep px-4 py-3 text-sm text-navy">
              {person.title} · {person.city}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted">Todavía no hay invitaciones.</p>
      )}
      <label className="mt-4 block text-sm font-semibold text-navy" htmlFor="community-invite">
        Invitar
        <select
          id="community-invite"
          value={inviteId}
          onChange={(event) => onInviteId(event.target.value)}
          className="mt-1 h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm font-normal outline-none focus:border-teal"
        >
          <option value="">Elige a alguien del catálogo</option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.title} · {person.city}
            </option>
          ))}
        </select>
      </label>
      {inviteError ? <p className="mt-2 text-sm text-danger">{inviteError}</p> : null}
      <button
        type="button"
        onClick={onInvite}
        disabled={!online || !inviteId}
        className="mt-3 h-11 rounded-xl border border-teal bg-white px-4 text-sm font-semibold text-teal disabled:opacity-50"
      >
        Enviar invitación
      </button>
      {!online ? <p className="mt-2 text-xs leading-5 text-muted">{offlineWriteMessage()}</p> : null}
    </section>
  );
}

function AppealForm({
  communityId,
  communityTitle,
  online,
}: {
  communityId: string;
  communityTitle: string;
  online: boolean;
}) {
  const [kind, setKind] = useState<AppealKind>("reporte");
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function send() {
    if (!online) {
      setError(offlineWriteMessage());
      setSent(false);
      return;
    }
    if (!confirmed) {
      setError("Confirma la apelación antes de enviarla.");
      setSent(false);
      return;
    }
    const result = await submitAppealAsync({ communityId, communityTitle, kind, note });
    if (typeof result === "string") {
      setError(result);
      setSent(false);
      return;
    }
    setNote("");
    setConfirmed(false);
    setError("");
    setSent(true);
  }

  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold text-navy">Apelar</h2>
      <p className="mt-1 text-sm leading-6 text-muted">
        Pide otra revisión de un reporte, un bloqueo o el acceso. Una persona la mira. No
        suspende ni borra nada, y no hace falta escribir un correo.
      </p>
      <label className="mt-4 block text-sm font-semibold text-navy" htmlFor="appeal-kind">
        Decisión
        <select
          id="appeal-kind"
          value={kind}
          onChange={(event) => {
            setKind(event.target.value as AppealKind);
            setSent(false);
          }}
          className="mt-1 h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm font-normal outline-none focus:border-teal"
        >
          {APPEAL_KINDS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-3 block text-sm font-semibold text-navy" htmlFor="appeal-note">
        Motivo
        <textarea
          id="appeal-note"
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
            setSent(false);
            setError("");
          }}
          rows={3}
          className="mt-1 w-full rounded-xl border border-line bg-white px-3.5 py-2 text-sm font-normal outline-none focus:border-teal"
        />
      </label>
      <label className="mt-3 flex items-start gap-3 text-sm leading-6 text-navy">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          className="mt-1 size-4 accent-teal"
        />
        Confirmo la apelación. Una persona la revisa y no hay sanción automática.
      </label>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      {sent ? (
        <p className="mt-2 text-sm text-teal-deep">
          Apelación enviada. Queda pendiente hasta que una persona la revise.
        </p>
      ) : null}
      <button
        type="button"
        onClick={send}
        disabled={!online || !confirmed || note.trim().length === 0}
        className="mt-3 h-11 rounded-xl border border-teal bg-white px-4 text-sm font-semibold text-teal disabled:opacity-50"
      >
        Enviar apelación
      </button>
    </section>
  );
}

function MemberRow({
  person,
  role,
  onBlock,
}: {
  person: CatalogEntry;
  role: string;
  onBlock: () => void;
}) {
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-cream-deep px-4 py-3">
      <div className="flex size-10 items-center justify-center rounded-full bg-teal text-xs font-semibold text-cream">
        {initialsFromName(person.title)}
      </div>
      <div className="min-w-0 flex-1">
        <Link href={`/descubrir/personas/${person.id}`} className="font-semibold text-navy hover:text-teal">
          {person.title}
        </Link>
        <p className="text-sm text-muted">
          {role}
          {" · "}
          {person.city}
        </p>
      </div>
      <button type="button" onClick={onBlock} className="text-xs font-semibold text-navy">
        Bloquear
      </button>
    </li>
  );
}

function PostCard({
  author,
  body,
  when,
  reported,
  onReport,
}: {
  author: string;
  body: string;
  when: string;
  reported: boolean;
  onReport: () => void;
}) {
  return (
    <li className="rounded-2xl border border-line px-4 py-3">
      <p className="text-sm font-semibold text-navy">
        {author}
        <span className="font-normal text-muted"> · {when}</span>
      </p>
      <p className="mt-2 text-sm leading-6 text-ink">{body}</p>
      <button
        type="button"
        onClick={onReport}
        disabled={reported}
        className="mt-3 text-xs font-semibold text-teal disabled:text-muted"
      >
        {reported ? "Reporte enviado" : "Reportar"}
      </button>
    </li>
  );
}

function modalityLabel(modality: ScoredEntry["modality"]) {
  if (modality === "presencial") return "Presencial";
  if (modality === "remota") return "Remota";
  return "Presencial o remota";
}
