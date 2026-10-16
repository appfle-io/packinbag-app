// 우리 서비스의 짧은 URL(/s/…) · 커스텀 URL(/c/…)인지 판단한다. 서버 라우트와 화면이 같이 쓴다.
// - 서버(2026-10-16, api.md 확인 필요 6): 짧은 URL을 또 줄이면 리다이렉트가 돌고 돌 수 있어 막는다.
//   예전에는 주소 끝 모양만 봐서 다른 사이트 주소(예: example.com/s/abc)도 막혔다 → 우리 도메인일 때만.
// - 화면(2026-10-16, api.md 확인 필요 13): parseShortLinkUrl(lib/shortLinkService.ts)이 같은 기준으로
//   우리 링크만 골라 표시 이름을 조회하고 "짧은 URL로 변경" 메뉴를 숨긴다.
// 우리 도메인 = 지금 접속한(요청이 들어온) 도메인 · 짧은 URL 도메인 · 앱 도메인
//   짧은 URL 도메인: NEXT_PUBLIC_SHORT_URL_BASE_URL → (서버만) SHORT_URL_BASE_URL → 기본 short.seeuson.com
//   앱 도메인: NEXT_PUBLIC_APP_URL · packinbag.seeuson.com

export const DEFAULT_SHORT_URL_BASE_URL = "https://short.seeuson.com";
const DEFAULT_APP_URL = "https://packinbag.seeuson.com";

const SHORT_PATH = /^\/(s|c)\/([^/\s]+)\/?$/;

function hostOf(value: string | undefined | null): string | null {
  if (!value) return null;
  try {
    return new URL(value.trim()).host.toLowerCase();
  } catch {
    return null;
  }
}

// NEXT_PUBLIC_*는 빌드할 때 화면 코드에 박힌다(이름을 그대로 적어야 Next가 바꿔 넣는다).
// SHORT_URL_BASE_URL은 서버에만 있고 화면에서는 undefined.
export function ownShortLinkHosts(currentOrigin?: string | null): Set<string> {
  return new Set(
    [
      currentOrigin,
      process.env.NEXT_PUBLIC_SHORT_URL_BASE_URL,
      process.env.SHORT_URL_BASE_URL,
      DEFAULT_SHORT_URL_BASE_URL,
      process.env.NEXT_PUBLIC_APP_URL,
      DEFAULT_APP_URL,
    ]
      .map((v) => hostOf(v))
      .filter((h): h is string => !!h),
  );
}

// 우리 링크면 종류와 코드(한글 코드는 풀어서)를, 아니면 null.
// 주소 뒤 ?·#이 붙은 것은 우리 링크로 보지 않는다(화면이 만드는 짧은 URL에는 붙지 않음, 예전 판단과 같음).
// hosts를 따로 받는 것은 테스트하기 쉽게.
export function parseOwnShortLink(url: string, hosts: Set<string>): { kind: "s" | "c"; code: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (!hosts.has(parsed.host.toLowerCase())) return null;
  if (parsed.search || parsed.hash) return null;
  const match = parsed.pathname.match(SHORT_PATH);
  if (!match) return null;
  let code = match[2];
  try {
    code = decodeURIComponent(code);
  } catch {
    return null;
  }
  return { kind: match[1] as "s" | "c", code };
}

// 서버 라우트용: 축약 금지 판단. 서버는 ?·#이 붙어도 우리 짧은 URL 경로면 막는다(리다이렉트 고리 방지).
// 라우트는 ownShortLinkHosts(req.nextUrl.origin)를 넘긴다.
export function isOwnShortLink(url: string, hosts: Set<string>): boolean {
  try {
    const parsed = new URL(url);
    return hosts.has(parsed.host.toLowerCase()) && SHORT_PATH.test(parsed.pathname);
  } catch {
    return false;
  }
}
