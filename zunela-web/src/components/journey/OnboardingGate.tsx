"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { nextOnboardingPath, onboardingMessage } from "@/lib/onboarding";

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    const next = nextOnboardingPath(pathname);
    setTarget(next);
    if (next && next !== pathname) {
      router.replace(next);
    }
  }, [pathname, router]);

  const blocked = Boolean(target && target !== pathname);

  return (
    <>
      <div inert={blocked ? true : undefined} aria-hidden={blocked || undefined}>
        {children}
      </div>
      {blocked && target ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-cream/95 px-6">
          <div className="w-full max-w-md rounded-[28px] border border-gold/40 bg-card p-6 shadow-[0_18px_40px_rgba(7,21,31,0.08)]">
            <h1 className="font-display text-3xl text-navy">Completa el recorrido</h1>
            <p className="mt-3 text-sm leading-6 text-muted">{onboardingMessage(target)}</p>
            <Link
              href={target}
              className="mt-5 inline-flex h-11 items-center rounded-xl bg-teal px-4 text-sm font-semibold text-white hover:bg-teal-deep"
            >
              Continuar
            </Link>
          </div>
        </div>
      ) : null}
    </>
  );
}
