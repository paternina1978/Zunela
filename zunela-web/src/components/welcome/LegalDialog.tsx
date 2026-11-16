"use client";

import { useEffect } from "react";

export type LegalTopic = "terminos" | "privacidad";

const CONTENT: Record<
  LegalTopic,
  { title: string; paragraphs: string[] }
> = {
  terminos: {
    title: "Términos de uso",
    paragraphs: [
      "ZUNELA es una plataforma de afinidades, oportunidades y comunidades. El registro implica aceptar estas reglas de uso mientras el producto esté en prueba.",
      "Puedes descubrir perfiles, oportunidades y comunidades públicas. Una conversación privada solo se abre cuando ambas personas expresan interés o aceptan la solicitud.",
      "El plan gratuito permite participar en oportunidades existentes y crear comunidades públicas dentro de un cupo. Crear oportunidades propias y comunidades privadas será una función Premium.",
      "Queda prohibido el fraude, la suplantación, el spam y las promesas engañosas. ZUNELA podrá suspender cuentas que incumplan estas normas.",
    ],
  },
  privacidad: {
    title: "Política de privacidad",
    paragraphs: [
      "Pedimos solo los datos necesarios para el servicio. El nombre legal se protege; el nombre visible, la foto y la ciudad se controlan desde tu perfil.",
      "Teléfono, correo y redes no se muestran a otras personas por defecto. Compartir un contacto exigirá tu permiso explícito y podrá revocarse.",
      "Puedes corregir tu información, retirar el consentimiento, desactivar la cuenta o solicitar su eliminación.",
      "Este texto es una base de trabajo para el piloto en Colombia. Las condiciones definitivas se revisarán antes de un lanzamiento comercial.",
    ],
  },
};

type LegalDialogProps = {
  topic: LegalTopic | null;
  onClose: () => void;
};

export function LegalDialog({ topic, onClose }: LegalDialogProps) {
  useEffect(() => {
    if (!topic) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [topic, onClose]);

  if (!topic) {
    return null;
  }

  const content = CONTENT[topic];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Cerrar documento"
        className="absolute inset-0 bg-navy/45"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-title"
        className="relative max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-card p-6 shadow-2xl"
      >
        <p className="text-[11px] font-semibold tracking-[0.22em] text-gold uppercase">
          ZUNELA
        </p>
        <h2 id="legal-title" className="mt-2 font-display text-2xl text-navy">
          {content.title}
        </h2>
        <div className="mt-4 space-y-3 text-sm leading-6 text-muted">
          {content.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 h-11 w-full rounded-xl bg-navy text-sm font-semibold text-cream transition-colors hover:bg-navy-soft"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
