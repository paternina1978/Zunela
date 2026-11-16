import type { Metadata } from "next";
import { OpportunityCopilot } from "@/components/assistant/OpportunityCopilot";
import { OrbitalField } from "@/components/welcome/OrbitalField";

export const metadata: Metadata = {
  title: "Copiloto de oportunidad — ZUNELA",
  description: "Borrador de una oportunidad propia. Se revisan las reglas y solo pasa con tu confirmación.",
};

export default function OpportunityCopilotPage() {
  return (
    <main className="relative isolate min-h-dvh overflow-x-hidden bg-cream">
      <OrbitalField />
      <div className="relative mx-auto w-full max-w-6xl px-6 py-6 pb-12 sm:py-8">
        <OpportunityCopilot />
      </div>
    </main>
  );
}
