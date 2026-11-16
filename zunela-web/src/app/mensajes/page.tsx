import type { Metadata } from "next";
import { MessageInbox } from "@/components/messages/MessageInbox";
import { OrbitalField } from "@/components/welcome/OrbitalField";

export const metadata: Metadata = {
  title: "Mensajes — ZUNELA",
  description: "Chat privado solo con conexiones aceptadas, con reportes y límite diario.",
};

export default function MessagesPage() {
  return (
    <main className="relative isolate min-h-dvh overflow-x-hidden bg-cream">
      <OrbitalField />
      <div className="relative mx-auto w-full max-w-6xl px-6 py-6 pb-12 sm:py-8">
        <MessageInbox />
      </div>
    </main>
  );
}
