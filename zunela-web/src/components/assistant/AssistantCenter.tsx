"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { JourneySteps } from "@/components/journey/JourneySteps";
import { offlineWriteMessage, useOnline } from "@/hooks/useOnline";
import { readActivePlan } from "@/lib/account";
import { evaluateAiAccess } from "@/lib/ai-policy";
import { attemptA00, attemptA01 } from "@/lib/ai-structured";
import { readAiBudgetSnapshot } from "@/lib/ai-runtime";
import { ASSISTANT_TASKS, readAiConsent, saveAiConsent, type AssistantTaskId } from "@/lib/assistant";

export function AssistantCenter() {
  const online = useOnline();
  const [ready, setReady] = useState(false);
  const [premium, setPremium] = useState(false);
  const [consent, setConsent] = useState(false);
  const [task, setTask] = useState<AssistantTaskId | null>(null);
  const [accessReason, setAccessReason] = useState("");
  const [quotaLabel, setQuotaLabel] = useState("");
  const [structuredNote, setStructuredNote] = useState("");
  const [structuredJson, setStructuredJson] = useState("");
  const [offlineHint, setOfflineHint] = useState("");

  useEffect(() => {
    setPremium(readActivePlan() === "prueba");
    setConsent(readAiConsent());
    setAccessReason(evaluateAiAccess("A00", "consultar", { record: false }).reason);
    const snap = readAiBudgetSnapshot();
    setQuotaLabel(
      `Cupo ${snap.diarioUsado}/${snap.diarioLimite} · presupuesto ${snap.disponible}/${snap.presupuesto} (${snap.moneda})`,
    );
    setReady(true);
  }, []);

  function previewStructured(id: AssistantTaskId) {
    if (id === "perfil") {
      const result = attemptA01();
      setStructuredNote(`${result.acceso.reason} · ${result.nota}`);
      setStructuredJson(JSON.stringify(result.salida, null, 2));
      return;
    }
    const prompt =
      id === "oportunidad"
        ? "quiero crear una oportunidad"
        : id === "colaboradores"
          ? "buscar personas por afinidad"
          : id === "comunidad"
            ? "organizar una comunidad"
            : id === "mensaje"
              ? "preparar un mensaje"
              : "consulta general";
    const result = attemptA00(prompt);
    setStructuredNote(`${result.acceso.reason} · ${result.nota}`);
    setStructuredJson(JSON.stringify(result.salida, null, 2));
  }

  function toggleConsent(next: boolean) {
    if (!online) {
      setOfflineHint(offlineWriteMessage());
      return;
    }
    setOfflineHint("");
    saveAiConsent(next);
    setConsent(next);
  }

  if (!ready) {
    return <div className="h-80" />;
  }

  const selected = ASSISTANT_TASKS.find((item) => item.id === task) ?? null;

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

      <div className="mt-8 max-w-3xl">
        <p className="text-[11px] font-semibold tracking-[0.22em] text-gold uppercase">
          Asistente ZUNELA
        </p>
        <h1 className="mt-2 font-display text-3xl text-navy sm:text-4xl">Centro IA</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          El asistente está apagado. No hay modelo conectado, no se envía tu perfil y no hay
          consumo ni cobro. Una llamada directa tampoco puede ejecutarlo ni leer datos ocultos.
        </p>
      </div>

      {premium ? (
        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.8fr)]">
          <section className="rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_18px_40px_rgba(7,21,31,0.08)]">
            <h2 className="font-display text-2xl text-navy">Tareas previstas</h2>
            <ul className="mt-4 space-y-2">
              {ASSISTANT_TASKS.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-pressed={task === item.id}
                    onClick={() => {
                      setTask(item.id);
                      previewStructured(item.id);
                    }}
                    className={`w-full rounded-2xl border px-4 py-3 text-left ${
                      task === item.id ? "border-teal bg-cream-deep" : "border-line"
                    }`}
                  >
                    <span className="block text-sm font-semibold text-navy">{item.title}</span>
                    <span className="mt-1 block text-sm text-muted">{item.detail}</span>
                  </button>
                </li>
              ))}
            </ul>
            {selected ? (
              <div className="mt-4 rounded-2xl bg-cream-deep px-4 py-4">
                <p className="text-sm font-semibold text-navy">{selected.title}</p>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Cuando el módulo se active, esta tarea pedirá confirmación y usará solo los datos
                  que autorices. Hoy puedes hacerla tú en la pantalla correspondiente.
                </p>
                {structuredNote ? (
                  <p className="mt-2 text-sm leading-6 text-muted">{structuredNote}</p>
                ) : null}
                {structuredJson ? (
                  <pre className="mt-3 overflow-x-auto rounded-2xl bg-white/70 px-3 py-3 text-xs leading-5 text-navy">
                    {structuredJson}
                  </pre>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-4">
                  {selected.id === "oportunidad" ? (
                    <Link
                      href="/asistente/oportunidad"
                      className="text-sm font-semibold text-teal hover:text-teal-deep"
                    >
                      Abrir el copiloto
                    </Link>
                  ) : null}
                  <Link
                    href={selected.href}
                    className="text-sm font-semibold text-teal hover:text-teal-deep"
                  >
                    Ir sin asistente
                  </Link>
                </div>
              </div>
            ) : null}
          </section>

          <aside className="space-y-6">
            <section className="rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_18px_40px_rgba(7,21,31,0.08)]">
              <h2 className="font-display text-2xl text-navy">Cuota</h2>
              <p className="mt-2 text-sm font-semibold text-teal">0 ejecuciones · módulo apagado</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                La prueba Premium no incluye consumo de IA mientras el asistente siga apagado.
              </p>
              {quotaLabel ? <p className="mt-2 text-sm leading-6 text-muted">{quotaLabel}</p> : null}
              {accessReason ? (
                <p className="mt-2 text-sm leading-6 text-muted">A00 consultar: {accessReason}</p>
              ) : null}
            </section>
            <section className="rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_18px_40px_rgba(7,21,31,0.08)]">
              <h2 className="font-display text-2xl text-navy">Historial</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Todavía no hay respuestas. Lo que genere el asistente, cuando exista, quedará
                marcado como contenido de IA y podrás corregirlo o reportarlo.
              </p>
            </section>
            <section className="rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_18px_40px_rgba(7,21,31,0.08)]">
              <h2 className="font-display text-2xl text-navy">Consentimiento</h2>
              <label className="mt-3 flex items-start gap-3 text-sm leading-6 text-navy">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => toggleConsent(event.target.checked)}
                  className="mt-1"
                />
                <span>
                  Cuando el módulo se active, autorizo a usar mi nombre visible, ciudad, intereses
                  y objetivos. El correo y el teléfono no se incluyen.
                </span>
              </label>
              <p className="mt-3 text-sm text-muted">
                {consent ? "Autorización guardada en este navegador." : "Sin autorización."}
              </p>
              {!online || offlineHint ? (
                <p className="mt-2 text-sm text-muted">{offlineHint || offlineWriteMessage()}</p>
              ) : null}
            </section>
          </aside>
        </div>
      ) : (
        <section className="mt-8 max-w-2xl rounded-[28px] border border-gold/35 bg-card/95 p-6 shadow-[0_18px_40px_rgba(7,21,31,0.08)] sm:p-8">
          <h2 className="font-display text-2xl text-navy">El asistente es Premium</h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            En Gratis siguen el descubrimiento, las conexiones y las comunidades públicas. El asistente
            no está incluido y, además, el módulo sigue apagado para todo el producto.
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
