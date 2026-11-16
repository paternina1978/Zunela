"use client";

import Image from "next/image";
import Link from "next/link";
import { JourneySteps } from "@/components/journey/JourneySteps";
import { offlineWriteMessage, useOnline } from "@/hooks/useOnline";
import { useEffect, useState, type ReactNode } from "react";
import { EMPTY_AFFINITY, readAffinity } from "@/lib/affinity";
import {
  findCatalogEntry,
  isPublicField,
  readSentInterest,
  scoreCatalog,
  type ScoredEntry,
} from "@/lib/discover";
import { listRemotePeople, peekRemotePerson, remoteAuthUserId } from "@/lib/remote/catalog";
import { remoteIdentityAvailable } from "@/lib/remote/identity";
import { readAdminParams, refreshRemoteAdminParams } from "@/lib/admin";
import {
  acceptMatchAsync,
  blockPersonAsync,
  declineMatchAsync,
  readMatchBook,
  refreshRemoteMatchCache,
  unblockPersonAsync,
  withdrawMatchAsync,
} from "@/lib/matches";
import { initialsFromName, readProfile } from "@/lib/profile";

type MatchGroups = {
  received: ScoredEntry[];
  sent: ScoredEntry[];
  connected: ScoredEntry[];
  declined: ScoredEntry[];
  expired: ScoredEntry[];
  blocked: ScoredEntry[];
};

