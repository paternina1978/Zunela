"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { JourneySteps } from "@/components/journey/JourneySteps";
import { offlineWriteMessage, useOnline } from "@/hooks/useOnline";
import { readAudit, type AuditEntry } from "@/lib/admin";
import { AGENT_CATALOG } from "@/lib/agent-catalog";
import { DEFAULT_AI_LIMITS, readAiLimits, saveAiLimits, type AiLimits } from "@/lib/ai-control";
import {
  AI_ACTIONS,
  AI_SLOTS,
  defaultAiPolicy,
  evaluateAiAccess,
  readAiPolicy,
  saveAiPolicy,
  type AgentPolicyRow,
  type AiAction,
  type AiPlanSlot,
} from "@/lib/ai-policy";
import { AI_EVAL_CASES, readAiEvalChecks, toggleAiEvalCheck } from "@/lib/ai-evals";
import {
  AI_SAFE_TOOLS,
  isEmergencyAiOff,
  readAiBudgetSnapshot,
  readAiRuns,
  readAiTraces,
  readAiUsageLedger,
  setEmergencyAiOff,
  type AiLedgerEntry,
  type AiRunRecord,
  type AiTrace,
} from "@/lib/ai-runtime";

const PERMISSIONS = [
  {
    who: "Gratis",
    rule: "Sin IA generativa. Siguen descubrir, las conexiones y las comunidades públicas.",
  },
  {
    who: "Prueba Premium",
    rule: "Puede figurar en la matriz, pero el cupo no se consume: el módulo está apagado.",
  },
  {
    who: "Premium",
    rule: "Los agentes de usuario siguen bloqueados hasta que exista el servicio.",
  },
  {
    who: "Administración",
    rule: "Solo con rol administrador. No ejecuta sanciones ni lee chats privados.",
  },
];

