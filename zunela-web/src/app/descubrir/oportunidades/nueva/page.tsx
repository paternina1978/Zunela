import type { Metadata } from "next";
import { PublishOpportunity } from "@/components/discover/PublishOpportunity";
import { OrbitalField } from "@/components/welcome/OrbitalField";

export const metadata: Metadata = {
  title: "Publicar oportunidad — ZUNELA",
  description: "Publica una oportunidad propia durante la prueba Premium. Queda en revisión.",
};

export default function PublishOpportunityPage() {
  return (
    <main className="relative isolate min-h-dvh overflow-x-hidden bg-cream">
      <OrbitalField />
      <div className="relative mx-auto w-full max-w-6xl px-6 py-6 pb-12 sm:py-8">
        <PublishOpportunity />
      </div>
    </main>
  );
}
