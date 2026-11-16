import type { Metadata } from "next";
import { AiControl } from "@/components/admin/AiControl";
import { OrbitalField } from "@/components/welcome/OrbitalField";

export const metadata: Metadata = {
  title: "Control de IA — ZUNELA",
  description: "Consumo en cero, límites de prueba y permisos con el módulo apagado.",
};

export default function AiControlPage() {
  return (
    <main className="relative isolate min-h-dvh overflow-x-hidden bg-cream">
      <OrbitalField />
      <div className="relative mx-auto w-full max-w-6xl px-6 py-6 pb-12 sm:py-8">
        <AiControl />
      </div>
    </main>
  );
}
