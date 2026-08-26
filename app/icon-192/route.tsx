// 안드로이드 크롬 PWA 설치 조건(installability criteria)은 manifest.icons에
// 192x192 사이즈가 최소 하나 있어야 만족된다. (기존 app/icon.tsx는 512 고정이라
// 이 조건을 못 채움 -> 별도 Route Handler로 192 사이즈를 추가로 생성)
//
// app/icon.tsx, app/apple-icon.tsx와 완전히 같은 방식(ImageResponse)을 쓰지만,
// Next.js가 "icon.tsx"라는 정확한 파일명만 특수 아이콘 라우트로 인식하기 때문에
// 임의 이름(icon-192)은 이렇게 명시적 Route Handler로 만들어야 실제 URL이 생긴다.
// 디자인은 icon.tsx와 동일, 사이즈만 192로 축소.
import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

export const dynamic = "force-static";

export async function GET() {
  const filePath = path.join(process.cwd(), "public", "icon-192.png");
  if (fs.existsSync(filePath)) {
    const fileBuffer = fs.readFileSync(filePath);
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }
  return new NextResponse(null, { status: 404 });
}
