import type { MetadataRoute } from "next";
import { BRAND_ICON_BG } from "@/lib/brandColor";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "팩인백 - Pack In Bag",
    short_name: "팩인백",
    description: "함께 짐을 싸는 체크리스트, 팩인백",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: BRAND_ICON_BG,
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
