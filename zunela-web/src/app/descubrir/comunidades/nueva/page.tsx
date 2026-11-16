import type { Metadata } from "next";
import { PublishCommunity } from "@/components/discover/PublishCommunity";
import { OrbitalField } from "@/components/welcome/OrbitalField";

export const metadata: Metadata = {
  title: "Crear comunidad — ZUNELA",
  description: "Crea una comunidad pública, privada o por invitación. Las dos últimas no aparecen en el listado.",
};

export default function PublishCommunityPage() {
  return (
    <main className="relative isolate min-h-dvh overflow-x-hidden bg-cream">
      <OrbitalField />
      <div className="relative mx-auto w-full max-w-6xl px-6 py-6 pb-12 sm:py-8">
        <PublishCommunity />
      </div>
    </main>
  );
}
