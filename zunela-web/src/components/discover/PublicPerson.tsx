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
  type ScoredEntry,
} from "@/lib/discover";
import {
  canOfferMatchInterest,
  noteOutgoingInterestAsync,
  readBlockedIds,
  readMatchBook,
  refreshRemoteMatchCache,
  unblockPersonAsync,
  withdrawMatchAsync,
} from "@/lib/matches";
import { recordProductEvent } from "@/lib/product-events";
import { initialsFromName, readProfile } from "@/lib/profile";
import { getRemotePerson } from "@/lib/remote/catalog";
import { buildSelfEntry, isSelfPersonId } from "@/lib/self-profile";

type PublicPersonProps = {
  id: string;
};

export function PublicPerson({ id }: PublicPersonProps) {
  const online = useOnline();
  const [ready, setReady] = useState(false);
  const [entry, setEntry] = useState<ScoredEntry | null>(null);
  const [missing, setMissing] = useState(false);
  const [selected, setSelected] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [connected, setConnected] = useState(false);
  const [interestError, setInterestError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      await refreshRemoteMatchCache();
      const profile = readProfile();
      const affinity = readAffinity() ?? EMPTY_AFFINITY;
      let found = isSelfPersonId(id) ? buildSelfEntry(profile, affinity) : findCatalogEntry(id);
      if ((!found || found.kind !== "persona") && !isSelfPersonId(id)) {
        found = await getRemotePerson(id);
      }
      if (cancelled) {
        return;
      }
      if (!found || found.kind !== "persona") {
        setMissing(true);
        setReady(true);
        return;
      }

      setBlocked(!isSelfPersonId(id) && readBlockedIds().includes(found.id));
      setConnected(isSelfPersonId(id) || readMatchBook().accepted.includes(found.id));
      setEntry(scoreCatalog(found, affinity, profile?.city ?? ""));
      setSelected(readSentInterest().personas.includes(found.id));
      document.title = isSelfPersonId(id)
        ? `Tu ficha — ZUNELA`
        : `${found.title} — ZUNELA`;
      setReady(true);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function unblock() {
    if (!entry || isSelfPersonId(id)) {
      return;
    }
    if (!online) {
      setInterestError(offlineWriteMessage());
      return;
    }
    const reason = await unblockPersonAsync(entry.id);
    if (reason) {
      setInterestError(reason);
      return;
    }
    setInterestError("");
    setBlocked(false);
  }

  async function toggleInterest() {
    if (!entry || blocked || isSelfPersonId(id)) {
      return;
    }
    if (!online) {
      setInterestError(offlineWriteMessage());
      return;
    }
    const current = readSentInterest();
    const already = current.personas.includes(entry.id);
    if (!already) {
      const blockedReason = canOfferMatchInterest(entry.id);
      if (blockedReason) {
        setInterestError(blockedReason);
        return;
      }
    }
    const reason = already
      ? await withdrawMatchAsync(entry.id)
      : await noteOutgoingInterestAsync(entry.id);
    if (reason) {
      setInterestError(reason);
      return;
    }
    const personas = already
      ? current.personas.filter((personId) => personId !== entry.id)
      : [...current.personas, entry.id];
    saveSentInterest({ ...current, personas });
    if (!already) {
      recordProductEvent(`Envió interés a ${entry.title}.`);
    }
    setInterestError("");
    setSelected(!selected);
  }

  if (!ready) {
    return <div className="h-80" />;
  }

  return (
    <div>
      <DiscoverChrome />

      {missing || !entry ? (
        <div className="mt-10 rounded-[28px] border border-line bg-card/95 p-8 text-center">
          <h1 className="font-display text-3xl text-navy">Perfil no disponible</h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Esta ficha no está en el catálogo de personas o ya no se puede ver.
          </p>
        </div>
      ) : blocked ? (
        <div className="mt-10 rounded-[28px] border border-line bg-card/95 p-8">
          <h1 className="font-display text-3xl text-navy">Persona bloqueada</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
            {entry.title} no aparece en Descubrir y el chat está cerrado. El correo y el teléfono
            siguen ocultos. Desbloquear no reabre la conexión.
          </p>
          <button
            type="button"
            onClick={unblock}
            disabled={!online}
            className="mt-5 h-11 rounded-xl border border-teal bg-white px-4 text-sm font-semibold text-teal disabled:opacity-50"
          >
            Desbloquear
          </button>
          {interestError ? <p className="mt-3 text-sm text-danger">{interestError}</p> : null}
          {!online ? <p className="mt-2 text-sm text-muted">{offlineWriteMessage()}</p> : null}
        </div>
      ) : (
        <>
          <ProfileView
            entry={entry}
            selected={selected}
            connected={connected}
            isSelf={isSelfPersonId(id)}
            online={online}
            onToggle={toggleInterest}
          />
          {interestError ? <p className="mt-3 text-sm text-danger">{interestError}</p> : null}
        </>
      )}
    </div>
  );
}

function ProfileView({
  entry,
  selected,
  connected,
  isSelf,
  online,
  onToggle,
}: {
  entry: ScoredEntry;
  selected: boolean;
  connected: boolean;
  isSelf: boolean;
  online: boolean;
  onToggle: () => void;
}) {
  const opts = { connected };
  const showProfession = isPublicField(entry, "profession", opts);
  const showSummary = isPublicField(entry, "summary", opts);
  const showGoals = isPublicField(entry, "goals", opts);
  const showOffers = isPublicField(entry, "offers", opts);
  const showAvailability = isPublicField(entry, "availability", opts);

  return (
    <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.8fr)]">
      <article className="rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_24px_60px_rgba(7,21,31,0.1)] sm:p-8">
        <p className="text-[11px] font-semibold tracking-[0.22em] text-gold uppercase">
          {isSelf ? "Tu ficha · vista piloto" : "Perfil público"}
        </p>
        <div className="mt-4 flex items-center gap-4">
          <div className="flex size-16 items-center justify-center rounded-full bg-teal text-lg font-semibold text-cream">
            {initialsFromName(entry.title)}
          </div>
          <div>
            <h1 className="font-display text-4xl text-navy">{entry.title}</h1>
            <p className="mt-1 text-sm text-muted">
              {showProfession ? entry.subtitle : "Profesión reservada"}
              {" · "}
              {entry.city}
              {" · "}
              {modalityLabel(entry.modality)}
            </p>
          </div>
        </div>

        {showSummary ? (
          <p className="mt-6 text-base leading-7 text-ink">{entry.summary}</p>
        ) : (
          <LockedLine label="Presentación" />
        )}

        <Section title="Intereses" items={entry.interests} />
        {showGoals ? (
          <Section title="Busca" items={entry.goals} />
        ) : (
          <LockedLine label="Objetivos" />
        )}
        {showOffers ? (
          <Section title="Ofrece" items={entry.offers} />
        ) : (
          <LockedLine label="Aportes" />
        )}
        {showAvailability ? (
          <Section title="Disponibilidad" items={entry.availability} />
        ) : (
          <LockedLine label="Disponibilidad" />
        )}

        <div className="mt-8 rounded-2xl bg-cream-deep px-4 py-3">
          <p className="text-sm font-semibold text-navy">Sigue oculto</p>
          <p className="mt-1 text-sm leading-6 text-muted">
            {isSelf
              ? "Tu correo, teléfono y redes no salen en esta ficha. Los controles de privacidad están en Cuenta y Perfil."
              : "Correo, teléfono y redes no se muestran. Compartirlos exige una conexión y el permiso de esta persona."}
          </p>
        </div>

        {isSelf ? (
          <div className="mt-6 space-y-3">
            <Link
              href="/perfil"
              className="flex h-12 w-full items-center justify-center rounded-xl bg-navy text-sm font-semibold text-cream"
            >
              Editar perfil
            </Link>
            <Link
              href="/cuenta#visibilidad"
              className="flex h-12 w-full items-center justify-center rounded-xl border border-teal bg-white text-sm font-semibold text-teal"
            >
              Ajustar privacidad en Cuenta
            </Link>
          </div>
        ) : (
          <>
            <button
              type="button"
              aria-pressed={selected}
              onClick={onToggle}
              disabled={!online}
              className={`mt-6 h-12 w-full rounded-xl text-sm font-semibold disabled:opacity-50 ${
                selected
                  ? "border border-teal bg-white text-teal"
                  : "bg-teal text-white hover:bg-teal-deep"
              }`}
            >
              {selected ? "Retirar interés" : "Me interesa"}
            </button>
            {!online ? <p className="mt-2 text-center text-xs leading-5 text-muted">{offlineWriteMessage()}</p> : null}
            {selected ? (
              <p className="mt-3 text-center text-sm leading-6 text-teal-deep">
                Interés enviado. La conversación se abre solo si {entry.title.split(" ")[0]} también
                acepta.
              </p>
            ) : null}
          </>
        )}
      </article>

      <aside className="rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_24px_60px_rgba(7,21,31,0.1)] lg:sticky lg:top-6">
        <p className="text-[11px] font-semibold tracking-[0.22em] text-gold uppercase">
          {isSelf ? "Vista local" : "Por qué aparece"}
        </p>
        <h2 className="mt-2 font-display text-2xl text-navy">
          {isSelf ? "Cómo te verían" : "Coincidencia"}
        </h2>
        {isSelf ? (
          <p className="mt-4 text-sm leading-6 text-muted">
            Los campos marcados «después de la conexión» quedan cerrados para quien aún no tiene
            conexión contigo. En el piloto no hay segundo usuario real: esta ficha sirve para
            revisar tu presentación.
          </p>
        ) : null}
        <ul className="mt-4 space-y-2">
          {entry.reasons.map((reason) => (
            <li key={reason} className="rounded-2xl bg-cream-deep px-4 py-3 text-sm text-navy">
              {reason}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs leading-5 text-muted">
          Esto no es una probabilidad de éxito. Solo explica las señales que
          coinciden con tu perfil.
        </p>
      </aside>
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) {
    return null;
  }
  return (
    <section className="mt-6">
      <h2 className="text-sm font-semibold text-navy">{title}</h2>
      <ul className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item} className="rounded-full bg-cream-deep px-3 py-1 text-xs font-medium text-navy">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

function LockedLine({ label }: { label: string }) {
  return (
    <p className="mt-6 rounded-2xl border border-dashed border-line px-4 py-3 text-sm text-muted">
      {label}: visible después de la conexión.
    </p>
  );
}

function modalityLabel(modality: ScoredEntry["modality"]) {
  if (modality === "presencial") return "Presencial";
  if (modality === "remota") return "Remota";
  return "Presencial o remota";
}
