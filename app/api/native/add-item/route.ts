import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifyDeviceRequest, DeviceAuthError } from "@/lib/nativeDeviceServer";
import { isSafeDocId } from "@/lib/firestoreSanitize";
import { isPremiumServer } from "@/lib/premiumServer";
import { FREE_MAX_PACKS_PER_BAG, bagPackLimit, bagPackLimitMessage } from "@/lib/premiumLimits";
import type { Item, Pack } from "@/lib/types";

// 단축어 "가방에 추가"(2026-10-11): 앱을 열지 않고 가방의 팩에 아이템을 넣는다(기기 토큰).
// - packId가 없으면 "미분류"(isInbox) 팩에. 없으면 맨 앞에 새로 만든다(가방 화면 하단 입력창과 같은 규칙,
//   팩 한도 무료 5 · 프리미엄 30 — 2026-10-20 전에는 모두 10)
// - 여러 줄이면 줄마다 하나(최대 20개)
// - 앱 자동저장과 같은 규칙: 멤버만, 잠긴 가방의 그룹장은 못 고침, 메모 본문을 나눈 가방(notesV 2)은 packsRev + 1, editedBy = 나
export const runtime = "nodejs";

const MAX_LINES = 20;
const MAX_TEXT = 200;
const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

class BadRequest extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export async function POST(req: NextRequest) {
  let uid: string;
  try {
    uid = await verifyDeviceRequest(req);
  } catch (err) {
    const e = err instanceof DeviceAuthError ? err : new DeviceAuthError("다시 로그인해 주세요");
    return NextResponse.json({ error: e.message }, { status: e.status });
  }

  const body = (await req.json().catch(() => null)) as { bagId?: unknown; packId?: unknown; text?: unknown } | null;
  const bagId = body?.bagId;
  const packId = typeof body?.packId === "string" && body.packId ? body.packId : null;
  if (!isSafeDocId(bagId)) return NextResponse.json({ error: "가방을 골라 주세요" }, { status: 400 });
  const lines = (typeof body?.text === "string" ? body.text : "")
    .split(/\r?\n/)
    .map((l) => l.trim().slice(0, MAX_TEXT))
    .filter(Boolean)
    .slice(0, MAX_LINES);
  if (lines.length === 0) return NextResponse.json({ error: "넣을 내용을 적어 주세요" }, { status: 400 });

  const db = adminDb();
  const ref = db.collection("bags").doc(bagId);
  try {
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new BadRequest("가방을 찾을 수 없어요", 404);
      const data = snap.data()!;
      const memberIds: string[] = Array.isArray(data.memberIds) ? data.memberIds : [];
      if (!memberIds.includes(uid)) throw new BadRequest("이 가방을 볼 수 없어요", 403);
      if (data.ownerId === uid && data.locked === true) throw new BadRequest("잠긴 가방이에요", 403);
      // 내가 휴지통에 넣은 가방은 고치지 않는다(다른 멤버는 그대로 씀, 2026-10-16 api.md 확인 필요 7)
      if (data.ownerId === uid && data.trashedByOwnerAt) throw new BadRequest("휴지통에 있는 가방이에요", 403);

      let packs: Pack[] = Array.isArray(data.packs) ? data.packs : [];
      const items: Item[] = lines.map((text) => ({ id: newId(), type: "check", text, checked: false }));
      let targetName: string;
      if (packId) {
        const target = packs.find((p) => p?.id === packId && p.kind !== "editor" && p.type !== "folder");
        if (!target) throw new BadRequest("팩을 찾을 수 없어요. 단축어에서 팩을 다시 골라 주세요", 404);
        targetName = target.name || "팩";
        packs = packs.map((p) => (p === target ? { ...p, items: [...(Array.isArray(p.items) ? p.items : []), ...items] } : p));
      } else {
        const inbox = packs.find((p) => p?.isInbox && p.kind !== "editor");
        targetName = "미분류";
        if (inbox) {
          packs = packs.map((p) => (p === inbox ? { ...p, items: [...(Array.isArray(p.items) ? p.items : []), ...items] } : p));
        } else {
          // 무료 한도를 넘을 때만 프리미엄을 확인한다(읽기를 아끼려고)
          if (packs.length >= FREE_MAX_PACKS_PER_BAG) {
            const premium = await isPremiumServer(uid, null);
            if (packs.length >= bagPackLimit(premium)) throw new BadRequest(`${bagPackLimitMessage(premium)}. 팩을 골라 주세요`);
          }
          packs = [{ id: newId(), name: "미분류", items, isInbox: true }, ...packs];
        }
      }

      const patch: Record<string, unknown> = { packs, updatedAt: new Date().toISOString(), editedBy: uid };
      if (data.notesV === 2) patch.packsRev = (typeof data.packsRev === "number" ? data.packsRev : 0) + 1;
      tx.update(ref, patch);
      return { added: items.length, bagName: String(data.name || "가방"), packName: targetName };
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof BadRequest) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[팩인백] 단축어 가방에 추가 실패:", err);
    return NextResponse.json({ error: "잠시 후 다시 시도해 주세요" }, { status: 500 });
  }
}
