"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { JourneySteps } from "@/components/journey/JourneySteps";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { offlineWriteMessage, useHashScroll, useOnline } from "@/hooks/useOnline";
import {
  DEFAULT_ACCOUNT,
  currentPlanLimits,
  endPremiumTrial,
  isTrialActive,
  membershipRows,
  readAccount,
  saveAccount,
  startPremiumTrial,
  syncExpiredTrial,
  trialElapsedDay,
  type AccountSettings,
} from "@/lib/account";
import { isValidPassword } from "@/lib/auth-validation";
import {
  readProfile,
  saveProfile,
  type FieldVisibility,
  type ProfileDraft,
} from "@/lib/profile";
import { issueRecoveryCode, readAccess, savePasswordHash } from "@/lib/access";
import { recordAudit } from "@/lib/admin";
import { buildAccountCopy, eraseSessionAccount, noteAccountCopy, type AccountCopy } from "@/lib/account-data";
import { findCatalogEntry } from "@/lib/discover";
import {
  buildLocalBackup,
  noteLocalBackup,
  restoreLocalBackup,
  type LocalBackup,
} from "@/lib/local-backup";
import { readMatchBook } from "@/lib/matches";
import {
  clearNoticesAsync,
  hiddenNoticeCount,
  markNoticesSeenAsync,
  noticeKindLabel,
  readVisibleNotices,
  recordNotice,
  refreshRemoteNotices,
  unreadVisibleCount,
  type Notice,
} from "@/lib/notices";
import { recordProductEvent } from "@/lib/product-events";
import {
  bootstrapFirstAdminAsync,
  canAccessAdminPanel,
  checkRemoteAdminExists,
  readRole,
  refreshRemoteRole,
  roleLabel,
  setRole,
  type AppRole,
} from "@/lib/roles";
import {
  deleteRemoteAccount,
  exportRemoteAccountCopy,
} from "@/lib/remote/account-lifecycle";
import { remoteIdentityAvailable, remoteSignOut } from "@/lib/remote/identity";
import { clearSession, readSession, saveSession } from "@/lib/session";

