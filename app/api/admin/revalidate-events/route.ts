import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireMasterUser, AdminForbiddenError, ServerAuthError } from "@/lib/adminApiAuth";

export const runtime = "nodejs";

// 마스터 전용(2026-10-20, events.md EVT-WEB-07). 관리자에서 이벤트를 저장 · 지우면 공개 페이지 캐시를 바로 버린다.
// 예전에는 /about(5분) · /about/events/{주소}(1분) 캐시가 끝날 때까지 예전 제목 · 주소가 보였다.
// body: { keys: string[] } — 그 이벤트의 slug · 문서 id(예전 slug 포함)
export async function POST(req: NextRequest) {
  try {
    await requireMasterUser(req);
  } catch (err) {
    if (err instanceof AdminForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err instanceof ServerAuthError) return NextResponse.json({ error: err.message }, { status: 401 });
    return NextResponse.json({ error: "로그인 정보를 확인할 수 없어요" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { keys?: unknown };
  const keys = Array.isArray(body.keys)
    ? body.keys.filter((k): k is string => typeof k === "string" && /^[A-Za-z0-9-]{1,100}$/.test(k)).slice(0, 10)
    : [];

  revalidatePath("/about");
  for (const k of keys) revalidatePath(`/about/events/${k}`);
  return NextResponse.json({ ok: true, keys });
}
