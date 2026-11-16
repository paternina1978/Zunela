"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { JourneySteps } from "@/components/journey/JourneySteps";
import { offlineWriteMessage, useOnline } from "@/hooks/useOnline";
import {
  AVAILABILITY_OPTIONS,
  EMPTY_AFFINITY,
  MODALITY_OPTIONS,
  REACH_OPTIONS,
  foldText,
  readAffinity,
  saveAffinity,
  type AffinityDraft,
  type Reach,
} from "@/lib/affinity";
import {
  readGoalOptions,
  readInterestGroups,
  readOfferOptions,
  refreshRemoteCatalogs,
} from "@/lib/catalog";
import { readProfile } from "@/lib/profile";
import {
  remoteFetchAffinity,
  remoteIdentityAvailable,
  remoteSaveAffinity,
} from "@/lib/remote/identity";

type FieldErrors = {
  interests?: string;
  goals?: string;
};

export function InterestsSetup() {
  const online = useOnline();
  const [draft, setDraft] = useState<AffinityDraft>(EMPTY_AFFINITY);
  const [city, setCity] = useState("");
  const [query, setQuery] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [offlineError, setOfflineError] = useState("");
  const [interestGroups, setInterestGroups] = useState(readInterestGroups);
  const [goalOptions, setGoalOptions] = useState(readGoalOptions);
  const [offerOptions, setOfferOptions] = useState(readOfferOptions);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const profile = readProfile();
      setCity(profile?.city ?? "");
      let stored = readAffinity();
      if (remoteIdentityAvailable()) {
        await refreshRemoteCatalogs();
        const remote = await remoteFetchAffinity();
        if (remote) {
          stored = remote;
        }
      }
      if (cancelled) {
        return;
      }
      setInterestGroups(readInterestGroups());
      setGoalOptions(readGoalOptions());
      setOfferOptions(readOfferOptions());
      if (stored) {
        setDraft(stored);
      }
      setReady(true);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const foldedQuery = foldText(query);

  function toggle(list: keyof Pick<AffinityDraft, "interests" | "goals" | "offers" | "availability">, value: string) {
    setDraft((current) => {
      const selected = current[list];
      const next = selected.some((item) => foldText(item) === foldText(value))
        ? selected.filter((item) => foldText(item) !== foldText(value))
        : [...selected, value];
      return { ...current, [list]: next };
    });
    setErrors({});
  }

  function addCustom(list: "interests" | "goals" | "offers") {
    const value = query.trim();
    if (value.length < 2) {
      return;
    }
    setDraft((current) => {
      if (current[list].some((item) => foldText(item) === foldText(value))) {
        return current;
      }
      return { ...current, [list]: [...current[list], value] };
    });
    setQuery("");
  }

  function validate() {
    const next: FieldErrors = {};
    if (draft.interests.length === 0) {
      next.interests = "Elige al menos un interés.";
    }
    if (draft.goals.length === 0) {
      next.goals = "Elige al menos un objetivo.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!online) {
      setOfflineError(offlineWriteMessage());
      return;
    }
    setOfflineError("");
    if (!validate()) {
      return;
    }

    setSaving(true);
    try {
      if (remoteIdentityAvailable()) {
        const reason = await remoteSaveAffinity(draft);
        if (reason) {
          setOfflineError(reason);
          return;
        }
      }
      saveAffinity(draft);
      router.push("/descubrir");
    } finally {
      setSaving(false);
    }
  }

  const catalogInterests = useMemo(
    () => interestGroups.flatMap((group) => group.items),
    [interestGroups],
  );

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
        <JourneySteps current="intereses" />
      </header>

      <form className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.75fr)]" onSubmit={handleSubmit}>
        <div className="rounded-[28px] border border-gold/35 bg-card/95 p-5 shadow-[0_24px_60px_rgba(7,21,31,0.1)] sm:p-7">
          <p className="text-[11px] font-semibold tracking-[0.22em] text-gold uppercase">
            Paso 3
          </p>
          <h1 className="mt-2 font-display text-3xl text-navy sm:text-4xl">
            Intereses y objetivos
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            Cuéntanos qué te mueve, qué buscas y qué puedes aportar. Con eso
            ZUNELA podrá explicar por qué recomienda a alguien.
          </p>

          <label className="mt-6 block" htmlFor="affinity-search">
            <span className="mb-1.5 block text-sm font-medium text-navy">Buscar</span>
            <input
              id="affinity-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ventas, mentoría, senderismo…"
              className="h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink outline-none placeholder:text-muted/70 focus:border-teal focus:shadow-[0_0_0_3px_rgba(10,111,108,0.14)]"
            />
          </label>

          <ChoiceSection
            title="Intereses"
            hint="Puedes elegir varios."
            error={errors.interests}
            selected={draft.interests}
            options={filterOptions(catalogInterests, foldedQuery)}
            groups={interestGroups
              .map((group) => ({
                title: group.title,
                items: filterOptions(group.items, foldedQuery),
              }))
              .filter((group) => group.items.length > 0)}
            query={query}
            onToggle={(value) => toggle("interests", value)}
            onAdd={() => addCustom("interests")}
          />

          <ChoiceSection
            title="Busco"
            hint="El objetivo con el que quieres conectar."
            error={errors.goals}
            selected={draft.goals}
            options={filterOptions(goalOptions, foldedQuery)}
            query={query}
            onToggle={(value) => toggle("goals", value)}
            onAdd={() => addCustom("goals")}
          />

          <ChoiceSection
            title="Ofrezco"
            hint="Habilidades o apoyo que puedes aportar. Es opcional."
            selected={draft.offers}
            options={filterOptions(offerOptions, foldedQuery)}
            query={query}
            onToggle={(value) => toggle("offers", value)}
            onAdd={() => addCustom("offers")}
          />

          <fieldset className="mt-8">
            <legend className="text-sm font-semibold text-navy">Preferencias</legend>
            <p className="mt-1 text-xs leading-5 text-muted">
              Modalidad, alcance y disponibilidad ayudan a filtrar coincidencias.
              {city ? ` Tu ciudad de perfil es ${city}.` : ""}
            </p>

            <p className="mt-4 text-sm font-medium text-navy">Modalidad</p>
            <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Modalidad">
              {MODALITY_OPTIONS.map((option) => (
                <ChoiceChip
                  key={option.value}
                  selected={draft.modality === option.value}
                  onClick={() => {
                    setDraft((current) => ({ ...current, modality: option.value }));
                  }}
                >
                  {option.label}
                </ChoiceChip>
              ))}
            </div>

            <p className="mt-4 text-sm font-medium text-navy">Alcance</p>
            <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Alcance">
              {REACH_OPTIONS.map((option) => (
                <ChoiceChip
                  key={option.value}
                  selected={draft.reach === option.value}
                  onClick={() => {
                    setDraft((current) => ({ ...current, reach: option.value }));
                  }}
                >
                  {option.label}
                </ChoiceChip>
              ))}
            </div>

            <p className="mt-4 text-sm font-medium text-navy">Disponibilidad</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {filterOptions(AVAILABILITY_OPTIONS, "").map((option) => (
                <ChoiceChip
                  key={option}
                  selected={draft.availability.some((item) => foldText(item) === foldText(option))}
                  onClick={() => toggle("availability", option)}
                >
                  {option}
                </ChoiceChip>
              ))}
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={saving || !online}
            className="mt-8 h-12 w-full rounded-xl bg-teal text-sm font-semibold text-white hover:bg-teal-deep disabled:cursor-wait disabled:opacity-70"
          >
            {saving ? "Guardando…" : "Guardar y continuar"}
          </button>
          {offlineError ? <p className="mt-2 text-sm text-danger">{offlineError}</p> : null}
        </div>

        <aside className="rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_24px_60px_rgba(7,21,31,0.1)] lg:sticky lg:top-6">
          <p className="text-[11px] font-semibold tracking-[0.22em] text-gold uppercase">
            Tu afinidad
          </p>
          <h2 className="mt-2 font-display text-2xl text-navy">Lo que elegiste</h2>
          <SummaryList title="Intereses" items={draft.interests} />
          <SummaryList title="Busco" items={draft.goals} />
          <SummaryList title="Ofrezco" items={draft.offers} />
          <dl className="mt-5 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Modalidad</dt>
              <dd className="font-medium text-navy">
                {MODALITY_OPTIONS.find((option) => option.value === draft.modality)?.label}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Alcance</dt>
              <dd className="font-medium text-navy">
                {reachLabel(draft.reach, city)}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Disponibilidad</dt>
              <dd className="mt-1 font-medium text-navy">
                {draft.availability.length > 0 ? draft.availability.join(", ") : "Sin definir"}
              </dd>
            </div>
          </dl>
        </aside>
      </form>
    </div>
  );
}

