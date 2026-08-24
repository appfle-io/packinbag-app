import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifyRequestUser, ServerAuthError } from "@/lib/premiumServer";
import { Pack, SharedPackSnapshot } from "@/lib/types";
import { stripUndefined } from "@/lib/firestoreSanitize";
import { serializePack } from "@/lib/editorDocSerialize";
import crypto from "crypto";

export const runtime = "nodejs";

function generateShareToken(): string {
  return crypto.randomBytes(6).toString("hex"); // 12-char hex token e.g. "a3f8c19d4b2e"
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않아요" }, { status: 400 });
  }

  const { pack, packs, folder, folderId, packId } = body as {
    pack?: Pack;
    packs?: Pack[];
    folder?: Pack;
    folderId?: string;
    packId?: string;
  };

  let uid: string;
  try {
    const verified = await verifyRequestUser(req);
    uid = verified.uid;
  } catch (err) {
    if (err instanceof ServerAuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: "로그인 정보를 확인할 수 없어요" }, { status: 401 });
  }

  const db = adminDb();
  const isFolder = !!folderId || !!folder;
  const targetId = isFolder ? (folderId ?? folder?.id) : (packId ?? pack?.id);

  if (!targetId) {
    return NextResponse.json({ error: "공유할 대상이 지정되지 않았어요" }, { status: 400 });
  }

  try {
    // 1. 기존 토큰이 있는지 확인 (유저 보관함 문서 또는 넘어온 팩 객체에서 조회)
    const userDocRef = db.collection("users").doc(uid).collection("libraryPacks").doc(targetId);
    const existingSnap = await userDocRef.get();
    let token =
      (existingSnap.exists ? (existingSnap.data()?.publicShareToken as string | undefined) : undefined) ||
      pack?.publicShareToken ||
      folder?.publicShareToken;

    if (!token) {
      token = generateShareToken();
      if (existingSnap.exists) {
        await userDocRef.update({ publicShareToken: token });
      }
    }

    const now = new Date().toISOString();
    const title = isFolder ? (folder?.name ?? "폴더") : (pack?.name ?? "팩");

    const snapshotData: SharedPackSnapshot = {
      token,
      ownerUid: uid,
      type: isFolder ? "folder" : "pack",
      title,
      pack: pack ? serializePack(pack) : undefined,
      packs: packs ? packs.map(serializePack) : undefined,
      createdAt: now,
      updatedAt: now,
    };

    // /sharedPacks/{token} 컬렉션에 스냅샷 저장
    await db.collection("sharedPacks").doc(token).set(stripUndefined(snapshotData));

    return NextResponse.json({
      token,
      shareUrl: `https://packinbag.app/p/${token}`,
    });
  } catch (err) {
    console.error("[팩인백] 팩/폴더 공유 생성 실패:", err);
    return NextResponse.json({ error: "공유 링크 생성에 실패했어요" }, { status: 500 });
  }
}
