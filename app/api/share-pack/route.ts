import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifyRequestUser, ServerAuthError } from "@/lib/premiumServer";
import { Pack, SharedPackSnapshot } from "@/lib/types";
import { stripUndefined } from "@/lib/firestoreSanitize";
import { serializePack } from "@/lib/editorDocSerialize";
import crypto from "crypto";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";

// 예전에는 https://packinbag.app으로 고정돼 있었다(서비스 도메인은 packinbag.seeuson.com)
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://packinbag.seeuson.com").replace(/\/$/, "");

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

  const { pack, packs, folder, folderId, packId, bagId } = body as {
    pack?: Pack;
    packs?: Pack[];
    folder?: Pack;
    folderId?: string;
    packId?: string;
    bagId?: string;
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
    // 1. 기존 토큰 찾기. 클라이언트가 보낸 토큰은 믿지 않는다(2026-10-07):
    //    예전에는 pack.publicShareToken을 그대로 써서, /p/{token} 링크를 본 사람이면 누구나 그 토큰으로
    //    요청해 남의 공유 페이지 내용을 바꿔치기할 수 있었다.
    //    서버가 읽은 곳(가방 안 팩 / 내 보관함 문서)에 저장된 토큰만 쓰고, 그것도 기존 스냅샷의 주인이
    //    나이거나(내 공유) 같은 가방 팩에 저장된 토큰일 때(다른 멤버가 만든 공유 갱신)만 덮어쓴다.
    let bagRef: FirebaseFirestore.DocumentReference | null = null;
    let bagData: FirebaseFirestore.DocumentData | null = null;
    let packInBag: Pack | null = null;

    if (bagId) {
      bagRef = db.collection("bags").doc(bagId);
      const bagSnap = await bagRef.get();
      if (bagSnap.exists) {
        bagData = bagSnap.data() || null;
        const memberIds = (bagData?.memberIds as string[] | undefined) ?? [];
        const isMemberOrOwner = bagData?.ownerId === uid || memberIds.includes(uid);
        if (!isMemberOrOwner) {
          return NextResponse.json({ error: "이 가방의 팩을 공유할 수 없어요" }, { status: 403 });
        }
        if (Array.isArray(bagData?.packs)) {
          packInBag = bagData.packs.find((p: Pack) => p.id === targetId) || null;
        }
      }
    }

    const userDocRef = !bagId ? db.collection("users").doc(uid).collection("libraryPacks").doc(targetId) : null;
    const existingSnap = userDocRef ? await userDocRef.get() : null;

    const storedToken =
      packInBag?.publicShareToken ||
      (existingSnap?.exists ? (existingSnap.data()?.publicShareToken as string | undefined) : undefined);

    let token: string | undefined;
    if (storedToken) {
      const prev = await db.collection("sharedPacks").doc(storedToken).get();
      const prevData = prev.exists ? prev.data() : undefined;
      const prevOwner = prevData?.ownerUid as string | undefined;
      // 가방 문서는 멤버가 직접 고칠 수 있어서 packInBag.publicShareToken도 믿을 수 없다 →
      // 다른 사람이 만든 스냅샷은 "이 가방의 이 팩"에서 만든 것일 때만 갱신한다(출처는 서버만 기록)
      const sameBagPack =
        !!packInBag && prevData?.sourceBagId === bagId && prevData?.sourcePackId === targetId;
      if (!prev.exists || prevOwner === uid || sameBagPack) token = storedToken;
    }

    if (!token) {
      token = generateShareToken();
      if (bagRef && bagData && Array.isArray(bagData.packs) && packInBag) {
        // 트랜잭션: 읽은 뒤 다른 멤버가 고친 packs를 덮어쓰지 않게 최신본에 토큰만 넣는다
        const newToken = token;
        const ref = bagRef;
        await db.runTransaction(async (tx) => {
          const fresh = await tx.get(ref);
          const packs = (fresh.data()?.packs as Pack[] | undefined) ?? [];
          tx.update(ref, {
            packs: packs.map((p) => (p.id === targetId ? { ...p, publicShareToken: newToken } : p)),
            updatedAt: new Date().toISOString(),
          });
        });
      } else if (existingSnap?.exists && userDocRef) {
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
      ...(packInBag && bagId ? { sourceBagId: bagId, sourcePackId: targetId } : {}),
      pack: pack ? serializePack(pack) : undefined,
      packs: packs ? packs.map(serializePack) : undefined,
      createdAt: now,
      updatedAt: now,
    };

    // /sharedPacks/{token} 컬렉션에 스냅샷 저장
    await db.collection("sharedPacks").doc(token).set(stripUndefined(snapshotData));
    // 공유 페이지는 잠깐 캐시되므로(app/p/[token] revalidate) 바뀐 내용을 바로 보이게 한다
    try {
      revalidatePath(`/p/${token}`);
    } catch {}

    return NextResponse.json({
      token,
      shareUrl: `${APP_URL}/p/${token}`,
    });
  } catch (err) {
    console.error("[팩인백] 팩/폴더 공유 생성 실패:", err);
    return NextResponse.json({ error: "공유 링크 생성에 실패했어요" }, { status: 500 });
  }
}
