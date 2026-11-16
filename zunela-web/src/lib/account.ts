import { readAdminParams, recordAudit } from "@/lib/admin";
import { recordProductEvent } from "@/lib/product-events";
import { readDurable, writeDurable } from "@/lib/storage";

const ACCOUNT_KEY = "zunela.account";
export const TRIAL_DAYS = 10;

export type AccountSettings = {
  notifications: {
    matches: boolean;
    messages: boolean;
    communities: boolean;
  };
  plan: "gratis" | "prueba";
  trialStartedAt: string | null;
  trialEndedAt: string | null;
  paused: boolean;
};

export const DEFAULT_ACCOUNT: AccountSettings = {
  notifications: {
    matches: true,
    messages: true,
    communities: false,
  },
  plan: "gratis",
  trialStartedAt: null,
  trialEndedAt: null,
  paused: false,
};

export function membershipRows(
  freeMessages: number,
  premiumMessages: number,
  communityQuota: number,
  communityQuotaDays: number,
) {
  return [
    ["Crear una oportunidad propia", "No", "Sí"],
    ["Comunidades públicas", `Hasta ${communityQuota} / ${communityQuotaDays} días`, "Sin cupo fijo"],
    ["Comunidades privadas", "No", "Sí"],
    ["Chat", `${freeMessages} al día`, `${premiumMessages} al día`],
    ["Contacto externo", "No", "Con permiso de las dos partes"],
  ] as const;
}

export function readAccount(): AccountSettings {
  const raw = readDurable(ACCOUNT_KEY);
  if (!raw) {
    return DEFAULT_ACCOUNT;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<AccountSettings>;
    return {
      ...DEFAULT_ACCOUNT,
      ...parsed,
      notifications: {
        ...DEFAULT_ACCOUNT.notifications,
        ...parsed.notifications,
      },
      plan: parsed.plan === "prueba" ? "prueba" : "gratis",
      trialStartedAt: typeof parsed.trialStartedAt === "string" ? parsed.trialStartedAt : null,
      trialEndedAt: typeof parsed.trialEndedAt === "string" ? parsed.trialEndedAt : null,
      paused: parsed.paused === true,
    };
  } catch {
    return DEFAULT_ACCOUNT;
  }
}

export function saveAccount(account: AccountSettings) {
  writeDurable(ACCOUNT_KEY, JSON.stringify(account));
}

export function trialElapsedDay(startedAt: string | null, now = Date.now()) {
  if (!startedAt) {
    return 1;
  }
  const started = new Date(startedAt).getTime();
  if (!Number.isFinite(started)) {
    return 1;
  }
  const elapsed = now - started;
  if (elapsed < 0) {
    return 1;
  }
  return Math.floor(elapsed / 86_400_000) + 1;
}

export function isTrialActive(startedAt: string | null, trialDays: number, now = Date.now()) {
  if (!startedAt || trialDays < 1) {
    return false;
  }
  return trialElapsedDay(startedAt, now) <= trialDays;
}

/** RB-12: si la prueba venció, persiste el plan Gratis. */
export function syncExpiredTrial(now = Date.now()): {
  account: AccountSettings;
  justExpired: boolean;
} {
  const account = readAccount();
  if (account.plan !== "prueba") {
    return { account, justExpired: false };
  }
  if (isTrialActive(account.trialStartedAt, currentPlanLimits().trialDays, now)) {
    return { account, justExpired: false };
  }
  const next: AccountSettings = {
    ...account,
    plan: "gratis",
    trialStartedAt: null,
    trialEndedAt: new Date(now).toISOString(),
  };
  saveAccount(next);
  recordProductEvent("La prueba Premium venció. Volvió a Gratis sin cobro.");
  recordAudit("La prueba Premium venció. La cuenta quedó en Gratis sin cargo automático.");
  return { account: next, justExpired: true };
}

export function startPremiumTrial(now = Date.now()): AccountSettings {
  const next: AccountSettings = {
    ...readAccount(),
    plan: "prueba",
    trialStartedAt: new Date(now).toISOString(),
    trialEndedAt: null,
  };
  saveAccount(next);
  recordProductEvent("Inició la prueba Premium.");
  return next;
}

export function endPremiumTrial(manual = false): AccountSettings {
  const account = readAccount();
  const next: AccountSettings = {
    ...account,
    plan: "gratis",
    trialStartedAt: null,
    trialEndedAt: new Date().toISOString(),
  };
  saveAccount(next);
  if (manual) {
    recordProductEvent("Volvió al plan Gratis.");
  }
  return next;
}

export function readActivePlan(now = Date.now()): "gratis" | "prueba" {
  const account = readAccount();
  if (account.plan !== "prueba") {
    return "gratis";
  }
  return isTrialActive(account.trialStartedAt, currentPlanLimits().trialDays, now) ? "prueba" : "gratis";
}

export function trialDay(startedAt: string | null, total = TRIAL_DAYS, now = Date.now()) {
  return Math.min(total, trialElapsedDay(startedAt, now));
}

export function currentPlanLimits() {
  const params = readAdminParams();
  return {
    dailyMessages: params.dailyMessages,
    premiumDailyMessages: params.premiumDailyMessages,
    communityQuota: params.communityQuota,
    communityQuotaDays: params.communityQuotaDays,
    matchExpiryDays: params.matchExpiryDays,
    trialDays: params.trialDays,
  };
}
