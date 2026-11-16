"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { syncExpiredTrial } from "@/lib/account";
import { recordNotice } from "@/lib/notices";
import { touchPilotPresenceAsync } from "@/lib/pilot-presence";
import { readSession } from "@/lib/session";

/** Persiste RB-12: prueba vencida → Gratis, sin depender de un botón. */
export function TrialSync() {
  const pathname = usePathname();

  useEffect(() => {
    if (readSession()) {
      void touchPilotPresenceAsync();
    }
    const { justExpired } = syncExpiredTrial();
    if (justExpired) {
      recordNotice(
        "cuenta",
        "La prueba Premium terminó. Volviste a Gratis sin cobro.",
        "trial-expired",
      );
    }
  }, [pathname]);

  return null;
}
