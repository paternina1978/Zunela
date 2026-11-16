import { hashSecret, readAccess } from "@/lib/access";
import { recordAudit } from "@/lib/admin";
import { recordProductEvent } from "@/lib/product-events";
import { readActivePlan } from "@/lib/account";
import { readAffinity } from "@/lib/affinity";
import { readMatchBook } from "@/lib/matches";
import { readOwnCommunities } from "@/lib/own-communities";
import { readOwnOpportunities } from "@/lib/own-opportunities";
import { readProfile } from "@/lib/profile";
import { reportAttentionStats } from "@/lib/reports";
import { readSession } from "@/lib/session";
import { clearDurableKeys } from "@/lib/storage";

/** Identidad y plan que sobreviven a cerrar la pestaña. */
export const IDENTITY_KEYS = [
  "zunela.access",
  "zunela.role",
  "zunela.account",
  "zunela.profile",
  "zunela.affinity",
];

/** Cuerpos de chat/posts: no van en el respaldo verificable. */
export const CHAT_BODY_KEYS = [
  "zunela.community-chat",
  "zunela.community-posts",
  "zunela.private-chat",
];

/** Estado del piloto local (también durable). La sesión de pestaña queda aparte. */
export const PILOT_KEYS = [
  "zunela.sent-interest",
  "zunela.matches",
  "zunela.community-chat",
  "zunela.community-posts",
  "zunela.community-reports",
  "zunela.report-ledger",
  "zunela.admin-reviewed-meta",
  "zunela.admin-params",
  "zunela.admin-param-versions",
  "zunela.admin-log",
  "zunela.admin-suspended",
  "zunela.admin-reviewed",
  "zunela.private-chat",
  "zunela.private-reports",
  "zunela.contact-requests",
  "zunela.notices",
  "zunela.own-opportunities",
  "zunela.own-communities",
  "zunela.opportunity-applications",
  "zunela.opportunity-copilot",
  "zunela.product-events",
  "zunela.appeals",
  "zunela.ai-consent",
  "zunela.approvals",
  "zunela.agent-holds",
  "zunela.pilot-presence",
  "zunela.install-dismissed",
];

const TAB_SESSION_KEY = "zunela.session";

export type AccountCopy = {
  generado: string;
  correo: string;
  perfil: {
    nombre: string;
    pais: string;
    ciudad: string;
    profesion: string;
    conocimientos: string[];
    presentacion: string;
    foto: boolean;
    nombreLegalGuardado: boolean;
  } | null;
  intereses: string[];
  plan: string;
  conexiones: number;
  solicitudesPendientes: number;
  reportesAbiertos: number;
  oportunidades: { titulo: string; estado: string }[];
  comunidades: { titulo: string; acceso: string; estado: string }[];
  nota: string;
  huella: string;
};

export async function buildAccountCopy(): Promise<AccountCopy> {
  const session = readSession();
  const access = readAccess();
  const profile = readProfile();
  const affinity = readAffinity();
  const matches = readMatchBook();
  const attention = reportAttentionStats();
  const copy = {
    generado: new Date().toISOString(),
    correo: session?.email ?? access?.email ?? "",
    perfil: profile
      ? {
          nombre: profile.visibleName,
          pais: profile.country,
          ciudad: profile.city,
          profesion: profile.profession,
          conocimientos: profile.knowledge,
          presentacion: profile.presentation,
          foto: Boolean(profile.photoDataUrl),
          nombreLegalGuardado: Boolean(profile.legalName.trim()),
        }
      : null,
    intereses: affinity?.interests ?? [],
    plan: readActivePlan(),
    conexiones: matches.accepted.length,
    solicitudesPendientes: matches.incoming.length,
    reportesAbiertos: attention.open,
    oportunidades: readOwnOpportunities().map((item) => ({
      titulo: item.title,
      estado: item.status,
    })),
    comunidades: readOwnCommunities().map((item) => ({
      titulo: item.title,
      acceso: item.access,
      estado: item.status,
    })),
    nota: "Copia local del piloto: perfil, plan y conteos. No incluye mensajes, chats, contraseña ni contactos de otras personas.",
  };
  return { ...copy, huella: await hashSecret(JSON.stringify(copy)) };
}

export function noteAccountCopy() {
  recordProductEvent("Descargó una copia de sus datos.");
}

export function eraseSessionAccount() {
  clearDurableKeys([...IDENTITY_KEYS, ...PILOT_KEYS]);
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(TAB_SESSION_KEY);
  }
  recordAudit("Eliminó la cuenta de este navegador. No queda correo, rol ni mensajes.");
  recordProductEvent("Eliminó la cuenta de esta prueba.");
}
