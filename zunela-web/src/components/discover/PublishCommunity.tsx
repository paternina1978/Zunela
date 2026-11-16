"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { DiscoverChrome } from "@/components/discover/DiscoverChrome";
import { offlineWriteMessage, useOnline } from "@/hooks/useOnline";
import { readActivePlan } from "@/lib/account";
import { MODALITY_OPTIONS, readAffinity } from "@/lib/affinity";
import { catalogInterestLabels } from "@/lib/catalog";
import {
  communityQuotaStatus,
  formatQuotaReset,
  publishOwnCommunityAsync,
  refreshRemoteCommunityCache,
  type CommunityInput,
} from "@/lib/own-communities";
import { COLOMBIA_CITIES, readProfile } from "@/lib/profile";

export function PublishCommunity() {
  const router = useRouter();
  const online = useOnline();
  const [ready, setReady] = useState(false);
  const [premium, setPremium] = useState(false);
  const [quota, setQuota] = useState({
    used: 0,
    limit: 2,
    days: 30,
    remaining: 2,
    resetsAt: "",
    full: false,
  });
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [city, setCity] = useState("Medellín");
  const [modality, setModality] = useState("ambas");
  const [interest, setInterest] = useState("Programación");
  const [rule, setRule] = useState("");
  const [access, setAccess] = useState<CommunityInput["access"]>("publica");
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      await refreshRemoteCommunityCache();
      const profile = readProfile();
      const affinity = readAffinity();
      const onTrial = readActivePlan() === "prueba";
      setPremium(onTrial);
      setQuota(communityQuotaStatus());
      setAccess(onTrial ? "privada" : "publica");
      if (profile?.city && COLOMBIA_CITIES.includes(profile.city)) {
        setCity(profile.city);
      }
      if (affinity?.interests[0]) {
        setInterest(affinity.interests[0]);
      }
      setReady(true);
    })();
  }, []);

  async function publish() {
    if (!online) {
      setError(offlineWriteMessage());
      return;
    }
    const result = await publishOwnCommunityAsync({
      title,
      summary,
      city,
      modality,
      interest,
      rule,
      access,
    });
    if (typeof result === "string") {
      setError(result);
      return;
    }
    router.push(`/descubrir/comunidades/${result.id}`);
  }

  if (!ready) {
    return <div className="h-80" />;
  }

  const quotaFull = !premium && access === "publica" && quota.full;

  return (
    <div>
      <DiscoverChrome />

      <div className="mt-8 max-w-2xl">
        <p className="text-[11px] font-semibold tracking-[0.22em] text-gold uppercase">Comunidad</p>
        <h1 className="mt-2 font-display text-3xl text-navy sm:text-4xl">Crear comunidad</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          {premium
            ? "La prueba Premium permite una comunidad privada o por invitación. Esas no aparecen en el listado público."
            : `En Gratis: ${quota.remaining} de ${quota.limit} cupos públicos en ${quota.days} días. Llevas ${quota.used}. El período se renueva el ${formatQuotaReset(quota.resetsAt)}. Privadas y por invitación son Premium.`}
        </p>
        <p className="mt-2 text-sm leading-6 text-muted">
          Una llamada directa a la API no crea la comunidad ni cambia el cupo. Esta prueba no tiene
          sesión en el servidor, así que ese intento se rechaza.
        </p>
      </div>

      <form
        className="mt-8 max-w-2xl rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_18px_40px_rgba(7,21,31,0.08)] sm:p-8"
        onSubmit={(event) => {
          event.preventDefault();
          publish();
        }}
      >
        <fieldset>
          <legend className="text-sm font-semibold text-navy">Acceso</legend>
          <div className="mt-3 space-y-2">
            <AccessOption
              name="Pública"
              detail="Sale en Descubrir y cualquiera puede unirse."
              checked={access === "publica"}
              onChange={() => setAccess("publica")}
            />
            <AccessOption
              name="Privada"
              detail="No sale en Descubrir. El ingreso pide una solicitud."
              checked={access === "privada"}
              disabled={!premium}
              onChange={() => setAccess("privada")}
            />
            <AccessOption
              name="Por invitación"
              detail="No sale en Descubrir. Solo entra quien invitas, sin mostrar su correo."
              checked={access === "invitacion"}
              disabled={!premium}
              onChange={() => setAccess("invitacion")}
            />
          </div>
        </fieldset>
        <Field id="com-title" label="Título">
          <input
            id="com-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={80}
            className={inputClass}
          />
        </Field>
        <Field id="com-summary" label="Descripción">
          <textarea
            id="com-summary"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            maxLength={400}
            rows={4}
            className={`${inputClass} h-auto py-3`}
          />
        </Field>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field id="com-city" label="Ciudad">
            <select
              id="com-city"
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
          <Field id="com-modality" label="Modalidad">
            <select
              id="com-modality"
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
        <Field id="com-interest" label="Interés">
          <select
            id="com-interest"
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
        <Field id="com-rule" label="Una regla">
          <input
            id="com-rule"
            value={rule}
            onChange={(event) => setRule(event.target.value)}
            maxLength={180}
            className={inputClass}
          />
        </Field>
        <p className="mt-4 text-sm leading-6 text-muted">
          Quedas como quien organiza. El correo de la sesión no se publica.
        </p>
        {quotaFull ? (
          <p className="mt-3 text-sm text-danger">
            Llegaste al cupo de {quota.limit} comunidades públicas. Se renueva el{" "}
            {formatQuotaReset(quota.resetsAt)}.
          </p>
        ) : null}
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        <button
          type="submit"
          disabled={quotaFull || !online}
          className="mt-6 h-12 w-full rounded-xl bg-teal text-sm font-semibold text-white hover:bg-teal-deep disabled:opacity-50"
        >
          Crear comunidad
        </button>
        {!online ? <p className="mt-2 text-sm text-muted">{offlineWriteMessage()}</p> : null}
      </form>
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

function AccessOption({
  name,
  detail,
  checked,
  disabled,
  onChange,
}: {
  name: string;
  detail: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${
        checked ? "border-teal bg-cream-deep" : "border-line"
      } ${disabled ? "opacity-50" : ""}`}
    >
      <input
        type="radio"
        name="community-access"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="mt-1"
      />
      <span>
        <span className="block text-sm font-semibold text-navy">{name}</span>
        <span className="mt-1 block text-sm font-normal text-muted">{detail}</span>
      </span>
    </label>
  );
}
