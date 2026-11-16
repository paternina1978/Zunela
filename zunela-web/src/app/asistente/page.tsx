import type { Metadata } from "next";
import { AssistantCenter } from "@/components/assistant/AssistantCenter";
import { OrbitalField } from "@/components/welcome/OrbitalField";

export const metadata: Metadata = {
  title: "Asistente — ZUNELA",
  description: "Centro del asistente. El módulo está apagado y no envía datos a un modelo.",
};

export default function AssistantPage() {
  return (
    <main className="relative isolate min-h-dvh overflow-x-hidden bg-cream">
      <OrbitalField />
      <div className="relative mx-auto w-full max-w-6xl px-6 py-6 pb-12 sm:py-8">
        <AssistantCenter />
      </div>
    </main>
  );
}
