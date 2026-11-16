import type { Metadata } from "next";
import { Suspense } from "react";
import { MessageThread } from "@/components/messages/MessageThread";
import { OrbitalField } from "@/components/welcome/OrbitalField";
import { findCatalogEntry } from "@/lib/discover";

type MessagePageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: MessagePageProps): Promise<Metadata> {
  const { id } = await params;
  const entry = findCatalogEntry(id);
  const name = entry?.kind === "persona" ? entry.title : "Mensajes";
  return {
    title: `${name} — ZUNELA`,
    description: "Conversación privada sujeta a la conexión, los reportes y el límite diario.",
  };
}

export default function MessagePage({ params }: MessagePageProps) {
  return (
    <main className="relative isolate min-h-dvh overflow-x-hidden bg-cream">
      <OrbitalField />
      <div className="relative mx-auto w-full max-w-6xl px-6 py-6 pb-12 sm:py-8">
        <Suspense fallback={<div className="h-80" />}>
          <MessageContent params={params} />
        </Suspense>
      </div>
    </main>
  );
}

async function MessageContent({ params }: MessagePageProps) {
  const { id } = await params;
  return <MessageThread id={id} />;
}
