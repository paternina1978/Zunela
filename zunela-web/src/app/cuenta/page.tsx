import type { Metadata } from "next";
import { AccountBoard } from "@/components/account/AccountBoard";
import { OrbitalField } from "@/components/welcome/OrbitalField";

export const metadata: Metadata = {
  title: "Mi cuenta — ZUNELA",
  description: "Notificaciones, privacidad, seguridad y membresía de tu cuenta.",
};

export default function AccountPage() {
  return (
    <main className="relative isolate min-h-dvh overflow-x-hidden bg-cream">
      <OrbitalField />
      <div className="relative mx-auto w-full max-w-6xl px-6 py-6 pb-12 sm:py-8">
        <AccountBoard />
      </div>
    </main>
  );
}