export function MatchBoard() {
  const online = useOnline();
  const [ready, setReady] = useState(false);
  const [expiryDays, setExpiryDays] = useState(7);
  const [offlineHint, setOfflineHint] = useState("");
  const [groups, setGroups] = useState<MatchGroups>({
    received: [],
    sent: [],
    connected: [],
    declined: [],
    expired: [],
    blocked: [],
  });

  function guardWrite() {
    if (online) {
      setOfflineHint("");
      return true;
    }
    setOfflineHint(offlineWriteMessage());
    return false;
  }

  async function reload() {
    await refreshRemoteAdminParams();
    await refreshRemoteMatchCache();
    if (remoteIdentityAvailable()) {
      const me = await remoteAuthUserId();
      await listRemotePeople(me);
    }
    const profile = readProfile();
    const affinity = readAffinity() ?? EMPTY_AFFINITY;
    const city = profile?.city ?? "";
    const sent = new Set(readSentInterest().personas);
    const book = readMatchBook();
    const accepted = new Set(book.accepted);
    const declined = new Set(book.declined);
    const blocked = new Set(book.blocked);
    const expired = new Set(book.expired);
    const people = (ids: string[]) =>
      ids
        .map((id) => findCatalogEntry(id) ?? peekRemotePerson(id))
        .filter((entry): entry is NonNullable<typeof entry> => entry?.kind === "persona")
        .map((entry) => scoreCatalog(entry, affinity, city));

    const receivedIds = book.incoming.filter(
      (id) => !accepted.has(id) && !declined.has(id) && !blocked.has(id) && !expired.has(id),
    );
    const pendingIncoming = new Set(receivedIds);
    const connectedIds = book.accepted.filter((id) => sent.has(id) && !blocked.has(id));
    const sentIds = [...sent].filter(
      (id) =>
        !accepted.has(id) &&
        !pendingIncoming.has(id) &&
        !blocked.has(id) &&
        !declined.has(id) &&
        !expired.has(id),
    );

    setExpiryDays(readAdminParams().matchExpiryDays);
    setGroups({
      received: people(receivedIds),
      sent: people(sentIds),
      connected: people(connectedIds),
      declined: people(book.declined),
      expired: people(book.expired),
      blocked: people(book.blocked),
    });
    setReady(true);
  }

  useEffect(() => {
    void reload();
  }, []);

  async function accept(personId: string) {
    if (!guardWrite()) {
      return;
    }
    const reason = await acceptMatchAsync(personId);
    if (reason) {
      setOfflineHint(reason);
      return;
    }
    await reload();
  }

  async function decline(personId: string) {
    if (!guardWrite()) {
      return;
    }
    const reason = await declineMatchAsync(personId);
    if (reason) {
      setOfflineHint(reason);
      return;
    }
    await reload();
  }

  async function withdraw(personId: string) {
    if (!guardWrite()) {
      return;
    }
    const reason = await withdrawMatchAsync(personId);
    if (reason) {
      setOfflineHint(reason);
      return;
    }
    await reload();
  }

  async function block(personId: string) {
    if (!guardWrite()) {
      return;
    }
    const reason = await blockPersonAsync(personId);
    if (reason) {
      setOfflineHint(reason);
      return;
    }
    await reload();
  }

  async function unblock(personId: string) {
    if (!guardWrite()) {
      return;
    }
    const reason = await unblockPersonAsync(personId);
    if (reason) {
      setOfflineHint(reason);
      return;
    }
    await reload();
  }

  if (!ready) {
    return <div className="h-80" />;
  }

  return (
    <div>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/" className="inline-flex items-center">
          <Image
            src="/logo-zunela.png"
            alt="ZUNELA"
            width={1002}
            height={795}
            className="h-auto w-28"
            priority
          />
        </Link>
        <JourneySteps current="matches" />
      </header>

      <div className="mt-8">
        <p className="text-[11px] font-semibold tracking-[0.22em] text-gold uppercase">Conexiones</p>
        <h1 className="mt-2 font-display text-3xl text-navy sm:text-4xl">Mis conexiones</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          La conexión queda activa cuando las dos personas aceptan. Una solicitud
          pendiente expira a los {expiryDays} días. Si la rechazas, no se reactiva sola.
          Bloquear saca a la persona de Descubrir y cierra el chat. La conexión no muestra
          correo, teléfono ni redes.
        </p>
        {!online || offlineHint ? (
          <p className="mt-3 text-sm leading-6 text-muted">{offlineHint || offlineWriteMessage()}</p>
        ) : null}
      </div>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-3">
        <MatchColumn title="Recibidas" empty="Nadie te ha enviado una solicitud pendiente.">
          {groups.received.map((person) => (
            <PersonCard key={person.id} person={person} note="Te envió interés.">
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => accept(person.id)}
                  disabled={!online}
                  className="h-11 flex-1 rounded-xl bg-teal text-sm font-semibold text-white hover:bg-teal-deep disabled:opacity-50"
                >
                  Aceptar
                </button>
                <button
                  type="button"
                  onClick={() => decline(person.id)}
                  disabled={!online}
                  className="h-11 flex-1 rounded-xl border border-line bg-white text-sm font-semibold text-navy disabled:opacity-50"
                >
                  Rechazar
                </button>
              </div>
              <BlockButton onClick={() => block(person.id)} disabled={!online} />
            </PersonCard>
          ))}
        </MatchColumn>

        <MatchColumn title="Enviadas" empty="Todavía no envías una solicitud.">
          {groups.sent.map((person) => (
            <PersonCard key={person.id} person={person} note="Esperando que acepte. El chat sigue cerrado.">
              <button
                type="button"
                onClick={() => withdraw(person.id)}
                disabled={!online}
                className="mt-4 h-11 w-full rounded-xl border border-teal bg-white text-sm font-semibold text-teal disabled:opacity-50"
              >
                Retirar solicitud
              </button>
              <BlockButton onClick={() => block(person.id)} disabled={!online} />
            </PersonCard>
          ))}
        </MatchColumn>

        <MatchColumn title="Conexiones" empty="Aún no hay una aceptación de las dos partes.">
          {groups.connected.map((person) => (
            <PersonCard
              key={person.id}
              person={person}
              connected
              note="Conexión activa. El contacto sigue oculto hasta que esta persona lo autorice."
            >
              <div className="mt-4 flex gap-2">
                <Link
                  href={`/mensajes/${person.id}`}
                  className="flex h-11 flex-1 items-center justify-center rounded-xl bg-teal text-sm font-semibold text-white hover:bg-teal-deep"
                >
                  Escribir
                </Link>
                <button
                  type="button"
                  onClick={() => withdraw(person.id)}
                  disabled={!online}
                  className="h-11 flex-1 rounded-xl border border-line bg-white text-sm font-semibold text-navy disabled:opacity-50"
                >
                  Cerrar
                </button>
              </div>
              <BlockButton onClick={() => block(person.id)} disabled={!online} />
            </PersonCard>
          ))}
        </MatchColumn>
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <section className="rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_18px_40px_rgba(7,21,31,0.08)]">
          <h2 className="font-display text-2xl text-navy">Rechazadas</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            No se reactivan solas. Tampoco puedes volver a enviar interés desde Descubrir.
          </p>
          {groups.declined.length === 0 ? (
            <p className="mt-4 text-sm leading-6 text-muted">No hay rechazos.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {groups.declined.map((person) => (
                <PersonCard
                  key={person.id}
                  person={person}
                  note="Rechazada. Sin reactivación automática."
                >
                  <BlockButton onClick={() => block(person.id)} disabled={!online} />
                </PersonCard>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_18px_40px_rgba(7,21,31,0.08)]">
          <h2 className="font-display text-2xl text-navy">Expiradas</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Pasaron {expiryDays} días sin aceptación. Puedes enviar una nueva solicitud si quieres.
          </p>
          {groups.expired.length === 0 ? (
            <p className="mt-4 text-sm leading-6 text-muted">No hay solicitudes expiradas.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {groups.expired.map((person) => (
                <PersonCard
                  key={person.id}
                  person={person}
                  note="Expiró sin respuesta de las dos partes."
                >
                  <Link
                    href={`/descubrir/personas/${person.id}`}
                    className="mt-4 flex h-11 w-full items-center justify-center rounded-xl border border-teal bg-white text-sm font-semibold text-teal"
                  >
                    Ver perfil
                  </Link>
                </PersonCard>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_18px_40px_rgba(7,21,31,0.08)]">
        <h2 className="font-display text-2xl text-navy">Bloqueadas</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          No aparecen en Descubrir y el chat queda cerrado. Desbloquear no reabre la conexión.
        </p>
        {groups.blocked.length === 0 ? (
          <p className="mt-4 text-sm leading-6 text-muted">No hay personas bloqueadas.</p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {groups.blocked.map((person) => (
              <PersonCard key={person.id} person={person} note="Bloqueada. El contacto sigue oculto.">
                <button
                  type="button"
                  onClick={() => unblock(person.id)}
                  disabled={!online}
                  className="mt-4 h-11 w-full rounded-xl border border-teal bg-white text-sm font-semibold text-teal disabled:opacity-50"
                >
                  Desbloquear
                </button>
              </PersonCard>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function BlockButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mt-3 text-xs font-semibold text-navy disabled:opacity-50"
    >
      Bloquear
    </button>
  );
}

function MatchColumn({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: ReactNode;
}) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children;
  const isEmpty = Array.isArray(items) && items.length === 0;
  return (
    <section className="rounded-[28px] border border-gold/35 bg-card/95 p-5 shadow-[0_18px_40px_rgba(7,21,31,0.08)]">
      <h2 className="font-display text-2xl text-navy">{title}</h2>
      {isEmpty ? <p className="mt-4 text-sm leading-6 text-muted">{empty}</p> : <ul className="mt-4 space-y-4">{items}</ul>}
    </section>
  );
}

function PersonCard({
  person,
  note,
  connected = false,
  children,
}: {
  person: ScoredEntry;
  note: string;
  connected?: boolean;
  children: ReactNode;
}) {
  const showProfession = isPublicField(person, "profession", { connected });
  return (
    <li className="rounded-2xl border border-line px-4 py-4">
      <div className="flex items-center gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-teal text-sm font-semibold text-cream">
          {initialsFromName(person.title)}
        </div>
        <div className="min-w-0">
          <Link
            href={`/descubrir/personas/${person.id}`}
            className="font-semibold text-navy hover:text-teal"
          >
            {person.title}
          </Link>
          <p className="text-sm text-muted">
            {showProfession ? person.subtitle : "Profesión reservada"}
            {" · "}
            {person.city}
          </p>
        </div>
      </div>
      {person.reasons[0] ? (
        <p className="mt-3 rounded-2xl bg-cream-deep px-3 py-2 text-xs font-medium text-navy">
          {person.reasons[0]}
        </p>
      ) : null}
      <p className="mt-3 text-sm leading-6 text-muted">{note}</p>
      {children}
    </li>
  );
}
