"use client";

import { useEffect, useState } from "react";

export function useOnline() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    function sync() {
      setOnline(navigator.onLine);
    }
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return online;
}

export function offlineWriteMessage() {
  return "Sin conexión: espera red para guardar este cambio. Lectura y respaldo local siguen disponibles.";
}

/** Tras montar, desplaza a un ancla (#visibilidad, #avisos, …). */
export function useHashScroll(ready: boolean) {
  useEffect(() => {
    if (!ready || typeof window === "undefined") {
      return;
    }
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) {
      return;
    }
    const target = document.getElementById(hash);
    if (!target) {
      return;
    }
    window.requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [ready]);
}
