import { adminDb } from "@/lib/firebaseAdmin";
import { Bag } from "@/lib/types";
import { deserializeBag } from "@/lib/editorDocSerialize";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconLock } from "@tabler/icons-react";
import GuestBagClientView from "@/components/GuestBagClientView";

export const dynamic = "force-dynamic";

interface GuestPageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ code?: string; join?: string }>;
}

export default async function GuestBagPage({ params, searchParams }: GuestPageProps) {
  const { token } = await params;
  const { code: queryCode, join: queryJoin } = (await searchParams) || {};
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
    const db = adminDb();
    let snap = await db
      .collection("bags")
      .where("publicShareToken", "==", token)
      .limit(1)
      .get();

    if (snap.empty) {
      snap = await db
        .collection("bags")
        .where("inviteCode", "==", token)
        .limit(1)
        .get();
    }

    if (snap.empty) {
      return (
        <main className="h-screen w-full overflow-y-auto bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
          <div className="max-w-sm w-full text-center space-y-4 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl">
            <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <IconLock size={28} />
            </div>
            <div className="space-y-1">
              <h1 className="text-[17px] font-bold text-slate-900 dark:text-white">
                공유가 종료되었거나 없는 가방이에요
              </h1>
              <p className="text-[13px] text-slate-500">
                링크가 만료되었거나 비공개로 전환된 가방입니다.
              </p>
            </div>
            <Link
              href="/"
              className="inline-block w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[14px] transition-colors shadow-sm"
            >
              팩인백 홈으로 이동
            </Link>
          </div>
        </main>
      );
    }

    const bagDoc = snap.docs[0];
    bag = deserializeBag({ id: bagDoc.id, ...bagDoc.data() } as Bag);
  }

  // 초대코드 존재 여부 (URL 쿼리 우선)
  const activeInviteCode = queryCode || queryJoin;

  return <GuestBagClientView bag={bag} activeInviteCode={activeInviteCode} />;
}
