const CONSENT_KEY = "zunela.ai-consent";

export const ASSISTANT_TASKS = [
  {
    id: "perfil",
    title: "Mejorar perfil",
    detail: "Ordenar presentación, intereses y objetivos.",
    href: "/perfil",
  },
  {
    id: "colaboradores",
    title: "Encontrar colaboradores",
    detail: "Revisar personas afines que ya puedes ver.",
    href: "/descubrir",
  },
  {
    id: "oportunidad",
    title: "Crear oportunidad",
    detail: "Abrir el formulario de una oportunidad propia.",
    href: "/descubrir/oportunidades/nueva",
  },
  {
    id: "mensaje",
    title: "Preparar mensaje",
    detail: "Ir al chat que solo se abre con una conexión.",
    href: "/mensajes",
  },
  {
    id: "comunidad",
    title: "Organizar comunidad",
    detail: "Abrir la creación de una comunidad.",
    href: "/descubrir/comunidades/nueva",
  },
] as const;

export type AssistantTaskId = (typeof ASSISTANT_TASKS)[number]["id"];

export function readAiConsent() {
  if (typeof sessionStorage === "undefined") {
    return false;
  }
  return sessionStorage.getItem(CONSENT_KEY) === "si";
}

export function saveAiConsent(allowed: boolean) {
  sessionStorage.setItem(CONSENT_KEY, allowed ? "si" : "no");
}
