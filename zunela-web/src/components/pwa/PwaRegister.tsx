"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // La instalación sigue disponible con el manifiesto aunque falle el registro.
    });
  }, []);

  return null;
}
