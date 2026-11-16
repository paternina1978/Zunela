"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { loginAccess, readAccess, registerAccess, resetWithRecovery } from "@/lib/access";
import {
  isValidEmail,
  isValidPassword,
  isValidVisibleName,
} from "@/lib/auth-validation";
import {
  remoteCurrentUser,
  remoteIdentityAvailable,
  remoteLogin,
  remoteRegister,
  remoteRequestPasswordReset,
  remoteSignInWithOAuth,
} from "@/lib/remote/identity";
import { saveSession } from "@/lib/session";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { LegalDialog, type LegalTopic } from "@/components/welcome/LegalDialog";
import { TextField } from "@/components/welcome/TextField";
import { offlineWriteMessage, useOnline } from "@/hooks/useOnline";

type AuthMode = "login" | "register" | "recover";
type AuthSuccess = "login" | "register" | "recover" | "confirm-email" | null;

type FieldErrors = {
  visibleName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  recoveryCode?: string;
  consent?: string;
};

const INITIAL_FORM = {
  visibleName: "",
  email: "",
  password: "",
  confirmPassword: "",
  recoveryCode: "",
  consent: false,
};

export function AuthCard() {
  const online = useOnline();
  const [mode, setMode] = useState<AuthMode>("login");
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState<AuthSuccess>(null);
  const [formError, setFormError] = useState("");
  const [legalTopic, setLegalTopic] = useState<LegalTopic | null>(null);
  const router = useRouter();

  const title = useMemo(() => {
    if (mode === "register") return "Crea tu cuenta";
    if (mode === "recover") return "Recupera el acceso";
    return "Ingresa a ZUNELA";
  }, [mode]);

  const remote = remoteIdentityAvailable();

  const subtitle = useMemo(() => {
    if (mode === "register") {
      return remote
        ? "Empieza con un nombre visible. La cuenta queda en el servidor del piloto."
        : "Empieza con un nombre visible. Tu nombre legal y tus contactos quedan protegidos.";
    }
    if (mode === "recover") {
      return remote
        ? "Te enviamos un enlace al correo para elegir una contraseña nueva."
        : "No hay correo. Escribe el código que guardaste en Mi cuenta y elige una contraseña nueva.";
    }
    return remote
      ? "Entra con la cuenta del piloto compartido."
      : "Entra para descubrir personas, oportunidades y comunidades afines.";
  }, [mode, remote]);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function validate() {
    const next: FieldErrors = {};

    if (mode === "register" && !isValidVisibleName(form.visibleName)) {
      next.visibleName = "Escribe un nombre visible de al menos 2 caracteres.";
    }

    if (!isValidEmail(form.email)) {
      next.email = "Ingresa un correo válido.";
    }

    if (mode === "recover" && remote) {
      setErrors(next);
      return Object.keys(next).length === 0;
    }

    if (mode !== "recover" && !isValidPassword(form.password)) {
      next.password = "La contraseña debe tener al menos 8 caracteres.";
    }

    if (mode === "recover") {
      if (!form.recoveryCode.trim()) {
        next.recoveryCode = "Escribe el código de Mi cuenta.";
      }
      if (!isValidPassword(form.password)) {
        next.password = "La contraseña debe tener al menos 8 caracteres.";
      }
    }

    if ((mode === "register" || mode === "recover") && form.password !== form.confirmPassword) {
      next.confirmPassword = "Las contraseñas no coinciden.";
    }

    if (mode === "register" && !form.consent) {
      next.consent = "Necesitas aceptar las políticas para crear la cuenta.";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) {
      return;
    }
    if (!online) {
      setFormError(offlineWriteMessage());
      return;
    }

    setFormError("");
    setIsSubmitting(true);

    if (mode === "register") {
      if (remote) {
        const result = await remoteRegister(form.email, form.password, form.visibleName);
        if (!result.ok) {
          setFormError(result.message);
          setIsSubmitting(false);
          return;
        }
        if (result.pendingEmailConfirm) {
          setIsSubmitting(false);
          setSuccess("confirm-email");
          return;
        }
        saveSession({
          email: form.email.trim().toLowerCase(),
          visibleName: form.visibleName.trim(),
        });
        router.push("/perfil");
        return;
      }
      const reason = await registerAccess(form.email, form.visibleName, form.password);
      if (reason) {
        setFormError(reason);
        setIsSubmitting(false);
        return;
      }
      saveSession({
        email: form.email.trim().toLowerCase(),
        visibleName: form.visibleName.trim(),
      });
      router.push("/perfil");
      return;
    }

    if (mode === "login") {
      if (remote) {
        const reason = await remoteLogin(form.email, form.password);
        if (reason) {
          setFormError(reason);
          setIsSubmitting(false);
          return;
        }
        const user = await remoteCurrentUser();
        saveSession({
          email: user?.email ?? form.email.trim().toLowerCase(),
          visibleName: user?.visibleName ?? "",
        });
        router.push("/perfil");
        return;
      }
      const reason = await loginAccess(form.email, form.password);
      if (reason) {
        setFormError(reason);
        setIsSubmitting(false);
        return;
      }
      const access = readAccess();
      saveSession({
        email: access?.email ?? form.email.trim().toLowerCase(),
        visibleName: access?.visibleName ?? "",
      });
      router.push("/perfil");
      return;
    }

    if (remote) {
      const reason = await remoteRequestPasswordReset(form.email);
      if (reason) {
        setFormError(reason);
        setIsSubmitting(false);
        return;
      }
      setIsSubmitting(false);
      setSuccess("recover");
      return;
    }

    const reason = await resetWithRecovery(form.email, form.recoveryCode, form.password);
    if (reason) {
      setFormError(reason);
      setIsSubmitting(false);
      return;
    }
    const access = readAccess();
    saveSession({
      email: access?.email ?? form.email.trim().toLowerCase(),
      visibleName: access?.visibleName ?? "",
    });
    router.push("/perfil");
  }

  function resetTo(nextMode: AuthMode) {
    setMode(nextMode);
    setSuccess(null);
    setFormError("");
    setErrors({});
    setShowPassword(false);
    if (nextMode === "register") {
      setForm((current) => ({ ...current, consent: false, confirmPassword: "" }));
    }
  }

  async function continueWithGoogle() {
    if (!remote) {
      return;
    }
    if (!online) {
      setFormError(offlineWriteMessage());
      return;
    }
    if (mode === "register" && !form.consent) {
      setErrors({ consent: "Necesitas aceptar las políticas para continuar con Google." });
      return;
    }
    setFormError("");
    setIsSubmitting(true);
    const reason = await remoteSignInWithOAuth("google");
    if (reason) {
      setFormError(reason);
      setIsSubmitting(false);
    }
    // Si OK, el navegador redirige a Google; no resetear submitting.
  }

  return (
    <section className="rise-in order-2 flex items-center px-6 py-4 sm:px-10 lg:order-none lg:py-16">
      <div className="w-full rounded-[28px] border border-gold/35 bg-card/95 p-5 shadow-[0_24px_60px_rgba(7,21,31,0.12)] backdrop-blur-md sm:p-7">
        {success ? (
          <SuccessState
            kind={success}
            visibleName={form.visibleName}
            remote={remote}
            onBack={() => resetTo("login")}
          />
        ) : (
          <>
            <div className="mb-6 flex rounded-full bg-cream-deep p-1">
              <ModeButton
                active={mode === "login"}
                onClick={() => resetTo("login")}
              >
                Ingresar
              </ModeButton>
              <ModeButton
                active={mode === "register"}
                onClick={() => resetTo("register")}
              >
                Crear cuenta
              </ModeButton>
            </div>

            <p className="text-[11px] font-semibold tracking-[0.22em] text-gold uppercase">
              Acceso
            </p>
            <h2 className="mt-2 font-display text-3xl text-navy">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{subtitle}</p>

            {remote && mode === "register" ? (
              <div className="mt-5">
                <label className="flex items-start gap-3 text-sm leading-6 text-muted">
                  <input
                    type="checkbox"
                    checked={form.consent}
                    onChange={(event) => update("consent", event.target.checked)}
                    className="mt-1 size-4 rounded border-line text-teal accent-teal"
                  />
                  <span>
                    Acepto los{" "}
                    <LegalButton onClick={() => setLegalTopic("terminos")}>Términos de uso</LegalButton>{" "}
                    y la{" "}
                    <LegalButton onClick={() => setLegalTopic("privacidad")}>
                      Política de privacidad
                    </LegalButton>
                    . Mis contactos no se mostrarán sin mi permiso.
                  </span>
                </label>
                {errors.consent ? (
                  <p className="mt-1.5 text-xs text-danger">{errors.consent}</p>
                ) : null}
              </div>
            ) : null}

            {remote && (mode === "login" || mode === "register") ? (
              <div className="mt-5 space-y-3">
                <button
                  type="button"
                  onClick={() => void continueWithGoogle()}
                  disabled={isSubmitting || !online}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-line bg-white text-sm font-semibold text-navy transition-colors hover:border-teal hover:text-teal disabled:opacity-50"
                >
                  Continuar con Google
                </button>
                <p className="text-center text-xs leading-5 text-muted">
                  Gmail y cuentas Google. Apple, Microsoft u otros se habilitan en Supabase Auth cuando
                  los configures.
                </p>
                <div className="flex items-center gap-3 text-[11px] font-semibold tracking-[0.18em] text-muted uppercase">
                  <span className="h-px flex-1 bg-line" />
                  o con correo
                  <span className="h-px flex-1 bg-line" />
                </div>
              </div>
            ) : null}

            <form className="mt-5 space-y-3.5" onSubmit={handleSubmit} noValidate>
              {mode === "register" ? (
                <TextField
                  id="visible-name"
                  label="Nombre visible"
                  hint="Así te verán otras personas. No tiene que ser tu nombre legal."
                  autoComplete="nickname"
                  value={form.visibleName}
                  onChange={(value) => update("visibleName", value)}
                  error={errors.visibleName}
                />
              ) : null}

              <TextField
                id="email"
                label="Correo"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={form.email}
                onChange={(value) => update("email", value)}
                error={errors.email}
              />

              {mode === "recover" && !remote ? (
                <TextField
                  id="recovery-code"
                  label="Código de recuperación"
                  autoComplete="off"
                  value={form.recoveryCode}
                  onChange={(value) => update("recoveryCode", value)}
                  error={errors.recoveryCode}
                />
              ) : null}

              {mode === "login" || mode === "register" || (mode === "recover" && !remote) ? (
                <div className="relative">
                  <TextField
                    id="password"
                    label={mode === "recover" ? "Nueva contraseña" : "Contraseña"}
                    type={showPassword ? "text" : "password"}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    value={form.password}
                    onChange={(value) => update("password", value)}
                    error={errors.password}
                    className="pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute top-8 right-2.5 rounded-lg px-2 py-1 text-xs font-medium text-teal hover:text-teal-deep"
                  >
                    {showPassword ? "Ocultar" : "Ver"}
                  </button>
                </div>
              ) : null}

              {mode === "recover" && !remote ? (
                <TextField
                  id="confirm-password"
                  label="Confirmar contraseña"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={(value) => update("confirmPassword", value)}
                  error={errors.confirmPassword}
                />
              ) : null}

              {mode === "register" ? (
                <TextField
                  id="confirm-password"
                  label="Confirmar contraseña"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={(value) => update("confirmPassword", value)}
                  error={errors.confirmPassword}
                />
              ) : null}

              {mode === "register" && !remote ? (
                <div>
                  <label className="flex items-start gap-3 text-sm leading-6 text-muted">
                    <input
                      type="checkbox"
                      checked={form.consent}
                      onChange={(event) => update("consent", event.target.checked)}
                      className="mt-1 size-4 rounded border-line text-teal accent-teal"
                    />
                    <span>
                      Acepto los{" "}
                      <LegalButton onClick={() => setLegalTopic("terminos")}>
                        Términos de uso
                      </LegalButton>{" "}
                      y la{" "}
                      <LegalButton onClick={() => setLegalTopic("privacidad")}>
                        Política de privacidad
                      </LegalButton>
                      . Mis contactos no se mostrarán sin mi permiso.
                    </span>
                  </label>
                  {errors.consent ? (
                    <p className="mt-1.5 text-xs text-danger">{errors.consent}</p>
                  ) : null}
                </div>
              ) : null}

              {formError ? <p className="text-sm text-danger">{formError}</p> : null}
              {!online ? <p className="text-sm leading-6 text-muted">{offlineWriteMessage()}</p> : null}
              {mode === "recover" && !remote ? (
                <p className="text-sm leading-6 text-muted">
                  Una llamada directa a la API tampoco cambia la contraseña.
                </p>
              ) : null}
              <button
                type="submit"
                disabled={isSubmitting || !online}
                className="h-12 w-full rounded-xl bg-teal text-sm font-semibold text-white transition-colors hover:bg-teal-deep disabled:cursor-wait disabled:opacity-70"
              >
                {isSubmitting
                  ? "Un momento…"
                  : mode === "register"
                    ? "Crear cuenta"
                    : mode === "recover"
                      ? remote
                        ? "Enviar enlace"
                        : "Restablecer contraseña"
                      : "Ingresar"}
              </button>
            </form>

            {mode === "login" ? (
              <button
                type="button"
                onClick={() => resetTo("recover")}
                className="mt-4 w-full text-center text-sm font-medium text-teal hover:text-teal-deep"
              >
                ¿Olvidaste tu contraseña?
              </button>
            ) : null}

            {mode === "recover" ? (
              <button
                type="button"
                onClick={() => resetTo("login")}
                className="mt-4 w-full text-center text-sm font-medium text-teal hover:text-teal-deep"
              >
                Volver a ingresar
              </button>
            ) : null}
          </>
        )}
        <div className="mt-4">
          <InstallPrompt />
        </div>
      </div>

      <LegalDialog topic={legalTopic} onClose={() => setLegalTopic(null)} />
    </section>
  );
}