function ChoiceSection({
  title,
  hint,
  error,
  selected,
  options,
  groups,
  query,
  onToggle,
  onAdd,
}: {
  title: string;
  hint: string;
  error?: string;
  selected: string[];
  options: string[];
  groups?: { title: string; items: string[] }[];
  query: string;
  onToggle: (value: string) => void;
  onAdd: () => void;
}) {
  const folded = foldText(query);
  const canAdd =
    folded.length >= 2 &&
    !selected.some((item) => foldText(item) === folded) &&
    !options.some((item) => foldText(item) === folded);

  const customSelected = selected.filter(
    (item) => !options.includes(item) && !groups?.some((group) => group.items.includes(item)),
  );
  const catalogSelected = selected.filter((item) => !customSelected.includes(item));

  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold text-navy">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-muted">{hint}</p>
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}

      {groups ? (
        <div className="mt-3 space-y-4">
          {catalogSelected.length > 0 || customSelected.length > 0 ? (
            <ChipRow
              items={[...catalogSelected, ...customSelected]}
              selected={selected}
              onToggle={onToggle}
            />
          ) : null}
          {groups.map((group) => {
            const remaining = group.items.filter(
              (item) => !selected.some((picked) => foldText(picked) === foldText(item)),
            );
            if (remaining.length === 0) {
              return null;
            }
            return (
              <div key={group.title}>
                <p className="text-[11px] font-semibold tracking-[0.16em] text-teal uppercase">
                  {group.title}
                </p>
                <ChipRow items={remaining} selected={selected} onToggle={onToggle} />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-3">
          <ChipRow items={[...selected, ...options.filter((item) => !selected.includes(item))]} selected={selected} onToggle={onToggle} />
        </div>
      )}

      {groups && groups.length === 0 && folded ? (
        <p className="mt-3 text-sm text-muted">Ningún interés del catálogo coincide con la búsqueda.</p>
      ) : null}
      {!groups && options.length === 0 && folded ? (
        <p className="mt-3 text-sm text-muted">Nada del catálogo coincide con la búsqueda.</p>
      ) : null}

      {canAdd ? (
        <button
          type="button"
          onClick={onAdd}
          className="mt-3 text-sm font-semibold text-teal hover:text-teal-deep"
        >
          Agregar «{query.trim()}»
        </button>
      ) : null}
    </section>
  );
}

function ChipRow({
  items,
  selected,
  onToggle,
}: {
  items: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {items.map((item) => (
        <ChoiceChip
          key={item}
          selected={selected.some((picked) => foldText(picked) === foldText(item))}
          onClick={() => onToggle(item)}
        >
          {item}
        </ChoiceChip>
      ))}
    </div>
  );
}

function ChoiceChip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
        selected
          ? "border-teal bg-teal text-white"
          : "border-line bg-white text-navy hover:border-teal"
      }`}
    >
      {children}
    </button>
  );
}

function SummaryList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-4">
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">{title}</p>
      {items.length === 0 ? (
        <p className="mt-1 text-sm text-muted">Todavía sin elegir.</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-2">
          {items.map((item) => (
            <li key={item} className="rounded-full bg-cream-deep px-3 py-1 text-xs font-medium text-navy">
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function filterOptions(options: string[], foldedQuery: string) {
  if (!foldedQuery) {
    return options;
  }
  return options.filter((option) => foldText(option).includes(foldedQuery));
}

function reachLabel(reach: Reach, city: string) {
  if (reach === "ciudad") {
    return city ? city : "Mi ciudad";
  }
  return REACH_OPTIONS.find((option) => option.value === reach)?.label ?? reach;
}
