import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/changelog";

// 지금 이 서버(=가장 최신으로 배포된 버전)가 어떤 빌드인지 알려주는 엔드포인트.
// 설정 > 버전 정보(components/v2/settings/InfoScreens.tsx)가 열릴 때 한 번 부른다(2026-10-19부터, 예전 10분 폴링은 없앰).
// - buildId: 배포 커밋. 클라이언트가 로딩된 빌드와 다르면 "웹 새 버전"(다시 불러오기)
// - version: 배포된 package.json 버전(표시용)
// - storeVersion: App Store에 올라간 iOS 앱 버전. 설치된 앱보다 높으면 App Store로 보낸다(lib/appUpdate.ts)
//
// force-dynamic + no-store: 이 라우트 자체가 캐시되면 새 배포 뒤에도 예전 buildId를 돌려준다.
// App Store 버전만 이 서버 인스턴스 안에서 1시간 캐시한다(Apple 조회 API를 매번 부르지 않게).
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const APP_STORE_ID = "6793290752";
const STORE_TTL_MS = 60 * 60 * 1000;
let storeCache: { version: string | null; at: number } | null = null;

async function storeVersion(): Promise<string | null> {
  if (storeCache && Date.now() - storeCache.at < STORE_TTL_MS) return storeCache.version;
  try {
    const res = await fetch(`https://itunes.apple.com/lookup?id=${APP_STORE_ID}&country=kr`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as { results?: { version?: unknown }[] };
    const v = data.results?.[0]?.version;
    const version = typeof v === "string" && /^\d+(\.\d+)*$/.test(v) ? v : null;
    storeCache = { version, at: Date.now() };
    return version;
  } catch {
    // 실패는 짧게만 기억(5분 뒤 다시). 모르면 null → 클라이언트는 웹만 비교
    storeCache = { version: storeCache?.version ?? null, at: Date.now() - STORE_TTL_MS + 5 * 60 * 1000 };
    return storeCache.version;
  }
}

export async function GET() {
  const buildId = process.env.VERCEL_GIT_COMMIT_SHA || "dev";
  return NextResponse.json(
    { buildId, version: APP_VERSION, storeVersion: await storeVersion() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
