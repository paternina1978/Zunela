import type { Metadata } from "next";
import { AdminBoard } from "@/components/admin/AdminBoard";
import { OrbitalField } from "@/components/welcome/OrbitalField";

export const metadata: Metadata = {
  title: "Administración — ZUNELA",
  description: "Usuarios, catálogos, reportes y parámetros de la prueba.",
};

export default function AdminPage() {
  return (
    <main className="relative isolate min-h-dvh overflow-x-hidden bg-cream">
      <OrbitalField />
      <div className="relative mx-auto w-full max-w-6xl px-6 py-6 pb-12 sm:py-8">
        <AdminBoard />
      </div>
    </main>
  );
}
