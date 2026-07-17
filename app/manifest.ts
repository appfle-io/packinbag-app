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
      // 안드로이드 크롬 PWA 설치 조건(installability criteria)에는
      // 192x192 사이즈가 필수라서 추가함 (app/icon-192/route.tsx에서 생성).
      {
        src: "/icon-192",
        sizes: "192x192",
        type: "image/png",
      },
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
