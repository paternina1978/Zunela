"use client";

import { useEffect } from "react";
import {
  refreshRemoteAdminParams,
  refreshRemoteAudit,
  refreshRemoteSuspendedIds,
} from "@/lib/admin";
import { refreshRemoteCatalogs } from "@/lib/catalog";
import { refreshRemoteMatchCache } from "@/lib/matches";
import {
  remoteCurrentUser,
  remoteIdentityAvailable,
} from "@/lib/remote/identity";
import { clearRemoteAuditCache } from "@/lib/remote/audit";
import { clearRemoteCatalogCache } from "@/lib/remote/catalog-options";
import { clearRemoteProductEventCache } from "@/lib/remote/events";
import { clearRemotePresenceCache } from "@/lib/remote/presence";
import { clearRemoteRoleCache } from "@/lib/remote/roles";
import { clearRemoteNoticeCache } from "@/lib/remote/notices";
import { clearRemoteSettingsCache } from "@/lib/remote/settings";
import { clearRemoteSuspendedCache } from "@/lib/remote/suspensions";
import { refreshRemoteNotices } from "@/lib/notices";
import { touchPilotPresenceAsync } from "@/lib/pilot-presence";
import { refreshRemoteProductEvents } from "@/lib/product-events";
import { refreshRemoteRole } from "@/lib/roles";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { clearSession, saveSession } from "@/lib/session";

const SIGNED_OUT_KEY = "zunela.signed-out";

/** Si Supabase está activo, alinea la sesión de pestaña con Auth. */
export function RemoteSessionSync() {
  useEffect(() => {
    if (!remoteIdentityAvailable()) {
      return;
    }
    const client = getSupabaseBrowserClient();
    if (!client) {
      return;
    }

    async function hydrate() {
      if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(SIGNED_OUT_KEY) === "1") {
        return;
      }
      const user = await remoteCurrentUser();
      if (user) {
        saveSession(user);
        await Promise.all([
          refreshRemoteMatchCache(),
          refreshRemoteRole(),
          refreshRemoteNotices(),
          refreshRemoteAdminParams(),
          refreshRemoteProductEvents(),
          refreshRemoteAudit(),
          refreshRemoteSuspendedIds(),
          refreshRemoteCatalogs(),
          touchPilotPresenceAsync(),
        ]);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("zunela-session"));
          window.dispatchEvent(new Event("zunela-role"));
          window.dispatchEvent(new Event("zunela-notices"));
        }
      }
    }

    void hydrate();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        clearSession();
        clearRemoteRoleCache();
        clearRemoteNoticeCache();
        clearRemoteSettingsCache();
        clearRemoteProductEventCache();
        clearRemoteAuditCache();
        clearRemoteSuspendedCache();
        clearRemoteCatalogCache();
        clearRemotePresenceCache();
        return;
      }
      if (
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED" ||
        event === "INITIAL_SESSION"
      ) {
        void hydrate();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return null;
}
