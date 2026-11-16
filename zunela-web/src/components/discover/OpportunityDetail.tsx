"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DiscoverChrome } from "@/components/discover/DiscoverChrome";
import { offlineWriteMessage, useOnline } from "@/hooks/useOnline";
import { EMPTY_AFFINITY, readAffinity } from "@/lib/affinity";
import {
  findCatalogEntry,
  isPublicField,
  readSentInterest,
  saveSentInterest,
  scoreCatalog,
  type CatalogEntry,
  type ScoredEntry,
} from "@/lib/discover";
import {
  canOfferMatchInterest,
  noteOutgoingInterestAsync,
  readMatchBook,
  refreshRemoteMatchCache,
  withdrawMatchAsync,
} from "@/lib/matches";
import {
  applyToOpportunityAsync,
  ensureOrganizerDemoApplicants,
  myApplication,
  readApplicationsAsync,
  reviewApplicationAsync,
  spotsLabelFor,
  withdrawApplicationAsync,
  type OpportunityApplication,
} from "@/lib/opportunity-applications";
import {
  findOwnOpportunity,
  findStoredOpportunityAsync,
  ownOpportunityEntry,
  refreshRemoteOpportunityCache,
} from "@/lib/own-opportunities";
import { peekRemotePerson } from "@/lib/remote/catalog";
import { recordProductEvent } from "@/lib/product-events";
import { initialsFromName, readProfile } from "@/lib/profile";

type OpportunityDetailProps = {
  id: string;
};

