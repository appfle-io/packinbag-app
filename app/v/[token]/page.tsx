import { adminDb } from "@/lib/firebaseAdmin";
import { Bag } from "@/lib/types";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  IconBackpack,
  IconCheck,
  IconCalendar,
  IconLock,
  IconArrowRight,
  IconUserPlus,
} from "@tabler/icons-react";
import GuestMemoPackView from "@/components/GuestMemoPackView";

export const dynamic = "force-dynamic";

interface GuestPageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ code?: string; join?: string }>;
}

export default async function GuestBagPage({ params, searchParams }: GuestPageProps) {
  const { token } = await params;
  const { code: queryCode, join: queryJoin } = (await searchParams) || {};
  if (!token) notFound();

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
  const bag = { id: bagDoc.id, ...bagDoc.data() } as Bag;

  // 초대코드 존재 여부 (URL 쿼리 우선)
  const activeInviteCode = queryCode || queryJoin;
  const appEntryUrl = activeInviteCode
    ? `/?invite=${activeInviteCode}`
    : `/?openBag=${bag.id}`;

  // 체크리스트 통계
  const checklistPacks = (bag.packs || []).filter((p) => p.kind !== "editor" && p.type !== "folder");
  let totalItems = 0;
  let checkedItems = 0;
  checklistPacks.forEach((p) => {
    p.items.forEach((i) => {
      totalItems++;
      if (i.checked) checkedItems++;
    });
  });
  const progressRatio = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;

  // D-Day
  let ddayText = "";
  if (bag.travelDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(bag.travelDate);
    target.setHours(0, 0, 0, 0);
    const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    ddayText = diff === 0 ? "D-DAY" : diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`;
  }

  return (
    <main className="h-screen w-full overflow-y-auto bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-32 font-sans">
      {/* 상단 브랜드 헤더 */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              <IconBackpack size={16} />
            </div>
            <span className="font-bold text-[15px] tracking-tight">PackInBag</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
              {activeInviteCode ? "초대 포함 모드" : "보기 전용 모드"}
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-md mx-auto p-4 space-y-4">
        {/* 가방 메인 타이틀 카드 */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-[20px] font-bold text-slate-900 dark:text-white leading-tight">
                {bag.name}
              </h1>
              {bag.travelDate && (
                <p className="text-[13px] text-slate-500 flex items-center gap-1.5 mt-1 font-medium">
                  <IconCalendar size={14} />
                  {bag.travelDate}
                </p>
              )}
            </div>
            {ddayText && (
              <span className="px-3 py-1 rounded-xl bg-blue-600 text-white text-[13px] font-extrabold shadow-xs">
                {ddayText}
              </span>
            )}
          </div>

          {bag.notice && (
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 text-[13px] text-slate-600 dark:text-slate-300">
              {bag.notice}
            </div>
          )}

          {/* 진행률 바 */}
          {totalItems > 0 && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex justify-between text-[12px] font-medium mb-1">
                <span className="text-slate-500">패킹 달성률</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  {checkedItems} / {totalItems}개 ({progressRatio}%)
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full"
                  style={{ width: `${progressRatio}%` }}
                />
              </div>
            </div>
          )}
        </section>

        {/* 팩 및 짐 목록 */}
        <div className="space-y-4">
          {(bag.packs || []).map((pack) => {
            if (pack.type === "folder") return null;

            return (
              <section
                key={pack.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-2.5"
              >
                <h2 className="text-[15px] font-bold text-slate-900 dark:text-white flex items-center justify-between">
                  <span>{pack.name}</span>
                  {pack.items && pack.items.length > 0 && (
                    <span className="text-[12px] font-normal text-slate-400">
                      {pack.items.filter((i) => i.checked).length}/{pack.items.length}
                    </span>
                  )}
                </h2>

                {pack.kind === "editor" ? (
                  <GuestMemoPackView pack={pack} />
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {pack.items.map((item) => (
                      <div
                        key={item.id}
                        className={`flex items-center gap-3 py-2.5 ${
                          item.checked ? "opacity-45" : ""
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border ${
                            item.checked
                              ? "bg-blue-600 border-blue-600 text-white"
                              : "border-slate-300 dark:border-slate-700"
                          }`}
                        >
                          {item.checked && <IconCheck size={14} stroke={3} />}
                        </div>
                        <span
                          className={`text-[14px] ${
                            item.checked
                              ? "line-through text-slate-400"
                              : "text-slate-800 dark:text-slate-200 font-medium"
                          }`}
                        >
                          {item.text}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>

      {/* 하단 고정 온보딩 & 가방 열기 CTA 배너 */}
      <div className="fixed bottom-0 inset-x-0 p-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 z-40">
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-slate-900 dark:text-white truncate">
              {activeInviteCode ? "그룹원으로 함께 패킹하기" : "팩인백에서 가방 열기"}
            </p>
            <p className="text-[11px] text-slate-500 truncate">
              {activeInviteCode
                ? "초대코드가 포함되어 바로 그룹원으로 등록돼요"
                : "앱/웹에서 실시간으로 짐을 체크하고 관리하세요"}
            </p>
          </div>
          <Link
            href={appEntryUrl}
            className="shrink-0 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-[13px] shadow-sm flex items-center gap-1.5 transition-all"
          >
            {activeInviteCode ? (
              <>
                <IconUserPlus size={16} />
                <span>참여하기</span>
              </>
            ) : (
              <>
                <span>열기</span>
                <IconArrowRight size={15} />
              </>
            )}
          </Link>
        </div>
      </div>
    </main>
  );
}
