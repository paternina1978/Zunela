"use client";

import { useEffect, useState } from "react";
import { canUseBrowserStorage, readDurable, writeDurable } from "@/lib/storage";

const DISMISS_KEY = "zunela.install-dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallPrompt({ compact = false }: { compact?: boolean }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!canUseBrowserStorage()) {
      return;
    }
    setDismissed(readDurable(DISMISS_KEY) === "1");
    setInstalled(isStandalone());

    function onPrompt(event: Event) {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setDeferred(null);
    }

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!deferred) {
      return;
    }
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    if (choice.outcome === "dismissed") {
      writeDurable(DISMISS_KEY, "1");
      setDismissed(true);
    }
  }

  function dismiss() {
    writeDurable(DISMISS_KEY, "1");
    setDismissed(true);
  }

  if (installed) {
    return (
      <p className={compact ? "text-sm leading-6 text-teal-deep" : "mt-3 text-sm leading-6 text-teal-deep"}>
        ZUNELA ya está instalada en este dispositivo.
      </p>
    );
  }

  if (!deferred || dismissed) {
    return compact ? null : (
      <p className="mt-3 text-sm leading-6 text-muted">
        Si el navegador lo permite, aparecerá aquí el botón para instalar la PWA. También puedes usar el
        menú del navegador.
      </p>
    );
  }

  return (
    <div
      className={
        compact
          ? "flex flex-wrap items-center gap-2"
          : "mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-gold/35 bg-cream-deep px-4 py-3"
      }
    >
      <p className="text-sm leading-6 text-navy">Instala ZUNELA para abrirla como app.</p>
      <button
        type="button"
        onClick={() => void install()}
        className="h-10 rounded-xl bg-teal px-3 text-xs font-semibold text-white hover:bg-teal-deep"
      >
        Instalar
      </button>
      <button
        type="button"
        onClick={dismiss}
        className="h-10 rounded-xl border border-line bg-white px-3 text-xs font-semibold text-navy"
      >
        Ahora no
      </button>
    </div>
  );
}

function isStandalone() {
  if (typeof window === "undefined") {
    return false;
  }
  const media = window.matchMedia("(display-mode: standalone)").matches;
  const ios = "standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return media || ios;
}