export function OpportunityDetail({ id }: OpportunityDetailProps) {
  const online = useOnline();
  const [ready, setReady] = useState(false);
  const [entry, setEntry] = useState<ScoredEntry | null>(null);
  const [creator, setCreator] = useState<CatalogEntry | null>(null);
  const [missing, setMissing] = useState(false);
  const [application, setApplication] = useState<OpportunityApplication | null>(null);
  const [applications, setApplications] = useState<OpportunityApplication[]>([]);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [role, setRole] = useState("");
  const [error, setError] = useState("");
  const [spotsLabel, setSpotsLabel] = useState("");
  const [bridgeSent, setBridgeSent] = useState(false);
  const [bridgeBlocked, setBridgeBlocked] = useState(false);
  const [bridgeError, setBridgeError] = useState("");

  async function reload() {
    await refreshRemoteOpportunityCache();
    const own = findOwnOpportunity(id);
    const stored = own ?? (await findStoredOpportunityAsync(id));
    if (own?.status === "publicada") {
      ensureOrganizerDemoApplicants(id);
    }
    const found =
      findCatalogEntry(id) ?? (stored ? ownOpportunityEntry(stored) : null);
    if (!found || found.kind !== "oportunidad" || !found.opportunity) {
      setMissing(true);
      setReady(true);
      return;
    }

    const apps = await readApplicationsAsync(id);
    const profile = readProfile();
    const affinity = readAffinity() ?? EMPTY_AFFINITY;
    const scored = scoreCatalog(found, affinity, profile?.city ?? "");
    const label = spotsLabelFor(id) || found.opportunity.spotsLabel;
    const organizer =
      findCatalogEntry(found.opportunity.creatorId) ?? peekRemotePerson(found.opportunity.creatorId);
    setEntry({
      ...scored,
      opportunity: { ...found.opportunity, spotsLabel: label },
    });
    setCreator(organizer);
    setApplication(apps.find((item) => item.mine) ?? myApplication(id));
    setApplications(apps);
    setIsOrganizer(Boolean(findOwnOpportunity(id)));
    setRole(
      apps.find((item) => item.mine)?.role ||
        myApplication(id)?.role ||
        readSentInterest().roles[found.id] ||
        "",
    );
    setSpotsLabel(label);
    if (organizer?.kind === "persona") {
      const book = readMatchBook();
      setBridgeSent(readSentInterest().personas.includes(organizer.id) || book.accepted.includes(organizer.id));
      setBridgeBlocked(book.blocked.includes(organizer.id) || book.declined.includes(organizer.id));
    } else {
      setBridgeSent(false);
      setBridgeBlocked(false);
    }
    setBridgeError("");
    setError("");
    document.title = `${found.title} — ZUNELA`;
    setReady(true);
  }

  useEffect(() => {
    void (async () => {
      await refreshRemoteMatchCache();
      await reload();
    })();
  }, [id]);

  function chooseRole(nextRole: string) {
    setRole(role === nextRole ? "" : nextRole);
  }

  async function toggleParticipation() {
    if (!entry) {
      return;
    }
    if (!online) {
      setError(offlineWriteMessage());
      return;
    }
    if (application && application.status !== "rechazada") {
      const withdrawReason = await withdrawApplicationAsync(entry.id);
      if (withdrawReason) {
        setError(withdrawReason);
        return;
      }
      const current = readSentInterest();
      const roles = { ...current.roles };
      delete roles[entry.id];
      saveSentInterest({
        ...current,
        oportunidades: current.oportunidades.filter((item) => item !== entry.id),
        roles,
      });
      setRole("");
      await reload();
      return;
    }
    const reason = await applyToOpportunityAsync(entry.id, role);
    if (reason) {
      setError(reason);
      return;
    }
    const current = readSentInterest();
    const roles = { ...current.roles };
    if (role) {
      roles[entry.id] = role;
    }
    saveSentInterest({
      ...current,
      oportunidades: current.oportunidades.includes(entry.id)
        ? current.oportunidades
        : [...current.oportunidades, entry.id],
      roles,
    });
    await reload();
  }

  async function decide(applicationId: string, status: "aceptada" | "rechazada") {
    if (!online) {
      setError(offlineWriteMessage());
      return;
    }
    const reason = await reviewApplicationAsync(applicationId, status, id);
    if (reason) {
      setError(reason);
      return;
    }
    await reload();
  }

  async function toggleOrganizerBridge() {
    if (!creator || creator.kind !== "persona") {
      return;
    }
    if (!online) {
      setBridgeError(offlineWriteMessage());
      return;
    }
    const current = readSentInterest();
    const already = current.personas.includes(creator.id);
    if (!already) {
      const reason = canOfferMatchInterest(creator.id);
      if (reason) {
        setBridgeError(reason);
        return;
      }
    }
    const remoteReason = already
      ? await withdrawMatchAsync(creator.id)
      : await noteOutgoingInterestAsync(creator.id);
    if (remoteReason) {
      setBridgeError(remoteReason);
      return;
    }
    const personas = already
      ? current.personas.filter((personId) => personId !== creator.id)
      : [...current.personas, creator.id];
    saveSentInterest({ ...current, personas });
    if (already) {
      recordProductEvent(`Retiró el interés de conexión tras la oportunidad «${entry?.title ?? id}».`);
    } else {
      recordProductEvent(
        `Propuso conexión con quien organiza «${entry?.title ?? id}». No abre el chat solo.`,
      );
    }
    setBridgeError("");
    reload();
  }

  if (!ready) {
    return <div className="h-80" />;
  }

  return (
    <div>
      <DiscoverChrome />

      {missing || !entry?.opportunity ? (
        <div className="mt-10 rounded-[28px] border border-line bg-card/95 p-8 text-center">
          <h1 className="font-display text-3xl text-navy">Oportunidad no disponible</h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Esta ficha no está en el catálogo o ya no admite participación.
          </p>
        </div>
      ) : (
        <DetailView
          entry={entry}
          creator={creator}
          application={application}
          applications={applications}
          isOrganizer={isOrganizer}
          role={role}
          spotsLabel={spotsLabel}
          error={error}
          bridgeSent={bridgeSent}
          bridgeBlocked={bridgeBlocked}
          bridgeError={bridgeError}
          online={online}
          onChooseRole={chooseRole}
          onToggle={toggleParticipation}
          onDecide={decide}
          onBridge={toggleOrganizerBridge}
        />
      )}
    </div>
  );
}

