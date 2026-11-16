"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { NoticeTray } from "@/components/notices/NoticeTray";
import { canAccessAdminPanel, refreshRemoteRole } from "@/lib/roles";

const BASE_STEPS = [
  { id: "acceso", href: "/", label: "Acceso" },
  { id: "perfil", href: "/perfil", label: "Perfil" },
  { id: "intereses", href: "/intereses", label: "Intereses" },
  { id: "descubrir", href: "/descubrir", label: "Descubrir" },
  { id: "matches", href: "/matches", label: "Conexiones" },
  { id: "mensajes", href: "/mensajes", label: "Mensajes" },
  { id: "cuenta", href: "/cuenta", label: "Cuenta" },
  { id: "asistente", href: "/asistente", label: "Asistente" },
] as const;

const ADMIN_STEP = { id: "admin", href: "/admin", label: "Admin" } as const;

type StepId = (typeof BASE_STEPS)[number]["id"] | typeof ADMIN_STEP.id;

type JourneyStepsProps = {
  current: StepId;
};

export function JourneySteps({ current }: JourneyStepsProps) {
  const [showAdmin, setShowAdmin] = useState(false);

  useEffect(() => {
    function refresh() {
      setShowAdmin(canAccessAdminPanel());
    }
    void (async () => {
      await refreshRemoteRole();
      refresh();
    })();
    window.addEventListener("zunela-role", refresh);
    return () => window.removeEventListener("zunela-role", refresh);
  }, []);

  const steps = showAdmin || current === "admin" ? [...BASE_STEPS, ADMIN_STEP] : [...BASE_STEPS];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <ol className="flex flex-wrap items-center gap-2 text-xs font-semibold tracking-wide uppercase">
        {steps.map((step, index) => (
          <li key={step.id} className="flex items-center gap-2">
            {index > 0 ? (
              <span className="text-gold" aria-hidden>
                ·
              </span>
            ) : null}
            {step.id === current ? (
              <span className="text-navy">{step.label}</span>
            ) : (
              <Link href={step.href} className="text-teal hover:text-teal-deep">
                {step.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
      {current !== "acceso" ? <NoticeTray /> : null}
    </div>
  );
}
