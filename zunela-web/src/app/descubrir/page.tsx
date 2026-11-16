import type { Metadata } from "next";
import { DiscoverBoard } from "@/components/discover/DiscoverBoard";
import { OrbitalField } from "@/components/welcome/OrbitalField";

export const metadata: Metadata = {
  title: "Descubrir — ZUNELA",
  description:
    "Explora personas, oportunidades del catálogo y comunidades públicas, con la razón de cada coincidencia.",
};

export default function DiscoverPage() {
  return (
    <main className="relative isolate min-h-dvh overflow-x-hidden bg-cream">
      <OrbitalField />
      <div className="relative mx-auto w-full max-w-6xl px-6 py-6 pb-12 sm:py-8">
        <DiscoverBoard />
      </div>
    </main>
  );
}
