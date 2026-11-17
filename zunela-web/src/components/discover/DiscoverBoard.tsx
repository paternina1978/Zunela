"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DiscoverChrome } from "@/components/discover/DiscoverChrome";
import { offlineWriteMessage, useOnline, useRefreshOnFocus } from "@/hooks/useOnline";
import {
  readAdminParams,
  readSuspendedIds,
  refreshRemoteAdminParams,
  refreshRemoteSuspendedIds,
} from "@/lib/admin";
import { EMPTY_AFFINITY, foldText, readAffinity, type Modality } from "@/lib/affinity";
import { catalogInterestLabels, readGoalOptions, refreshRemoteCatalogs } from "@/lib/catalog";
import {
  listedCatalog,
  isPublicField,
  readSentInterest,
  saveSentInterest,
  scoreCatalog,
  sentKey,
  type DiscoverKind,
  type ScoredEntry,
  type SentInterest,
} from "@/lib/discover";
import { departmentOfCity } from "@/lib/locations";
import {
  canOfferMatchInterest,
  noteOutgoingInterestAsync,
  readBlockedIds,
  refreshRemoteMatchCache,
  withdrawMatchAsync,
} from "@/lib/matches";
import {
  findOwnCommunity,
  listCachedRemoteCommunities,
  ownCommunityEntry,
  readOwnCommunities,
  refreshRemoteCommunityCache,
} from "@/lib/own-communities";
import {
  listCachedRemoteOpportunities,
  ownOpportunityEntry,
  readOwnOpportunities,
  refreshRemoteOpportunityCache,
} from "@/lib/own-opportunities";
import { initialsFromName, readProfile } from "@/lib/profile";
import { listRemotePeople, remoteAuthUserId } from "@/lib/remote/catalog";
import { remoteIdentityAvailable } from "@/lib/remote/identity";
import { buildSelfEntry, SELF_PERSON_ID, selfPreviewReady } from "@/lib/self-profile";

type KindFilter = "todas" | DiscoverKind;
type PlaceFilter = "todas" | "mi-ciudad" | "mi-departamento";
type ModalityFilter = "todas" | Exclude<Modality, "ambas">;

const KIND_FILTERS: { id: KindFilter; label: string }[] = [
  { id: "todas", label: "Todo" },
  { id: "persona", label: "Personas" },
  { id: "oportunidad", label: "Oportunidades" },
  { id: "comunidad", label: "Comunidades" },
];

