import type { Metadata } from "next";
import { ProfileSetup } from "@/components/profile/ProfileSetup";
import { OrbitalField } from "@/components/welcome/OrbitalField";

export const metadata: Metadata = {
  title: "Tu perfil — ZUNELA",
  description:
    "Configura tu nombre visible, foto, ciudad, profesión y qué información se muestra antes de una conexión.",
};

export default function ProfilePage() {
  return (
    <main className="relative isolate min-h-dvh overflow-x-hidden bg-cream">
      <OrbitalField />
      <div className="relative mx-auto w-full max-w-6xl px-6 py-6 sm:py-8">
        <ProfileSetup />
      </div>
    </main>
  );
}
