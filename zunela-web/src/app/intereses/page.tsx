import type { Metadata } from "next";
import { InterestsSetup } from "@/components/interests/InterestsSetup";
import { OrbitalField } from "@/components/welcome/OrbitalField";

export const metadata: Metadata = {
  title: "Intereses y objetivos — ZUNELA",
  description:
    "Elige intereses, lo que buscas, lo que ofreces y tus preferencias de modalidad, alcance y disponibilidad.",
};

export default function InterestsPage() {
  return (
    <main className="relative isolate min-h-dvh overflow-x-hidden bg-cream">
      <OrbitalField />
      <div className="relative mx-auto w-full max-w-6xl px-6 py-6 sm:py-8">
        <InterestsSetup />
      </div>
    </main>
  );
}
