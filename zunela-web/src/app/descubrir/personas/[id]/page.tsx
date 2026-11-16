import type { Metadata } from "next";
import { Suspense } from "react";
import { PublicPerson } from "@/components/discover/PublicPerson";
import { OrbitalField } from "@/components/welcome/OrbitalField";
import { findCatalogEntry } from "@/lib/discover";
import { isSelfPersonId } from "@/lib/self-profile";

type PersonPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PersonPageProps): Promise<Metadata> {
  const { id } = await params;
  if (isSelfPersonId(id)) {
    return {
      title: "Tu ficha — ZUNELA",
      description: "Vista piloto de cómo te verían otras personas según tu perfil e intereses.",
    };
  }
  const entry = findCatalogEntry(id);
  const name = entry?.kind === "persona" ? entry.title : "Perfil";
  return {
    title: `${name} — ZUNELA`,
    description: "Información autorizada del perfil y botón para expresar interés.",
  };
}

export default function PersonPage({ params }: PersonPageProps) {
  return (
    <main className="relative isolate min-h-dvh overflow-x-hidden bg-cream">
      <OrbitalField />
      <div className="relative mx-auto w-full max-w-6xl px-6 py-6 pb-12 sm:py-8">
        <Suspense fallback={<div className="h-80" />}>
          <PersonContent params={params} />
        </Suspense>
      </div>
    </main>
  );
}

async function PersonContent({ params }: PersonPageProps) {
  const { id } = await params;
  return <PublicPerson id={id} />;
}
