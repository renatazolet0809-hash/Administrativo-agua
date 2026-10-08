import type { MetadataRoute } from "next";
import { getSettings } from "@/lib/settings";

/**
 * Manifest PWA — permite instalar el sistema como app (y generar el APK
 * del proyecto con PWABuilder / Bubblewrap como TWA).
 * El nombre se toma de la configuración del sistema (Configuración → Personalización).
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  let name = "AguaGestión";
  try {
    const s = await getSettings();
    if (s.systemName?.trim()) name = s.systemName.trim();
  } catch {
    // BD no disponible en build: usa el nombre por defecto
  }

  return {
    name,
    short_name: name.split(" ")[0] || name,
    description: "Control y despacho de agua embotellada 5L–20L con seguimiento GPS",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f0fdfa",
    theme_color: "#0d9488",
    lang: "es",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