export function AiControl() {
  const online = useOnline();
  const [limits, setLimits] = useState<AiLimits>(DEFAULT_AI_LIMITS);
  const [draft, setDraft] = useState<AiLimits>(DEFAULT_AI_LIMITS);
  const [policy, setPolicy] = useState<AgentPolicyRow[]>(defaultAiPolicy());
  const [notice, setNotice] = useState("");
  const [policyNotice, setPolicyNotice] = useState("");
  const [offlineHint, setOfflineHint] = useState("");
  const [emergency, setEmergency] = useState(false);
  const [traces, setTraces] = useState<AiTrace[]>([]);
  const [runs, setRuns] = useState<AiRunRecord[]>([]);
  const [ledger, setLedger] = useState<AiLedgerEntry[]>([]);
  const [budget, setBudget] = useState(readAiBudgetSnapshot());
  const [evals, setEvals] = useState<string[]>([]);
  const [probeNotice, setProbeNotice] = useState("");
  const [log, setLog] = useState<AuditEntry[]>([]);

  function reloadRuntime() {
    setEmergency(isEmergencyAiOff());
    setTraces(readAiTraces());
    setRuns(readAiRuns());
    setLedger(readAiUsageLedger());
    setBudget(readAiBudgetSnapshot());
    setEvals(readAiEvalChecks());
    setLog(readAudit());
  }

  useEffect(() => {
    const stored = readAiLimits();
    setLimits(stored);
    setDraft(stored);
    setPolicy(readAiPolicy());
    reloadRuntime();
  }, []);

  function update(field: keyof AiLimits, value: number) {
    setNotice("");
    setDraft((current) => ({
      ...current,
      [field]: Number.isFinite(value) ? value : current[field],
    }));
  }

  function guardWrite() {
    if (online) {
      setOfflineHint("");
      return true;
    }
    setOfflineHint(offlineWriteMessage());
    return false;
  }

  function save() {
    if (!guardWrite()) {
      return;
    }
    const result = saveAiLimits(draft);
    if (typeof result === "string") {
      setNotice(result);
      return;
    }
    setLimits(result);
    setDraft(result);
    setLog(readAudit());
    setNotice("Límites guardados en este navegador. La IA sigue apagada.");
  }

  function toggleAction(code: string, slot: AiPlanSlot, action: AiAction) {
    if (!guardWrite()) {
      return;
    }
    setPolicyNotice("");
    setPolicy((current) =>
      current.map((row) => {
        if (row.code !== code) {
          return row;
        }
        const list = row[slot];
        const next = list.includes(action) ? list.filter((item) => item !== action) : [...list, action];
        return { ...row, [slot]: next };
      }),
    );
  }

  function savePolicy() {
    if (!guardWrite()) {
      return;
    }
    const result = saveAiPolicy(policy);
    if (typeof result === "string") {
      setPolicyNotice(result);
      return;
    }
    setPolicy(result);
    setLog(readAudit());
    setPolicyNotice("Matriz guardada. No enciende ningún agente ni hay proveedor.");
  }

  function resetPolicy() {
    if (!guardWrite()) {
      return;
    }
    setPolicy(defaultAiPolicy());
    setPolicyNotice("Se restauró la propuesta inicial. Guarda para dejarla vigente.");
  }

  function toggleEmergency() {
    if (!guardWrite()) {
      return;
    }
    const next = !emergency;
    setEmergencyAiOff(next);
    setEmergency(next);
    reloadRuntime();
  }

  function probeBlockedCall() {
    if (!guardWrite()) {
      return;
    }
    const result = evaluateAiAccess("A00", "consultar", { record: true });
    setProbeNotice(result.reason);
    reloadRuntime();
  }

  function toggleEval(id: string) {
    if (!guardWrite()) {
      return;
    }
    setEvals(toggleAiEvalCheck(id));
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
        <p className="text-[11px] font-semibold tracking-[0.22em] text-gold uppercase">
          Administración
        </p>
        <h1 className="mt-2 font-display text-3xl text-navy sm:text-4xl">Control de IA</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Consumo, límites, matriz rol × plan × agente × acción y versiones de esta prueba. No hay
          proveedor, no hay tarifa y guardar no enciende ningún agente.
        </p>
        {!online || offlineHint ? (
          <p className="mt-2 text-sm leading-6 text-muted">{offlineHint || offlineWriteMessage()}</p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-4">
          <Link href="/admin" className="text-sm font-semibold text-teal hover:text-teal-deep">
            Volver a administración
          </Link>
          <Link href="/admin/agentes" className="text-sm font-semibold text-teal hover:text-teal-deep">
            Panel de agentes
          </Link>
        </div>
      </div>

      <section className="mt-8 rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_18px_40px_rgba(7,21,31,0.08)]">
        <h2 className="font-display text-2xl text-navy">Apagado de emergencia</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Corta cualquier intento de IA además del módulo apagado. No afecta perfiles, conexiones ni
          comunidades. Quitar el apagado tampoco conecta un proveedor.
        </p>
        <p className="mt-3 text-sm font-semibold text-teal">
          {emergency ? "Emergencia activa · sin ejecuciones" : "Emergencia inactiva · módulo sigue apagado"}
        </p>
        <button
          type="button"
          onClick={toggleEmergency}
          className="mt-4 h-11 rounded-full bg-navy px-5 text-sm font-semibold text-cream"
        >
          {emergency ? "Quitar apagado de emergencia" : "Activar apagado de emergencia"}
        </button>
      </section>

      <section className="mt-6 rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_18px_40px_rgba(7,21,31,0.08)]">
        <h2 className="font-display text-2xl text-navy">Consumo y ledger</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          `ai_runs`, `ai_usage_ledger` y presupuesto locales. Sin ejecuciones reales: tokens y
          costo quedan en cero. Las trazas no guardan correo, teléfono ni el texto del prompt.
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Ejecuciones ok" value="0" />
          <Stat label="Rechazos" value={String(runs.length)} />
          <Stat label="Cupo día" value={`${budget.diarioUsado}/${budget.diarioLimite}`} />
          <Stat label="Presupuesto" value={`${budget.disponible}/${budget.presupuesto || 0}`} />
        </dl>
        <p className="mt-3 text-sm leading-6 text-muted">
          Middleware de cuota: con presupuesto 0 o cupo 0 el acceso se corta sin tokens. Hoy el
          presupuesto vigente es {budget.presupuesto} ({budget.moneda}).
        </p>
        <button
          type="button"
          onClick={probeBlockedCall}
          className="mt-4 h-11 rounded-full border border-line bg-white px-5 text-sm font-semibold text-navy"
        >
          Simular intento bloqueado (A00)
        </button>
        {probeNotice ? <p className="mt-3 text-sm font-semibold text-navy">{probeNotice}</p> : null}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <TraceList
            title="Trazas saneadas"
            empty="Todavía no hay bloqueos registrados en esta sesión."
            items={traces.map((item) => `${formatWhen(item.at)} · ${item.agent} · ${item.action} · ${item.reason}`)}
          />
          <TraceList
            title="Ledger de uso"
            empty="El ledger está vacío. No hubo consumo."
            items={ledger.map((item) => `${formatWhen(item.at)} · ${item.tipo} · ${item.detalle}`)}
          />
        </div>
      </section>

      <section className="mt-6 rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_18px_40px_rgba(7,21,31,0.08)]">
        <h2 className="font-display text-2xl text-navy">Evaluaciones adversariales</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Checklist de revisión humana (IA-007). Marcar no ejecuta un modelo ni envía prompts.
        </p>
        <ul className="mt-4 space-y-2">
          {AI_EVAL_CASES.map((item) => {
            const checked = evals.includes(item.id);
            return (
              <li key={item.id} className="rounded-2xl border border-line px-4 py-3">
                <label className="flex items-start gap-3 text-sm leading-6 text-navy">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      toggleEval(item.id);
                      setLog(readAudit());
                    }}
                    className="mt-1"
                  />
                  <span>
                    <span className="block font-semibold">{item.title}</span>
                    <span className="mt-1 block text-muted">{item.detail}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs leading-5 text-muted">
          Revisadas: {evals.length} de {AI_EVAL_CASES.length}.
        </p>
      </section>

      <section className="mt-6 rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_18px_40px_rgba(7,21,31,0.08)]">
        <h2 className="font-display text-2xl text-navy">Herramientas seguras</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Vistas autorizadas previstas (IA-002). Ninguna se invoca en esta prueba y ninguna escribe
          datos de negocio.
        </p>
        <ul className="mt-4 space-y-2">
          {AI_SAFE_TOOLS.map((tool) => (
            <li key={tool.id} className="rounded-2xl border border-line px-4 py-3">
              <p className="text-sm font-semibold text-navy">
                {tool.name}
                <span className="ml-2 text-xs font-semibold tracking-wide text-muted uppercase">
                  {tool.escribe ? "escribe" : "solo lectura"}
                </span>
              </p>
              <p className="mt-1 text-sm leading-6 text-muted">Vista: {tool.vista}</p>
              <p className="mt-1 text-sm leading-6 text-muted">{tool.nota}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_18px_40px_rgba(7,21,31,0.08)]">
        <h2 className="font-display text-2xl text-navy">Matriz de permisos</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Define quién podría usar cada agente y con qué acción. Gratis arranca vacío. Aunque la
          casilla esté marcada, el módulo apagado impide la ejecución.
        </p>
        <div className="mt-4 space-y-4">
          {policy.map((row) => {
            const agent = AGENT_CATALOG.find((item) => item.code === row.code);
            if (!agent) {
              return null;
            }
            return (
              <div key={row.code} className="rounded-2xl border border-line px-4 py-4">
                <p className="text-sm font-semibold text-navy">
                  {row.code} · {agent.name}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted">{agent.permission}</p>
                <div className="mt-3 grid gap-3 lg:grid-cols-3">
                  {AI_SLOTS.map((slot) => (
                    <div key={slot.id}>
                      <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                        {slot.label}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {AI_ACTIONS.map((action) => {
                          const active = row[slot.id].includes(action.id);
                          return (
                            <button
                              key={action.id}
                              type="button"
                              aria-pressed={active}
                              onClick={() => toggleAction(row.code, slot.id, action.id)}
                              className={`h-8 rounded-full px-3 text-xs font-semibold ${
                                active ? "bg-navy text-cream" : "bg-cream-deep text-muted"
                              }`}
                            >
                              {action.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {policyNotice ? <p className="mt-3 text-sm font-semibold text-navy">{policyNotice}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={savePolicy}
            className="h-11 rounded-full bg-navy px-5 text-sm font-semibold text-cream"
          >
            Guardar matriz
          </button>
          <button
            type="button"
            onClick={resetPolicy}
            className="h-11 rounded-full border border-line bg-white px-5 text-sm font-semibold text-navy"
          >
            Restaurar propuesta
          </button>
        </div>
      </section>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <section className="rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_18px_40px_rgba(7,21,31,0.08)]">
          <h2 className="font-display text-2xl text-navy">Límites</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Propuesta guardada en este navegador. El presupuesto de referencia no tiene moneda.
            Cero significa que no hay presupuesto cargado.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <LimitField
              id="ai-daily"
              label="Solicitudes por cuenta al día"
              value={draft.dailyRequests}
              onChange={(value) => update("dailyRequests", value)}
            />
            <LimitField
              id="ai-monthly"
              label="Solicitudes por cuenta al mes"
              value={draft.monthlyRequests}
              onChange={(value) => update("monthlyRequests", value)}
            />
            <LimitField
              id="ai-context"
              label="Tokens de contexto"
              value={draft.contextTokens}
              onChange={(value) => update("contextTokens", value)}
            />
            <LimitField
              id="ai-steps"
              label="Pasos por ejecución"
              value={draft.maxSteps}
              onChange={(value) => update("maxSteps", value)}
            />
            <LimitField
              id="ai-concurrency"
              label="Llamadas en paralelo"
              value={draft.concurrency}
              onChange={(value) => update("concurrency", value)}
            />
            <LimitField
              id="ai-budget"
              label="Presupuesto mensual de referencia"
              value={draft.budgetUnits}
              onChange={(value) => update("budgetUnits", value)}
            />
          </div>
          <p className="mt-4 text-sm leading-6 text-muted">
            Vigentes: {limits.dailyRequests} al día, {limits.monthlyRequests} al mes, contexto{" "}
            {limits.contextTokens}, {limits.maxSteps} pasos, {limits.concurrency} en paralelo,
            presupuesto {limits.budgetUnits}.
          </p>
          {notice ? <p className="mt-3 text-sm font-semibold text-navy">{notice}</p> : null}
          <button
            type="button"
            onClick={save}
            className="mt-4 h-11 rounded-full bg-navy px-5 text-sm font-semibold text-cream"
          >
            Guardar límites
          </button>
        </section>

        <div className="space-y-6">
          <section className="rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_18px_40px_rgba(7,21,31,0.08)]">
            <h2 className="font-display text-2xl text-navy">Resumen por plan</h2>
            <ul className="mt-4 space-y-2">
              {PERMISSIONS.map((item) => (
                <li key={item.who} className="rounded-2xl border border-line px-4 py-3">
                  <p className="text-sm font-semibold text-navy">{item.who}</p>
                  <p className="mt-1 text-sm leading-6 text-muted">{item.rule}</p>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_18px_40px_rgba(7,21,31,0.08)]">
            <h2 className="font-display text-2xl text-navy">Versiones</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              No hay instrucciones publicadas ni un modelo asignado. El catálogo de ejemplo no se
              envía a un proveedor.
            </p>
          </section>
        </div>
      </div>

      <section className="mt-6 rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_18px_40px_rgba(7,21,31,0.08)]">
        <h2 className="font-display text-2xl text-navy">Auditoría</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          La misma bitácora de administración. No hay ejecuciones de IA que registrar.
        </p>
        {log.length === 0 ? (
          <p className="mt-4 text-sm leading-6 text-muted">Todavía no hay cambios en esta sesión.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {log.map((entry) => (
              <li key={entry.id} className="rounded-2xl border border-line px-4 py-3 text-sm text-navy">
                <span className="font-semibold text-muted">{formatWhen(entry.at)}</span>
                {" · "}
                {entry.text}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line px-4 py-3">
      <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</dt>
      <dd className="mt-1 font-display text-2xl text-navy">{value}</dd>
    </div>
  );
}

function TraceList({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: string[];
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-navy">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm leading-6 text-muted">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.slice(0, 8).map((item) => (
            <li key={item} className="rounded-2xl bg-cream-deep px-3 py-2 text-xs leading-5 text-navy">
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LimitField({
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
        min={0}
        value={value}
        onChange={(event) => onChange(event.target.valueAsNumber)}
        className="mt-1 h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm font-normal outline-none focus:border-teal"
      />
    </label>
  );
}

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Ahora";
  }
  return date.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
}
