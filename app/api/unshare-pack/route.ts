import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifyRequestUser, ServerAuthError } from "@/lib/premiumServer";
import type { Pack } from "@/lib/types";

// 팩 · 폴더 · 메모 공유 끄기(2026-10-15, share.md 확인 필요 3).
// - 공유 시트의 "공유 끄기"와, 원본을 완전히 지울 때(휴지통 비우기 · 30일 자동 삭제 · 가방 완전 삭제) 앱이 부른다
// - sharedPacks/{token}을 지우고, 원본(보관함 팩 · 폴더 또는 가방 속 팩)에 남은 publicShareToken도 뗀다
// - 지울 수 있는 것: 내가 만든 스냅샷, 또는 가방 속 팩에서 만든 스냅샷 중 내가 그 가방 멤버이거나 그 가방이 이미 없는 것
export const runtime = "nodejs";

const MAX_TOKENS = 50;

export async function POST(req: NextRequest) {
  let uid: string;
  try {
    uid = (await verifyRequestUser(req)).uid;
  } catch (err) {
    const message = err instanceof ServerAuthError ? err.message : "로그인이 필요해요";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않아요" }, { status: 400 });
  }
  const raw = (body as { tokens?: unknown })?.tokens;
  const tokens = [
    ...new Set(
      (Array.isArray(raw) ? raw : []).filter(
        (t): t is string => typeof t === "string" && /^[A-Za-z0-9_-]{6,64}$/.test(t),
      ),
    ),
  ].slice(0, MAX_TOKENS);
  if (tokens.length === 0) return NextResponse.json({ removed: 0 });

  const db = adminDb();
  let removed = 0;
  for (const token of tokens) {
    try {
      const ref = db.collection("sharedPacks").doc(token);
      const snap = await ref.get();
      if (!snap.exists) continue;
      const data = snap.data() ?? {};
      const sourceBagId = data.sourceBagId as string | undefined;
      const sourcePackId = data.sourcePackId as string | undefined;

      let allowed = data.ownerUid === uid;
      let bagRef: FirebaseFirestore.DocumentReference | null = null;
      if (sourceBagId) {
        const candidate = db.collection("bags").doc(sourceBagId);
        const bag = await candidate.get();
        if (!bag.exists) allowed = true;
        else {
          bagRef = candidate;
          if (((bag.data()?.memberIds as string[] | undefined) ?? []).includes(uid)) allowed = true;
        }
      }
      if (!allowed) continue;

      await ref.delete();
      removed += 1;

      if (bagRef && sourcePackId) {
        const target = bagRef;
        await db.runTransaction(async (tx) => {
          const fresh = await tx.get(target);
          const packs = (fresh.data()?.packs as Pack[] | undefined) ?? [];
          if (!packs.some((p) => p.id === sourcePackId && p.publicShareToken === token)) return;
          tx.update(target, {
            packs: packs.map((p) => {
              if (p.id !== sourcePackId) return p;
              const { publicShareToken: _t, ...rest } = p;
              void _t;
              return rest;
            }),
          });
        });
      }
      const owner = (data.ownerUid as string | undefined) ?? uid;
      const libSnap = await db
        .collection("users")
        .doc(owner)
        .collection("libraryPacks")
        .where("publicShareToken", "==", token)
        .get();
      await Promise.all(libSnap.docs.map((d) => d.ref.update({ publicShareToken: FieldValue.delete() })));

      try {
        revalidatePath(`/p/${token}`);
      } catch {}
    } catch (err) {
      console.error("[팩인백] 공유 끄기 실패:", token, err);
    }
  }
  return NextResponse.json({ removed });
}