export function DiscoverBoard() {
  const online = useOnline();
  const [ready, setReady] = useState(false);
  const [city, setCity] = useState("");
  const [department, setDepartment] = useState("");
  const [hasAffinity, setHasAffinity] = useState(false);
  const [entries, setEntries] = useState<ScoredEntry[]>([]);
  const [interestChoices, setInterestChoices] = useState<string[]>([]);
  const [goalChoices, setGoalChoices] = useState<string[]>([]);
  const [sent, setSent] = useState<SentInterest>({
    personas: [],
    oportunidades: [],
    comunidades: [],
    roles: {},
  });
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("todas");
  const [place, setPlace] = useState<PlaceFilter>("todas");
  const [modality, setModality] = useState<ModalityFilter>("todas");
  const [interest, setInterest] = useState("todas");
  const [goal, setGoal] = useState("todas");
  const [affinityThreshold, setAffinityThreshold] = useState(0);
  const [selfCard, setSelfCard] = useState<ScoredEntry | null>(null);
  const [offlineHint, setOfflineHint] = useState("");

  const load = useCallback(async () => {
    const profile = readProfile();
    const parsedAffinity = readAffinity();
    const active = parsedAffinity ?? EMPTY_AFFINITY;
    const profileCity = profile?.city ?? "";
    setCity(profileCity);
    setDepartment(departmentOfCity(profileCity));
    setHasAffinity(Boolean(parsedAffinity));
    const self = buildSelfEntry(profile, active);
    setSelfCard(self ? scoreCatalog(self, active, profileCity) : null);

    let remotePeople: Awaited<ReturnType<typeof listRemotePeople>> = [];
    if (remoteIdentityAvailable()) {
      await refreshRemoteAdminParams();
      await refreshRemoteCatalogs();
      await refreshRemoteSuspendedIds();
      await refreshRemoteMatchCache();
      await refreshRemoteOpportunityCache();
      await refreshRemoteCommunityCache();
      const me = await remoteAuthUserId();
      remotePeople = await listRemotePeople(me);
    }
    setInterestChoices(catalogInterestLabels());
    setGoalChoices(readGoalOptions());
    setAffinityThreshold(readAdminParams().affinityThreshold ?? 0);

    const listed = [
      ...listedCatalog(),
      ...remotePeople,
      ...readOwnOpportunities().map(ownOpportunityEntry),
      ...listCachedRemoteOpportunities().map(ownOpportunityEntry),
      ...readOwnCommunities()
        .filter((item) => item.access === "publica")
        .map(ownCommunityEntry),
      ...listCachedRemoteCommunities()
        .filter((item) => item.access !== "invitacion" || findOwnCommunity(item.id))
        .map(ownCommunityEntry),
    ];
    setEntries(
      listed
        .map((entry) => scoreCatalog(entry, active, profileCity))
        .sort((left, right) => right.score - left.score),
    );
    setSent(readSentInterest());
    setReady(true);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useRefreshOnFocus(load);

  const visible = useMemo(() => {
    const folded = foldText(query);
    const suspended = new Set(readSuspendedIds());
    const blocked = new Set(readBlockedIds());
    return entries.filter((entry) => {
      if (entry.kind === "persona" && (suspended.has(entry.id) || blocked.has(entry.id))) {
        return false;
      }
      if (affinityThreshold > 0 && entry.score * 100 < affinityThreshold) {
        return false;
      }
      if (kind !== "todas" && entry.kind !== kind) {
        return false;
      }
      if (place === "mi-ciudad" && foldText(entry.city) !== foldText(city)) {
        return false;
      }
      if (
        place === "mi-departamento" &&
        department &&
        foldText(entry.department || departmentOfCity(entry.city)) !== foldText(department)
      ) {
        return false;
      }
      if (modality !== "todas" && entry.modality !== "ambas" && entry.modality !== modality) {
        return false;
      }
      if (
        interest !== "todas" &&
        !entry.interests.some((item) => foldText(item) === foldText(interest))
      ) {
        return false;
      }
      if (goal !== "todas" && !entry.goals.some((item) => foldText(item) === foldText(goal))) {
        return false;
      }
      if (!folded) {
        return true;
      }
      const haystack = [
        entry.title,
        entry.city,
        entry.department,
        ...entry.interests,
        ...entry.goals,
        isPublicField(entry, "profession") ? entry.subtitle : "",
        isPublicField(entry, "summary") ? entry.summary : "",
      ]
        .map(foldText)
        .join(" ");
      return haystack.includes(folded);
    });
  }, [
    affinityThreshold,
    city,
    department,
    entries,
    goal,
    interest,
    kind,
    modality,
    place,
    query,
  ]);

  function toggleInterest(entry: ScoredEntry) {
    if (!online) {
      setOfflineHint(offlineWriteMessage());
      return;
    }
    setOfflineHint("");
    const key = sentKey(entry.kind);
    void (async () => {
      const current = readSentInterest();
      const already = current[key].includes(entry.id);
      if (!already && entry.kind === "persona") {
        const reason = canOfferMatchInterest(entry.id);
        if (reason) {
          window.alert(reason);
          return;
        }
      }
      if (entry.kind === "persona") {
        const reason = already
          ? await withdrawMatchAsync(entry.id)
          : await noteOutgoingInterestAsync(entry.id);
        if (reason) {
          setOfflineHint(reason);
          return;
        }
      }
      const selected = already
        ? current[key].filter((id) => id !== entry.id)
        : [...current[key], entry.id];
      const roles = { ...current.roles };
      if (already) {
        delete roles[entry.id];
      }
      const next = { ...current, [key]: selected, roles };
      saveSentInterest(next);
      setSent(next);
    })();
  }

  if (!ready) {
    return <div className="h-80" />;
  }

  return (
    <div>
      <DiscoverChrome />

      <div className="mt-8">
        <p className="text-[11px] font-semibold tracking-[0.22em] text-gold uppercase">Paso 4</p>
        <h1 className="mt-2 font-display text-3xl text-navy sm:text-4xl">Descubrir</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Personas, oportunidades del catálogo y comunidades públicas. Cada ficha
          dice por qué aparece. Enviar interés no abre el chat: hace falta que la
          otra parte también acepte.
        </p>
        {!online || offlineHint ? (
          <p className="mt-3 text-sm leading-6 text-muted">{offlineHint || offlineWriteMessage()}</p>
        ) : null}
        <p className="mt-3 text-sm text-navy">
          <Link
            href="/descubrir/oportunidades/nueva"
            className="font-semibold text-teal hover:text-teal-deep"
          >
            Publicar una oportunidad
          </Link>{" "}
          es parte de la prueba Premium.{" "}
          <Link
            href="/descubrir/comunidades/nueva"
            className="font-semibold text-teal hover:text-teal-deep"
          >
            Crear una comunidad
          </Link>{" "}
          pública usa el cupo de Gratis; la privada y la de invitación son Premium y no salen en
          este listado.
        </p>
        {!hasAffinity ? (
          <p className="mt-3 text-sm text-navy">
            <Link href="/intereses" className="font-semibold text-teal hover:text-teal-deep">
              Elige tus intereses
            </Link>{" "}
            para ver coincidencias más precisas.
          </p>
        ) : null}
        {affinityThreshold > 0 ? (
          <p className="mt-3 text-sm leading-6 text-muted">
            Umbral de afinidad vigente: {affinityThreshold}. Las fichas por debajo no salen en este
            listado. No es probabilidad de éxito; una ficha por enlace sigue abierta.
          </p>
        ) : null}
      </div>

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="min-w-0 flex-1" htmlFor="discover-search">
          <span className="sr-only">Buscar</span>
          <input
            id="discover-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nombre, ciudad o interés"
            className="h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink outline-none placeholder:text-muted/70 focus:border-teal focus:shadow-[0_0_0_3px_rgba(10,111,108,0.14)]"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <FilterChip active={place === "todas"} onClick={() => setPlace("todas")}>
            Toda Colombia
          </FilterChip>
          <FilterChip
            active={place === "mi-ciudad"}
            onClick={() => setPlace("mi-ciudad")}
            disabled={!city}
          >
            {city ? city : "Mi ciudad"}
          </FilterChip>
          <FilterChip
            active={place === "mi-departamento"}
            onClick={() => setPlace("mi-departamento")}
            disabled={!department}
          >
            {department ? department : "Mi departamento"}
          </FilterChip>
          <FilterChip active={modality === "todas"} onClick={() => setModality("todas")}>
            Toda modalidad
          </FilterChip>
          <FilterChip active={modality === "presencial"} onClick={() => setModality("presencial")}>
            Presencial
          </FilterChip>
          <FilterChip active={modality === "remota"} onClick={() => setModality("remota")}>
            Remota
          </FilterChip>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
        <label className="inline-flex items-center gap-2 text-sm text-muted">
          Interés
          <select
            value={interest}
            onChange={(event) => setInterest(event.target.value)}
            className="h-10 rounded-xl border border-line bg-white px-3 text-sm text-navy"
          >
            <option value="todas">Todos</option>
            {interestChoices.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-muted">
          Objetivo
          <select
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            className="h-10 rounded-xl border border-line bg-white px-3 text-sm text-navy"
          >
            <option value="todas">Todos</option>
            {goalChoices.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Tipo de resultado">
        {KIND_FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            role="tab"
            aria-selected={kind === filter.id}
            onClick={() => setKind(filter.id)}
            className={`h-10 rounded-full px-4 text-sm font-semibold ${
              kind === filter.id ? "bg-navy text-cream" : "bg-white text-muted hover:text-navy"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {(kind === "todas" || kind === "persona") && (selfCard || selfPreviewReady()) ? (
        <section className="mt-6 rounded-[28px] border border-dashed border-gold/50 bg-card/90 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.22em] text-gold uppercase">
                Tu ficha
              </p>
              <h2 className="mt-1 font-display text-2xl text-navy">
                {selfCard?.title ?? "Perfil incompleto"}
              </h2>
              <p className="mt-1 max-w-xl text-sm leading-6 text-muted">
                Vista piloto de cómo te descubrirían. No puedes enviarte interés a ti mismo.
              </p>
            </div>
            <Link
              href={`/descubrir/personas/${SELF_PERSON_ID}`}
              className="inline-flex h-11 items-center rounded-xl bg-navy px-4 text-sm font-semibold text-cream hover:bg-navy/90"
            >
              Ver tu ficha
            </Link>
          </div>
          {selfCard ? (
            <ul className="mt-4 flex flex-wrap gap-2">
              {selfCard.reasons.map((reason) => (
                <li
                  key={reason}
                  className="rounded-full bg-cream-deep px-3 py-1 text-xs font-medium text-navy"
                >
                  {reason}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">
              <Link href="/perfil" className="font-semibold text-teal">
                Completa el perfil
              </Link>{" "}
              para armar la ficha.
            </p>
          )}
        </section>
      ) : null}

      <OwnCommunities />

      {visible.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-line bg-white/70 px-5 py-8 text-center text-sm leading-6 text-muted">
          <p>Nada coincide con esos filtros.</p>
          <p className="mt-3">
            Para ver otras cuentas: cada una debe completar{" "}
            <Link href="/perfil" className="font-semibold text-teal hover:text-teal-deep">
              Perfil
            </Link>{" "}
            e{" "}
            <Link href="/intereses" className="font-semibold text-teal hover:text-teal-deep">
              Intereses
            </Link>
            , luego aquí elige <span className="font-semibold text-navy">Personas</span> y{" "}
            <span className="font-semibold text-navy">Toda Colombia</span> (sin búsqueda). No hay
            “invitar por correo”: se conectan con interés desde Descubrir.
          </p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          {visible.map((entry) => (
            <DiscoverCard
              key={entry.id}
              entry={entry}
              selected={sent[sentKey(entry.kind)].includes(entry.id)}
              onToggle={() => toggleInterest(entry)}
              online={online}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function DiscoverCard({
  entry,
  selected,
  onToggle,
  online,
}: {
  entry: ScoredEntry;
  selected: boolean;
  onToggle: () => void;
  online: boolean;
}) {
  const action = actionCopy(entry.kind, selected);

  const profileHref =
    entry.kind === "persona"
      ? `/descubrir/personas/${entry.id}`
      : entry.kind === "oportunidad"
        ? `/descubrir/oportunidades/${entry.id}`
        : `/descubrir/comunidades/${entry.id}`;

  return (
    <li className="flex flex-col rounded-[28px] border border-gold/35 bg-card/95 p-5 shadow-[0_18px_40px_rgba(7,21,31,0.08)]">
      <div className="flex items-start gap-3">
        {entry.kind === "persona" ? (
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-teal text-sm font-semibold text-cream">
            {initialsFromName(entry.title)}
          </div>
        ) : (
          <span className="rounded-full bg-cream-deep px-2.5 py-1 text-[11px] font-semibold tracking-wide text-teal uppercase">
            {kindLabel(entry.kind)}
          </span>
        )}
        <div className="min-w-0">
          {entry.kind === "persona" ? (
            <p className="text-[11px] font-semibold tracking-[0.16em] text-gold uppercase">Persona</p>
          ) : null}
          {profileHref ? (
            <h2 className="font-display text-2xl leading-tight text-navy">
              <Link href={profileHref} className="hover:text-teal">
                {entry.title}
              </Link>
            </h2>
          ) : (
            <h2 className="font-display text-2xl leading-tight text-navy">{entry.title}</h2>
          )}
          <p className="mt-1 text-sm text-muted">
            {entry.subtitle} · {entry.city} · {modalityLabel(entry.modality)}
          </p>
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-ink">{entry.summary}</p>

      <ul className="mt-4 flex flex-wrap gap-2">
        {entry.reasons.map((reason) => (
          <li key={reason} className="rounded-full bg-cream-deep px-3 py-1 text-xs font-medium text-navy">
            {reason}
          </li>
        ))}
      </ul>

      {profileHref ? (
        <Link href={profileHref} className="mt-4 text-sm font-semibold text-teal hover:text-teal-deep">
          {entry.kind === "persona"
            ? "Ver perfil"
            : entry.kind === "oportunidad"
              ? "Ver oportunidad"
              : "Ver comunidad"}
        </Link>
      ) : null}

      {entry.opportunity?.ownStatus ? (
        <p className="mt-5 text-sm font-semibold text-navy">
          {entry.opportunity.ownStatus === "revision" ? "En revisión" : "Publicada"}
        </p>
      ) : (
        <button
          type="button"
          aria-pressed={selected}
          onClick={onToggle}
          disabled={!online}
          className={`mt-5 h-11 rounded-xl text-sm font-semibold disabled:opacity-50 ${
            selected
              ? "border border-teal bg-white text-teal"
              : "bg-teal text-white hover:bg-teal-deep"
          }`}
        >
          {action}
        </button>
      )}
      {selected && !entry.opportunity?.ownStatus ? (
        <p className="mt-2 text-xs leading-5 text-muted">{selectedNote(entry.kind)}</p>
      ) : null}
    </li>
  );
}

function FilterChip({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      onClick={onClick}
      className={`h-11 rounded-full border px-3 text-sm font-medium ${
        active
          ? "border-teal bg-teal text-white"
          : "border-line bg-white text-navy hover:border-teal"
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {children}
    </button>
  );
}

function OwnCommunities() {
  const seen = new Set<string>();
  const mine = [...readOwnCommunities(), ...listCachedRemoteCommunities()].filter((item) => {
    if (item.access === "publica" || seen.has(item.id) || !findOwnCommunity(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
  if (mine.length === 0) {
    return null;
  }
  return (
    <section className="mt-6 rounded-[28px] border border-gold/35 bg-card/95 p-5">
      <h2 className="font-display text-2xl text-navy">Tus comunidades</h2>
      <p className="mt-1 text-sm leading-6 text-muted">
        Privadas y por invitación. No aparecen entre las fichas públicas.
      </p>
      <ul className="mt-3 space-y-2">
        {mine.map((item) => (
          <li key={item.id}>
            <Link
              href={`/descubrir/comunidades/${item.id}`}
              className="font-semibold text-teal hover:text-teal-deep"
            >
              {item.title}
            </Link>
            <p className="text-sm text-muted">
              {item.access === "privada" ? "Privada" : "Por invitación"}
              {item.status === "revision" ? " · en revisión" : ""}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function kindLabel(kind: DiscoverKind) {
  if (kind === "oportunidad") return "Oportunidad";
  if (kind === "comunidad") return "Comunidad";
  return "Persona";
}

function modalityLabel(modality: ScoredEntry["modality"]) {
  if (modality === "presencial") return "Presencial";
  if (modality === "remota") return "Remota";
  return "Presencial o remota";
}

function actionCopy(kind: DiscoverKind, selected: boolean) {
  if (kind === "persona") {
    return selected ? "Retirar interés" : "Me interesa";
  }
  if (kind === "oportunidad") {
    return selected ? "Retirar participación" : "Quiero participar";
  }
  return selected ? "Salir" : "Unirme";
}

function selectedNote(kind: DiscoverKind) {
  if (kind === "persona") {
    return "Interés enviado. La conversación se abre solo si también hay aceptación.";
  }
  if (kind === "oportunidad") {
    return "Quedaste en la lista de esta oportunidad del catálogo.";
  }
  return "Entraste. Las publicaciones y el chat están en la ficha.";
}