function ModeButton({
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
      onClick={onClick}
      className={`h-10 flex-1 rounded-full text-sm font-semibold transition-colors ${
        active ? "bg-white text-navy shadow-sm" : "text-muted hover:text-navy"
      }`}
    >
      {children}
    </button>
  );
}

function LegalButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
      className="font-semibold text-teal underline decoration-gold/70 underline-offset-2 hover:text-teal-deep"
    >
      {children}
    </button>
  );
}

function SuccessState({
  kind,
  visibleName,
  remote,
  onBack,
}: {
  kind: Exclude<AuthSuccess, null>;
  visibleName: string;
  remote: boolean;
  onBack: () => void;
}) {
  const heading =
    kind === "confirm-email"
      ? "Revisa tu correo"
      : kind === "register"
        ? `Bienvenido${visibleName ? `, ${visibleName}` : ""}`
        : kind === "recover"
          ? remote
            ? "Revisa tu correo"
            : "Contraseña restablecida"
          : "Sesión lista";

  const message =
    kind === "confirm-email"
      ? "Te enviamos un enlace para confirmar el correo. Ábrelo en este mismo dispositivo y luego ingresa. Sin confirmar no hay sesión."
      : kind === "register"
        ? "Tu cuenta quedó preparada. El siguiente paso es configurar tu perfil."
        : kind === "recover"
          ? remote
            ? "Si el correo existe en el piloto, recibirás un enlace para elegir una contraseña nueva."
            : "La contraseña quedó restablecida en este navegador. No se envió ningún correo."
          : "El acceso está listo. Continúa para configurar tu perfil.";

  return (
    <div className="text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-teal/10 text-2xl text-teal">
        ✓
      </div>
      <h2 className="mt-4 font-display text-3xl text-navy">{heading}</h2>
      <p className="mt-3 text-sm leading-6 text-muted">{message}</p>
      <button
        type="button"
        onClick={onBack}
        className="mt-6 h-12 w-full rounded-xl bg-navy text-sm font-semibold text-cream hover:bg-navy-soft"
      >
        Volver al acceso
      </button>
    </div>
  );
}
