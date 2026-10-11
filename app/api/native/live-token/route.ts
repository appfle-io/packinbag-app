import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifyDeviceRequest, DeviceAuthError, attachLiveToken, detachLiveToken, parseDeviceLive } from "@/lib/nativeDeviceServer";

// 잠금화면 실시간 현황의 푸시 토큰(2026-10-11, B-5). 네이티브(Shared/PIBActivity.swift)가 기기 토큰으로 부른다.
// POST { token, bagId, packId, env } : 이 기기의 실시간 현황 등록(그 가방 멤버만 - 아이템 이름이 잠금화면으로 가므로)
// DELETE : 내림(실시간 현황을 끄거나 다 챙겨서 내려갈 때)
export const runtime = "nodejs";

async function auth(req: NextRequest): Promise<{ uid: string } | NextResponse> {
  try {
    return { uid: await verifyDeviceRequest(req) };
  } catch (err) {
    const e = err instanceof DeviceAuthError ? err : new DeviceAuthError("다시 로그인해 주세요");
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
}

export async function POST(req: NextRequest) {
  const who = await auth(req);
  if (who instanceof NextResponse) return who;
  const live = parseDeviceLive(await req.json().catch(() => null));
  if (!live) return NextResponse.json({ error: "요청 데이터가 올바르지 않아요" }, { status: 400 });
  try {
    const bag = await adminDb().collection("bags").doc(live.bagId).get();
    const members: string[] = Array.isArray(bag.data()?.memberIds) ? bag.data()!.memberIds : [];
    if (!bag.exists || !members.includes(who.uid)) {
      return NextResponse.json({ error: "이 가방을 볼 수 없어요" }, { status: 403 });
    }
    await attachLiveToken(req, live);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[팩인백] 실시간 현황 토큰 저장 실패:", err);
    return NextResponse.json({ error: "잠시 후 다시 시도해 주세요" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const who = await auth(req);
  if (who instanceof NextResponse) return who;
  try {
    await detachLiveToken(req);
  } catch (err) {
    console.error("[팩인백] 실시간 현황 토큰 삭제 실패:", err);
  }
  return NextResponse.json({ ok: true });
}
