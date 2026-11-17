"use client";

import Image from "next/image";
import Link from "next/link";
import { JourneySteps } from "@/components/journey/JourneySteps";
import { useCallback, useEffect, useState } from "react";
import { useRefreshOnFocus, useRefreshOnRemoteSession } from "@/hooks/useOnline";
import { readActivePlan } from "@/lib/account";
import { readDailyMessageLimit } from "@/lib/admin";
import { findCatalogEntry, isPublicField } from "@/lib/discover";
import { activeConnectionIds, refreshRemoteMatchCache } from "@/lib/matches";
import {
  outboundTodayCount,
  readThreadAsync,
  refreshRemoteMessageState,
  type PrivateMessage,
} from "@/lib/messages";
import { getRemotePerson, listRemotePeople, peekRemotePerson, remoteAuthUserId } from "@/lib/remote/catalog";
import { isRemotePersonId } from "@/lib/remote/connections";
import { remoteIdentityAvailable } from "@/lib/remote/identity";
import { initialsFromName } from "@/lib/profile";

type InboxItem = {
  id: string;
  name: string;
  detail: string;
  preview: string;
};

export function MessageInbox() {
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [limit, setLimit] = useState(20);
  const [remaining, setRemaining] = useState(20);
  const [planLabel, setPlanLabel] = useState("Gratis");

  const load = useCallback(async () => {
    await refreshRemoteMatchCache();
    await refreshRemoteMessageState();
    if (remoteIdentityAvailable()) {
      const me = await remoteAuthUserId();
      await listRemotePeople(me);
    }
    const next: InboxItem[] = [];
    for (const id of activeConnectionIds()) {
      const person =
        findCatalogEntry(id) ??
        peekRemotePerson(id) ??
        (isRemotePersonId(id) ? await getRemotePerson(id) : null);
      if (!person || person.kind !== "persona") {
        continue;
      }
      const thread = await readThreadAsync(id);
      next.push({
        id,
        name: person.title,
        detail: `${isPublicField(person, "profession", { connected: true }) ? person.subtitle : "Profesión reservada"} · ${person.city}`,
        preview: lastPreview(thread),
      });
    }
    const plan = readActivePlan();
    const daily = readDailyMessageLimit(plan);
    setItems(next);
    setLimit(daily);
    setRemaining(Math.max(0, daily - outboundTodayCount()));
    setPlanLabel(plan === "prueba" ? "Prueba Premium" : "Gratis");
    setReady(true);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useRefreshOnRemoteSession(load);
  useRefreshOnFocus(load);

  if (!ready) {
    return <div className="h-80" />;
  }

  return (
    <div>
      <MessageHeader />
      <div className="mt-8">
        <p className="text-[11px] font-semibold tracking-[0.22em] text-gold uppercase">Chat privado</p>
        <h1 className="mt-2 font-display text-3xl text-navy sm:text-4xl">Mensajes</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Solo aparecen las conexiones aceptadas por las dos personas. Hoy te
          quedan {remaining} de {limit} mensajes en el plan {planLabel} (privado y
          comunidad).
        </p>
      </div>

      {items.length === 0 ? (
        <p className="mt-8 rounded-[28px] border border-line bg-card/95 px-5 py-8 text-sm leading-6 text-muted">
          El chat privado aparece cuando hay una conexión. Puedes ver las
          solicitudes en{" "}
          <Link href="/matches" className="font-semibold text-teal hover:text-teal-deep">
            Conexiones
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/mensajes/${item.id}`}
                className="flex items-center gap-4 rounded-[28px] border border-gold/35 bg-card/95 p-5 shadow-[0_18px_40px_rgba(7,21,31,0.08)]"
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-teal text-sm font-semibold text-cream">
                  {initialsFromName(item.name)}
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-navy">{item.name}</span>
                  <span className="mt-1 block text-sm text-muted">{item.detail}</span>
                  <span className="mt-2 block truncate text-sm text-ink">{item.preview}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function MessageHeader() {
  return (
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
      <JourneySteps current="mensajes" />
    </header>
  );
}

function lastPreview(thread: PrivateMessage[]) {
  const last = thread[thread.length - 1];
  if (!last) {
    return "Conversación disponible";
  }
  return last.from === "me" ? `Tú: ${last.body}` : last.body;
}
