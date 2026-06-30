import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Oyi Facility",
    short_name: "Facility",
    description: "Facility OS command center for estates, infrastructure and operational intelligence.",
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#09090b",
    orientation: "portrait",
    icons: [
      {
        src: "/oyi-logo-transparent.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
