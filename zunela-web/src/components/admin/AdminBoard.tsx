"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { JourneySteps } from "@/components/journey/JourneySteps";
import { offlineWriteMessage, useHashScroll, useOnline } from "@/hooks/useOnline";
import { readActivePlan } from "@/lib/account";
import { readAccess } from "@/lib/access";
import { backendModeLabel } from "@/lib/backend-mode";
import {
  readAdminParams,
  readAudit,
  readParamVersions,
  readReviewedReports,
  readSuspendedIds,
  refreshRemoteAdminParams,
  refreshRemoteAudit,
  refreshRemoteSuspendedIds,
  saveAdminParamsAsync,
  setUserSuspendedAsync,
  type AdminParams,
  type AuditEntry,
  type ParamVersion,
} from "@/lib/admin";
import {
  appealKindLabel,
  readAppeals,
  refreshRemoteAppealState,
  reviewAppealAsync,
  type Appeal,
} from "@/lib/appeals";
import { checklistStatusLabel, readPilotChecklist, type PilotChecklistItem } from "@/lib/pilot-checklist";
import { readPilotMetrics, type PilotMetric } from "@/lib/pilot-metrics";
import { readPilotPresence, refreshRemotePilotPresence } from "@/lib/pilot-presence";
import {
  readProductEvents,
  refreshRemoteProductEvents,
  type ProductEvent,
} from "@/lib/product-events";
import {
  addCatalogItemAsync,
  catalogInterestLabels,
  deactivateCatalogItemAsync,
  readGoalOptions,
  readInterestGroups,
  readOfferOptions,
  refreshRemoteCatalogs,
  resetCatalogsAsync,
  type CatalogKind,
} from "@/lib/catalog";
import { CATALOG } from "@/lib/discover";
import {
  approveOwnOpportunityAsync,
  listCachedRemoteOpportunities,
  readOwnOpportunities,
  refreshRemoteOpportunityCache,
  type OwnOpportunity,
} from "@/lib/own-opportunities";
import {
  admitCommunityRequestAsync,
  approveOwnCommunityAsync,
  listCachedRemoteCommunities,
  readOwnCommunities,
  refreshRemoteCommunityCache,
  type OwnCommunity,
} from "@/lib/own-communities";
import { readProfile } from "@/lib/profile";
import {
  pendingReportEntries,
  refreshRemoteReportState,
  reportAttentionStats,
  reportDetail,
  reportLabel,
  reviewReportAsync,
  saveReviewMeta,
} from "@/lib/reports";
import { remoteReviewedKeys } from "@/lib/remote/moderation";
import {
  assignRoleAsync,
  canManageAiControls,
  canManageCatalogs,
  canManageParams,
  canManageUsers,
  refreshRemoteRole,
  roleLabel,
  type AppRole,
} from "@/lib/roles";
import {
  listCachedRemotePeople,
  listRemotePeople,
  peekRemotePerson,
  remoteAuthUserId,
} from "@/lib/remote/catalog";
import { remoteIdentityAvailable } from "@/lib/remote/identity";
import { listRemoteMemberships } from "@/lib/remote/roles";
import { readSession } from "@/lib/session";

type AdminUser = {
  id: string;
  name: string;
  detail: string;
  suspended: boolean;
  current: boolean;
};

type MembershipRow = {
  userId: string;
  role: AppRole;
  name: string;
};

type AdminReport = {
  key: string;
  label: string;
  detail: string;
  openedAt: string;
};

