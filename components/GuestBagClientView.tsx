"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  IconBackpack,
  IconCheck,
  IconCalendar,
  IconArrowRight,
  IconUserPlus,
  IconSun,
  IconMoon,
  IconChevronDown,
  IconChevronUp,
  IconInfoCircle,
} from "@tabler/icons-react";
import { Bag, Pack } from "@/lib/types";
import GuestMemoPackView from "@/components/GuestMemoPackView";

interface GuestBagClientViewProps {
  bag: Bag;
  activeInviteCode?: string;
}

type FontScale = "normal" | "large" | "xlarge";

const FONT_SCALE_LABELS: Record<FontScale, string> = {
  normal: "보통",
  large: "크게",
  xlarge: "아주 크게",
};

export default function GuestBagClientView({
  bag,
  activeInviteCode,
}: GuestBagClientViewProps) {
  // 1. 다크/라이트 테마 관리 (확실한 class + data-theme 동기화)
  const [isDark, setIsDark] = useState<boolean>(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("packinbag-theme");
      const isSystemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const resolvedDark =
        stored === "dark"
          ? true
          : stored === "light"
          ? false
          : isSystemDark || document.documentElement.classList.contains("dark");

      setIsDark(resolvedDark);
      if (resolvedDark) {
        document.documentElement.classList.add("dark");
        document.documentElement.setAttribute("data-theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        document.documentElement.setAttribute("data-theme", "light");
      }
    } catch {}
  }, []);

  const handleToggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
      document.documentElement.setAttribute("data-theme", "dark");
      try {
        localStorage.setItem("packinbag-theme", "dark");
      } catch {}
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.setAttribute("data-theme", "light");
      try {
        localStorage.setItem("packinbag-theme", "light");
      } catch {}
    }
  };

  // 2. 글씨 크기 조절 (Font Scale)
  const [fontScale, setFontScale] = useState<FontScale>("normal");

  useEffect(() => {
    try {
      const savedScale = localStorage.getItem(
        "packinbag_guest_font_scale"
      ) as FontScale | null;
      if (savedScale && ["normal", "large", "xlarge"].includes(savedScale)) {
        setFontScale(savedScale);
      }
    } catch {}
  }, []);

  const handleToggleFontScale = () => {
    const nextScale: FontScale =
      fontScale === "normal"
        ? "large"
        : fontScale === "large"
        ? "xlarge"
        : "normal";
    setFontScale(nextScale);
    try {
      localStorage.setItem("packinbag_guest_font_scale", nextScale);
    } catch {}
  };

  // 3. 화면 꺼짐 방지 (Screen Wake Lock API)
  const [wakeLockEnabled, setWakeLockEnabled] = useState(false);
  const wakeLockSentinelRef = useRef<any>(null);

  const requestWakeLock = async () => {
    if (typeof window !== "undefined" && "wakeLock" in navigator) {
      try {
        const sentinel = await (navigator as any).wakeLock.request("screen");
        wakeLockSentinelRef.current = sentinel;
        sentinel.addEventListener("release", () => {
          wakeLockSentinelRef.current = null;
        });
        return true;
      } catch (err) {
        console.warn("[팩인백] 화면 꺼짐 방지 활성화 실패:", err);
        return false;
      }
    }
    return false;
  };

  const releaseWakeLock = async () => {
    if (wakeLockSentinelRef.current) {
      try {
        await wakeLockSentinelRef.current.release();
      } catch {}
      wakeLockSentinelRef.current = null;
    }
  };

  const handleToggleWakeLock = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setWakeLockEnabled(checked);
    if (checked) {
      if (typeof window !== "undefined" && "wakeLock" in navigator) {
        const ok = await requestWakeLock();
        if (!ok) {
          alert("이 브라우저에서는 화면 꺼짐 방지를 활성화할 수 없어요.");
          setWakeLockEnabled(false);
        }
      } else {
        alert("현재 브라우저는 화면 꺼짐 방지 기능을 지원하지 않아요.");
        setWakeLockEnabled(false);
      }
    } else {
      await releaseWakeLock();
    }
  };

  // 모바일 화면 전환(다른 탭/앱 전환 후 복귀 시) 자동 재획득
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (
        wakeLockEnabled &&
        document.visibilityState === "visible" &&
        !wakeLockSentinelRef.current
      ) {
        await requestWakeLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      releaseWakeLock();
    };
  }, [wakeLockEnabled]);

  // 4. 로컬 체크박스 상태 (방안 A: 로컬 개인 임시 체크 + localStorage 보관)
  const [localChecks, setLocalChecks] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    (bag.packs || []).forEach((p) => {
      (p.items || []).forEach((i) => {
        initial[i.id] = !!i.checked;
      });
    });
    return initial;
  });

  // localStorage에서 저장된 로컬 체크 복원
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`guest_check_${bag.id}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === "object") {
          setLocalChecks((prev) => ({ ...prev, ...parsed }));
        }
      }
    } catch {}
  }, [bag.id]);

  const handleToggleCheck = (itemId: string) => {
    setLocalChecks((prev) => {
      const next = { ...prev, [itemId]: !prev[itemId] };
      try {
        localStorage.setItem(`guest_check_${bag.id}`, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // 4. 팩별 접기/펴기 (Accordion) - 최초 진입 시 기본으로 모두 접힌 상태
  const validPacks = useMemo(() => {
    return (bag.packs || []).filter((p) => p.type !== "folder");
  }, [bag.packs]);

  const [collapsedPacks, setCollapsedPacks] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    (bag.packs || []).forEach((p) => {
      initial[p.id] = true; // 최초 진입 시 모두 접힌 상태를 기본값으로 지정
    });
    return initial;
  });

  const allCollapsed = useMemo(() => {
    if (validPacks.length === 0) return true;
    return validPacks.every((p) => collapsedPacks[p.id] !== false);
  }, [validPacks, collapsedPacks]);

  const togglePackCollapse = (packId: string) => {
    setCollapsedPacks((prev) => ({
      ...prev,
      [packId]: !prev[packId],
    }));
  };

  const handleToggleAllPacks = () => {
    const nextCollapsedState = !allCollapsed;
    const nextMap: Record<string, boolean> = {};
    validPacks.forEach((p) => {
      nextMap[p.id] = nextCollapsedState;
    });
    setCollapsedPacks(nextMap);
  };

  // 체크리스트 통계 (로컬 체크 상태 반영)
  const checklistPacks = useMemo(() => {
    return validPacks.filter((p) => p.kind !== "editor");
  }, [validPacks]);

  const { totalItems, checkedItems, progressRatio } = useMemo(() => {
    let total = 0;
    let checked = 0;
    checklistPacks.forEach((p) => {
      (p.items || []).forEach((i) => {
        total++;
        if (localChecks[i.id]) checked++;
      });
    });
    const ratio = total > 0 ? Math.round((checked / total) * 100) : 0;
    return { totalItems: total, checkedItems: checked, progressRatio: ratio };
  }, [checklistPacks, localChecks]);

  // D-Day 계산
  const ddayText = useMemo(() => {
    if (!bag.travelDate) return "";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(bag.travelDate);
    target.setHours(0, 0, 0, 0);
    const diff = Math.ceil(
      (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    return diff === 0 ? "D-DAY" : diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`;
  }, [bag.travelDate]);

  // 온보딩 및 앱 진입 링크
  const appEntryUrl = activeInviteCode
    ? `/?invite=${activeInviteCode}`
    : `/?openBag=${bag.id}`;

  // 폰트 크기 스타일 배율
  const fontClasses = {
    normal: {
      bagTitle: "text-[20px] md:text-[22px]",
      packTitle: "text-[15px] md:text-[16px]",
      itemText: "text-[14px]",
      checkbox: "w-5 h-5",
      checkIcon: 14,
      notice: "text-[13px]",
      meta: "text-[12px]",
    },
    large: {
      bagTitle: "text-[22px] md:text-[24px]",
      packTitle: "text-[17px] md:text-[18px]",
      itemText: "text-[16px]",
      checkbox: "w-5.5 h-5.5",
      checkIcon: 16,
      notice: "text-[14.5px]",
      meta: "text-[13.5px]",
    },
    xlarge: {
      bagTitle: "text-[24px] md:text-[26px]",
      packTitle: "text-[19px] md:text-[20px]",
      itemText: "text-[18px]",
      checkbox: "w-6 h-6",
      checkIcon: 18,
      notice: "text-[16px]",
      meta: "text-[15px]",
    },
  }[fontScale];

  return (
    <main className="h-screen w-full overflow-y-auto bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-36 font-sans select-none md:select-auto transition-colors duration-200">
      {/* 상단 헤더 */}
      <header className="sticky top-0 z-30 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-2.5 transition-colors duration-200">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              <IconBackpack size={16} />
            </div>
            <span className="font-bold text-[15px] tracking-tight">PackInBag</span>
          </div>

          <div className="flex items-center gap-2">
            {/* 글자 크기 변경 버튼 */}
            <button
              type="button"
              onClick={handleToggleFontScale}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[12px] font-semibold transition-colors border border-slate-200/80 dark:border-slate-700/80"
              title="글씨 크기 변경"
              aria-label="글씨 크기 변경"
            >
              <span className="font-bold text-[11px] px-1 py-0.2 rounded bg-slate-200 dark:bg-slate-700">
                A
              </span>
              <span>{FONT_SCALE_LABELS[fontScale]}</span>
            </button>

            {/* 화면 꺼짐 방지 체크박스 */}
            <label
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[12px] font-semibold transition-colors border cursor-pointer select-none ${
                wakeLockEnabled
                  ? "bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800"
                  : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-slate-700/80"
              }`}
              title="화면 꺼짐 방지 (체크 시 모바일에서 화면이 꺼지지 않아요)"
            >
              <input
                type="checkbox"
                checked={wakeLockEnabled}
                onChange={handleToggleWakeLock}
                className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-0 cursor-pointer accent-blue-600"
              />
              <span className="hidden sm:inline">화면 꺼짐 방지</span>
              <span className="sm:hidden">화면유지</span>
            </label>

            {/* 라이트/다크모드 토글 버튼 */}
            <button
              type="button"
              onClick={handleToggleTheme}
              className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors border border-slate-200/80 dark:border-slate-700/80"
              title={isDark ? "라이트 모드로 전환" : "다크 모드로 전환"}
              aria-label="화면 모드 전환"
            >
              {isDark ? <IconSun size={17} /> : <IconMoon size={17} />}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-4">
        {/* 가방 메인 타이틀 카드 */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-xs space-y-3 transition-colors duration-200">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/80">
                  {activeInviteCode ? "초대 포함 모드" : "보기 전용 모드"}
                </span>
              </div>
              <h1
                className={`${fontClasses.bagTitle} font-bold text-slate-900 dark:text-white leading-tight break-words`}
              >
                {bag.name}
              </h1>
              {bag.travelDate && (
                <p
                  className={`${fontClasses.notice} text-slate-500 flex items-center gap-1.5 mt-1 font-medium`}
                >
                  <IconCalendar size={14} />
                  {bag.travelDate}
                </p>
              )}
            </div>
            {ddayText && (
              <span className="px-3 py-1 rounded-xl bg-blue-600 text-white text-[13px] font-extrabold shadow-xs shrink-0">
                {ddayText}
              </span>
            )}
          </div>

          {bag.notice && (
            <div
              className={`p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 ${fontClasses.notice} text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed border border-slate-100 dark:border-slate-800/40`}
            >
              {bag.notice}
            </div>
          )}

          {/* 패킹 달성률 바 (로컬 체크 연동) */}
          {totalItems > 0 && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
              <div className="flex justify-between items-center text-[12px] font-medium">
                <span className="text-slate-500">패킹 달성률</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  {checkedItems} / {totalItems}개 ({progressRatio}%)
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${progressRatio}%` }}
                />
              </div>
            </div>
          )}
        </section>

        {/* 상단 조작 툴바: 전체 접기/펴기 & 안내 */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5 text-[12px] text-slate-500 dark:text-slate-400">
            <IconInfoCircle size={14} className="shrink-0 text-blue-500" />
            <span>체크는 현재 브라우저에 임시 저장돼요</span>
          </div>

          {validPacks.length > 1 && (
            <button
              type="button"
              onClick={handleToggleAllPacks}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-300 text-[12px] font-medium transition-colors"
            >
              {allCollapsed ? (
                <>
                  <IconChevronDown size={14} />
                  <span>모두 펴기</span>
                </>
              ) : (
                <>
                  <IconChevronUp size={14} />
                  <span>모두 접기</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* 팩 목록: 모바일 1열, 태블릿 2열, 데스크탑 최대 3열 반응형 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 md:gap-4 items-start">
          {validPacks.map((pack) => {
            const isCollapsed = !!collapsedPacks[pack.id];
            const isMemo = pack.kind === "editor";
            const items = pack.items || [];
            const packCheckedCount = items.filter((i) => localChecks[i.id]).length;
            const allItemsPacked = items.length > 0 && packCheckedCount === items.length;

            return (
              <section
                key={pack.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden transition-colors duration-200"
              >
                {/* 팩 헤더 (클릭 시 접기/펴기 아코디언) */}
                <button
                  type="button"
                  onClick={() => togglePackCollapse(pack.id)}
                  className="w-full text-left p-4 flex items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors"
                  aria-expanded={!isCollapsed}
                >
                  <div className="min-w-0 flex-1 flex items-center gap-2">
                    <span
                      className={`${fontClasses.packTitle} font-bold text-slate-900 dark:text-white truncate`}
                    >
                      {pack.name}
                    </span>
                    {!isMemo && items.length > 0 && (
                      <span
                        className={`text-[12px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                          allItemsPacked
                            ? "bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {packCheckedCount}/{items.length}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-slate-400 shrink-0">
                    <span className="text-[12px] font-medium text-slate-400">
                      {isCollapsed ? "펼치기" : "접기"}
                    </span>
                    {isCollapsed ? (
                      <IconChevronDown size={17} />
                    ) : (
                      <IconChevronUp size={17} />
                    )}
                  </div>
                </button>

                {/* 팩 본문 (접힘 상태가 아닐 때 노출) */}
                {!isCollapsed && (
                  <div className="px-4 pb-4 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                    {isMemo ? (
                      <div className="mt-1">
                        <GuestMemoPackView
                          pack={pack}
                          className={fontClasses.itemText}
                        />
                      </div>
                    ) : items.length === 0 ? (
                      <p className="text-[13px] text-slate-400 py-2 italic">
                        추가된 짐 항목이 없어요
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {items.map((item) => {
                          const isChecked = !!localChecks[item.id];
                          return (
                            <div
                              key={item.id}
                              onClick={() => handleToggleCheck(item.id)}
                              className="flex items-center gap-3 py-2.5 cursor-pointer select-none group transition-opacity active:opacity-60"
                            >
                              <div
                                className={`${fontClasses.checkbox} rounded-md flex items-center justify-center shrink-0 border transition-all ${
                                  isChecked
                                    ? "bg-blue-600 border-blue-600 text-white shadow-2xs"
                                    : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 group-hover:border-blue-400"
                                }`}
                              >
                                {isChecked && (
                                  <IconCheck
                                    size={fontClasses.checkIcon}
                                    stroke={3}
                                  />
                                )}
                              </div>
                              <span
                                className={`${fontClasses.itemText} leading-snug break-words flex-1 transition-all ${
                                  isChecked
                                    ? "line-through text-slate-400 dark:text-slate-500"
                                    : "text-slate-800 dark:text-slate-200 font-medium"
                                }`}
                              >
                                {item.text}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>

      {/* 하단 고정 온보딩 & 가방 열기/참여 배너 */}
      <div className="fixed bottom-0 inset-x-0 p-4 bg-white/92 dark:bg-slate-900/92 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 z-40 shadow-lg transition-colors duration-200">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
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
