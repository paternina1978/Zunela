"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { JourneySteps } from "@/components/journey/JourneySteps";
import { offlineWriteMessage, useOnline } from "@/hooks/useOnline";
import { AGENT_CATALOG, type AgentEntry } from "@/lib/agent-catalog";
import { readHeldAgents, toggleAgentHold } from "@/lib/agent-holds";
import { readReviewedReports, reviewReport } from "@/lib/admin";
import {
  commitApproval,
  expireApproval,
  prepareApproval,
  readApprovals,
  type ApprovalRequest,
} from "@/lib/approvals";
import { attemptA08, attemptA09, buildA08 } from "@/lib/ai-admin-agents";
import {
  STRUCTURED_SCHEMAS,
  attemptA00,
  attemptA01,
  attemptA03,
} from "@/lib/ai-structured";
import { readOwnCommunities } from "@/lib/own-communities";
import { readOwnOpportunities } from "@/lib/own-opportunities";
import { readPilotMetrics, type PilotMetric } from "@/lib/pilot-metrics";
import {
  pendingReportEntries,
  reportDetail,
  reportLabel,
  saveReviewMeta,
} from "@/lib/reports";

type ReviewCase = {
  key: string;
  label: string;
  detail: string;
  kind: "reporte" | "publicacion";
  asignadoA: "moderacion-piloto";
  lecturaPropuesta: string;
};

