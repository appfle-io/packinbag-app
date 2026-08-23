import { adminDb } from "@/lib/firebaseAdmin";
import { SharedPackSnapshot, Pack } from "@/lib/types";
import { deserializePack } from "@/lib/editorDocSerialize";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  IconCheck,
  IconFolder,
  IconLock,
  IconNotes,
  IconPackage,
  IconArrowRight,
  IconPlus,
} from "@tabler/icons-react";
import GuestMemoPackView from "@/components/GuestMemoPackView";

export const dynamic = "force-dynamic";

interface GuestPackPageProps {
  params: Promise<{ token: string }>;
}

export default async function GuestPackPage({ params }: GuestPackPageProps) {
  const { token } = await params;
  if (!token) notFound();

  const db = adminDb();
  const docSnap = await db.collection("sharedPacks").doc(token).get();

  if (!docSnap.exists) {
    return (
      <main className="h-screen w-full overflow-y-auto bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-sm w-full text-center space-y-4 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl">
          <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <IconLock size={28} />
          </div>
          <div className="space-y-1">
            <h1 className="text-[17px] font-bold text-slate-900 dark:text-white">
              공유가 종료되었거나 없는 팩이에요
            </h1>
            <p className="text-[13px] text-slate-500">
              링크가 만료되었거나 삭제된 팩/폴더입니다.
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

  const snapshot = docSnap.data() as SharedPackSnapshot;
  const isFolder = snapshot.type === "folder";
  const rawPacks: Pack[] = isFolder
    ? (snapshot.packs ?? []).filter((p) => p.type !== "folder")
    : snapshot.pack
      ? [snapshot.pack]
      : [];
  const displayPacks = rawPacks.map(deserializePack);

  const totalItems = displayPacks.reduce((acc, p) => acc + (p.items?.length ?? 0), 0);

  return (
    <main className="h-screen w-full overflow-y-auto bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-32 font-sans">
      {/* 상단 브랜드 헤더 */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              {isFolder ? <IconFolder size={16} /> : <IconPackage size={16} />}
            </div>
            <span className="font-bold text-[15px] tracking-tight">PackInBag</span>
          </div>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
            {isFolder ? "폴더 공유 모드" : "팩 공유 모드"}
          </span>
        </div>
      </header>

      <div className="max-w-md mx-auto p-4 space-y-4">
        {/* 메인 타이틀 카드 */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[12px] font-semibold text-blue-600 dark:text-blue-400">
                  {isFolder ? `폴더 · ${displayPacks.length}개 팩` : "팩 보관함 공유"}
                </span>
              </div>
              <h1 className="text-[20px] font-bold text-slate-900 dark:text-white leading-tight">
                {snapshot.title}
              </h1>
            </div>
            <span className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[12.5px] font-bold shrink-0">
              총 {totalItems}개 짐
            </span>
          </div>
        </section>

        {/* 팩 내용 목록 */}
        <div className="space-y-3">
          {displayPacks.map((p, idx) => {
            const isEditor = p.kind === "editor";
            return (
              <section
                key={p.id || idx}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-xs overflow-hidden space-y-3"
              >
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    {isEditor ? (
                      <IconNotes size={16} className="text-amber-500" />
                    ) : (
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    )}
                    <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">
                      {p.name}
                    </h2>
                  </div>
                  <span className="text-[11.5px] text-slate-400 font-medium">
                    {isEditor ? "메모" : `${p.items?.length || 0}개`}
                  </span>
                </div>

                {isEditor ? (
                  <div className="pt-1">
                    <GuestMemoPackView pack={p} />
                  </div>
                ) : (
                  <div className="space-y-1 pt-1">
                    {p.items && p.items.length > 0 ? (
                      p.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-2.5 py-1.5 px-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <div className="w-4 h-4 rounded-md border border-slate-300 dark:border-slate-700 flex items-center justify-center shrink-0">
                            {item.checked && <IconCheck size={11} className="text-blue-600" />}
                          </div>
                          <span className="text-[13.5px] text-slate-700 dark:text-slate-200 font-medium">
                            {item.text}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-[13px] text-slate-400 py-3 text-center">
                        아직 담긴 짐이 없어요.
                      </p>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>

      {/* 하단 고정 액션 바 */}
      <footer className="fixed bottom-0 inset-x-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 p-3 sm:p-4 z-40">
        <div className="max-w-md mx-auto flex items-center gap-2">
          <Link
            href={`/?importPack=${token}`}
            className="flex-1 py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[14px] flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98]"
          >
            <IconPlus size={18} stroke={2.5} />
            내 보관함으로 가져오기
          </Link>
          <Link
            href={`/?importPack=${token}&target=bag`}
            className="py-3 px-4 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-[13.5px] flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
          >
            가방에 담기
            <IconArrowRight size={15} stroke={2} />
          </Link>
        </div>
      </footer>
    </main>
  );
}
