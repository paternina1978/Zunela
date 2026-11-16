import { initialsFromName, type ProfileDraft } from "@/lib/profile";

type ProfilePreviewProps = {
  profile: ProfileDraft;
};

export function ProfilePreview({ profile }: ProfilePreviewProps) {
  const name = profile.visibleName.trim() || "Tu nombre";
  const showPhoto = Boolean(profile.photoDataUrl) && profile.visibility.photo === "public";
  const showCountry =
    profile.visibility.country === "public" && profile.country.trim().length > 0;
  const showCity = profile.visibility.city === "public" && profile.city.trim().length > 0;
  const showProfession =
    profile.visibility.profession === "public" && profile.profession.trim().length > 0;
  const showKnowledge =
    profile.visibility.knowledge === "public" && profile.knowledge.length > 0;
  const showPresentation =
    profile.visibility.presentation === "public" &&
    profile.presentation.trim().length > 0;

  const place = [showCity ? profile.city.trim() : null, showCountry ? profile.country.trim() : null]
    .filter(Boolean)
    .join(", ");

  const hidden = [
    profile.photoDataUrl && profile.visibility.photo === "after-match" ? "foto" : null,
    profile.visibility.profession === "after-match" ? "profesión" : null,
    profile.visibility.country === "after-match" ? "país" : null,
    profile.visibility.city === "after-match" ? "ciudad" : null,
    profile.knowledge.length > 0 && profile.visibility.knowledge === "after-match"
      ? "conocimientos"
      : null,
    profile.presentation.trim() && profile.visibility.presentation === "after-match"
      ? "presentación"
      : null,
  ].filter(Boolean);

  return (
    <aside className="rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_24px_60px_rgba(7,21,31,0.1)]">
      <p className="text-[11px] font-semibold tracking-[0.22em] text-gold uppercase">
        Antes de la conexión
      </p>
      <h2 className="mt-2 font-display text-2xl text-navy">Así te verán</h2>
      <p className="mt-1 text-sm leading-6 text-muted">
        Esta tarjeta usa solo lo que marcaste como visible. El correo y el nombre legal nunca
        aparecen.
      </p>

      <div className="mt-6 rounded-3xl border border-line bg-white p-5">
        <div className="flex items-center gap-4">
          {showPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.photoDataUrl ?? ""}
              alt=""
              className="size-16 rounded-full object-cover"
            />
          ) : (
            <div className="flex size-16 items-center justify-center rounded-full bg-teal text-lg font-semibold text-cream">
              {initialsFromName(profile.visibleName)}
            </div>
          )}
          <div>
            <p className="font-display text-2xl text-navy">{name}</p>
            <p className="text-sm text-muted">
              {showProfession ? profile.profession.trim() : "Profesión reservada"}
              {place ? ` · ${place}` : ""}
            </p>
          </div>
        </div>

        {showKnowledge ? (
          <ul className="mt-4 flex flex-wrap gap-2">
            {profile.knowledge.map((item) => (
              <li
                key={item}
                className="rounded-full bg-cream-deep px-3 py-1 text-xs font-semibold text-navy"
              >
                {item}
              </li>
            ))}
          </ul>
        ) : profile.knowledge.length > 0 && profile.visibility.knowledge === "after-match" ? (
          <p className="mt-4 text-sm leading-6 text-muted">
            Los conocimientos quedan ocultos hasta que haya una conexión.
          </p>
        ) : null}

        {showPresentation ? (
          <p className="mt-4 text-sm leading-6 text-ink">{profile.presentation.trim()}</p>
        ) : (
          <p className="mt-4 text-sm leading-6 text-muted">
            {profile.visibility.presentation === "after-match"
              ? "La presentación queda oculta hasta que haya una conexión."
              : "Si escribes una presentación, aparecerá aquí."}
          </p>
        )}
      </div>

      {hidden.length > 0 ? (
        <p className="mt-4 text-xs leading-5 text-muted">
          Visible solo después de la conexión: {hidden.join(", ")}.
        </p>
      ) : null}
    </aside>
  );
}