export function AgentPanel() {
  const online = useOnline();
  const [cases, setCases] = useState<ReviewCase[]>([]);
  const [held, setHeld] = useState<string[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [approvalNotice, setApprovalNotice] = useState("");
  const [structuredNote, setStructuredNote] = useState("");
  const [structuredJson, setStructuredJson] = useState("");
  const [a09Note, setA09Note] = useState("");
  const [a09Metrics, setA09Metrics] = useState<PilotMetric[]>([]);
  const [a08Note, setA08Note] = useState("");
  const [offlineHint, setOfflineHint] = useState("");

  function guardWrite() {
    if (online) {
      setOfflineHint("");
      return true;
    }
    setOfflineHint(offlineWriteMessage());
    return false;
  }

  useEffect(() => {
    setCases(loadCases());
    setHeld(readHeldAgents());
    setApprovals(readApprovals());
    setA09Metrics(readPilotMetrics());
  }, []);

  function reloadApprovals() {
    setApprovals(readApprovals());
  }

  function prepare(action: "cambiar-limite" | "suspender-cuenta") {
    if (!guardWrite()) {
      return;
    }
    const result = prepareApproval(action);
    if (typeof result === "string") {
      setApprovalNotice(result);
      return;
    }
    setApprovalNotice(`Solicitud lista. Vence en 90 segundos. Todavía no se aplicó.`);
    reloadApprovals();
  }

  function apply(id: string) {
    if (!guardWrite()) {
      return;
    }
    const result = commitApproval(id);
    if (typeof result === "string") {
      setApprovalNotice(result);
      return;
    }
    setApprovalNotice(result.reason);
    reloadApprovals();
  }

  function markExpired(id: string) {
    if (!guardWrite()) {
      return;
    }
    expireApproval(id);
    setApprovalNotice("La aprobación quedó vencida. No se aplicó el cambio.");
    reloadApprovals();
  }

  function markReviewed(item: ReviewCase) {
    if (item.kind !== "reporte") {
      return;
    }
    if (!guardWrite()) {
      return;
    }
    reviewReport(item.key, item.label);
    saveReviewMeta(item.key, item.label);
    setCases(loadCases());
  }

  function holdAgent(code: string) {
    if (!guardWrite()) {
      return;
    }
    setHeld(toggleAgentHold(code));
  }

  function runA09() {
    const result = attemptA09();
    setA09Note(`${result.acceso.reason} · ${result.nota}`);
    setA09Metrics(
      result.salida.metricas.map((item) => ({
        id: item.id,
        label: item.etiqueta,
        value: item.valor,
        detail: "Agregado local. Sin chats ni personas identificables.",
      })),
    );
  }

  function runA08() {
    const open = loadCases();
    const result = attemptA08(open);
    setA08Note(`${result.acceso.reason} · ${result.nota}`);
    setCases(
      open.map((item) => {
        const brief = result.salida.casos.find((caseItem) => caseItem.key === item.key);
        return {
          ...item,
          asignadoA: "moderacion-piloto" as const,
          lecturaPropuesta: brief?.lecturaPropuesta ?? item.lecturaPropuesta,
        };
      }),
    );
  }

  function runStructured(code: "A00" | "A01" | "A03") {
    if (code === "A00") {
      const result = attemptA00("quiero mejorar mi perfil");
      setStructuredNote(`${result.acceso.reason} · ${result.nota}`);
      setStructuredJson(JSON.stringify(result.salida, null, 2));
      return;
    }
    if (code === "A01") {
      const result = attemptA01();
      setStructuredNote(`${result.acceso.reason} · ${result.nota}`);
      setStructuredJson(JSON.stringify(result.salida, null, 2));
      return;
    }
    const result = attemptA03({
      titulo: "Práctica de ejemplo",
      objetivo: "Ordenar un ejercicio corto sin datos de clientes.",
      interes: "Programación",
      modalidad: "ambas",
      rol: "Participante",
    });
    setStructuredNote(`${result.acceso.reason} · ${result.nota}`);
    setStructuredJson(JSON.stringify(result.salida, null, 2));
  }

  const userAgents = AGENT_CATALOG.filter((agent) => agent.audience === "usuario");
  const adminAgents = AGENT_CATALOG.filter((agent) => agent.audience === "administracion");

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
        {!online || offlineHint ? (
          <p className="mb-3 text-sm leading-6 text-muted">{offlineHint || offlineWriteMessage()}</p>
        ) : null}
        <p className="text-[11px] font-semibold tracking-[0.22em] text-gold uppercase">
          Administración
        </p>
        <h1 className="mt-2 font-display text-3xl text-navy sm:text-4xl">Panel de agentes</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          El módulo está apagado. No hay modelo conectado, no hay ejecuciones y ningún agente
          puede suspender, borrar o publicar. La revisión la haces tú. Una llamada directa a la
          API tampoco ejecuta un agente ni devuelve datos ocultos.
        </p>
        <div className="mt-3 flex flex-wrap gap-4">
          <Link href="/admin" className="text-sm font-semibold text-teal hover:text-teal-deep">
            Volver a administración
          </Link>
          <Link href="/admin/ia" className="text-sm font-semibold text-teal hover:text-teal-deep">
            Control de IA
          </Link>
        </div>
      </div>

      <section className="mt-8 rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_18px_40px_rgba(7,21,31,0.08)]">
        <h2 className="font-display text-2xl text-navy">Estado</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          IA desactivada. Descubrir, conexiones, mensajes y la revisión manual siguen disponibles.
          En esta prueba no hay forma de encender un agente.
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-4">
          <Stat label="Agentes apagados" value={String(AGENT_CATALOG.length)} />
          <Stat label="Trabajos" value="0" />
          <Stat
            label="Aprobaciones"
            value={String(approvals.filter((item) => item.status === "pendiente").length)}
          />
          <Stat label="Casos abiertos" value={String(cases.length)} />
        </dl>
        <p className="mt-3 text-xs leading-5 text-muted">
          Cifras de esta sesión. A08 y A09 siguen sin modelo; solo leen agregados o expedientes
          asignados en este navegador.
        </p>
      </section>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <section className="rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_18px_40px_rgba(7,21,31,0.08)]">
          <h2 className="font-display text-2xl text-navy">A08 · Expedientes</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Casos asignados a moderación del piloto. A08 no propone sanciones automáticas ni muestra
            el cuerpo del mensaje.
          </p>
          <button
            type="button"
            onClick={runA08}
            className="mt-3 h-10 rounded-full border border-line bg-white px-4 text-xs font-semibold text-navy"
          >
            Preparar lectura A08
          </button>
          {a08Note ? <p className="mt-3 text-sm font-semibold text-navy">{a08Note}</p> : null}
          {cases.length === 0 ? (
            <p className="mt-4 text-sm leading-6 text-muted">No hay casos abiertos.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {cases.map((item) => (
                <li key={item.key} className="rounded-2xl border border-line px-4 py-3">
                  <p className="text-sm font-semibold text-navy">{item.label}</p>
                  <p className="mt-1 text-xs font-semibold tracking-wide text-muted uppercase">
                    Asignado · {item.asignadoA}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted">{item.detail}</p>
                  <p className="mt-2 text-sm leading-6 text-navy">{item.lecturaPropuesta}</p>
                  <p className="mt-1 text-xs leading-5 text-muted">Sanción automática: no.</p>
                  {item.kind === "reporte" ? (
                    <button
                      type="button"
                      onClick={() => markReviewed(item)}
                      className="mt-3 text-xs font-semibold text-teal"
                    >
                      Marcar revisado
                    </button>
                  ) : (
                    <Link href="/admin" className="mt-3 inline-block text-xs font-semibold text-teal">
                      Revisar en administración
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-6">
          <section className="rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_18px_40px_rgba(7,21,31,0.08)]">
            <h2 className="font-display text-2xl text-navy">A09 · Analítica</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Solo agregados del piloto. Sin chats, sin personas y sin SQL libre.
            </p>
            <button
              type="button"
              onClick={runA09}
              className="mt-3 h-10 rounded-full border border-line bg-white px-4 text-xs font-semibold text-navy"
            >
              Leer agregados A09
            </button>
            {a09Note ? <p className="mt-3 text-sm font-semibold text-navy">{a09Note}</p> : null}
            <ul className="mt-4 space-y-2">
              {a09Metrics.map((item) => (
                <li key={item.id} className="rounded-2xl border border-line px-4 py-3">
                  <p className="text-sm font-semibold text-navy">
                    {item.label}: {item.value}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted">{item.detail}</p>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_18px_40px_rgba(7,21,31,0.08)]">
            <h2 className="font-display text-2xl text-navy">Trabajos</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              No hay trabajos en cola. Ningún agente está en ejecución.
            </p>
          </section>
          <section className="rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_18px_40px_rgba(7,21,31,0.08)]">
            <h2 className="font-display text-2xl text-navy">Aprobaciones</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Preparar no aplica el cambio. Aplicar falla si falta permiso, si la solicitud
              venció o si el servicio de IA no responde. Una llamada directa tampoco lo aplica.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => prepare("cambiar-limite")}
                className="h-10 rounded-xl border border-teal bg-white px-3 text-xs font-semibold text-teal"
              >
                Preparar cambio de límite
              </button>
              <button
                type="button"
                onClick={() => prepare("suspender-cuenta")}
                className="h-10 rounded-xl border border-line bg-white px-3 text-xs font-semibold text-navy"
              >
                Preparar suspensión
              </button>
            </div>
            <p className="mt-3 text-xs leading-5 text-muted">
              Si A10 está suspendido, el cambio de límite no tiene permiso. Si A08 está
              suspendido, la suspensión de ejemplo no tiene permiso.
            </p>
            {approvalNotice ? (
              <p className="mt-3 text-sm font-semibold text-navy">{approvalNotice}</p>
            ) : null}
            {approvals.length === 0 ? (
              <p className="mt-4 text-sm leading-6 text-muted">Todavía no hay solicitudes.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {approvals.map((item) => (
                  <li key={item.id} className="rounded-2xl border border-line px-4 py-3">
                    <p className="text-sm font-semibold text-navy">{item.label}</p>
                    <p className="mt-1 text-xs text-muted">
                      {item.status === "pendiente"
                        ? `Pendiente · vence ${formatWhen(item.expiresAt)}`
                        : `${item.status === "vencida" ? "Vencida" : "Rechazada"} · ${item.reason}`}
                    </p>
                    {item.status === "pendiente" ? (
                      <div className="mt-3 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => apply(item.id)}
                          className="text-xs font-semibold text-teal"
                        >
                          Aplicar
                        </button>
                        <button
                          type="button"
                          onClick={() => markExpired(item.id)}
                          className="text-xs font-semibold text-navy"
                        >
                          Caducar ahora
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <section className="mt-6 rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_18px_40px_rgba(7,21,31,0.08)]">
        <h2 className="font-display text-2xl text-navy">Salidas estructuradas</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          A00, A01 y A03 definen JSON local (IA-005 / IA-006). No hay modelo: `modelo: null`,
          `publicado: false` y hace falta confirmación humana.
        </p>
        <ul className="mt-4 space-y-2">
          {STRUCTURED_SCHEMAS.map((item) => (
            <li key={item.code} className="rounded-2xl border border-line px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-navy">
                    {item.code} · {item.title}
                  </p>
                  <p className="mt-1 font-mono text-xs leading-5 text-muted">{item.shape}</p>
                </div>
                <button
                  type="button"
                  onClick={() => runStructured(item.code)}
                  className="h-9 rounded-full border border-line bg-white px-3 text-xs font-semibold text-navy"
                >
                  Probar forma local
                </button>
              </div>
            </li>
          ))}
        </ul>
        {structuredNote ? <p className="mt-3 text-sm font-semibold text-navy">{structuredNote}</p> : null}
        {structuredJson ? (
          <pre className="mt-3 overflow-x-auto rounded-2xl bg-cream-deep px-4 py-3 text-xs leading-5 text-navy">
            {structuredJson}
          </pre>
        ) : null}
      </section>

      <section className="mt-6 rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_18px_40px_rgba(7,21,31,0.08)]">
        <h2 className="font-display text-2xl text-navy">Catálogo</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Versión sin asignar. Modelo: sin modelo. Despliegue: 0 %. Todos apagados.
        </p>
        <AgentGroup
          title="Para cuentas Premium"
          agents={userAgents}
          held={held}
          onToggle={holdAgent}
        />
        <AgentGroup
          title="Para administración"
          agents={adminAgents}
          held={held}
          onToggle={holdAgent}
        />
      </section>
    </div>
  );
}

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "ahora";
  }
  return date.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line px-4 py-3">
      <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</dt>
      <dd className="mt-1 font-display text-2xl text-navy">{value}</dd>
    </div>
  );
}

function AgentGroup({
  title,
  agents,
  held,
  onToggle,
}: {
  title: string;
  agents: AgentEntry[];
  held: string[];
  onToggle: (code: string) => void;
}) {
  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold tracking-wide text-navy uppercase">{title}</h3>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {agents.map((agent) => (
          <li key={agent.code} className="rounded-2xl border border-line px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-navy">
                {agent.code} · {agent.name}
              </p>
              <span className="shrink-0 text-xs font-semibold tracking-wide text-gold uppercase">
                {held.includes(agent.code) ? "Suspendido" : "Apagado"}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted">{agent.purpose}</p>
            <button
              type="button"
              onClick={() => onToggle(agent.code)}
              className="mt-2 text-xs font-semibold text-teal"
            >
              {held.includes(agent.code) ? "Quitar suspensión" : "Suspender"}
            </button>
            {held.includes(agent.code) ? (
              <p className="mt-1 text-xs leading-5 text-muted">
                La suspensión queda registrada. Quitarla no enciende el agente.
              </p>
            ) : null}
            <p className="mt-2 text-sm leading-6 text-navy">{agent.permission}</p>
            <p className="mt-2 text-xs font-semibold tracking-wide text-muted uppercase">
              {agent.phase}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function loadCases(): ReviewCase[] {
  const reviewed = new Set(readReviewedReports());
  const reports = pendingReportEntries(reviewed).map((entry) => ({
    key: entry.key,
    label: reportLabel(entry),
    detail: reportDetail(entry),
    kind: "reporte" as const,
    asignadoA: "moderacion-piloto" as const,
    lecturaPropuesta: "Revisar a mano. No hay sanción automática.",
  }));
  const publications = [
    ...readOwnOpportunities()
      .filter((item) => item.status === "revision")
      .map((item) => ({
        key: item.id,
        label: item.title,
        detail: "Oportunidad en revisión. La publicación no sale de este panel.",
        kind: "publicacion" as const,
      })),
    ...readOwnCommunities()
      .filter((item) => item.status === "revision")
      .map((item) => ({
        key: item.id,
        label: item.title,
        detail: "Comunidad en revisión. La publicación no sale de este panel.",
        kind: "publicacion" as const,
      })),
  ];
  const base = [...reports, ...publications];
  const briefs = buildA08(base).casos;
  return base.map((item) => {
    const brief = briefs.find((caseItem) => caseItem.key === item.key);
    return {
      ...item,
      asignadoA: "moderacion-piloto" as const,
      lecturaPropuesta: brief?.lecturaPropuesta ?? "Revisar con decisión humana.",
    };
  });
}
