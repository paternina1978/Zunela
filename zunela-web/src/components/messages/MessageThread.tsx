"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MessageHeader } from "@/components/messages/MessageInbox";
import { offlineWriteMessage, useOnline, useRefreshOnFocus } from "@/hooks/useOnline";
import { readActivePlan } from "@/lib/account";
import { blockedAttachment, readDailyMessageLimit } from "@/lib/admin";
import {
  confirmCounterpartContact,
  contactIsGranted,
  contactIsShared,
  grantContactConsentAsync,
  refreshRemoteContactState,
  revealedContact,
  revokeContactConsentAsync,
  type RevealedContact,
} from "@/lib/contact-consent";
import { findCatalogEntry, isPublicField } from "@/lib/discover";
import { readBlockedIds, refreshRemoteMatchCache } from "@/lib/matches";
import {
  isChatOpen,
  outboundTodayCount,
  readPrivateReports,
  readThreadAsync,
  refreshRemoteMessageState,
  reportPrivateMessageAsync,
  sendPrivateMessageAsync,
  type PrivateMessage,
} from "@/lib/messages";
import { getRemotePerson, peekRemotePerson } from "@/lib/remote/catalog";
import { isRemotePersonId } from "@/lib/remote/connections";
import { refreshRemoteReportState } from "@/lib/reports";
import { initialsFromName, readProfile } from "@/lib/profile";
import { readSession } from "@/lib/session";

type MessageThreadProps = {
  id: string;
};

