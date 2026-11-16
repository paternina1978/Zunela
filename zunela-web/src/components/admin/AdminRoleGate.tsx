"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  canAccessAdminPanel,
  canManageAiControls,
  isAdmin,
  isModerator,
  refreshRemoteRole,
  roleLabel,
} from "@/lib/roles";

export function AdminRoleGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [aiBlocked, setAiBlocked] = useState(false);

  useEffect(() => {
    void (async () => {
      await refreshRemoteRole();
      const panel = canAccessAdminPanel();
      const needsFullAdmin = pathname.startsWith("/admin/ia") || pathname.startsWith("/admin/agentes");
      setAllowed(panel && (!needsFullAdmin || canManageAiControls()));
      setAiBlocked(panel && needsFullAdmin && !canManageAiControls());
      setReady(true);
    })();
  }, [pathname]);

  if (!ready) {
    return <div className="h-80" />;
  }

  if (!allowed) {
    return (
      <div className="mx-auto max-w-xl rounded-[28px] border border-gold/35 bg-card/95 p-8 shadow-[0_18px_40px_rgba(7,21,31,0.08)]">
        <p className="text-[11px] font-semibold tracking-[0.22em] text-gold uppercase">Administración</p>
        <h1 className="mt-2 font-display text-3xl text-navy">
          {aiBlocked ? "Solo el administrador" : "Se necesita un rol elevado"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          {aiBlocked
            ? "El control de IA y el panel de agentes quedan para el rol administrador. El moderador puede revisar reportes y publicaciones desde Administración."
            : "Tu cuenta es de usuario. En modo local activa el rol en Mi cuenta; con Supabase el rol viene de memberships (sin auto-elevación)."}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/cuenta"
            className="inline-flex h-11 items-center rounded-xl bg-teal px-4 text-sm font-semibold text-white hover:bg-teal-deep"
          >
            Ir a Mi cuenta
          </Link>
          {aiBlocked ? (
            <Link
              href="/admin"
              className="inline-flex h-11 items-center rounded-xl border border-line bg-white px-4 text-sm font-semibold text-navy"
            >
              Ir a administración
            </Link>
          ) : (
            <Link
              href="/descubrir"
              className="inline-flex h-11 items-center rounded-xl border border-line bg-white px-4 text-sm font-semibold text-navy"
            >
              Volver a descubrir
            </Link>
          )}
        </div>
        {isModerator() || isAdmin() ? (
          <p className="mt-4 text-xs text-muted">Rol actual: {roleLabel()}</p>
        ) : null}
      </div>
    );
  }

  return <>{children}</>;
}