function DetailView({
  entry,
  creator,
  application,
  applications,
  isOrganizer,
  role,
  spotsLabel,
  error,
  bridgeSent,
  bridgeBlocked,
  bridgeError,
  online,
  onChooseRole,
  onToggle,
  onDecide,
  onBridge,
}: {
  entry: ScoredEntry;
  creator: CatalogEntry | null;
  application: OpportunityApplication | null;
  applications: OpportunityApplication[];
  isOrganizer: boolean;
  role: string;
  spotsLabel: string;
  error: string;
  bridgeSent: boolean;
  bridgeBlocked: boolean;
  bridgeError: string;
  online: boolean;
  onChooseRole: (role: string) => void;
  onToggle: () => void;
  onDecide: (id: string, status: "aceptada" | "rechazada") => void;
  onBridge: () => void;
}) {
  const facts = entry.opportunity;
  if (!facts) {
    return null;
  }
  const creatorIsPerson = creator?.kind === "persona";
  const creatorConnected = Boolean(
    creator && creator.kind === "persona" && readMatchBook().accepted.includes(creator.id),
  );
  const showProfession = creator
    ? isPublicField(creator, "profession", { connected: creatorConnected })
    : false;
  const activeApplication = application && application.status !== "rechazada";
  const pendingApps = applications.filter((item) => !item.mine && item.status === "pendiente");
  const decidedApps = applications.filter((item) => !item.mine && item.status !== "pendiente");
  const showBridge =
    !isOrganizer &&
    application?.status === "aceptada" &&
    creatorIsPerson &&
    Boolean(creator) &&
    !facts.organizerName;

  return (
    <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.8fr)]">
      <article className="rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_24px_60px_rgba(7,21,31,0.1)] sm:p-8">
        <p className="text-[11px] font-semibold tracking-[0.22em] text-gold uppercase">
          {facts.category}
          {" · "}
          {facts.ownStatus === "revision"
            ? "tuya · en revisión"
            : facts.ownStatus === "publicada"
              ? "tuya"
              : "del catálogo"}
        </p>
        <h1 className="mt-3 font-display text-4xl text-navy">{entry.title}</h1>
        <p className="mt-2 text-sm text-muted">
          {entry.city}
          {" · "}
          {modalityLabel(entry.modality)}
          {" · "}
          {spotsLabel}
        </p>
        <p className="mt-6 text-base leading-7 text-ink">{facts.objective}</p>

        <section className="mt-8 rounded-2xl bg-cream-deep px-4 py-4">
          <h2 className="text-sm font-semibold text-navy">Quién organiza</h2>
          {facts.organizerName ? (
            <div className="mt-3 flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-full bg-teal text-sm font-semibold text-cream">
                {initialsFromName(facts.organizerName)}
              </div>
              <div>
                <p className="font-semibold text-navy">{facts.organizerName}</p>
                <p className="text-sm text-muted">{facts.organizerDetail}</p>
              </div>
            </div>
          ) : creatorIsPerson && creator ? (
            <div className="mt-3 flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-full bg-teal text-sm font-semibold text-cream">
                {initialsFromName(creator.title)}
              </div>
              <div>
                <Link
                  href={`/descubrir/personas/${creator.id}`}
                  className="font-semibold text-navy hover:text-teal"
                >
                  {creator.title}
                </Link>
                <p className="text-sm text-muted">
                  {showProfession ? creator.subtitle : "Profesión reservada"}
                  {" · "}
                  {creator.city}
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">El organizador no está disponible.</p>
          )}
          <p className="mt-3 text-sm leading-6 text-muted">
            {facts.organizerName
              ? "Organizas esta oportunidad. Correo, teléfono y redes no se muestran."
              : "Organiza esta oportunidad del catálogo. Correo, teléfono y redes no se muestran."}
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-semibold text-navy">Reglas</h2>
          <ul className="mt-3 space-y-2">
            {facts.rules.map((rule) => (
              <li key={rule} className="rounded-2xl border border-line px-4 py-3 text-sm leading-6 text-ink">
                {rule}
              </li>
            ))}
          </ul>
        </section>

        {facts.roles.length > 0 && !isOrganizer ? (
          <section className="mt-8">
            <h2 className="text-sm font-semibold text-navy">Cómo puedes aportar</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              El rol es opcional. Sirve para decir cómo participas dentro de esta oportunidad.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {facts.roles.map((item) => {
                const active = role === item;
                return (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onChooseRole(item)}
                    disabled={Boolean(activeApplication)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-60 ${
                      active ? "bg-navy text-cream" : "bg-cream-deep text-navy hover:text-teal"
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {isOrganizer ? (
          <section className="mt-8">
            <h2 className="text-sm font-semibold text-navy">Postulaciones</h2>
            {facts.ownStatus === "revision" ? (
              <p className="mt-3 text-sm leading-6 text-muted">
                Tu publicación está en revisión. Todavía no recibe participantes.
              </p>
            ) : (
              <>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Acepta o rechaza postulaciones. El cupo solo avanza con las aceptadas. Esto no abre
                  un chat privado.
                </p>
                {pendingApps.length === 0 ? (
                  <p className="mt-4 text-sm text-muted">No hay postulaciones pendientes.</p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {pendingApps.map((item) => (
                      <li key={item.id} className="rounded-2xl border border-line px-4 py-3">
                        <p className="text-sm font-semibold text-navy">{item.applicantName}</p>
                        <p className="text-sm text-muted">
                          {item.role ? `Rol: ${item.role}` : "Sin rol elegido"} · Pendiente
                        </p>
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => onDecide(item.id, "aceptada")}
                            disabled={!online}
                            className="h-10 flex-1 rounded-xl bg-teal text-sm font-semibold text-white hover:bg-teal-deep disabled:opacity-50"
                          >
                            Aceptar
                          </button>
                          <button
                            type="button"
                            onClick={() => onDecide(item.id, "rechazada")}
                            disabled={!online}
                            className="h-10 flex-1 rounded-xl border border-line bg-white text-sm font-semibold text-navy disabled:opacity-50"
                          >
                            Rechazar
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {decidedApps.length > 0 ? (
                  <ul className="mt-4 space-y-2">
                    {decidedApps.map((item) => (
                      <li
                        key={item.id}
                        className="rounded-2xl bg-cream-deep px-4 py-3 text-sm text-navy"
                      >
                        {item.applicantName}
                        {" · "}
                        {item.status === "aceptada" ? "Aceptada" : "Rechazada"}
                        {item.role ? ` · ${item.role}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}
          </section>
        ) : (
          <>
            <button
              type="button"
              aria-pressed={Boolean(activeApplication)}
              onClick={onToggle}
              disabled={!online}
              className={`mt-8 h-12 w-full rounded-xl text-sm font-semibold disabled:opacity-50 ${
                activeApplication
                  ? "border border-teal bg-white text-teal"
                  : "bg-teal text-white hover:bg-teal-deep"
              }`}
            >
              {activeApplication ? "Retirar postulación" : "Quiero participar"}
            </button>
            {!online ? <p className="mt-2 text-xs leading-5 text-muted">{offlineWriteMessage()}</p> : null}
            {application ? (
              <p className="mt-3 text-center text-sm leading-6 text-teal-deep">
                Estado: {statusLabel(application.status)}
                {application.role ? ` · «${application.role}»` : ""}. Esto no abre un chat privado.
              </p>
            ) : null}
            {showBridge && creator ? (
              <div className="mt-6 rounded-2xl border border-dashed border-line px-4 py-4">
                <p className="text-sm font-semibold text-navy">Conexión con quien organiza</p>
                <p className="mt-1 text-sm leading-6 text-muted">
                  Tu postulación fue aceptada. Si quieres una conexión con {creator.title}, envía interés
                  tú mismo. La IA no crea la conexión ni abre el chat.
                </p>
                {bridgeBlocked ? (
                  <p className="mt-3 text-sm text-muted">No puedes proponer conexión con esta persona ahora.</p>
                ) : (
                  <button
                    type="button"
                    aria-pressed={bridgeSent}
                    onClick={onBridge}
                    disabled={!online}
                    className={`mt-3 h-11 w-full rounded-xl text-sm font-semibold disabled:opacity-50 ${
                      bridgeSent
                        ? "border border-teal bg-white text-teal"
                        : "bg-navy text-cream hover:bg-navy/90"
                    }`}
                  >
                    {bridgeSent ? "Retirar interés de conexión" : "Proponer conexión"}
                  </button>
                )}
                {bridgeSent ? (
                  <p className="mt-2 text-center text-xs leading-5 text-muted">
                    Interés enviado. El chat solo abre si hay aceptación de las dos partes.{" "}
                    <Link href={`/descubrir/personas/${creator.id}`} className="font-semibold text-teal">
                      Ver perfil
                    </Link>
                  </p>
                ) : null}
                {bridgeError ? <p className="mt-2 text-sm text-danger">{bridgeError}</p> : null}
              </div>
            ) : null}
          </>
        )}
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      </article>

      <aside className="rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_24px_60px_rgba(7,21,31,0.1)] lg:sticky lg:top-6">
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
        <p className="mt-4 text-xs leading-5 text-muted">
          Esto no es una probabilidad de éxito. Solo explica las señales que coinciden con tu perfil.
        </p>
        <div className="mt-6 rounded-2xl border border-dashed border-line px-4 py-3">
          <p className="text-sm font-semibold text-navy">
            {facts.ownStatus ? "Prueba Premium" : "Plan Gratis"}
          </p>
          <p className="mt-1 text-sm leading-6 text-muted">
            Puedes postularte a oportunidades del catálogo.{" "}
            <Link href="/descubrir/oportunidades/nueva" className="font-semibold text-teal">
              Crear una propia
            </Link>{" "}
            es Premium y queda en revisión.
          </p>
        </div>
      </aside>
    </div>
  );
}

function statusLabel(status: OpportunityApplication["status"]) {
  if (status === "aceptada") {
    return "Aceptada";
  }
  if (status === "rechazada") {
    return "Rechazada";
  }
  return "Pendiente";
}

function modalityLabel(value: ScoredEntry["modality"]) {
  if (value === "presencial") {
    return "Presencial";
  }
  if (value === "remota") {
    return "Remota";
  }
  return "Presencial o remota";
}
