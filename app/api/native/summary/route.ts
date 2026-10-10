import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifyDeviceRequest, DeviceAuthError } from "@/lib/nativeDeviceServer";
import { buildNativeSummary } from "@/lib/nativeSummary";
import type { Bag } from "@/lib/types";

// 위젯 · 단축어("팩인백 새로고침")가 앱 없이 최신 가방 요약을 받는다(lib/nativeSummary.ts).
// 앱이 열려 있을 때는 웹이 직접 요약을 넘기므로(lib/v2/nativeBridge.ts) 이 라우트는 앱이 꺼져 있을 때만 쓰인다.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  let uid: string;
  try {
    uid = await verifyDeviceRequest(req);
  } catch (err) {
    const e = err instanceof DeviceAuthError ? err : new DeviceAuthError("다시 로그인해 주세요");
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  try {
    const snap = await adminDb().collection("bags").where("memberIds", "array-contains", uid).get();
    const bags = snap.docs.map((d) => ({ ...(d.data() as Bag), id: d.id }));
    return NextResponse.json(buildNativeSummary(bags, uid), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[팩인백] 위젯 요약 실패:", err);
    return NextResponse.json({ error: "잠시 후 다시 시도해 주세요" }, { status: 500 });
  }
}