export function MessageThread({ id }: MessageThreadProps) {
  const online = useOnline();
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [detail, setDetail] = useState("");
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [reports, setReports] = useState<string[]>([]);
  const [contactGranted, setContactGranted] = useState(false);
  const [contactShared, setContactShared] = useState(false);
  const [sharedContact, setSharedContact] = useState<RevealedContact | null>(null);
  const [contactConfirmed, setContactConfirmed] = useState(false);
  const [remoteContact, setRemoteContact] = useState(false);
  const [premium, setPremium] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [limit, setLimit] = useState(20);
  const [remaining, setRemaining] = useState(20);
  const [authorName, setAuthorName] = useState("Tú");
  const [blocked, setBlocked] = useState(false);

  const reload = useCallback(async () => {
    await refreshRemoteMatchCache();
    await refreshRemoteMessageState(id);
    const person =
      findCatalogEntry(id) ??
      peekRemotePerson(id) ??
      (isRemotePersonId(id) ? await getRemotePerson(id) : null);
    const isBlocked = readBlockedIds().includes(id);
    setBlocked(isBlocked);
    const allowed = Boolean(person && person.kind === "persona" && isChatOpen(id) && !isBlocked);
    setOpen(allowed);
    if (person && person.kind === "persona") {
      setName(person.title);
      setDetail(
        `${isPublicField(person, "profession", { connected: true }) ? person.subtitle : "Profesión reservada"} · ${person.city}`,
      );
    } else {
      setName("");
      setDetail("");
    }
    setMessages(allowed ? await readThreadAsync(id) : []);
    setReports(readPrivateReports());
    setRemoteContact(isRemotePersonId(id));
    await refreshRemoteContactState(id);
    setContactGranted(contactIsGranted(id));
    setContactShared(contactIsShared(id));
    setSharedContact(revealedContact(id));
    const plan = readActivePlan();
    setPremium(plan === "prueba");
    const daily = readDailyMessageLimit(plan);
    setLimit(daily);
    const profile = readProfile();
    const session = readSession();
    const visible = profile?.visibleName || session?.visibleName || "Tú";
    setAuthorName(visible);
    setRemaining(Math.max(0, daily - outboundTodayCount(visible)));
    setReady(true);
  }, [id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useRefreshOnFocus(reload);

  async function send() {
    if (!online) {
      setError(offlineWriteMessage());
      return;
    }
    const reason = await sendPrivateMessageAsync(id, draft);
    if (reason) {
      setError(reason);
      return;
    }
    setDraft("");
    setError("");
    await reload();
  }

  async function report(messageId: string) {
    await reportPrivateMessageAsync(id, messageId);
    await refreshRemoteReportState();
    setReports(readPrivateReports());
  }

  async function askContact() {
    if (!online) {
      setError(offlineWriteMessage());
      return;
    }
    const reason = await grantContactConsentAsync(id);
    if (reason) {
      setError(reason);
      return;
    }
    setError("");
    setContactConfirmed(false);
    await reload();
  }

  async function confirmCounterpart() {
    if (!online) {
      setError(offlineWriteMessage());
      return;
    }
    if (isRemotePersonId(id)) {
      setError("En remoto la otra persona debe autorizar desde su cuenta.");
      return;
    }
    const reason = confirmCounterpartContact(id);
    if (reason) {
      setError(reason);
      return;
    }
    setError("");
    await reload();
  }

  async function revokeContact() {
    if (!online) {
      setError(offlineWriteMessage());
      return;
    }
    const reason = await revokeContactConsentAsync(id);
    if (reason) {
      setError(reason);
      return;
    }
    setContactConfirmed(false);
    setError("");
    await reload();
  }

  if (!ready) {
    return <div className="h-80" />;
  }

  return (
    <div>
      <MessageHeader />
      <div className="mt-8">
        <Link href="/mensajes" className="text-sm font-semibold text-teal hover:text-teal-deep">
          Volver a mensajes
        </Link>
        {open ? (
          <div className="mt-4 flex items-center gap-4">
            <div className="flex size-12 items-center justify-center rounded-full bg-teal text-sm font-semibold text-cream">
              {initialsFromName(name)}
            </div>
            <div>
              <h1 className="font-display text-3xl text-navy">
                <Link href={`/descubrir/personas/${id}`} className="hover:text-teal">
                  {name}
                </Link>
              </h1>
              <p className="text-sm text-muted">{detail}</p>
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-[28px] border border-line bg-card/95 p-8">
            <h1 className="font-display text-3xl text-navy">Conversación cerrada</h1>
            <p className="mt-3 text-sm leading-6 text-muted">
              {blocked
                ? "Bloqueaste a esta persona. El chat sigue cerrado y el contacto no se muestra."
                : "Este chat no está disponible. Hace falta una conexión aceptada por las dos personas."}
            </p>
          </div>
        )}
      </div>

      {open ? (
        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.7fr)]">
          <section className="rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_24px_60px_rgba(7,21,31,0.1)]">
            <ul className="space-y-3">
              {messages.length === 0 ? (
                <li className="rounded-2xl bg-cream-deep px-4 py-3 text-sm text-muted">
                  Escribe el primer mensaje. El contacto sigue oculto.
                </li>
              ) : (
                messages.map((message) => {
                  const reported = reports.includes(`${id}:${message.id}`);
                  return (
                    <li
                      key={message.id}
                      className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                        message.from === "me" ? "ml-auto bg-teal text-white" : "bg-cream-deep text-ink"
                      }`}
                    >
                      <p className="text-xs font-semibold">
                        {message.from === "me" ? authorName : name}
                      </p>
                      <p className="mt-1 text-sm leading-6">{message.body}</p>
                      <button
                        type="button"
                        onClick={() => report(message.id)}
                        disabled={reported}
                        className={`mt-2 text-xs font-semibold ${
                          message.from === "me" ? "text-cream disabled:text-cream/70" : "text-teal disabled:text-muted"
                        }`}
                      >
                        {reported ? "Reporte enviado" : "Reportar"}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>

            <label className="mt-6 block text-sm font-semibold text-navy" htmlFor="private-message">
              Mensaje
            </label>
            <textarea
              id="private-message"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={280}
              rows={3}
              placeholder="Sin correo, teléfono, enlaces ni redes"
              className="mt-2 w-full rounded-xl border border-line bg-white px-3.5 py-3 text-sm text-ink outline-none placeholder:text-muted/70 focus:border-teal"
            />
            {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
            <p className="mt-2 text-xs leading-5 text-muted">
              Solo texto. Los adjuntos están cerrados en esta prueba.
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted">
                Quedan {remaining} de {limit} mensajes hoy (privado y comunidad).
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setError(blockedAttachment())}
                  className="h-11 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-navy"
                >
                  Adjuntar
                </button>
                <button
                  type="button"
                  onClick={send}
                  disabled={remaining === 0 || !online}
                  className="h-11 rounded-xl bg-teal px-4 text-sm font-semibold text-white hover:bg-teal-deep disabled:opacity-50"
                >
                  Enviar
                </button>
              </div>
              {!online ? (
                <p className="mt-2 text-xs leading-5 text-muted">{offlineWriteMessage()}</p>
              ) : null}
            </div>
          </section>

          <aside className="rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_24px_60px_rgba(7,21,31,0.1)]">
            <h2 className="font-display text-2xl text-navy">Permisos</h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              {`Correo, teléfono y redes siguen ocultos. Compartirlos pide tu autorización y la aceptación de ${name.split(" ")[0]}.`}
            </p>
            {premium ? (
              contactShared && sharedContact ? (
                <>
                  <div className="mt-4 rounded-2xl bg-cream-deep px-4 py-3 text-sm leading-6 text-navy">
                    <p className="font-semibold">Contacto visible (prueba)</p>
                    <p className="mt-1">{sharedContact.email}</p>
                    <p>{sharedContact.phone}</p>
                    <p className="mt-2 text-xs text-muted">{sharedContact.note}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void revokeContact()}
                    disabled={!online}
                    className="mt-4 h-11 w-full rounded-xl border border-teal bg-white text-sm font-semibold text-teal disabled:opacity-50"
                  >
                    Revocar permiso
                  </button>
                </>
              ) : contactGranted ? (
                <>
                  <p className="mt-3 text-sm leading-6 text-muted">
                    {`Autorizaste compartir tu contacto. Falta la aceptación de ${name.split(" ")[0]}. Hasta entonces no se muestra correo ni teléfono.`}
                  </p>
                  {remoteContact ? (
                    <p className="mt-2 text-xs leading-5 text-muted">
                      En remoto, {name.split(" ")[0]} debe autorizar desde su propia cuenta. No hay
                      simulación de la otra parte.
                    </p>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => void confirmCounterpart()}
                        disabled={!online}
                        className="mt-4 h-11 w-full rounded-xl bg-teal text-sm font-semibold text-white hover:bg-teal-deep disabled:opacity-50"
                      >
                        Registrar aceptación de la otra parte
                      </button>
                      <p className="mt-2 text-xs leading-5 text-muted">
                        En el piloto local no hay segundo usuario real: este botón simula su
                        aceptación bilateral.
                      </p>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => void revokeContact()}
                    disabled={!online}
                    className="mt-3 h-11 w-full rounded-xl border border-line bg-white text-sm font-semibold text-navy disabled:opacity-50"
                  >
                    Revocar permiso
                  </button>
                </>
              ) : (
                <>
                  <label className="mt-4 flex items-start gap-3 text-sm leading-6 text-navy">
                    <input
                      type="checkbox"
                      checked={contactConfirmed}
                      onChange={(event) => setContactConfirmed(event.target.checked)}
                      className="mt-1"
                    />
                    {`Confirmo que autorizo compartir mi contacto con ${name}. No se muestra hasta que esta persona también acepte.`}
                  </label>
                  <button
                    type="button"
                    onClick={() => void askContact()}
                    disabled={!online || !contactConfirmed}
                    className="mt-4 h-11 w-full rounded-xl border border-teal bg-white text-sm font-semibold text-teal disabled:opacity-60"
                  >
                    Autorizar contacto
                  </button>
                </>
              )
            ) : (
              <p className="mt-3 text-sm leading-6 text-muted">
                Compartir un contacto externo es de la prueba Premium. En Gratis no se comparte.
              </p>
            )}
            <p className="mt-3 text-sm leading-6 text-muted">
              Una llamada directa tampoco puede mostrar el contacto.
            </p>
            <p className="mt-6 text-sm leading-6 text-muted">
              Un mensaje con correo, teléfono, enlace o red no se envía. Cada mensaje
              se puede reportar.
            </p>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
