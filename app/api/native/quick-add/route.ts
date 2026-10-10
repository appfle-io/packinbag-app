import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifyDeviceRequest, DeviceAuthError } from "@/lib/nativeDeviceServer";
import { QUICK_PACK_ID } from "@/lib/premiumLimits";
import type { Item } from "@/lib/types";

// 단축어 "빠른팩에 입력": 앱을 열지 않고 빠른팩 끝에 아이템을 붙인다(기기 토큰).
// 빠른팩은 문서 id가 QUICK_PACK_ID로 고정이고 무료 한도와 무관하다(app/api/create-library-pack과 같은 기준).
// 한 번에 여러 줄을 보내면 줄마다 아이템 하나(최대 20개).
export const runtime = "nodejs";

const MAX_LINES = 20;
const MAX_TEXT = 200;
const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export async function POST(req: NextRequest) {
  let uid: string;
  try {
    uid = await verifyDeviceRequest(req);
  } catch (err) {
    const e = err instanceof DeviceAuthError ? err : new DeviceAuthError("다시 로그인해 주세요");
    return NextResponse.json({ error: e.message }, { status: e.status });
  }

  const body = (await req.json().catch(() => null)) as { text?: unknown; type?: unknown } | null;
  const type: Item["type"] = body?.type === "text" ? "text" : "check";
  const lines = (typeof body?.text === "string" ? body.text : "")
    .split(/\r?\n/)
    .map((l) => l.trim().slice(0, MAX_TEXT))
    .filter(Boolean)
    .slice(0, MAX_LINES);
  if (lines.length === 0) return NextResponse.json({ error: "넣을 내용을 적어 주세요" }, { status: 400 });

  const db = adminDb();
  const userRef = db.collection("users").doc(uid);
  const ref = userRef.collection("libraryPacks").doc(QUICK_PACK_ID);
  try {
    const added = await db.runTransaction(async (tx) => {
      const [userSnap, packSnap] = await Promise.all([tx.get(userRef), tx.get(ref)]);
      // 탈퇴한 계정의 남은 토큰으로 데이터를 다시 만들지 않는다
      if (!userSnap.exists) throw new DeviceAuthError("다시 로그인해 주세요");
      const now = new Date().toISOString();
      const items: Item[] = lines.map((text) => ({ id: newId(), type, text, checked: false }));
      if (packSnap.exists) {
        const prev = packSnap.data()!;
        const prevItems: Item[] = Array.isArray(prev.items) ? prev.items : [];
        tx.update(ref, { items: [...prevItems, ...items], updatedAt: now });
      } else {
        tx.create(ref, { id: QUICK_PACK_ID, name: "빠른팩", items, isQuickPack: true, type: "pack", createdAt: now, updatedAt: now });
      }
      return items.length;
    });
    return NextResponse.json({ ok: true, added });
  } catch (err) {
    if (err instanceof DeviceAuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[팩인백] 단축어 빠른팩 입력 실패:", err);
    return NextResponse.json({ error: "잠시 후 다시 시도해 주세요" }, { status: 500 });
  }
}
