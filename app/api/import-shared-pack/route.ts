import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifyRequestUser, isPremiumServer, ServerAuthError } from "@/lib/premiumServer";
import { FREE_MAX_LIBRARY_PACKS, QUICK_PACK_ID } from "@/lib/premiumLimits";
import { Pack, SharedPackSnapshot } from "@/lib/types";
import { stripUndefined } from "@/lib/firestoreSanitize";
import { serializePack, deserializePack } from "@/lib/editorDocSerialize";
import crypto from "crypto";

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
      return !d.trashedAt && doc.id !== QUICK_PACK_ID && !d.isQuickPack;
    }).length;

    const neededSlots = data.type === "folder" ? 1 + (data.packs?.length ?? 0) : 1;
    if (activeCount + neededSlots > FREE_MAX_LIBRARY_PACKS) {
      return NextResponse.json(
        {
          code: "PACK_LIMIT_REACHED",
          error: `무료로는 팩/폴더를 최대 ${FREE_MAX_LIBRARY_PACKS}개까지만 보관할 수 있어요. 더 가져오려면 이용권 코드를 등록해주세요.`,
        },
        { status: 403 }
      );
    }
  }

  const now = new Date().toISOString();

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

      const childPacks = (data.packs ?? []).filter((p) => p.type !== "folder");
      for (const cp of childPacks) {
        const deserializedCp = deserializePack(cp);
        const childPackId = uid();
        const newChildPack: Pack = {
          ...deserializedCp,
          id: childPackId,
          parentId: folderId,
          type: "pack",
          items: Array.isArray(deserializedCp.items)
            ? deserializedCp.items.map((i) => ({ ...i, id: uid() }))
            : [],
          createdAt: now,
          updatedAt: now,
        };
        await packsCol.doc(childPackId).set(stripUndefined(serializePack(newChildPack)));
      }

      return NextResponse.json({
        type: "folder",
        title: data.title,
        message: `"${data.title}" 폴더와 팩들을 보관함으로 가져왔어요!`,
      });
    } else if (data.pack) {
      const deserializedPack = deserializePack(data.pack);
      const newPackId = uid();
      const newPack: Pack = {
        ...deserializedPack,
        id: newPackId,
        parentId: undefined,
        type: deserializedPack.type || "pack",
        items: Array.isArray(deserializedPack.items)
          ? deserializedPack.items.map((i) => ({ ...i, id: uid() }))
          : [],
        createdAt: now,
        updatedAt: now,
      };
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
