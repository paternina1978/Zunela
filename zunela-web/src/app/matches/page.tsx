import type { Metadata } from "next";
import { MatchBoard } from "@/components/matches/MatchBoard";
import { OrbitalField } from "@/components/welcome/OrbitalField";

export const metadata: Metadata = {
  title: "Mis conexiones — ZUNELA",
  description: "Solicitudes enviadas, solicitudes recibidas y conexiones aceptadas por las dos personas.",
};

export default function MatchesPage() {
  return (
    <main className="relative isolate min-h-dvh overflow-x-hidden bg-cream">
      <OrbitalField />
      <div className="relative mx-auto w-full max-w-6xl px-6 py-6 pb-12 sm:py-8">
        <MatchBoard />
      </div>
    </main>
  );
}
