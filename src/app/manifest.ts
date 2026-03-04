import type { MetadataRoute } from "next";
import { getConfiguredAppOrigin } from "@/lib/app-origin";

export default function manifest(): MetadataRoute.Manifest {
  const appOrigin = getConfiguredAppOrigin();

  return {
    id: `${appOrigin}/home`,
    name: "ODG HRM",
    short_name: "HRM",
    description: "ລະບົບບໍລິຫານຊັບພະຍາກອນມະນຸດ ສຳລັບ ODG Group",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#eef4fb",
    theme_color: "#21487a",
    lang: "lo",
    categories: ["business", "productivity"],
    prefer_related_applications: false,
    icons: [
      {
        src: "/pwa-icon?size=192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-icon?size=512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-icon?size=512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