export function AccountBoard() {
  const router = useRouter();
  const online = useOnline();
  const [ready, setReady] = useState(false);
  useHashScroll(ready);
  const [email, setEmail] = useState("");
  const [account, setAccount] = useState<AccountSettings>(DEFAULT_ACCOUNT);
  const [profile, setProfile] = useState<ProfileDraft | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [copy, setCopy] = useState<AccountCopy | null>(null);
  const [backup, setBackup] = useState<LocalBackup | null>(null);
  const [backupMessage, setBackupMessage] = useState("");
  const [backupError, setBackupError] = useState("");
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [confirmErase, setConfirmErase] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoveryError, setRecoveryError] = useState("");
  const [notices, setNotices] = useState<Notice[]>([]);
  const [hiddenNotices, setHiddenNotices] = useState(0);
  const [unreadNotices, setUnreadNotices] = useState(0);
  const [role, setRoleState] = useState<AppRole>("usuario");
  const [remoteRoles, setRemoteRoles] = useState(false);
  const [canBootstrapAdmin, setCanBootstrapAdmin] = useState(false);
  const [bootstrapError, setBootstrapError] = useState("");
  const [adminConfirm, setAdminConfirm] = useState(false);
  const [offlineHint, setOfflineHint] = useState("");

  async function loadNotices() {
    await refreshRemoteNotices();
    for (const personId of readMatchBook().incoming) {
      const name = findCatalogEntry(personId)?.title;
      if (name) {
        recordNotice("match", `${name} te envió interés.`, `match-in-${personId}`);
      }
    }
    await refreshRemoteNotices();
    const visible = readVisibleNotices();
    setNotices(visible);
    setHiddenNotices(hiddenNoticeCount());
    setUnreadNotices(unreadVisibleCount());
  }

  useEffect(() => {
    void (async () => {
      const remote = remoteIdentityAvailable();
      setRemoteRoles(remote);
      if (remote) {
        await refreshRemoteRole();
        const current = readRole();
        setCanBootstrapAdmin(current === "usuario" && !(await checkRemoteAdminExists()));
      } else {
        setCanBootstrapAdmin(false);
      }
      const session = readSession();
      setEmail(session?.email ?? "");
      setAccount(syncExpiredTrial().account);
      setProfile(readProfile());
      setRoleState(readRole());
      await loadNotices();
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    function onRole() {
      setRoleState(readRole());
    }
    window.addEventListener("zunela-role", onRole);
    return () => window.removeEventListener("zunela-role", onRole);
  }, []);

  useEffect(() => {
    function onNotices() {
      void loadNotices();
    }
    window.addEventListener("zunela-notices", onNotices);
    window.addEventListener("focus", onNotices);
    return () => {
      window.removeEventListener("zunela-notices", onNotices);
      window.removeEventListener("focus", onNotices);
    };
  }, []);

  function guardWrite() {
    if (online) {
      setOfflineHint("");
      return true;
    }
    setOfflineHint(offlineWriteMessage());
    return false;
  }

  function chooseRole(next: AppRole) {
    if (!guardWrite()) {
      return;
    }
    if (remoteRoles) {
      return;
    }
    if (next !== "usuario" && !adminConfirm && role === "usuario") {
      return;
    }
    setRole(next);
    setRoleState(next);
    setAdminConfirm(false);
  }

  function updateAccount(next: AccountSettings) {
    if (!guardWrite()) {
      return;
    }
    saveAccount(next);
    setAccount(next);
    loadNotices();
  }

  function setVisibility(field: keyof ProfileDraft["visibility"], value: FieldVisibility) {
    if (!profile) {
      return;
    }
    if (!guardWrite()) {
      return;
    }
    const next = {
      ...profile,
      visibility: { ...profile.visibility, [field]: value },
    };
    saveProfile(next);
    setProfile(next);
  }

  async function savePassword() {
    if (!guardWrite()) {
      return;
    }
    if (!isValidPassword(password)) {
      setPasswordError("Usa al menos 8 caracteres.");
      setPasswordMessage("");
      return;
    }
    if (password !== confirm) {
      setPasswordError("Las dos contraseñas deben coincidir.");
      setPasswordMessage("");
      return;
    }
    const session = readSession();
    const access = readAccess();
    const reason = await savePasswordHash(
      access?.email || session?.email || "",
      access?.visibleName || session?.visibleName || profile?.visibleName || "",
      password,
    );
    if (reason) {
      setPasswordError(reason);
      setPasswordMessage("");
      return;
    }
    setPassword("");
    setConfirm("");
    setPasswordError("");
    setPasswordMessage("La contraseña quedó en este navegador. No se envía a un servidor.");
  }

  async function signOut() {
    await remoteSignOut();
    clearSession();
    router.push("/");
  }

  async function prepareCopy() {
    setBackupError("");
    let next: AccountCopy | string;
    if (remoteIdentityAvailable()) {
      next = await exportRemoteAccountCopy();
      if (typeof next === "string") {
        setBackupError(next);
        setCopy(null);
        return;
      }
    } else {
      next = await buildAccountCopy();
    }
    noteAccountCopy();
    setCopy(next);
    const blob = new Blob([JSON.stringify(next, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "zunela-copia.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function prepareBackup() {
    const next = await buildLocalBackup();
    if (typeof next === "string") {
      setBackupError(next);
      setBackupMessage("");
      setBackup(null);
      return;
    }
    noteLocalBackup();
    setBackup(next);
    setBackupError("");
    setBackupMessage("Respaldo listo. Guárdalo en un lugar privado: incluye la huella de tu acceso.");
    const blob = new Blob([JSON.stringify(next, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "zunela-respaldo-v2.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function onRestoreFile(file: File | null) {
    if (!file) {
      return;
    }
    if (!confirmRestore) {
      setBackupError("Confirma que quieres reemplazar los datos locales antes de restaurar.");
      return;
    }
    const text = await file.text();
    const reason = await restoreLocalBackup(text);
    if (reason) {
      setBackupError(reason);
      setBackupMessage("");
      return;
    }
    const access = readAccess();
    if (access?.email) {
      saveSession({ email: access.email, visibleName: access.visibleName || "" });
    }
    setAccount(syncExpiredTrial().account);
    setProfile(readProfile());
    setRoleState(readRole());
    loadNotices();
    setBackupError("");
    setBackupMessage("Respaldo restaurado en este navegador. Recargando…");
    setConfirmRestore(false);
    router.refresh();
    window.setTimeout(() => {
      window.location.reload();
    }, 400);
  }

  async function createRecoveryCode() {
    const code = await issueRecoveryCode();
    if (!code) {
      setRecoveryCode("");
      setRecoveryError("Primero guarda una contraseña en esta pantalla.");
      return;
    }
    setRecoveryError("");
    setRecoveryCode(code);
  }

  async function eraseAccount() {
    if (!confirmErase) {
      return;
    }
    setBackupError("");
    if (remoteIdentityAvailable()) {
      if (!online) {
        setBackupError(offlineWriteMessage());
        return;
      }
      const remoteError = await deleteRemoteAccount();
      if (remoteError) {
        setBackupError(remoteError);
        return;
      }
    }
    eraseSessionAccount();
    router.push("/");
  }

  if (!ready) {
    return <div className="h-80" />;
  }

  const limits = currentPlanLimits();
  const onTrial = isTrialActive(account.trialStartedAt, limits.trialDays) && account.plan === "prueba";
  const trialEnded = Boolean(account.trialEndedAt) && account.plan === "gratis" && !onTrial;
  const rows = membershipRows(
    limits.dailyMessages,
    limits.premiumDailyMessages,
    limits.communityQuota,
    limits.communityQuotaDays,
  );

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
        <JourneySteps current="cuenta" />
      </header>

      <div className="mt-8">
        <p className="text-[11px] font-semibold tracking-[0.22em] text-gold uppercase">Tu acceso</p>
        <h1 className="mt-2 font-display text-3xl text-navy sm:text-4xl">Mi cuenta</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Notificaciones, privacidad, seguridad y membresía. El correo solo lo ves tú. Esta prueba
          es una PWA: puedes instalarla desde el navegador sin pagar.
        </p>
        {!online || offlineHint ? (
          <p className="mt-3 text-sm leading-6 text-muted">{offlineHint || offlineWriteMessage()}</p>
        ) : null}
        <InstallPrompt />
      </div>

      {account.paused ? (
        <div className="mt-6 rounded-2xl border border-gold/40 bg-card px-4 py-4">
          <p className="text-sm font-semibold text-navy">La cuenta está en pausa</p>
          <p className="mt-1 text-sm leading-6 text-muted">
            La pausa queda en este navegador. Los datos se conservan y puedes reactivar la cuenta.
          </p>
          <button
            type="button"
            onClick={() => {
              recordProductEvent("Reactivó la cuenta.");
              recordAudit("Reactivó la cuenta en este navegador.");
              updateAccount({ ...account, paused: false });
            }}
            className="mt-3 h-11 rounded-xl bg-teal px-4 text-sm font-semibold text-white hover:bg-teal-deep"
          >
            Reactivar
          </button>
        </div>
      ) : null}

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-2">
        <section
          id="avisos"
          className="scroll-mt-6 rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_18px_40px_rgba(7,21,31,0.08)]"
        >
          <h2 className="font-display text-2xl text-navy">Notificaciones</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Un aviso dice que hubo actividad. No incluye correo, teléfono ni el texto del mensaje.
            Si apagas un tipo, esos avisos se guardan pero no se muestran aquí.
          </p>
          <div className="mt-4 space-y-2">
            <Toggle
              label="Solicitudes y conexiones"
              checked={account.notifications.matches}
              onChange={(matches) =>
                updateAccount({ ...account, notifications: { ...account.notifications, matches } })
              }
            />
            <Toggle
              label="Mensajes de una conexión"
              checked={account.notifications.messages}
              onChange={(messages) =>
                updateAccount({ ...account, notifications: { ...account.notifications, messages } })
              }
            />
            <Toggle
              label="Comunidades a las que entraste"
              checked={account.notifications.communities}
              onChange={(communities) =>
                updateAccount({
                  ...account,
                  notifications: { ...account.notifications, communities },
                })
              }
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                void (async () => {
                  await markNoticesSeenAsync();
                  await loadNotices();
                })();
              }}
              disabled={unreadNotices === 0}
              className="h-10 rounded-xl border border-line bg-white px-3 text-xs font-semibold text-navy disabled:opacity-50"
            >
              Marcar visibles como leídos
            </button>
            <button
              type="button"
              onClick={() => {
                void (async () => {
                  await clearNoticesAsync();
                  await loadNotices();
                })();
              }}
              className="h-10 rounded-xl border border-line bg-white px-3 text-xs font-semibold text-navy"
            >
              Vaciar avisos
            </button>
          </div>
          {hiddenNotices > 0 ? (
            <p className="mt-3 text-xs leading-5 text-muted">
              {hiddenNotices === 1
                ? "1 aviso queda oculto por tus preferencias."
                : `${hiddenNotices} avisos quedan ocultos por tus preferencias.`}
            </p>
          ) : null}
          {notices.length === 0 ? (
            <p className="mt-4 text-sm leading-6 text-muted">
              Todavía no hay avisos de los tipos activos.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {notices.map((notice) => (
                <li
                  key={notice.id}
                  className={`rounded-2xl px-4 py-3 text-sm text-navy ${
                    notice.seen ? "bg-cream-deep" : "border border-teal/40 bg-white"
                  }`}
                >
                  <span className="text-muted">
                    {formatWhen(notice.at)} · {noticeKindLabel(notice.kind)}
                    {notice.seen ? "" : " · nuevo"} ·{" "}
                  </span>
                  {notice.text}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          id="visibilidad"
          className="scroll-mt-6 rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_18px_40px_rgba(7,21,31,0.08)]"
        >
          <h2 className="font-display text-2xl text-navy">Privacidad</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            El nombre público sigue visible. El resto depende de estos controles.
          </p>
          <Link
            href="/perfil#visibilidad"
            className="mt-2 inline-block text-sm font-semibold text-teal hover:text-teal-deep"
          >
            Editar perfil
          </Link>
          {profile ? (
            <div className="mt-4 space-y-2">
              <VisibilityRow
                label="Foto"
                value={profile.visibility.photo}
                onChange={(value) => setVisibility("photo", value)}
              />
              <VisibilityRow
                label="Profesión"
                value={profile.visibility.profession}
                onChange={(value) => setVisibility("profession", value)}
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
          ) : (
            <p className="mt-4 text-sm text-muted">Todavía no hay un perfil guardado.</p>
          )}
          <p className="mt-4 rounded-2xl bg-cream-deep px-4 py-3 text-sm leading-6 text-navy">
            Correo: solo en tu cuenta. No sale en el perfil, en una conexión ni en una notificación.
          </p>
        </section>

        <section className="rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_18px_40px_rgba(7,21,31,0.08)]">
          <h2 className="font-display text-2xl text-navy">Seguridad</h2>
          <p className="mt-2 text-sm text-muted">
            Acceso: <span className="font-semibold text-navy">{email || "Sin sesión"}</span>
          </p>
          <div className="mt-4 space-y-3">
            <label className="block text-sm font-semibold text-navy" htmlFor="new-password">
              Nueva contraseña
            </label>
            <input
              id="new-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              className="h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm outline-none focus:border-teal"
            />
            <label className="block text-sm font-semibold text-navy" htmlFor="confirm-password">
              Confirmar contraseña
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              autoComplete="new-password"
              className="h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm outline-none focus:border-teal"
            />
            {passwordError ? <p className="text-sm text-danger">{passwordError}</p> : null}
            {passwordMessage ? <p className="text-sm text-teal-deep">{passwordMessage}</p> : null}
            <button
              type="button"
              onClick={savePassword}
              disabled={!online}
              className="h-11 rounded-xl bg-navy px-4 text-sm font-semibold text-cream disabled:opacity-50"
            >
              Actualizar contraseña
            </button>
          </div>
          <div className="mt-6 border-t border-line pt-5">
            <p className="text-sm leading-6 text-muted">
              El código de recuperación se muestra una sola vez. No hay correo: sin ese código no se
              puede restablecer la contraseña.
            </p>
            <button
              type="button"
              onClick={createRecoveryCode}
              className="mt-3 h-11 rounded-xl border border-teal bg-white px-4 text-sm font-semibold text-teal"
            >
              Crear código de recuperación
            </button>
            {recoveryError ? <p className="mt-3 text-sm text-danger">{recoveryError}</p> : null}
            {recoveryCode ? (
              <p className="mt-3 rounded-2xl bg-cream-deep px-4 py-3 text-sm leading-6 text-navy">
                Código: <span className="font-mono text-base font-semibold">{recoveryCode}</span>
                <span className="mt-1 block text-muted">
                  Guárdalo ahora. Si creas otro, este deja de servir.
                </span>
              </p>
            ) : null}
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={signOut}
              className="h-11 rounded-xl border border-teal bg-white px-4 text-sm font-semibold text-teal"
            >
              Cerrar sesión
            </button>
            <button
              type="button"
              onClick={() => {
                recordProductEvent("Pausó la cuenta.");
                recordAudit("Pausó la cuenta en este navegador.");
                updateAccount({ ...account, paused: true });
              }}
              disabled={account.paused}
              className="h-11 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-navy disabled:opacity-50"
            >
              Desactivar cuenta
            </button>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted">
            Cerrar sesión solo cierra el acceso activo. El correo, la contraseña, el rol y el perfil
            quedan guardados en este navegador. La pausa bloquea descubrir, mensajes y publicaciones
            sin borrar esos datos.
          </p>
        </section>

        <section className="rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_18px_40px_rgba(7,21,31,0.08)]">
          <h2 className="font-display text-2xl text-navy">Rol</h2>
          <p className="mt-2 text-sm font-semibold text-teal">{roleLabel(role)}</p>
          <p className="mt-2 text-sm leading-6 text-muted">
            {remoteRoles
              ? "Con Supabase el rol vive en memberships. No hay auto-elevación: el primer administrador se crea una sola vez (bootstrap); después solo un admin asigna roles. El moderador revisa reportes y publicaciones; el administrador también gestiona parámetros, catálogos e IA."
              : "Al crear la cuenta eres usuario. El moderador revisa reportes, apelaciones y publicaciones. El administrador además cambia parámetros, catálogos y controles de IA. El rol queda guardado al cerrar sesión; solo se borra si vuelves a usuario o eliminas la cuenta."}
          </p>
          {!remoteRoles && role === "usuario" ? (
            <label className="mt-4 flex items-start gap-3 text-sm leading-6 text-navy">
              <input
                type="checkbox"
                checked={adminConfirm}
                onChange={(event) => setAdminConfirm(event.target.checked)}
                className="mt-1"
              />
              Confirmo activar un rol elevado solo en este navegador. No sustituye el RBAC del
              producto final.
            </label>
          ) : null}
          {bootstrapError ? (
            <p className="mt-3 text-sm leading-6 text-coral">{bootstrapError}</p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {!remoteRoles ? (
              <>
                <button
                  type="button"
                  onClick={() => chooseRole("moderador")}
                  disabled={role === "usuario" && !adminConfirm}
                  className="h-11 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-navy disabled:opacity-50"
                >
                  {role === "moderador" ? "Moderador activo" : "Activar moderador"}
                </button>
                <button
                  type="button"
                  onClick={() => chooseRole("administrador")}
                  disabled={role === "usuario" && !adminConfirm}
                  className="h-11 rounded-xl bg-navy px-4 text-sm font-semibold text-cream disabled:opacity-50"
                >
                  {role === "administrador" ? "Administrador activo" : "Activar administrador"}
                </button>
                {role !== "usuario" ? (
                  <button
                    type="button"
                    onClick={() => chooseRole("usuario")}
                    className="h-11 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-navy"
                  >
                    Volver a usuario
                  </button>
                ) : null}
              </>
            ) : null}
            {remoteRoles && canBootstrapAdmin ? (
              <button
                type="button"
                onClick={() => {
                  if (!guardWrite()) {
                    return;
                  }
                  void (async () => {
                    const reason = await bootstrapFirstAdminAsync();
                    if (reason) {
                      setBootstrapError(reason);
                      setCanBootstrapAdmin(!(await checkRemoteAdminExists()));
                      return;
                    }
                    setBootstrapError("");
                    setCanBootstrapAdmin(false);
                    setRoleState(readRole());
                  })();
                }}
                className="h-11 rounded-xl bg-navy px-4 text-sm font-semibold text-cream"
              >
                Soy el primer administrador
              </button>
            ) : null}
            {canAccessAdminPanel() ? (
              <Link
                href="/admin"
                className="inline-flex h-11 items-center rounded-xl bg-teal px-4 text-sm font-semibold text-white hover:bg-teal-deep"
              >
                Ir a administración
              </Link>
            ) : null}
          </div>
        </section>

        <section className="rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_18px_40px_rgba(7,21,31,0.08)]">
          <h2 className="font-display text-2xl text-navy">Membresía</h2>
          <p className="mt-2 text-sm font-semibold text-teal">
            {onTrial
              ? `Prueba Premium · día ${trialElapsedDay(account.trialStartedAt)} de ${limits.trialDays}`
              : trialEnded
                ? "La prueba terminó · Plan Gratis"
                : "Plan Gratis"}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted">
            La prueba dura {limits.trialDays} días y no hace un cobro. Al terminar, sin suscripción,
            la cuenta vuelve sola a Gratis (RB-12): límites, publicaciones Premium y contacto
            externo se cierran.
          </p>
          {trialEnded ? (
            <p className="mt-3 rounded-2xl border border-gold/40 bg-cream-deep px-4 py-3 text-sm leading-6 text-navy">
              Tu última prueba ya venció. Sigues en Gratis. Puedes iniciar otra prueba de{" "}
              {limits.trialDays} días cuando quieras; no hay cargo automático.
            </p>
          ) : null}
          <ul className="mt-4 space-y-2">
            {rows.map(([label, free, premium]) => (
              <li key={label} className="rounded-2xl bg-cream-deep px-4 py-3 text-sm">
                <p className="font-semibold text-navy">{label}</p>
                <p className="mt-1 text-muted">
                  Gratis: {free} · Premium: {premium}
                </p>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              if (!guardWrite()) {
                return;
              }
              if (onTrial) {
                setAccount(endPremiumTrial(true));
                loadNotices();
                return;
              }
              setAccount(startPremiumTrial());
              loadNotices();
            }}
            disabled={!online}
            className="mt-4 h-11 rounded-xl bg-teal px-4 text-sm font-semibold text-white hover:bg-teal-deep disabled:opacity-50"
          >
            {onTrial ? "Volver a Gratis" : trialEnded ? "Iniciar otra prueba" : `Probar Premium ${limits.trialDays} días`}
          </button>
        </section>

        <section
          id="respaldo"
          className="scroll-mt-6 rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_18px_40px_rgba(7,21,31,0.08)] lg:col-span-2"
        >
          <h2 className="font-display text-2xl text-navy">Tus datos</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            {remoteIdentityAvailable()
              ? "La copia resumida sale del servidor (perfil, afinidad y conteos; sin mensajes). El respaldo v2 sigue siendo solo de este navegador. Eliminar cuenta borra tu usuario remoto y limpia este dispositivo. El único administrador no puede borrarse a sí mismo."
              : "La copia resumida sirve para revisar qué hay en el piloto. El respaldo v2 restaura el estado local (acceso, perfil, conexiones, preferencias) con huella verificable. No incluye cuerpos de chat. Descargar, restaurar y borrar funcionan sin red: son solo de este navegador."}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={prepareCopy}
              className="h-11 rounded-xl border border-teal bg-white px-4 text-sm font-semibold text-teal"
            >
              Descargar copia
            </button>
            <button
              type="button"
              onClick={prepareBackup}
              className="h-11 rounded-xl bg-teal px-4 text-sm font-semibold text-white hover:bg-teal-deep"
            >
              Descargar respaldo
            </button>
          </div>
          {copy ? (
            <div className="mt-4 rounded-2xl bg-cream-deep px-4 py-3 text-sm leading-6 text-navy">
              <p>
                Plan {copy.plan === "prueba" ? "de prueba" : "Gratis"} · {copy.intereses.length}{" "}
                intereses · {copy.conexiones} conexiones · {copy.oportunidades.length} oportunidades ·{" "}
                {copy.comunidades.length} comunidades
              </p>
              <p className="mt-1">{copy.nota}</p>
              <p className="mt-1 font-mono text-xs break-all">Huella {copy.huella}</p>
            </div>
          ) : null}
          {backup ? (
            <div className="mt-4 rounded-2xl bg-cream-deep px-4 py-3 text-sm leading-6 text-navy">
              <p>
                Respaldo v{backup.version} · {Object.keys(backup.keys).length} claves ·{" "}
                {new Date(backup.generado).toLocaleString("es-CO")}
              </p>
              <p className="mt-1">{backup.nota}</p>
              <p className="mt-1 font-mono text-xs break-all">Huella {backup.huella}</p>
            </div>
          ) : null}
          {backupMessage ? <p className="mt-3 text-sm leading-6 text-teal-deep">{backupMessage}</p> : null}
          {backupError ? <p className="mt-3 text-sm text-danger">{backupError}</p> : null}

          <label className="mt-6 flex items-start gap-3 text-sm leading-6 text-navy">
            <input
              type="checkbox"
              checked={confirmRestore}
              onChange={(event) => setConfirmRestore(event.target.checked)}
              className="mt-1 size-4 accent-teal"
            />
            Confirmo que restaurar reemplazará los datos locales actuales por el archivo elegido.
          </label>
          <label className="mt-3 inline-flex h-11 cursor-pointer items-center rounded-xl border border-line bg-white px-4 text-sm font-semibold text-navy">
            Restaurar respaldo
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                void onRestoreFile(file);
                event.target.value = "";
              }}
            />
          </label>

          <label className="mt-6 flex items-start gap-3 text-sm leading-6 text-navy">
            <input
              type="checkbox"
              checked={confirmErase}
              onChange={(event) => setConfirmErase(event.target.checked)}
              className="mt-1 size-4 accent-teal"
            />
            Confirmo que quiero borrar el acceso, el rol, el perfil, los intereses, las conexiones, los
            mensajes y las publicaciones de esta prueba.
          </label>
          <button
            type="button"
            onClick={() => void eraseAccount()}
            disabled={!confirmErase || (remoteIdentityAvailable() && !online)}
            className="mt-3 h-11 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-navy disabled:opacity-50"
          >
            Eliminar cuenta
          </button>
        </section>
      </div>
    </div>
  );
}

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Ahora";
  }
  return date.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-2xl border border-line bg-white px-4 py-3 text-left"
    >
      <span className="text-sm font-medium text-navy">{label}</span>
      <span className={`text-xs font-semibold tracking-wide uppercase ${checked ? "text-teal" : "text-muted"}`}>
        {checked ? "Activa" : "Pausada"}
      </span>
    </button>
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
        <Choice active={value === "public"} onClick={() => onChange("public")}>
          En el perfil
        </Choice>
        <Choice active={value === "after-match"} onClick={() => onChange("after-match")}>
          Tras la conexión
        </Choice>
      </div>
    </div>
  );
}

function Choice({
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
      className={`h-8 rounded-full px-3 text-xs font-semibold ${
        active ? "bg-navy text-cream" : "text-muted"
      }`}
    >
      {children}
    </button>
  );
}
