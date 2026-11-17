import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Fraunces, Outfit } from "next/font/google";
import { AccountPauseGate } from "@/components/account/AccountPauseGate";
import { TrialSync } from "@/components/account/TrialSync";
import { RemoteSessionSync } from "@/components/auth/RemoteSessionSync";
import { OnboardingGate } from "@/components/journey/OnboardingGate";
import { OfflineBanner } from "@/components/pwa/OfflineBanner";
import { PwaRegister } from "@/components/pwa/PwaRegister";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  applicationName: "ZUNELA",
  title: "ZUNELA — Conecta con tu gente",
  description:
    "Plataforma de afinidades, oportunidades y comunidades. Encuentra aliados compatibles con tus intereses y objetivos.",
  appleWebApp: {
    capable: true,
    title: "ZUNELA",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0b7a76",
  // "only light" evita que Chrome/Android oscurezca la PWA en modo oscuro del sistema
  colorScheme: "only light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${outfit.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <PwaRegister />
        <OfflineBanner />
        <RemoteSessionSync />
        <Suspense fallback={null}>
          <TrialSync />
        </Suspense>
        <Suspense fallback={null}>
          <OnboardingGate>
            <AccountPauseGate>{children}</AccountPauseGate>
          </OnboardingGate>
        </Suspense>
      </body>
    </html>
  );
}
