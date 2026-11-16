"use client";

import { useEffect, useState } from "react";

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    function sync() {
      setOffline(!navigator.onLine);
    }
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!offline) {
    return null;
  }

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-gold/40 bg-navy px-4 py-3 text-center text-sm text-cream shadow-[0_-12px_30px_rgba(7,21,31,0.2)]"
    >
      Sin conexión. Puedes revisar lo ya cargado y usar respaldo local; los envíos y cambios nuevos
      esperan red.
    </div>
  );
}
