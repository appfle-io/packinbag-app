import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifyRequestUser, isPremiumServer, ServerAuthError } from "@/lib/premiumServer";
import { FREE_MAX_LIBRARY_PACKS, QUICK_PACK_ID } from "@/lib/premiumLimits";
import { Pack, SharedPackSnapshot } from "@/lib/types";
import { stripUndefined, stripServerOnlyPackFields } from "@/lib/firestoreSanitize";
import { serializePack, deserializePack } from "@/lib/editorDocSerialize";
import { copyPackFilesToUser, newImportBudget } from "@/lib/storageCopyServer";

export const runtime = "nodejs";

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않아요" }, { status: 400 });
  }

  const token = (body as { token?: string })?.token;
  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "공유 토큰이 올바르지 않아요" }, { status: 400 });
  }

  let userUid: string;
  let email: string | null;
  try {
    const verified = await verifyRequestUser(req);
    userUid = verified.uid;
    email = verified.email;
  } catch (err) {
    if (err instanceof ServerAuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: "로그인 정보를 확인할 수 없어요" }, { status: 401 });
  }

  const db = adminDb();

  // 1. sharedPacks 컬렉션에서 스냅샷 조회 (Admin SDK로 안전하게 조회)
  const sharedSnap = await db.collection("sharedPacks").doc(token).get();
  if (!sharedSnap.exists) {
    return NextResponse.json({ error: "공유가 종료되었거나 없는 팩이에요" }, { status: 404 });
  }

  const data = sharedSnap.data() as SharedPackSnapshot;
  const packsCol = db.collection("users").doc(userUid).collection("libraryPacks");

  // 2. 무료 보관함 한도 검증
  const premium = await isPremiumServer(userUid, email);
  if (!premium) {
    const userPacksSnap = await packsCol.get();
    const activeCount = userPacksSnap.docs.filter((doc) => {
      const d = doc.data();
      return !d.trashedAt && doc.id !== QUICK_PACK_ID;
    }).length;

    const neededSlots = data.type === "folder" ? 1 + (data.packs?.length ?? 0) : 1;
    if (activeCount + neededSlots > FREE_MAX_LIBRARY_PACKS) {
      return NextResponse.json(
        {
          code: "PACK_LIMIT_REACHED",
          error: `무료로는 팩/폴더를 최대 ${FREE_MAX_LIBRARY_PACKS}개까지만 보관할 수 있어요. 더 가져오려면 프리미엄이 필요해요.`,
        },
        { status: 403 }
      );
    }
  }

  const now = new Date().toISOString();
  const budget = newImportBudget();

  try {
    if (data.type === "folder") {
      const folderId = uid();
      const newFolder: Pack = {
        id: folderId,
        name: data.title || "가져온 폴더",
        type: "folder",
        items: [],
        createdAt: now,
        updatedAt: now,
      };
      await packsCol.doc(folderId).set(stripUndefined(serializePack(newFolder)));

      // 하위 폴더 구조를 그대로 다시 만든다(2026-10-15, share.md 확인 필요 5).
      // 스냅샷 안 항목의 옛 id → 새 id. 부모가 스냅샷 안에 없으면(공유한 폴더 바로 아래 · 예전 스냅샷) 새 최상위 폴더 안으로
      const entries = data.packs ?? [];
      const idMap = new Map<string, string>(entries.map((p) => [p.id, uid()]));
      // 폴더 먼저 쓴다(안쪽 항목이 부모를 가리킬 때 이미 있게)
      const ordered = [...entries.filter((p) => p.type === "folder"), ...entries.filter((p) => p.type !== "folder")];
      for (const cp of ordered) {
        const deserializedCp = stripServerOnlyPackFields(deserializePack(cp));
        const childId = idMap.get(cp.id) ?? uid();
        const parentId = cp.parentId && idMap.has(cp.parentId) ? idMap.get(cp.parentId) : folderId;
        const isSubFolder = cp.type === "folder";
        let child: Pack = {
          ...deserializedCp,
          id: childId,
          parentId,
          publicShareToken: undefined,
          type: isSubFolder ? "folder" : "pack",
          items: isSubFolder
            ? []
            : Array.isArray(deserializedCp.items)
              ? deserializedCp.items.map((i) => ({ ...i, id: uid() }))
              : [],
          createdAt: now,
          updatedAt: now,
        };
        if (!isSubFolder) child = await copyPackFilesToUser(child, userUid, budget);
        await packsCol.doc(childId).set(stripUndefined(serializePack(child)));
      }

      return NextResponse.json({
        type: "folder",
        title: data.title,
        message: `"${data.title}" 폴더와 팩들을 보관함으로 가져왔어요!`,
      });
    } else if (data.pack) {
      // 공유된 팩에 남아 있던 locked·isQuickPack 같은 서버 필드는 가져오지 않는다(2026-10-09)
      const deserializedPack = stripServerOnlyPackFields(deserializePack(data.pack));
      const newPackId = uid();
      let newPack: Pack = {
        ...deserializedPack,
        id: newPackId,
        parentId: undefined,
        publicShareToken: undefined,
        type: deserializedPack.type || "pack",
        items: Array.isArray(deserializedPack.items)
          ? deserializedPack.items.map((i) => ({ ...i, id: uid() }))
          : [],
        createdAt: now,
        updatedAt: now,
      };
      // 사진 · 파일을 내 저장소로 복사(2026-10-15, share.md 확인 필요 6)
      newPack = await copyPackFilesToUser(newPack, userUid, budget);
      await packsCol.doc(newPackId).set(stripUndefined(serializePack(newPack)));

      return NextResponse.json({
        type: "pack",
        title: newPack.name,
        pack: newPack,
        message: `"${newPack.name}" 팩을 보관함으로 가져왔어요!`,
      });
    }

    return NextResponse.json({ error: "가져올 팩 데이터가 비어있어요" }, { status: 400 });
  } catch (err) {
    console.error("[팩인백] 팩 가져오기 저장 실패(서버):", err);
    return NextResponse.json({ error: "팩을 보관함에 저장하지 못했어요" }, { status: 500 });
  }
}