export function AdminBoard() {
  const online = useOnline();
  const [ready, setReady] = useState(false);
  useHashScroll(ready);
  const [offlineHint, setOfflineHint] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [params, setParams] = useState<AdminParams>(readAdminParamsSafe());
  const [versions, setVersions] = useState<ParamVersion[]>([]);
  const [draft, setDraft] = useState<AdminParams>(readAdminParamsSafe());
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [events, setEvents] = useState<ProductEvent[]>([]);
  const [metrics, setMetrics] = useState<PilotMetric[]>([]);
  const [checklist, setChecklist] = useState<PilotChecklistItem[]>([]);
  const [reportSla, setReportSla] = useState({ open: 0, reviewed: 0, averageMinutes: null as number | null });
  const [ownOpportunities, setOwnOpportunities] = useState<OwnOpportunity[]>([]);
  const [ownCommunities, setOwnCommunities] = useState<OwnCommunity[]>([]);
  const [paramError, setParamError] = useState("");
  const [catalogTick, setCatalogTick] = useState(0);
  const [catalogDraft, setCatalogDraft] = useState("");
  const [catalogKind, setCatalogKind] = useState<CatalogKind>("interests");
  const [catalogGroup, setCatalogGroup] = useState("Negocios");
  const [catalogError, setCatalogError] = useState("");
  const [manageUsers, setManageUsers] = useState(false);
  const [manageCatalogs, setManageCatalogs] = useState(false);
  const [manageParams, setManageParams] = useState(false);
  const [manageAi, setManageAi] = useState(false);
  const [activeRole, setActiveRole] = useState(roleLabel());
  const [lastVisit, setLastVisit] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [roleError, setRoleError] = useState("");

  async function reload() {
    await refreshRemoteRole();
    await refreshRemoteAdminParams();
    await refreshRemoteProductEvents();
    await refreshRemoteAudit();
    await refreshRemoteSuspendedIds();
    await refreshRemoteCatalogs();
    await refreshRemotePilotPresence();
    await refreshRemoteOpportunityCache();
    await refreshRemoteCommunityCache();
    await refreshRemoteReportState();
    await refreshRemoteAppealState();
    const suspended = new Set(readSuspendedIds());
    const reviewed = new Set([...readReviewedReports(), ...remoteReviewedKeys()]);
    const session = readSession();
    const access = readAccess();
    const profile = readProfile();
    let people: AdminUser[] = CATALOG.filter((entry) => entry.kind === "persona").map((person) => ({
      id: person.id,
      name: person.title,
      detail: `${person.subtitle} · ${person.city}`,
      suspended: suspended.has(person.id),
      current: false,
    }));
    if (remoteIdentityAvailable()) {
      const me = await remoteAuthUserId();
      const remotePeople = await listRemotePeople(me, { includeSuspended: true });
      people = remotePeople.map((person) => ({
        id: person.id,
        name: person.title,
        detail: `${person.subtitle} · ${person.city}`,
        suspended: suspended.has(person.id),
        current: false,
      }));
    }
    const sessionUser: AdminUser = {
      id: "session",
      name: profile?.visibleName || session?.visibleName || access?.visibleName || "Sesión actual",
      detail: `${session?.email || access?.email || "Sin correo"} · ${readActivePlan() === "prueba" ? "Prueba Premium" : "Plan Gratis"}`,
      suspended: false,
      current: true,
    };
    setUsers([sessionUser, ...people]);
    setReports(pendingReports(reviewed));
    setAppeals(readAppeals().filter((item) => item.status === "pendiente"));
    const stored = readAdminParams();
    setParams(stored);
    setVersions(readParamVersions());
    setDraft(stored);
    setAudit(readAudit());
    setEvents(readProductEvents());
    setMetrics(readPilotMetrics());
    setChecklist(readPilotChecklist());
    setReportSla(reportAttentionStats());
    const remotePending = listCachedRemoteOpportunities().filter((item) => item.status === "revision");
    const localOwn = readOwnOpportunities();
    const byId = new Map<string, OwnOpportunity>();
    for (const item of [...localOwn, ...remotePending]) {
      byId.set(item.id, item);
    }
    setOwnOpportunities([...byId.values()]);
    const remotePendingCommunities = listCachedRemoteCommunities().filter(
      (item) => item.status === "revision",
    );
    const communityById = new Map<string, OwnCommunity>();
    for (const item of [...readOwnCommunities(), ...remotePendingCommunities]) {
      communityById.set(item.id, item);
    }
    setOwnCommunities([...communityById.values()]);
    setManageUsers(canManageUsers());
    setManageCatalogs(canManageCatalogs());
    setManageParams(canManageParams());
    setManageAi(canManageAiControls());
    setActiveRole(roleLabel());
    setLastVisit(readPilotPresence()?.lastSeenAt ?? null);
    if (remoteIdentityAvailable() && canManageUsers()) {
      const rows = await listRemoteMemberships();
      setMemberships(
        rows.map((row) => ({
          userId: row.userId,
          role: row.role,
          name:
            peekRemotePerson(row.userId)?.title ??
            listCachedRemotePeople().find((person) => person.id === row.userId)?.title ??
            row.userId.slice(0, 8),
        })),
      );
    } else {
      setMemberships([]);
    }
    setRoleError("");
    setReady(true);
  }

  useEffect(() => {
    void reload();
  }, []);

  function guardWrite() {
    if (online) {
      setOfflineHint("");
      return true;
    }
    setOfflineHint(offlineWriteMessage());
    return false;
  }

  async function toggleUser(user: AdminUser) {
    if (!guardWrite() || user.current) {
      return;
    }
    const reason = await setUserSuspendedAsync(user.id, user.name, !user.suspended);
    if (reason) {
      setRoleError(reason);
      return;
    }
    setRoleError("");
    await reload();
  }

  async function markReviewed(report: AdminReport) {
    if (!guardWrite()) {
      return;
    }
    await reviewReportAsync(report.key, report.label);
    saveReviewMeta(report.key, report.label);
    await reload();
  }

  async function markAppeal(id: string) {
    if (!guardWrite()) {
      return;
    }
    await reviewAppealAsync(id);
    await reload();
  }

  async function approve(id: string) {
    if (!guardWrite()) {
      return;
    }
    await approveOwnOpportunityAsync(id);
    await reload();
  }

  async function approveCommunity(id: string) {
    if (!guardWrite()) {
      return;
    }
    await approveOwnCommunityAsync(id);
    await reload();
  }

  async function admit(id: string) {
    if (!guardWrite()) {
      return;
    }
    await admitCommunityRequestAsync(id);
    await reload();
  }

  function admitLabel(count: number) {
    return count === 1 ? "Admitir 1" : `Admitir (${count})`;
  }

  async function saveParams() {
    if (!guardWrite()) {
      return;
    }
    if (
      !Number.isFinite(draft.dailyMessages) ||
      !Number.isFinite(draft.premiumDailyMessages) ||
      !Number.isFinite(draft.communityQuota) ||
      !Number.isFinite(draft.communityQuotaDays) ||
      !Number.isFinite(draft.matchExpiryDays) ||
      !Number.isFinite(draft.trialDays) ||
      !Number.isFinite(draft.reportAlert) ||
      !Number.isFinite(draft.affinityThreshold)
    ) {
      setParamError("Usa números enteros.");
      return;
    }
    const saved = await saveAdminParamsAsync({ ...draft, attachments: "ninguno" });
    if (typeof saved === "string") {
      setParamError(saved);
      return;
    }
    setParamError("");
    await reload();
  }

  function copyVersion(version: ParamVersion) {
    setDraft({
      dailyMessages: version.dailyMessages,
      premiumDailyMessages: version.premiumDailyMessages,
      communityQuota: version.communityQuota,
      communityQuotaDays: version.communityQuotaDays,
      matchExpiryDays: version.matchExpiryDays,
      trialDays: version.trialDays,
      attachments: "ninguno",
      reportAlert: version.reportAlert,
      affinityThreshold: version.affinityThreshold,
    });
    setParamError("");
  }

  if (!ready) {
    return <div className="h-80" />;
  }

  const interestGroups = readInterestGroups();
  const interests = catalogInterestLabels();
  const goals = readGoalOptions();
  const offers = readOfferOptions();
  const opportunities = CATALOG.filter((entry) => entry.kind === "oportunidad");
  const communities = CATALOG.filter((entry) => entry.kind === "comunidad");
  void catalogTick;

  async function submitCatalogItem() {
    if (!guardWrite()) {
      return;
    }
    const reason = await addCatalogItemAsync(catalogKind, catalogDraft, catalogGroup);
    if (reason) {
      setCatalogError(reason);
      return;
    }
    setCatalogDraft("");
    setCatalogError("");
    setCatalogTick((value) => value + 1);
    await reload();
  }

  async function removeCatalogItem(kind: CatalogKind, label: string) {
    if (!guardWrite()) {
      return;
    }
    const reason = await deactivateCatalogItemAsync(kind, label);
    if (reason) {
      setCatalogError(reason);
      return;
    }
    setCatalogError("");
    setCatalogTick((value) => value + 1);
    await reload();
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
        <JourneySteps current="admin" />
      </header>

      <div className="mt-8">
        <p className="text-[11px] font-semibold tracking-[0.22em] text-gold uppercase">Panel</p>
        <h1 className="mt-2 font-display text-3xl text-navy sm:text-4xl">Administración</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Rol actual: {activeRole}. El moderador revisa reportes, apelaciones y publicaciones. El
          administrador también gestiona usuarios, catálogos, parámetros e IA. Cada cambio queda en
          este navegador y en la bitácora.
        </p>
        {lastVisit ? (
          <p className="mt-2 text-sm text-muted">
            Última visita en este navegador:{" "}
            {new Date(lastVisit).toLocaleString("es-CO", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
            .
          </p>
        ) : null}
        {!online || offlineHint ? (
          <p className="mt-2 text-sm leading-6 text-muted">{offlineHint || offlineWriteMessage()}</p>
        ) : null}
        {manageAi ? (
          <div className="mt-3 flex flex-wrap gap-4">
            <Link href="/admin/agentes" className="text-sm font-semibold text-teal hover:text-teal-deep">
              Panel de agentes
            </Link>
            <Link href="/admin/ia" className="text-sm font-semibold text-teal hover:text-teal-deep">
              Control de IA
            </Link>
          </div>
        ) : null}
      </div>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-2">
        <section className="rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_18px_40px_rgba(7,21,31,0.08)]">
          <h2 className="font-display text-2xl text-navy">Usuarios</h2>
          {!manageUsers ? (
            <p className="mt-3 text-sm leading-6 text-muted">
              Solo lectura para moderación. Suspender o reactivar requiere administrador.
            </p>
          ) : null}
          <ul className="mt-4 space-y-2">
            {users.map((user) => (
              <li
                key={user.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-line px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-navy">{user.name}</p>
                  <p className="text-sm text-muted">{user.detail}</p>
                </div>
                {user.current ? (
                  <span className="text-xs font-semibold tracking-wide text-teal uppercase">Sesión</span>
                ) : manageUsers ? (
                  <button
                    type="button"
                    onClick={() => toggleUser(user)}
                    className="h-9 rounded-full border border-line px-3 text-xs font-semibold text-navy"
                  >
                    {user.suspended ? "Reactivar" : "Suspender"}
                  </button>
                ) : (
                  <span className="text-xs font-semibold text-muted">
                    {user.suspended ? "Suspendido" : "Activo"}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {manageUsers && memberships.length > 0 ? (
            <div className="mt-6 border-t border-line pt-4">
              <h3 className="text-sm font-semibold text-navy">Roles remotos (memberships)</h3>
              <p className="mt-1 text-xs leading-5 text-muted">
                Primer admin:{" "}
                <code className="rounded bg-cream-deep px-1">
                  UPDATE memberships SET role = &apos;administrador&apos; WHERE user_id = …
                </code>
              </p>
              {roleError ? <p className="mt-2 text-sm text-danger">{roleError}</p> : null}
              <ul className="mt-3 space-y-2">
                {memberships.map((row) => (
                  <li
                    key={row.userId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-navy">{row.name}</p>
                      <p className="text-xs text-muted">{row.userId}</p>
                    </div>
                    <select
                      value={row.role}
                      onChange={(event) => {
                        void (async () => {
                          if (!guardWrite()) {
                            return;
                          }
                          const next = event.target.value as AppRole;
                          const reason = await assignRoleAsync(row.userId, next);
                          if (reason) {
                            setRoleError(reason);
                            return;
                          }
                          await reload();
                        })();
                      }}
                      className="h-9 rounded-full border border-line bg-white px-3 text-xs font-semibold text-navy"
                    >
                      <option value="usuario">Usuario</option>
                      <option value="moderador">Moderador</option>
                      <option value="administrador">Administrador</option>
                    </select>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section className="rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_18px_40px_rgba(7,21,31,0.08)]">
          <h2 className="font-display text-2xl text-navy">Catálogos</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            {manageCatalogs
              ? "Intereses, objetivos y habilidades son administrables en este navegador (RB-01). Lo que desactives deja de aparecer al elegir afinidad o publicar."
              : "Vista de catálogos. Solo el administrador puede agregar o desactivar ítems."}
          </p>
          {manageCatalogs ? (
            <>
              <div className="mt-4 flex flex-wrap gap-2">
                {(
                  [
                    ["interests", "Intereses"],
                    ["goals", "Objetivos"],
                    ["offers", "Habilidades"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setCatalogKind(id);
                      setCatalogError("");
                    }}
                    className={`h-9 rounded-full px-3 text-xs font-semibold ${
                      catalogKind === id ? "bg-navy text-cream" : "border border-line text-navy"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  value={catalogDraft}
                  onChange={(event) => setCatalogDraft(event.target.value)}
                  placeholder={
                    catalogKind === "interests"
                      ? "Nuevo interés"
                      : catalogKind === "goals"
                        ? "Nuevo objetivo"
                        : "Nueva habilidad"
                  }
                  className="h-10 min-w-[12rem] flex-1 rounded-xl border border-line bg-white px-3 text-sm text-navy outline-none focus:border-teal"
                />
                {catalogKind === "interests" ? (
                  <select
                    value={catalogGroup}
                    onChange={(event) => setCatalogGroup(event.target.value)}
                    className="h-10 rounded-xl border border-line bg-white px-3 text-sm text-navy"
                  >
                    {[...interestGroups.map((group) => group.title), "Otros"]
                      .filter((title, index, list) => list.indexOf(title) === index)
                      .map((title) => (
                        <option key={title} value={title}>
                          {title}
                        </option>
                      ))}
                  </select>
                ) : null}
                <button
                  type="button"
                  onClick={submitCatalogItem}
                  className="h-10 rounded-xl bg-teal px-4 text-sm font-semibold text-white hover:bg-teal-deep"
                >
                  Agregar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!guardWrite()) {
                      return;
                    }
                    void (async () => {
                      const reason = await resetCatalogsAsync();
                      if (reason) {
                        setCatalogError(reason);
                        return;
                      }
                      setCatalogError("");
                      setCatalogTick((value) => value + 1);
                      await reload();
                    })();
                  }}
                  className="h-10 rounded-xl border border-line px-4 text-sm font-semibold text-navy"
                >
                  Restablecer base
                </button>
              </div>
              {catalogError ? <p className="mt-2 text-sm text-gold-deep">{catalogError}</p> : null}
              <EditableCatalog
                title={`Intereses · ${interests.length}`}
                items={interests}
                onRemove={(label) => removeCatalogItem("interests", label)}
              />
              <EditableCatalog
                title={`Objetivos · ${goals.length}`}
                items={goals}
                onRemove={(label) => removeCatalogItem("goals", label)}
              />
              <EditableCatalog
                title={`Habilidades · ${offers.length}`}
                items={offers}
                onRemove={(label) => removeCatalogItem("offers", label)}
              />
            </>
          ) : (
            <>
              <CatalogBlock title={`Intereses · ${interests.length}`} items={interests} />
              <CatalogBlock title={`Objetivos · ${goals.length}`} items={goals} />
              <CatalogBlock title={`Habilidades · ${offers.length}`} items={offers} />
            </>
          )}
          <CatalogBlock
            title={`Oportunidades · ${opportunities.length + ownOpportunities.length}`}
            items={[
              ...opportunities.map((entry) => entry.title),
              ...ownOpportunities.map((entry) => entry.title),
            ]}
          />
          {ownOpportunities.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {ownOpportunities.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-line px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-navy">{entry.title}</p>
                    <p className="text-sm text-muted">
                      {entry.status === "revision" ? "En revisión" : "Publicada"} · {entry.organizerName}
                    </p>
                  </div>
                  {entry.status === "revision" ? (
                    <button
                      type="button"
                      onClick={() => approve(entry.id)}
                      className="h-9 rounded-full border border-line px-3 text-xs font-semibold text-navy"
                    >
                      Aprobar
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          <CatalogBlock
            title={`Comunidades · ${communities.length + ownCommunities.length}`}
            items={[
              ...communities.map((entry) => entry.title),
              ...ownCommunities.map((entry) => entry.title),
            ]}
          />
          {ownCommunities.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {ownCommunities.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-line px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-navy">{entry.title}</p>
                    <p className="text-sm text-muted">
                      {entry.access === "privada"
                        ? "Privada"
                        : entry.access === "invitacion"
                          ? "Por invitación"
                          : "Pública"}
                      {" · "}
                      {entry.status === "revision" ? "En revisión" : "Publicada"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {entry.requests.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => admit(entry.id)}
                        className="h-9 rounded-full border border-line px-3 text-xs font-semibold text-navy"
                      >
                        {admitLabel(entry.requests.length)}
                      </button>
                    ) : null}
                    {entry.status === "revision" ? (
                      <button
                        type="button"
                        onClick={() => approveCommunity(entry.id)}
                        className="h-9 rounded-full border border-line px-3 text-xs font-semibold text-navy"
                      >
                        Aprobar
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_18px_40px_rgba(7,21,31,0.08)]">
          <h2 className="font-display text-2xl text-navy">Apelaciones</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Una persona decide. Marcarla revisada no suspende ni borra.
          </p>
          {appeals.length === 0 ? (
            <p className="mt-4 text-sm leading-6 text-muted">No hay apelaciones pendientes.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {appeals.map((appeal) => (
                <li key={appeal.id} className="rounded-2xl border border-line px-4 py-3">
                  <p className="text-sm font-semibold text-navy">
                    {appeal.communityTitle} · {appealKindLabel(appeal.kind)}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted">{appeal.note}</p>
                  <button
                    type="button"
                    onClick={() => markAppeal(appeal.id)}
                    className="mt-3 text-xs font-semibold text-teal"
                  >
                    Marcar revisada
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_18px_40px_rgba(7,21,31,0.08)]">
          <h2 className="font-display text-2xl text-navy">Reportes</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            {reportSla.averageMinutes === null
              ? `${reportSla.open} abiertos · ${reportSla.reviewed} revisados · sin tiempo medio aún.`
              : `${reportSla.open} abiertos · ${reportSla.reviewed} revisados · atención media ${reportSla.averageMinutes} min.`}{" "}
            Sin el contenido denunciado. Nadie queda suspendido automático.
          </p>
          {reports.length >= params.reportAlert ? (
            <p className="mt-4 rounded-2xl border border-gold/50 bg-cream-deep px-4 py-3 text-sm leading-6 text-navy">
              {`Hay ${reports.length} reportes pendientes (aviso desde ${params.reportAlert}). Revisar a mano.`}
            </p>
          ) : null}
          {reports.length === 0 ? (
            <p className="mt-4 text-sm leading-6 text-muted">No hay reportes pendientes.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {reports.map((report) => (
                <li key={report.key} className="rounded-2xl border border-line px-4 py-3">
                  <p className="text-sm font-semibold text-navy">{report.label}</p>
                  <p className="mt-1 text-sm leading-6 text-muted">{report.detail}</p>
                  <p className="mt-1 text-xs text-muted">Abierto {formatWhen(report.openedAt)}</p>
                  <button
                    type="button"
                    onClick={() => markReviewed(report)}
                    className="mt-3 text-xs font-semibold text-teal"
                  >
                    Marcar revisado
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_18px_40px_rgba(7,21,31,0.08)]">
          <h2 className="font-display text-2xl text-navy">Parámetros</h2>
          {!manageParams ? (
            <p className="mt-3 text-sm leading-6 text-muted">
              Vigentes (solo lectura): Gratis {params.dailyMessages} / Premium{" "}
              {params.premiumDailyMessages} mensajes, {params.communityQuota} comunidades cada{" "}
              {params.communityQuotaDays} días, conexión {params.matchExpiryDays} días, prueba{" "}
              {params.trialDays} días, umbral {params.affinityThreshold}. Solo el administrador los
              cambia.
            </p>
          ) : (
          <div className="mt-4 space-y-3">
            <NumberField
              id="daily-messages"
              label="Mensajes Gratis por día"
              value={draft.dailyMessages}
              onChange={(dailyMessages) => setDraft({ ...draft, dailyMessages })}
            />
            <NumberField
              id="premium-daily-messages"
              label="Mensajes Premium por día"
              value={draft.premiumDailyMessages}
              onChange={(premiumDailyMessages) => setDraft({ ...draft, premiumDailyMessages })}
            />
            <NumberField
              id="community-quota"
              label="Comunidades públicas por período"
              value={draft.communityQuota}
              onChange={(communityQuota) => setDraft({ ...draft, communityQuota })}
            />
            <NumberField
              id="community-quota-days"
              label="Días del período de comunidades"
              value={draft.communityQuotaDays}
              onChange={(communityQuotaDays) => setDraft({ ...draft, communityQuotaDays })}
            />
            <NumberField
              id="match-expiry-days"
              label="Días para expirar una conexión pendiente"
              value={draft.matchExpiryDays}
              onChange={(matchExpiryDays) => setDraft({ ...draft, matchExpiryDays })}
            />
            <NumberField
              id="trial-days"
              label="Días de la prueba Premium"
              value={draft.trialDays}
              onChange={(trialDays) => setDraft({ ...draft, trialDays })}
            />
            <NumberField
              id="report-alert"
              label="Aviso de reportes (sin sanción automática)"
              value={draft.reportAlert}
              onChange={(reportAlert) => setDraft({ ...draft, reportAlert })}
            />
            <NumberField
              id="affinity-threshold"
              label="Umbral de afinidad en Descubrir (0–100)"
              value={draft.affinityThreshold}
              onChange={(affinityThreshold) => setDraft({ ...draft, affinityThreshold })}
            />
            <div className="rounded-2xl border border-line bg-cream-deep px-4 py-3">
              <p className="text-sm font-semibold text-navy">Adjuntos en chat</p>
              <p className="mt-1 text-sm leading-6 text-muted">
                Política vigente: ninguno. Esta prueba no almacena archivos. El botón Adjuntar solo explica el rechazo.
              </p>
            </div>
            <p className="text-xs leading-5 text-muted">
              Umbral 0 lista todo. Un valor mayor oculta fichas por debajo en Descubrir; abrir por enlace
              sigue permitido. No es probabilidad de éxito.
            </p>
            {paramError ? <p className="text-sm text-danger">{paramError}</p> : null}
            <button
              type="button"
              onClick={saveParams}
              className="h-11 rounded-xl bg-teal px-4 text-sm font-semibold text-white hover:bg-teal-deep"
            >
              Guardar parámetros
            </button>
            <p className="text-xs leading-5 text-muted">
              {`Vigentes, versión ${versions[0]?.version ?? 1}${versions[0]?.at ? "" : " inicial"}: Gratis ${params.dailyMessages} / Premium ${params.premiumDailyMessages} mensajes, ${params.communityQuota} comunidades cada ${params.communityQuotaDays} días, conexión ${params.matchExpiryDays} días, prueba ${params.trialDays} días, adjuntos ${params.attachments}, aviso a ${params.reportAlert} reportes, umbral ${params.affinityThreshold}.`}
            </p>
            <ul className="space-y-2">
              {versions.map((version) => (
                <li key={version.version} className="rounded-2xl bg-cream-deep px-4 py-3 text-sm text-navy">
                  <p>
                    <span className="text-muted">
                      {version.at ? formatWhen(version.at) : "Inicial"} ·{" "}
                    </span>
                    Versión {version.version}: Gratis {version.dailyMessages} / Premium{" "}
                    {version.premiumDailyMessages} mensajes, {version.communityQuota} comunidades /{" "}
                    {version.communityQuotaDays} días, conexión {version.matchExpiryDays} días, prueba{" "}
                    {version.trialDays} días, adjuntos {version.attachments}, aviso {version.reportAlert},
                    umbral {version.affinityThreshold}.
                    {version.version === versions[0]?.version ? " Vigente." : ""}
                  </p>
                  {version.version === versions[0]?.version ? null : (
                    <button
                      type="button"
                      onClick={() => copyVersion(version)}
                      className="mt-2 text-xs font-semibold text-teal"
                    >
                      Copiar a la edición
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <p className="text-xs leading-5 text-muted">
              Guardar crea una versión nueva y deja las anteriores en el historial. No hay cobro.
            </p>
          </div>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_18px_40px_rgba(7,21,31,0.08)]">
        <h2 className="font-display text-2xl text-navy">Listo para piloto</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Criterios mínimos §13 leídos en este navegador. Lo parcial suele ser multiusuario o un paso que aún no corriste en la sesión.
          Runbook, acta de parámetros y modelo de datos: carpeta <span className="font-mono text-navy">docs/</span> del repositorio.
          Persistencia: {backendModeLabel()}.
        </p>
        <ul className="mt-4 space-y-2">
          {checklist.map((item) => {
            const action = checklistAction(item);
            return (
              <li key={item.id} className="rounded-2xl border border-line px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-navy">{item.label}</p>
                  <span
                    className={`text-xs font-semibold ${
                      item.status === "ok"
                        ? "text-teal-deep"
                        : item.status === "parcial"
                          ? "text-gold"
                          : "text-muted"
                    }`}
                  >
                    {checklistStatusLabel(item.status)}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-6 text-muted">{item.detail}</p>
                {action && item.status !== "ok" ? (
                  <Link href={action.href} className="mt-2 inline-block text-sm font-semibold text-teal hover:text-teal-deep">
                    {action.label}
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <section
        id="metricas-piloto"
        className="scroll-mt-6 mt-6 rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_18px_40px_rgba(7,21,31,0.08)]"
      >
        <h2 className="font-display text-2xl text-navy">Actividad del piloto</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          {events.length === 1 ? "1 evento" : `${events.length} eventos`} en esta sesión. Se guarda el hecho, no el texto de los mensajes ni los contactos. Las métricas salen de esos hechos y del estado local.
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map((metric) => (
            <div key={metric.id} className="rounded-2xl bg-cream-deep px-4 py-3">
              <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{metric.label}</dt>
              <dd className="mt-1 font-display text-2xl text-navy">{metric.value}</dd>
              <p className="mt-1 text-xs leading-5 text-muted">{metric.detail}</p>
            </div>
          ))}
        </dl>
        {events.length === 0 ? (
          <p className="mt-4 text-sm leading-6 text-muted">Todavía no hay actividad registrada.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {events.map((entry) => (
              <li key={entry.id} className="rounded-2xl bg-cream-deep px-4 py-3 text-sm text-navy">
                <span className="text-muted">{formatWhen(entry.at)} · </span>
                {entry.text}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_18px_40px_rgba(7,21,31,0.08)]">
        <h2 className="font-display text-2xl text-navy">Bitácora</h2>
        {audit.length === 0 ? (
          <p className="mt-4 text-sm leading-6 text-muted">Todavía no hay cambios registrados.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {audit.map((entry) => (
              <li key={entry.id} className="rounded-2xl bg-cream-deep px-4 py-3 text-sm text-navy">
                <span className="text-muted">{formatWhen(entry.at)} · </span>
                {entry.text}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CatalogBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold text-navy">{title}</h3>
      <ul className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item} className="rounded-full bg-cream-deep px-3 py-1 text-xs font-medium text-navy">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function EditableCatalog({
  title,
  items,
  onRemove,
}: {
  title: string;
  items: string[];
  onRemove: (label: string) => void;
}) {
  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold text-navy">{title}</h3>
      <ul className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <li
            key={item}
            className="inline-flex items-center gap-1 rounded-full bg-cream-deep px-3 py-1 text-xs font-medium text-navy"
          >
            {item}
            <button
              type="button"
              onClick={() => onRemove(item)}
              className="ml-1 text-muted hover:text-navy"
              aria-label={`Desactivar ${item}`}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-sm font-semibold text-navy" htmlFor={id}>
      {label}
      <input
        id={id}
        type="number"
        min={1}
        value={value}
        onChange={(event) => onChange(event.target.valueAsNumber)}
        className="mt-1 h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm font-normal outline-none focus:border-teal"
      />
    </label>
  );
}

function checklistAction(item: PilotChecklistItem): { href: string; label: string } | null {
  switch (item.id) {
    case "registro-intereses":
      return { href: "/perfil", label: "Ir a perfil e intereses" };
    case "descubrimiento":
      return { href: "/descubrir", label: "Abrir Descubrir" };
    case "match-chat":
      return { href: "/matches", label: "Ver conexiones" };
    case "cuota-comunidades":
      return { href: "/admin", label: "Revisar parámetros arriba" };
    case "recuperacion":
      return { href: "/cuenta#respaldo", label: "Ir al respaldo en Cuenta" };
    case "metricas":
      return { href: "/admin#metricas-piloto", label: "Ver actividad del piloto" };
    case "admin":
      return { href: "/cuenta", label: "Activar rol en Cuenta" };
    case "chat-reportes":
      return { href: "/mensajes", label: "Abrir mensajes y reportes" };
    case "oportunidad-gratis":
      return { href: "/descubrir", label: "Ver oportunidades" };
    case "ia-gratis":
      return { href: "/asistente", label: "Revisar asistente" };
    case "privacidad":
      return { href: "/cuenta#visibilidad", label: "Ajustar privacidad" };
    default:
      return null;
  }
}

function pendingReports(reviewed: Set<string>): AdminReport[] {
  return pendingReportEntries(reviewed).map((entry) => ({
    key: entry.key,
    label: reportLabel(entry),
    detail: reportDetail(entry),
    openedAt: entry.at,
  }));
}

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Ahora";
  }
  return date.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
}

function readAdminParamsSafe(): AdminParams {
  if (typeof sessionStorage === "undefined") {
    return {
      dailyMessages: 20,
      premiumDailyMessages: 60,
      communityQuota: 2,
      communityQuotaDays: 30,
      matchExpiryDays: 7,
      trialDays: 10,
      attachments: "ninguno",
      reportAlert: 3,
      affinityThreshold: 0,
    };
  }
  return readAdminParams();
}
