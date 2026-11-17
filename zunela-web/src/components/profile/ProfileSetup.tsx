"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useId, useState } from "react";
import { JourneySteps } from "@/components/journey/JourneySteps";
import { TextField } from "@/components/welcome/TextField";
import { offlineWriteMessage, useHashScroll, useOnline } from "@/hooks/useOnline";
import { isValidVisibleName } from "@/lib/auth-validation";
import { foldText } from "@/lib/affinity";
import {
  COUNTRY_OPTIONS,
  EMPTY_PROFILE,
  KNOWLEDGE_SUGGESTIONS,
  initialsFromName,
  readProfile,
  rememberCustomCity,
  rememberCustomProfession,
  saveProfile,
  type FieldVisibility,
  type ProfileDraft,
} from "@/lib/profile";
import {
  remoteFetchProfile,
  remoteIdentityAvailable,
  remoteSaveProfile,
} from "@/lib/remote/identity";
import { readSession } from "@/lib/session";
import { CityPicker } from "@/components/profile/CityPicker";
import { ProfessionPicker } from "@/components/profile/ProfessionPicker";
import { ProfilePreview } from "@/components/profile/ProfilePreview";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_PRESENTATION = 280;

type FieldErrors = {
  visibleName?: string;
  country?: string;
  city?: string;
  profession?: string;
  photo?: string;
};

