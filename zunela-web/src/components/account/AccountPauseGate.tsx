"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { readAccount } from "@/lib/account";

export function AccountPauseGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    setPaused(readAccount().paused);
  }, [pathname]);

  const allowed = pathname === "/" || pathname.startsWith("/cuenta");
  const blocked = paused && !allowed;

  return (
    <>
      <div inert={blocked ? true : undefined} aria-hidden={blocked || undefined}>
        {children}
      </div>
      {blocked ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-cream/95 px-6">
          <div className="w-full max-w-md rounded-[28px] border border-gold/40 bg-card p-6 shadow-[0_18px_40px_rgba(7,21,31,0.08)]">
            <h1 className="font-display text-3xl text-navy">La cuenta está en pausa</h1>
            <p className="mt-3 text-sm leading-6 text-muted">
              Descubrir, mensajes y publicaciones quedan bloqueados. Tus datos siguen en este
              navegador. Reactívala desde Mi cuenta o elimina la cuenta si ya no la quieres.
            </p>
            <Link
              href="/cuenta"
              className="mt-5 inline-flex h-11 items-center rounded-xl bg-teal px-4 text-sm font-semibold text-white hover:bg-teal-deep"
            >
              Ir a Mi cuenta
            </Link>
          </div>
        </div>
      ) : null}
    </>
  );
}
