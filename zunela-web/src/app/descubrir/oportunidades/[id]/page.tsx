import type { Metadata } from "next";
import { Suspense } from "react";
import { OpportunityDetail } from "@/components/discover/OpportunityDetail";
import { OrbitalField } from "@/components/welcome/OrbitalField";
import { findCatalogEntry } from "@/lib/discover";

type OpportunityPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: OpportunityPageProps): Promise<Metadata> {
  const { id } = await params;
  const entry = findCatalogEntry(id);
  const name = entry?.kind === "oportunidad" ? entry.title : "Oportunidad";
  return {
    title: `${name} — ZUNELA`,
    description: "Categoría, objetivo, organizador, reglas y participación de una oportunidad del catálogo.",
  };
}

export default function OpportunityPage({ params }: OpportunityPageProps) {
  return (
    <main className="relative isolate min-h-dvh overflow-x-hidden bg-cream">
      <OrbitalField />
      <div className="relative mx-auto w-full max-w-6xl px-6 py-6 pb-12 sm:py-8">
        <Suspense fallback={<div className="h-80" />}>
          <OpportunityContent params={params} />
        </Suspense>
      </div>
    </main>
  );
}

async function OpportunityContent({ params }: OpportunityPageProps) {
  const { id } = await params;
  return <OpportunityDetail id={id} />;
}
