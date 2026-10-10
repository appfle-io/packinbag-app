import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifyDeviceRequest, DeviceAuthError } from "@/lib/nativeDeviceServer";
import { isSafeDocId } from "@/lib/firestoreSanitize";
import type { Item, Pack } from "@/lib/types";

// 위젯 · 잠금화면(실시간 현황)에서 아이템 하나를 체크/해제한다(앱 없이, 기기 토큰).
// 앱의 자동저장과 같은 규칙을 지킨다: 멤버만, 잠긴 가방의 그룹장은 못 고침, 메모 본문을 나눈 가방(notesV 2)은 packsRev + 1.
// packs 배열은 Firestore에 있는 모양 그대로 고쳐서 다시 쓴다(메모 팩·본문은 건드리지 않음).
export const runtime = "nodejs";

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

  const body = (await req.json().catch(() => null)) as { bagId?: unknown; packId?: unknown; itemId?: unknown; checked?: unknown } | null;
  const { bagId, packId, itemId, checked } = body ?? {};
  if (!isSafeDocId(bagId) || typeof packId !== "string" || typeof itemId !== "string" || typeof checked !== "boolean") {
    return NextResponse.json({ error: "요청 데이터가 올바르지 않아요" }, { status: 400 });
  }

  const db = adminDb();
  const ref = db.collection("bags").doc(bagId);
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new BadRequest("가방을 찾을 수 없어요", 404);
      const data = snap.data()!;
      const memberIds: string[] = Array.isArray(data.memberIds) ? data.memberIds : [];
      if (!memberIds.includes(uid)) throw new BadRequest("이 가방을 볼 수 없어요", 403);
      if (data.ownerId === uid && data.locked === true) throw new BadRequest("잠긴 가방이에요", 403);

      const packs: Pack[] = Array.isArray(data.packs) ? data.packs : [];
      const pack = packs.find((p) => p?.id === packId);
      if (!pack || pack.kind === "editor") throw new BadRequest("팩을 찾을 수 없어요", 404);
      const items: Item[] = Array.isArray(pack.items) ? pack.items : [];
      const item = items.find((i) => i?.id === itemId);
      if (!item) throw new BadRequest("아이템을 찾을 수 없어요", 404);
      if (!!item.checked === checked) return; // 이미 그 상태

      const nextPacks = packs.map((p) =>
        p?.id !== packId ? p : { ...p, items: items.map((i) => (i?.id === itemId ? { ...i, checked } : i)) },
      );
      const now = new Date().toISOString();
      const patch: Record<string, unknown> = { packs: nextPacks, lastCheckedAt: now, updatedAt: now };
      if (data.notesV === 2) patch.packsRev = (typeof data.packsRev === "number" ? data.packsRev : 0) + 1;

      // 다 챙긴 순간이면 "마지막으로 다 싼 날"을 남긴다(앱과 같은 기준: 체크리스트 팩의 체크 아이템 전부)
      if (checked) {
        const checks = nextPacks
          .filter((p) => p && p.kind !== "editor" && p.type !== "folder")
          .flatMap((p) => (Array.isArray(p.items) ? p.items : []))
          .filter((i) => i && i.type !== "text");
        if (checks.length > 0 && checks.every((i) => i.checked)) {
          patch.lastPackedAt = now;
          patch.lastPackedBy = uid;
        }
      }
      tx.update(ref, patch);
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof BadRequest) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[팩인백] 위젯 체크 실패:", err);
    return NextResponse.json({ error: "잠시 후 다시 시도해 주세요" }, { status: 500 });
  }
}
