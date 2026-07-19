// 안드로이드 크롬 PWA 설치 조건(installability criteria)은 manifest.icons에
// 192x192 사이즈가 최소 하나 있어야 만족된다. (기존 app/icon.tsx는 512 고정이라
// 이 조건을 못 채움 -> 별도 Route Handler로 192 사이즈를 추가로 생성)
//
// app/icon.tsx, app/apple-icon.tsx와 완전히 같은 방식(ImageResponse)을 쓰지만,
// Next.js가 "icon.tsx"라는 정확한 파일명만 특수 아이콘 라우트로 인식하기 때문에
// 임의 이름(icon-192)은 이렇게 명시적 Route Handler로 만들어야 실제 URL이 생긴다.
// 디자인은 icon.tsx와 동일, 사이즈만 192로 축소.
import { ImageResponse } from "next/og";

export const contentType = "image/png";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2563eb",
          borderRadius: 36, // 512 버전의 96px을 192 비율(0.375)로 축소
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width={135} // 512 버전의 360px을 192 비율로 축소
          height={135}
          fill="none"
          stroke="#ffffff"
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 18v-6a6 6 0 0 1 6 -6h2a6 6 0 0 1 6 6v6a3 3 0 0 1 -3 3h-8a3 3 0 0 1 -3 -3" />
          <path d="M10 6v-1a2 2 0 1 1 4 0v1" />
          <path d="M9 21v-4a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v4" />
        </svg>
      </div>
    ),
    { width: 192, height: 192 }
  );
}
