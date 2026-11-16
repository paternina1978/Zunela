import type { Metadata } from "next";
import { AgentPanel } from "@/components/admin/AgentPanel";
import { OrbitalField } from "@/components/welcome/OrbitalField";

export const metadata: Metadata = {
  title: "Panel de agentes — ZUNELA",
  description: "Catálogo de agentes apagado, casos de revisión humana y cola vacía.",
};

export default function AgentPanelPage() {
  return (
    <main className="relative isolate min-h-dvh overflow-x-hidden bg-cream">
      <OrbitalField />
      <div className="relative mx-auto w-full max-w-6xl px-6 py-6 pb-12 sm:py-8">
        <AgentPanel />
      </div>
    </main>
  );
}
