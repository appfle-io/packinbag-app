import { NextResponse } from "next/server";

// CSP 위반 보고 받기(2026-10-22, _secrets/docs/packinbag_security_review.md SEC-WEB-02).
// next.config.ts의 Content-Security-Policy-Report-Only가 막았을 것을 브라우저가 여기로 알린다(실제로 막지는 않음).
// 저장하지 않고 Vercel 로그에 한 줄만 남긴다(Firestore 비용 없음). 몇 주 모아 정책을 다듬은 뒤 진짜 CSP로 바꾼다.
// 공개 라우트: 브라우저가 로그인 정보 없이 보낸다. 본문은 앞 8KB만 읽는다
const MAX_BODY = 8 * 1024;

type CspReport = Record<string, unknown>;

function pick(r: CspReport, ...keys: string[]): string {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "string" && v) return v.slice(0, 200);
  }
  return "";
}

// 주소의 경로까지만(검색어 · 토큰이 붙은 쿼리는 로그에 남기지 않는다)
function stripQuery(u: string): string {
  try {
    const url = new URL(u);
    return `${url.origin}${url.pathname}`;
  } catch {
    return u.split("?")[0];
  }
}

export async function POST(req: Request) {
  try {
    const text = (await req.text()).slice(0, MAX_BODY);
    const parsed = JSON.parse(text) as unknown;
    // report-uri 형식 { "csp-report": {...} } 과 Reporting API 형식 [{ body: {...} }] 둘 다
    const reports: CspReport[] = Array.isArray(parsed)
      ? parsed.map((x) => ((x as { body?: CspReport }).body ?? {}) as CspReport)
      : [((parsed as { "csp-report"?: CspReport })["csp-report"] ?? {}) as CspReport];
    for (const r of reports.slice(0, 5)) {
      const directive = pick(r, "effective-directive", "effectiveDirective", "violated-directive");
      const blocked = stripQuery(pick(r, "blocked-uri", "blockedURL"));
      const page = stripQuery(pick(r, "document-uri", "documentURL"));
      console.warn(`[CSP] ${directive} blocked=${blocked} page=${page}`);
    }
  } catch {
    // 형식이 이상한 보고는 버린다
  }
  return new NextResponse(null, { status: 204 });
}
