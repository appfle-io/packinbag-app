import { NextResponse } from "next/server";

// 지금 이 서버(=가장 최신으로 배포된 버전)가 어떤 빌드인지 알려주는 엔드포인트.
// 클라이언트(lib/useNewVersionAvailable.ts)는 자기가 로딩된 시점의 빌드 식별자와 이 값을
// 주기적으로 비교해서, 다르면 "새 배포가 있다"고 판단해 알림벨에 새로고침 안내를 띄운다.
//
// force-dynamic + no-store: 이 라우트 자체가 캐시되면(Vercel CDN이든 브라우저든) 새 배포
// 이후에도 예전 값을 계속 돌려주게 되어 무용지물이 된다 - 매 요청마다 지금 실행 중인
// 서버 함수(=최신 배포)의 값을 새로 읽도록 강제한다.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const buildId = process.env.VERCEL_GIT_COMMIT_SHA || "dev";
  return NextResponse.json(
    { buildId },
    { headers: { "Cache-Control": "no-store" } }
  );
}
