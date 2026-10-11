import { NextRequest, NextResponse } from "next/server";
import { verifyDeviceRequest, DeviceAuthError, attachPushToken, detachPushToken, parseDevicePush } from "@/lib/nativeDeviceServer";

// iOS 푸시(APNs) 토큰을 이 기기의 기기 토큰 문서에 붙인다(lib/nativeDeviceServer.ts, 2026-10-11).
// 네이티브(AppDelegate PIBPush)가 "Authorization: Device <토큰>"으로 부른다. 웹은 부르지 않는다.
// POST { token, env: "sandbox" | "production", alerts } : 붙이기(바뀌었을 때만 옴)
// DELETE : 떼기(지금은 쓰지 않음 - 로그아웃은 기기 토큰째 지운다)
export const runtime = "nodejs";

async function auth(req: NextRequest): Promise<NextResponse | null> {
  try {
    await verifyDeviceRequest(req);
    return null;
  } catch (err) {
    const e = err instanceof DeviceAuthError ? err : new DeviceAuthError("다시 로그인해 주세요");
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
}

export async function POST(req: NextRequest) {
  const denied = await auth(req);
  if (denied) return denied;
  const push = parseDevicePush(await req.json().catch(() => null));
  if (!push) return NextResponse.json({ error: "푸시 토큰 형식이 올바르지 않아요" }, { status: 400 });
  try {
    await attachPushToken(req, push);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[팩인백] 푸시 토큰 저장 실패:", err);
    return NextResponse.json({ error: "잠시 후 다시 시도해 주세요" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const denied = await auth(req);
  if (denied) return denied;
  try {
    await detachPushToken(req);
  } catch (err) {
    console.error("[팩인백] 푸시 토큰 삭제 실패:", err);
  }
  return NextResponse.json({ ok: true });
}
