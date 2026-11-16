import type { Metadata } from "next";
import { Suspense } from "react";
import { CommunitySpace } from "@/components/discover/CommunitySpace";
import { OrbitalField } from "@/components/welcome/OrbitalField";
import { findCatalogEntry } from "@/lib/discover";

type CommunityPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: CommunityPageProps): Promise<Metadata> {
  const { id } = await params;
  const entry = findCatalogEntry(id);
  const name = entry?.kind === "comunidad" ? entry.title : "Comunidad";
  return {
    title: `${name} — ZUNELA`,
    description: "Acceso, miembros, publicaciones y chat de una comunidad pública.",
  };
}

export default function CommunityPage({ params }: CommunityPageProps) {
  return (
    <main className="relative isolate min-h-dvh overflow-x-hidden bg-cream">
      <OrbitalField />
      <div className="relative mx-auto w-full max-w-6xl px-6 py-6 pb-12 sm:py-8">
        <Suspense fallback={<div className="h-80" />}>
          <CommunityContent params={params} />
        </Suspense>
      </div>
    </main>
  );
}

async function CommunityContent({ params }: CommunityPageProps) {
  const { id } = await params;
  return <CommunitySpace id={id} />;
}
