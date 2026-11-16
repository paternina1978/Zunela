"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isRemoteBackendEnabled } from "@/lib/backend-mode";

/**
 * Destino de enlaces Auth (confirmación de correo / recuperación).
 * Intercambia ?code= (PKCE) o deja que detectSessionInUrl lea el hash.
 */
function AuthCallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [message, setMessage] = useState("Validando acceso…");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!isRemoteBackendEnabled()) {
        setMessage("El backend remoto no está activo.");
        return;
      }
      const client = getSupabaseBrowserClient();
      if (!client) {
        setMessage("No se pudo conectar con Auth.");
        return;
      }

      const code = params.get("code");
      if (code) {
        const { error } = await client.auth.exchangeCodeForSession(code);
        if (cancelled) {
          return;
        }
        if (error) {
          setMessage(error.message);
          return;
        }
      } else {
        const {
          data: { session },
        } = await client.auth.getSession();
        if (cancelled) {
          return;
        }
        if (!session) {
          setMessage("No hay sesión en el enlace. Vuelve a ingresar o solicita otro correo.");
          return;
        }
      }

      setMessage("Listo. Continuamos…");
      router.replace("/perfil");
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [params, router]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-cream px-6">
      <p className="max-w-sm text-center text-sm leading-6 text-navy">{message}</p>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center bg-cream px-6">
          <p className="text-sm text-navy">Validando acceso…</p>
        </main>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
