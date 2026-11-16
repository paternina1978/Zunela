"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { DiscoverChrome } from "@/components/discover/DiscoverChrome";
import { offlineWriteMessage, useOnline } from "@/hooks/useOnline";
import { currentPlanLimits, readActivePlan, startPremiumTrial } from "@/lib/account";
import { MODALITY_OPTIONS, readAffinity } from "@/lib/affinity";
import { catalogInterestLabels } from "@/lib/catalog";
import { publishOwnOpportunityAsync, OPPORTUNITY_CATEGORIES } from "@/lib/own-opportunities";
import { COLOMBIA_CITIES, readProfile } from "@/lib/profile";

export function PublishOpportunity() {
  const router = useRouter();
  const online = useOnline();
  const [ready, setReady] = useState(false);
  const [premium, setPremium] = useState(false);
  const [trialDays, setTrialDays] = useState(10);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("Conocimiento");
  const [objective, setObjective] = useState("");
  const [city, setCity] = useState("Medellín");
  const [modality, setModality] = useState("ambas");
  const [spots, setSpots] = useState(8);
  const [interest, setInterest] = useState("Programación");
  const [role, setRole] = useState("");
  const [rule, setRule] = useState("");
  const [organizer, setOrganizer] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const profile = readProfile();
    const affinity = readAffinity();
    setPremium(readActivePlan() === "prueba");
    setTrialDays(currentPlanLimits().trialDays);
    if (profile?.city && COLOMBIA_CITIES.includes(profile.city)) {
      setCity(profile.city);
    }
    if (affinity?.interests[0]) {
      setInterest(affinity.interests[0]);
    }
    const profession =
      profile && profile.visibility.profession === "public" && profile.profession
        ? profile.profession
        : "Profesión reservada";
    setOrganizer(`${profile?.visibleName || "Tu sesión"} · ${profession}`);
    setReady(true);
  }, []);

  function startTrial() {
    if (!online) {
      setError(offlineWriteMessage());
      return;
    }
    startPremiumTrial();
    setPremium(true);
  }

  async function publish() {
    if (!online) {
      setError(offlineWriteMessage());
      return;
    }
    const result = await publishOwnOpportunityAsync({
      title,
      category,
      objective,
      city,
      modality,
      spots,
      interest,
      role,
      rule,
    });
    if (typeof result === "string") {
      setError(result);
      return;
    }
    router.push(`/descubrir/oportunidades/${result.id}`);
  }

  if (!ready) {
    return <div className="h-80" />;
  }

  return (
    <div>
      <DiscoverChrome />

      <div className="mt-8 max-w-2xl">
        <p className="text-[11px] font-semibold tracking-[0.22em] text-gold uppercase">Premium</p>
        <h1 className="mt-2 font-display text-3xl text-navy sm:text-4xl">Publicar oportunidad</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Una oportunidad propia queda en revisión. El correo y el teléfono no se publican.
        </p>
      </div>

      {premium ? (
        <form
          className="mt-8 max-w-2xl rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_18px_40px_rgba(7,21,31,0.08)] sm:p-8"
          onSubmit={(event) => {
            event.preventDefault();
            publish();
          }}
        >
          <Field id="op-title" label="Título">
            <input
              id="op-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={80}
              className={inputClass}
            />
          </Field>
          <Field id="op-category" label="Categoría">
            <select
              id="op-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className={inputClass}
            >
              {OPPORTUNITY_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>
          <Field id="op-objective" label="Objetivo">
            <textarea
              id="op-objective"
              value={objective}
              onChange={(event) => setObjective(event.target.value)}
              maxLength={400}
              rows={4}
              className={`${inputClass} h-auto py-3`}
            />
          </Field>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field id="op-city" label="Ciudad">
              <select
                id="op-city"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                className={inputClass}
              >
                {COLOMBIA_CITIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="op-modality" label="Modalidad">
              <select
                id="op-modality"
                value={modality}
                onChange={(event) => setModality(event.target.value)}
                className={inputClass}
              >
                {MODALITY_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field id="op-spots" label="Cupo">
              <input
                id="op-spots"
                type="number"
                min={2}
                max={30}
                value={spots}
                onChange={(event) => setSpots(event.target.valueAsNumber)}
                className={inputClass}
              />
            </Field>
            <Field id="op-interest" label="Interés">
              <select
                id="op-interest"
                value={interest}
                onChange={(event) => setInterest(event.target.value)}
                className={inputClass}
              >
                {catalogInterestLabels().map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field id="op-role" label="Rol opcional para quien participe">
            <input
              id="op-role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              maxLength={60}
              className={inputClass}
            />
          </Field>
          <Field id="op-rule" label="Una regla de la oportunidad">
            <input
              id="op-rule"
              value={rule}
              onChange={(event) => setRule(event.target.value)}
              maxLength={180}
              className={inputClass}
            />
          </Field>
          <p className="mt-4 text-sm leading-6 text-muted">
            Quien organiza se verá como {organizer}. El correo de la sesión no sale en la ficha.
          </p>
          {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
          <button
            type="submit"
            disabled={!online}
            className="mt-6 h-12 w-full rounded-xl bg-teal text-sm font-semibold text-white hover:bg-teal-deep disabled:opacity-50"
          >
            Enviar a revisión
          </button>
          {!online ? <p className="mt-2 text-sm text-muted">{offlineWriteMessage()}</p> : null}
        </form>
      ) : (
        <section className="mt-8 max-w-2xl rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_18px_40px_rgba(7,21,31,0.08)] sm:p-8">
          <h2 className="font-display text-2xl text-navy">Hace falta la prueba Premium</h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            En Gratis puedes participar en oportunidades del catálogo. Publicar una propia se
            abre con la prueba de {trialDays} días. No hay cobro y, sin suscripción, la cuenta
            vuelve a Gratis.
          </p>
          <button
            type="button"
            onClick={startTrial}
            disabled={!online}
            className="mt-6 h-12 rounded-xl bg-teal px-5 text-sm font-semibold text-white hover:bg-teal-deep disabled:opacity-50"
          >
            Probar Premium {trialDays} días
          </button>
          {!online ? <p className="mt-3 text-sm text-muted">{offlineWriteMessage()}</p> : null}
        </section>
      )}
    </div>
  );
}

const inputClass =
  "mt-1 h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm font-normal text-ink outline-none focus:border-teal";

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <label className="mt-4 block text-sm font-semibold text-navy" htmlFor={id}>
      {label}
      {children}
    </label>
  );
}
