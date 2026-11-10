import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MESCE • Gestão pastoral",
    short_name: "MESCE",
    description: "Escalas e organização do ministério",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f7f3",
    theme_color: "#164d3f",
    lang: "pt-BR",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