export function ProfileSetup() {
  const online = useOnline();
  const [profile, setProfile] = useState<ProfileDraft>(EMPTY_PROFILE);
  const [email, setEmail] = useState("");
  const [knowledgeDraft, setKnowledgeDraft] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [offlineError, setOfflineError] = useState("");
  const photoInputId = useId();
  const router = useRouter();
  useHashScroll(ready);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const session = readSession();
      setEmail(session?.email ?? "");
      const local = readProfile();
      let stored = local;
      if (remoteIdentityAvailable()) {
        const remote = await remoteFetchProfile();
        if (remote) {
          stored = remote;
        }
      }
      if (cancelled) {
        return;
      }
      setProfile({
        ...EMPTY_PROFILE,
        ...stored,
        visibleName: stored?.visibleName || session?.visibleName || "",
        country: stored?.country || "Colombia",
        knowledge: stored?.knowledge ?? [],
        visibility: {
          ...EMPTY_PROFILE.visibility,
          ...stored?.visibility,
        },
      });
      setReady(true);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  function update(partial: Partial<ProfileDraft>) {
    setProfile((current) => ({ ...current, ...partial }));
    setErrors({});
  }

  function setVisibility(field: keyof ProfileDraft["visibility"], value: FieldVisibility) {
    setProfile((current) => ({
      ...current,
      visibility: { ...current.visibility, [field]: value },
    }));
  }

  function toggleKnowledge(value: string) {
    setProfile((current) => {
      const exists = current.knowledge.some((item) => foldText(item) === foldText(value));
      const knowledge = exists
        ? current.knowledge.filter((item) => foldText(item) !== foldText(value))
        : [...current.knowledge, value.trim()];
      return { ...current, knowledge };
    });
  }

  function addCustomKnowledge() {
    const value = knowledgeDraft.trim();
    if (value.length < 2) {
      return;
    }
    toggleKnowledge(value);
    setKnowledgeDraft("");
  }

  function onPhoto(file: File | undefined) {
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      setErrors({ photo: "Elige una imagen JPG, PNG o WebP." });
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setErrors({ photo: "La foto debe pesar menos de 5 MB." });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      update({ photoDataUrl: String(reader.result) });
    };
    reader.readAsDataURL(file);
  }

  function validate() {
    const next: FieldErrors = {};
    if (!isValidVisibleName(profile.visibleName)) {
      next.visibleName = "Escribe un nombre visible de al menos 2 caracteres.";
    }
    if (!profile.country.trim()) {
      next.country = "Indica el país.";
    }
    if (profile.city.trim().length < 2) {
      next.city = "Indica tu ciudad.";
    }
    if (profile.profession.trim().length < 2) {
      next.profession = "Indica tu profesión o actividad.";
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

    const nextProfile: ProfileDraft = {
      ...profile,
      visibleName: profile.visibleName.trim(),
      legalName: profile.legalName.trim(),
      country: profile.country.trim() || "Colombia",
      city: profile.city.trim(),
      profession: profile.profession.trim(),
      knowledge: profile.knowledge.map((item) => item.trim()).filter(Boolean),
      presentation: profile.presentation.trim().slice(0, MAX_PRESENTATION),
    };
    if (nextProfile.profession.length >= 2) {
      rememberCustomProfession(nextProfile.profession);
    }
    if (nextProfile.city.length >= 2) {
      rememberCustomCity(nextProfile.city);
    }

    setSaving(true);
    try {
      if (remoteIdentityAvailable()) {
        const reason = await remoteSaveProfile(nextProfile);
        if (reason) {
          setOfflineError(reason);
          return;
        }
      }
      saveProfile(nextProfile);
      router.push("/intereses");
    } catch {
      setErrors({ photo: "No hubo espacio para guardar la foto en este navegador." });
    } finally {
      setSaving(false);
    }
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
        <JourneySteps current="perfil" />
      </header>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.85fr)]">
        <form
          className="rounded-[28px] border border-gold/35 bg-card/95 p-5 shadow-[0_24px_60px_rgba(7,21,31,0.1)] sm:p-7"
          onSubmit={handleSubmit}
          noValidate
        >
          <p className="text-[11px] font-semibold tracking-[0.22em] text-gold uppercase">
            Paso 2
          </p>
          <h1 className="mt-2 font-display text-3xl text-navy sm:text-4xl">
            Configura tu perfil
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            Nombre visible, país, ciudad, profesión y conocimientos. Tú decides qué se ve
            antes de una conexión. El nombre legal y el correo quedan ocultos.
          </p>

          {email ? (
            <p className="mt-4 rounded-2xl bg-cream-deep px-4 py-3 text-sm text-navy">
              Correo de acceso: <span className="font-semibold">{email}</span>
              <span className="mt-1 block text-xs text-muted">
                Otras personas no ven este dato.
              </span>
            </p>
          ) : (
            <p className="mt-4 rounded-2xl bg-cream-deep px-4 py-3 text-sm text-muted">
              Puedes llegar aquí después de ingresar o crear tu cuenta.
            </p>
          )}

          <div className="mt-6 flex items-center gap-4">
            {profile.photoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.photoDataUrl}
                alt="Tu foto"
                className="size-20 rounded-full object-cover"
              />
            ) : (
              <div className="flex size-20 items-center justify-center rounded-full bg-teal text-xl font-semibold text-cream">
                {initialsFromName(profile.visibleName)}
              </div>
            )}
            <div>
              <input
                id={photoInputId}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => onPhoto(event.target.files?.[0])}
              />
              <label
                htmlFor={photoInputId}
                className="inline-flex h-10 cursor-pointer items-center rounded-xl bg-navy px-4 text-sm font-semibold text-cream hover:bg-navy-soft"
              >
                {profile.photoDataUrl ? "Cambiar foto" : "Subir foto"}
              </label>
              {profile.photoDataUrl ? (
                <button
                  type="button"
                  onClick={() => update({ photoDataUrl: null })}
                  className="ml-3 text-sm font-medium text-teal hover:text-teal-deep"
                >
                  Quitar
                </button>
              ) : null}
              <p className="mt-2 text-xs text-muted">Opcional. JPG, PNG o WebP, hasta 5 MB.</p>
              {errors.photo ? <p className="mt-1 text-xs text-danger">{errors.photo}</p> : null}
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <TextField
              id="profile-name"
              label="Nombre visible"
              hint="Siempre se muestra. No tiene que ser tu nombre legal."
              autoComplete="nickname"
              value={profile.visibleName}
              onChange={(value) => update({ visibleName: value })}
              error={errors.visibleName}
            />

            <TextField
              id="profile-legal-name"
              label="Nombre legal"
              hint="Opcional y protegido. No se muestra en el perfil público ni en Descubrir."
              autoComplete="name"
              value={profile.legalName}
              onChange={(value) => update({ legalName: value })}
            />

            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy" htmlFor="profile-country">
                País
              </label>
              <select
                id="profile-country"
                value={profile.country}
                onChange={(event) => update({ country: event.target.value })}
                className="h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink outline-none focus:border-teal focus:shadow-[0_0_0_3px_rgba(10,111,108,0.14)]"
              >
                {COUNTRY_OPTIONS.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </select>
              {errors.country ? <p className="mt-1 text-xs text-danger">{errors.country}</p> : null}
            </div>

            <CityPicker
              id="profile-city"
              value={profile.city}
              onChange={(value) => update({ city: value })}
              error={errors.city}
            />

            <ProfessionPicker
              id="profile-profession"
              value={profile.profession}
              onChange={(value) => update({ profession: value })}
              error={errors.profession}
            />

            <div>
              <p className="mb-1.5 text-sm font-medium text-navy">Conocimientos</p>
              <p className="mb-2 text-xs leading-5 text-muted">
                Distintos de «ofrezco» en intereses: aquí anotas saberes o herramientas.
              </p>
              <div className="flex flex-wrap gap-2">
                {KNOWLEDGE_SUGGESTIONS.map((item) => {
                  const active = profile.knowledge.some(
                    (entry) => foldText(entry) === foldText(item),
                  );
                  return (
                    <button
                      key={item}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleKnowledge(item)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                        active ? "bg-navy text-cream" : "bg-cream-deep text-navy hover:text-teal"
                      }`}
                    >
                      {item}
                    </button>
                  );
                })}
                {profile.knowledge
                  .filter(
                    (item) =>
                      !KNOWLEDGE_SUGGESTIONS.some(
                        (suggestion) => foldText(suggestion) === foldText(item),
                      ),
                  )
                  .map((item) => (
                    <button
                      key={item}
                      type="button"
                      aria-pressed
                      onClick={() => toggleKnowledge(item)}
                      className="rounded-full bg-navy px-3 py-1.5 text-xs font-semibold text-cream"
                    >
                      {item}
                    </button>
                  ))}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  value={knowledgeDraft}
                  onChange={(event) => setKnowledgeDraft(event.target.value)}
                  placeholder="Agregar otro conocimiento"
                  className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none focus:border-teal"
                />
                <button
                  type="button"
                  onClick={addCustomKnowledge}
                  className="h-10 rounded-xl border border-line px-3 text-sm font-semibold text-navy"
                >
                  Agregar
                </button>
              </div>
            </div>

            <label className="block" htmlFor="profile-presentation">
              <span className="mb-1.5 block text-sm font-medium text-navy">
                Presentación
              </span>
              <textarea
                id="profile-presentation"
                value={profile.presentation}
                maxLength={MAX_PRESENTATION}
                rows={4}
                onChange={(event) => update({ presentation: event.target.value })}
                placeholder="Qué buscas o qué puedes aportar, en pocas líneas."
                className="w-full resize-none rounded-xl border border-line bg-white px-3.5 py-3 text-sm leading-6 text-ink outline-none placeholder:text-muted/70 focus:border-teal focus:shadow-[0_0_0_3px_rgba(10,111,108,0.14)]"
              />
              <span className="mt-1.5 block text-xs text-muted">
                Opcional. {profile.presentation.length}/{MAX_PRESENTATION}
              </span>
            </label>
          </div>

          <fieldset id="visibilidad" className="mt-6 scroll-mt-6">
            <legend className="text-sm font-semibold text-navy">Privacidad</legend>
            <p className="mt-1 text-xs leading-5 text-muted">
              El nombre visible queda público. El nombre legal nunca se muestra. El resto puedes
              mostrarlo en el perfil o reservarlo para después de la conexión.
            </p>
            <div className="mt-3 space-y-3">
              <VisibilityRow
                label="Foto"
                value={profile.visibility.photo}
                onChange={(value) => setVisibility("photo", value)}
              />
              <VisibilityRow
                label="País"
                value={profile.visibility.country}
                onChange={(value) => setVisibility("country", value)}
              />
              <VisibilityRow
                label="Ciudad"
                value={profile.visibility.city}
                onChange={(value) => setVisibility("city", value)}
              />
              <VisibilityRow
                label="Profesión"
                value={profile.visibility.profession}
                onChange={(value) => setVisibility("profession", value)}
              />
              <VisibilityRow
                label="Conocimientos"
                value={profile.visibility.knowledge}
                onChange={(value) => setVisibility("knowledge", value)}
              />
              <VisibilityRow
                label="Presentación"
                value={profile.visibility.presentation}
                onChange={(value) => setVisibility("presentation", value)}
              />
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={saving || !online}
            className="mt-6 h-12 w-full rounded-xl bg-teal text-sm font-semibold text-white hover:bg-teal-deep disabled:cursor-wait disabled:opacity-70"
          >
            {saving ? "Guardando…" : "Guardar y continuar"}
          </button>
          {offlineError ? <p className="mt-2 text-sm text-danger">{offlineError}</p> : null}
        </form>

        <div className="lg:sticky lg:top-6">
          <ProfilePreview profile={profile} />
        </div>
      </div>
    </div>
  );
}

function VisibilityRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: FieldVisibility;
  onChange: (value: FieldVisibility) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-line bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm font-medium text-navy">{label}</span>
      <div className="flex rounded-full bg-cream-deep p-1" role="group" aria-label={label}>
        <VisibilityButton
          active={value === "public"}
          onClick={() => onChange("public")}
        >
          En el perfil
        </VisibilityButton>
        <VisibilityButton
          active={value === "after-match"}
          onClick={() => onChange("after-match")}
        >
          Tras la conexión
        </VisibilityButton>
      </div>
    </div>
  );
}

function VisibilityButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`h-8 rounded-full px-3 text-xs font-semibold transition-colors ${
        active ? "bg-white text-navy shadow-sm" : "text-muted hover:text-navy"
      }`}
    >
      {children}
    </button>
  );
}
