"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { JourneySteps } from "@/components/journey/JourneySteps";
import { offlineWriteMessage, useOnline } from "@/hooks/useOnline";
import { readActivePlan } from "@/lib/account";
import { MODALITY_OPTIONS, readAffinity } from "@/lib/affinity";
import { catalogInterestLabels } from "@/lib/catalog";
import {
  clearCopilotDraft,
  EMPTY_COPILOT_DRAFT,
  readCopilotDraft,
  reviewCopilotDraft,
  saveCopilotDraft,
  type CopilotDraft,
} from "@/lib/opportunity-draft";
import { attemptA03 } from "@/lib/ai-structured";
import { OPPORTUNITY_CATEGORIES, publishOwnOpportunityAsync } from "@/lib/own-opportunities";
import { COLOMBIA_CITIES, readProfile } from "@/lib/profile";

export function OpportunityCopilot() {
  const router = useRouter();
  const online = useOnline();
  const [ready, setReady] = useState(false);
  const [premium, setPremium] = useState(false);
  const [draft, setDraft] = useState<CopilotDraft>(EMPTY_COPILOT_DRAFT);
  const [errors, setErrors] = useState<string[]>([]);
  const [reviewed, setReviewed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [structuredNote, setStructuredNote] = useState("");
  const [structuredJson, setStructuredJson] = useState("");

  useEffect(() => {
    const profile = readProfile();
    const affinity = readAffinity();
    const stored = readCopilotDraft();
    setPremium(readActivePlan() === "prueba");
    setDraft({
      ...(stored ?? EMPTY_COPILOT_DRAFT),
      city:
        stored?.city ||
        (profile?.city && COLOMBIA_CITIES.includes(profile.city) ? profile.city : "Medellín"),
      interest: stored?.interest || affinity?.interests[0] || "Programación",
    });
    setReady(true);
  }, []);

  function update(partial: Partial<CopilotDraft>) {
    setDraft((current) => ({ ...current, ...partial }));
    setReviewed(false);
    setConfirmed(false);
    setSaved(false);
  }

  function review() {
    const next = reviewCopilotDraft(draft);
    setErrors(next);
    setReviewed(true);
    setConfirmed(false);
  }

  function previewStructured() {
    const result = attemptA03({
      titulo: draft.title,
      objetivo: draft.objective,
      interes: draft.interest,
      modalidad: draft.modality,
      rol: draft.role,
    });
    setStructuredNote(`${result.acceso.reason} · ${result.nota}`);
    setStructuredJson(JSON.stringify(result.salida, null, 2));
  }

  function keep() {
    if (!online) {
      setErrors([offlineWriteMessage()]);
      setSaved(false);
      return;
    }
    saveCopilotDraft(draft);
    setErrors([]);
    setSaved(true);
  }

  async function publish() {
    if (!online) {
      setErrors([offlineWriteMessage()]);
      return;
    }
    const next = reviewCopilotDraft(draft);
    setErrors(next);
    setReviewed(true);
    if (next.length > 0 || !confirmed) {
      return;
    }
    const result = await publishOwnOpportunityAsync(draft);
    if (typeof result === "string") {
      setErrors([result]);
      return;
    }
    clearCopilotDraft();
    router.push(`/descubrir/oportunidades/${result.id}`);
  }

  if (!ready) {
    return <div className="h-80" />;
  }

  const clean = reviewed && errors.length === 0;

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
        <JourneySteps current="asistente" />
      </header>

      <div className="mt-8 max-w-2xl">
        <p className="text-[11px] font-semibold tracking-[0.22em] text-gold uppercase">Copiloto</p>
        <h1 className="mt-2 font-display text-3xl text-navy sm:text-4xl">Borrador de oportunidad</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          El asistente sigue apagado y no redacta el texto. Tú escribes el borrador, ZUNELA revisa
          las reglas y solo pasa a revisión si lo confirmas.
        </p>
        <Link href="/asistente" className="mt-3 inline-block text-sm font-semibold text-teal hover:text-teal-deep">
          Volver al centro
        </Link>
      </div>

      {premium ? (
        <form
          className="mt-8 max-w-2xl rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_18px_40px_rgba(7,21,31,0.08)] sm:p-8"
          onSubmit={(event) => {
            event.preventDefault();
            publish();
          }}
        >
          <Field id="draft-title" label="Título">
            <input
              id="draft-title"
              value={draft.title}
              onChange={(event) => update({ title: event.target.value })}
              maxLength={80}
              className={inputClass}
            />
          </Field>
          <Field id="draft-category" label="Categoría">
            <select
              id="draft-category"
              value={draft.category}
              onChange={(event) => update({ category: event.target.value })}
              className={inputClass}
            >
              {OPPORTUNITY_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>
          <Field id="draft-objective" label="Objetivo">
            <textarea
              id="draft-objective"
              value={draft.objective}
              onChange={(event) => update({ objective: event.target.value })}
              maxLength={400}
              rows={4}
              className={`${inputClass} h-auto py-3`}
            />
          </Field>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field id="draft-city" label="Ciudad">
              <select
                id="draft-city"
                value={draft.city}
                onChange={(event) => update({ city: event.target.value })}
                className={inputClass}
              >
                {COLOMBIA_CITIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="draft-modality" label="Modalidad">
              <select
                id="draft-modality"
                value={draft.modality}
                onChange={(event) => update({ modality: event.target.value })}
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
            <Field id="draft-spots" label="Cupo">
              <input
                id="draft-spots"
                type="number"
                min={2}
                max={30}
                value={draft.spots}
                onChange={(event) => update({ spots: event.target.valueAsNumber })}
                className={inputClass}
              />
            </Field>
            <Field id="draft-interest" label="Interés">
              <select
                id="draft-interest"
                value={draft.interest}
                onChange={(event) => update({ interest: event.target.value })}
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
          <Field id="draft-role" label="Rol opcional">
            <input
              id="draft-role"
              value={draft.role}
              onChange={(event) => update({ role: event.target.value })}
              maxLength={60}
              className={inputClass}
            />
          </Field>
          <Field id="draft-rule" label="Una regla">
            <input
              id="draft-rule"
              value={draft.rule}
              onChange={(event) => update({ rule: event.target.value })}
              maxLength={180}
              className={inputClass}
            />
          </Field>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={review}
              className="h-11 rounded-xl bg-navy px-4 text-sm font-semibold text-cream"
            >
              Revisar reglas
            </button>
            <button
              type="button"
              onClick={keep}
              disabled={!online}
              className="h-11 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-navy disabled:opacity-50"
            >
              Guardar borrador
            </button>
            <button
              type="button"
              onClick={previewStructured}
              className="h-11 rounded-xl border border-teal bg-white px-4 text-sm font-semibold text-teal"
            >
              Ver JSON A03
            </button>
          </div>
          {saved ? <p className="mt-3 text-sm text-teal">Borrador guardado en este navegador.</p> : null}
          {structuredNote ? <p className="mt-3 text-sm leading-6 text-muted">{structuredNote}</p> : null}
          {structuredJson ? (
            <pre className="mt-3 overflow-x-auto rounded-2xl bg-cream-deep px-4 py-3 text-xs leading-5 text-navy">
              {structuredJson}
            </pre>
          ) : null}
          {reviewed && errors.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {errors.map((error) => (
                <li key={error} className="rounded-2xl bg-cream-deep px-4 py-3 text-sm text-danger">
                  {error}
                </li>
              ))}
            </ul>
          ) : null}
          {clean ? (
            <label className="mt-4 flex items-start gap-3 text-sm leading-6 text-navy">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                className="mt-1"
              />
              <span>Confirmo el envío a revisión. No se publica solo y no hay cobro.</span>
            </label>
          ) : null}
          <button
            type="submit"
            disabled={!online || !clean || !confirmed}
            className="mt-6 h-12 w-full rounded-xl bg-teal text-sm font-semibold text-white hover:bg-teal-deep disabled:opacity-50"
          >
            Enviar a revisión
          </button>
          {!online ? <p className="mt-2 text-sm text-muted">{offlineWriteMessage()}</p> : null}
        </form>
      ) : (
        <section className="mt-8 max-w-2xl rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_18px_40px_rgba(7,21,31,0.08)]">
          <h2 className="font-display text-2xl text-navy">Hace falta la prueba Premium</h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            Publicar una oportunidad propia es Premium. El copiloto tampoco redacta mientras el
            asistente esté apagado.
          </p>
          <Link
            href="/cuenta"
            className="mt-6 inline-flex h-12 items-center rounded-xl bg-teal px-5 text-sm font-semibold text-white hover:bg-teal-deep"
          >
            Ver la prueba en Mi cuenta
          </Link>
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
