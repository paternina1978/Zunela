import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ZUNELA",
    short_name: "ZUNELA",
    description:
      "Conecta con tu gente. Afinidades, oportunidades y comunidades en Colombia, con consentimiento.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f7f3eb",
    theme_color: "#0b7a76",
    lang: "es-CO",
    categories: ["social", "lifestyle"],
    icons: [
      {
        src: "/logo-zunela.png",
        sizes: "1002x795",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
