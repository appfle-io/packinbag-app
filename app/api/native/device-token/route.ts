import { NextRequest, NextResponse } from "next/server";
import { verifyRequestUser, ServerAuthError } from "@/lib/premiumServer";
import { issueDeviceToken, revokeDeviceToken } from "@/lib/nativeDeviceServer";

// iOS 네이티브(위젯 · 단축어 · 실시간 현황)용 기기 토큰(lib/nativeDeviceServer.ts).
// POST: 로그인한 앱(Firebase 토큰)이 새 토큰을 받는다. DELETE: "Device <토큰>"으로 그 토큰을 지운다(로그아웃)
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let uid: string;
  try {
    uid = (await verifyRequestUser(req)).uid;
  } catch (err) {
    const message = err instanceof ServerAuthError ? err.message : "로그인 정보를 확인할 수 없어요";
    return NextResponse.json({ error: message }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { platform?: unknown };
  try {
    const token = await issueDeviceToken(uid, typeof body.platform === "string" ? body.platform : "ios");
    return NextResponse.json({ token });
  } catch (err) {
    console.error("[팩인백] 기기 토큰 발급 실패:", err);
    return NextResponse.json({ error: "잠시 후 다시 시도해 주세요" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await revokeDeviceToken(req);
  } catch (err) {
    console.error("[팩인백] 기기 토큰 삭제 실패:", err);
  }
  return NextResponse.json({ ok: true });
}
