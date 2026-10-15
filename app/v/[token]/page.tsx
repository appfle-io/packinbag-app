import { adminDb } from "@/lib/firebaseAdmin";
import { Bag } from "@/lib/types";
import { deserializeBag } from "@/lib/editorDocSerialize";
import { hydrateBag, parseNoteData, type BagNote } from "@/lib/bagNotesCore";
import { notFound } from "next/navigation";
import { GuestBagViewV2 } from "@/components/v2/guest/GuestBagViewV2";
import { GuestEnded } from "@/components/v2/guest/GuestShell";
import type { Metadata } from "next";
import { APP_STORE_ID } from "@/lib/v2/appBridge";

// 예전에는 force-dynamic이라 볼 때마다 함수 실행 + Firestore 읽기가 생겼다. 잠깐(60초) 캐시한다(2026-10-07).
// 초대코드(?code= / ?join=)는 페이지가 아니라 GuestBagClientView가 주소에서 직접 읽는다(캐시되는 HTML에 섞이지 않게).
export const revalidate = 60;

// 아이폰 사파리 위쪽 앱 배너(스마트 앱 배너, 2026-10-12): 앱이 있으면 "열기", 없으면 "받기"를 iOS가 알아서 보여 준다
export const metadata: Metadata = {
  itunes: { appId: APP_STORE_ID },
};

interface GuestPageProps {
  params: Promise<{ token: string }>;
}

// 게스트 화면이 쓰는 필드만 남긴다. 예전에는 가방 문서를 통째 클라이언트 컴포넌트에 넘겨서,
// 페이지 HTML에 inviteCode·memberIds·ownerId가 그대로 들어갔다 → 보기 링크만 받은 사람이 초대코드로
// 가방에 들어와 편집할 수 있었다(2026-10-07).
function toGuestBag(b: Bag): Bag {
  return {
    id: b.id,
    name: b.name,
    travelDate: b.travelDate,
    notice: b.notice,
    images: [],
    memberIds: [],
    ownerId: "",
    inviteCode: "",
    createdAt: "",
    updatedAt: b.updatedAt,
    packs: (b.packs ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      kind: p.kind,
      type: p.type,
      editorDoc: p.editorDoc,
      editorPreviewText: p.editorPreviewText,
      images: p.images,
      items: (p.items ?? []).map((i) => ({
        id: i.id,
        type: i.type,
        text: i.text,
        checked: i.checked,
        bold: i.bold,
        strike: i.strike,
        color: i.color,
      })),
    })),
  };
}

export default async function GuestBagPage({ params }: GuestPageProps) {
  const { token } = await params;
  if (!token) notFound();

  let bag: Bag;

  if (token === "sample-guide-view") {
    bag = {
      id: "sample-guide-bag",
      name: "도쿄 3박4일 자유여행",
      images: [],
      ownerId: "sample-user",
      memberIds: ["sample-user", "friend-1"],
      memberProfiles: {
        "sample-user": { nickname: "나", avatarId: "dog", joinedAt: new Date().toISOString() },
        "friend-1": { nickname: "민수", avatarId: "cat", joinedAt: new Date().toISOString() },
      },
      inviteCode: "TOKYO2026",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      travelDate: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10),
      packs: [
        {
          id: "pack-1",
          name: "전자기기 & 충전",
          type: "pack",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: [
            { id: "i-1", type: "check", text: "여권 원본 (유효기간 6개월 이상)", checked: false },
            { id: "i-2", type: "check", text: "110V 돼지코 어댑터", checked: true },
            { id: "i-3", type: "check", text: "보조배터리 20000mAh", checked: false },
          ],
        },
        {
          id: "pack-2",
          name: "세면 & 위생용품",
          type: "pack",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: [
            { id: "i-4", type: "check", text: "칫솔 & 치약 세트", checked: false },
            { id: "i-5", type: "check", text: "선크림 SPF50+", checked: true },
          ],
        },
        {
          id: "pack-3",
          name: "여행 일정 & 맛집 메모",
          type: "pack",
          kind: "editor",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: [],
          editorPreviewText: "Day 1: 나리타 공항 도착 (14:15)\n- N'EX 타고 신주쿠역 이동\n- 저녁: 신주쿠 츠케멘\n- 도쿄도청 전망대",
        },
      ],
    };
  } else {
    // 보기 토큰으로만 연다(2026-10-15, share.md 확인 필요 2). 예전에는 못 찾으면 초대코드로도 찾아 /v/{초대코드}가 열렸다
    const db = adminDb();
    const snap = await db
      .collection("bags")
      .where("publicShareToken", "==", token)
      .limit(1)
      .get();

    // 휴지통에 넣은 가방도 닫는다(2026-10-15, share.md 확인 필요 1)
    const data = snap.empty ? null : snap.docs[0].data();
    if (!data || data.publicShareEnabled === false || data.trashedByOwnerAt) {
      return (
        <GuestEnded
          title="공유가 끝났거나 없는 가방이에요"
          message="링크가 만료됐거나 가방이 지워졌어요."
        />
      );
    }

    const bagDoc = snap.docs[0];
    // 메모 본문은 bags/{id}/notes에 따로 있다(lib/bagNotesService, 2026-10-08). 메모가 있는 가방만 읽는다
    const raw = deserializeBag({ id: bagDoc.id, ...bagDoc.data() } as Bag);
    let notes: Map<string, BagNote> | null = null;
    if (raw.packs.some((p) => p.kind === "editor" && p.noteSeparated)) {
      const notesSnap = await bagDoc.ref.collection("notes").get();
      notes = new Map(notesSnap.docs.map((d) => [d.id, parseNoteData(d.data())]));
    }
    bag = toGuestBag(hydrateBag(raw, notes));
  }

  return <GuestBagViewV2 bag={bag} />;
}
