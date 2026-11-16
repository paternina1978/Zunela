import { AuthCard } from "@/components/welcome/AuthCard";
import { BrandPanel } from "@/components/welcome/BrandPanel";
import { OrbitalField } from "@/components/welcome/OrbitalField";

export default function HomePage() {
  return (
    <main className="relative isolate min-h-dvh overflow-x-hidden bg-cream">
      <OrbitalField />

      <div className="relative mx-auto grid min-h-dvh w-full max-w-6xl lg:grid-cols-[1.15fr_0.85fr]">
        <BrandPanel />
        <AuthCard />
      </div>

      <p className="relative px-6 pb-8 text-center text-xs text-muted">
        ZUNELA · Conecta con tu gente · Piloto Colombia · PWA instalable
      </p>
    </main>
  );
}
