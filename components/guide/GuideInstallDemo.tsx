"use client";

import { useState, useEffect, useRef } from "react";
import {
  IconBrandChrome,
  IconBrandApple,
  IconDownload,
  IconShare,
  IconSquarePlus,
  IconCheck,
  IconReload,
  IconDeviceDesktop,
  IconDeviceMobile,
  IconLock,
  IconPlayerPlay,
  IconPlayerPause,
  IconX,
  IconChevronRight,
  IconBookmark,
  IconStar,
  IconNotebook,
  IconMessageCircle,
  IconMail,
  IconSend,
  IconArrowDown,
  IconHandFinger,
} from "@tabler/icons-react";
import BackpackLogo from "@/components/BackpackLogo";

export type InstallBrowserTab = "chrome" | "safari";

export default function GuideInstallDemo() {
  const [activeTab, setActiveTab] = useState<InstallBrowserTab>("safari"); // 사파리를 기본 탭으로 설정
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [chromeStep, setChromeStep] = useState<number>(0); // 0: initial, 1: hover install, 2: dialog open, 3: installed app window
  const [safariStep, setSafariStep] = useState<number>(0); // 0: Safari 화면, 1: 공유시트 열림(앱행), 2: 스크롤 및 [홈화면에추가] 탭, 3: [추가] 다이얼로그, 4: 홈화면 앱 아이콘 생성 완료

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Chrome 자동 루프
  useEffect(() => {
    if (!isPlaying) return;
    if (activeTab !== "chrome") return;

    if (timerRef.current) clearTimeout(timerRef.current);

    const nextDelay =
      chromeStep === 0 ? 1600 : chromeStep === 1 ? 1300 : chromeStep === 2 ? 1800 : 2800;

    timerRef.current = setTimeout(() => {
      setChromeStep((prev) => (prev + 1) % 4);
    }, nextDelay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [activeTab, chromeStep, isPlaying]);

  // Safari 자동 루프 (실제 5단계 흐름)
  useEffect(() => {
    if (!isPlaying) return;
    if (activeTab !== "safari") return;

    if (timerRef.current) clearTimeout(timerRef.current);

    const nextDelay =
      safariStep === 0
        ? 1500
        : safariStep === 1
        ? 2000 // 스크롤 강조 시간 여유있게
        : safariStep === 2
        ? 1800
        : safariStep === 3
        ? 1600
        : 3000;

    timerRef.current = setTimeout(() => {
      setSafariStep((prev) => (prev + 1) % 5);
    }, nextDelay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [activeTab, safariStep, isPlaying]);

  const handleTabChange = (tab: InstallBrowserTab) => {
    setActiveTab(tab);
    setChromeStep(0);
    setSafariStep(0);
    setIsPlaying(true);
  };

  const handleReset = () => {
    if (activeTab === "chrome") setChromeStep(0);
    else setSafariStep(0);
    setIsPlaying(true);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 상단 탭 전환: Chrome vs Safari */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface-2 border border-border">
          <button
            type="button"
            onClick={() => handleTabChange("safari")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-medium transition-all cursor-pointer ${
              activeTab === "safari"
                ? "bg-surface text-foreground shadow-2xs font-semibold"
                : "text-text-muted hover:text-foreground"
            }`}
          >
            <IconBrandApple size={15} stroke={1.75} />
            <span>Safari / iPhone / iPad</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("chrome")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-medium transition-all cursor-pointer ${
              activeTab === "chrome"
                ? "bg-surface text-foreground shadow-2xs font-semibold"
                : "text-text-muted hover:text-foreground"
            }`}
          >
            <IconBrandChrome size={15} stroke={1.75} />
            <span>Chrome / PC / Android</span>
          </button>
        </div>

        {/* 재생 / 일시정지 / 다시보기 */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsPlaying((p) => !p)}
            className="p-1.5 rounded-lg border border-border bg-surface text-text-muted hover:text-foreground transition-colors cursor-pointer"
            aria-label={isPlaying ? "일시정지" : "재생"}
            title={isPlaying ? "일시정지" : "재생"}
          >
            {isPlaying ? (
              <IconPlayerPause size={14} stroke={1.75} />
            ) : (
              <IconPlayerPlay size={14} stroke={1.75} />
            )}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="p-1.5 rounded-lg border border-border bg-surface text-text-muted hover:text-foreground transition-colors cursor-pointer"
            aria-label="다시보기"
            title="다시보기"
          >
            <IconReload size={14} stroke={1.75} />
          </button>
        </div>
      </div>

      {/* 애니메이션 뷰어 컨테이너 */}
      <div className="relative rounded-2xl border border-border bg-surface/50 overflow-hidden shadow-xs">
        {activeTab === "safari" ? (
          /* ======================================================== */
          /* SAFARI / IOS REAL SHARE SHEET ANIMATION                  */
          /* ======================================================== */
          <div className="p-3 sm:p-5 flex flex-col gap-4">
            {/* 아이폰 프레임 목업 */}
            <div className="max-w-[320px] mx-auto w-full rounded-[32px] border-[3px] border-border-strong bg-background shadow-2xl overflow-hidden flex flex-col transition-all duration-300 min-h-[470px] relative">
              {/* iOS 상단 상태바 & 노치 */}
              <div className="pt-2 px-5 pb-1 flex items-center justify-between text-[11px] font-semibold text-foreground bg-surface shrink-0 select-none">
                <span>14:14</span>
                <div className="w-20 h-4 bg-foreground/20 rounded-full" />
                <div className="flex items-center gap-1 text-[10px]">
                  <span>5G</span>
                  <div className="w-4 h-2 rounded-[2px] border border-foreground/60 flex items-center p-0.5">
                    <div className="w-full h-full bg-foreground rounded-[1px]" />
                  </div>
                </div>
              </div>

              {/* 본문 영역 */}
              <div className="flex-1 flex flex-col relative overflow-hidden bg-background">
                {/* 팩인백 로그인/홈 화면 배경 목업 */}
                <div className="p-4 flex-1 flex flex-col items-center justify-center text-center opacity-85">
                  <div className="w-12 h-12 rounded-2xl bg-orange-500 flex items-center justify-center text-white shadow-md mb-2">
                    <BackpackLogo size={28} />
                  </div>
                  <div className="text-[13px] font-bold text-foreground">로그인하고 계속하기</div>
                  <div className="w-full max-w-[200px] mt-3 flex flex-col gap-1.5">
                    <div className="h-6 rounded-md bg-surface-2 border border-border/80 text-[10px] text-text-muted flex items-center px-2">
                      이메일
                    </div>
                    <div className="h-6 rounded-md bg-surface-2 border border-border/80 text-[10px] text-text-muted flex items-center px-2">
                      비밀번호
                    </div>
                    <div className="h-7 rounded-md bg-green-600 text-white text-[11px] font-medium flex items-center justify-center mt-1">
                      로그인
                    </div>
                  </div>
                </div>

                {/* 1) Safari 하단 툴바 (공유 버튼 포함) */}
                <div className="px-5 py-2.5 border-t border-border bg-surface/95 backdrop-blur-xs flex items-center justify-between text-text-secondary shrink-0 z-10">
                  <span className="text-[12px] font-mono text-text-muted">〈</span>
                  <span className="text-[12px] font-mono text-text-muted">〉</span>

                  {/* 공유 버튼 (중앙 펄스 효과) */}
                  <button
                    type="button"
                    onClick={() => setSafariStep(1)}
                    className={`p-1.5 rounded-lg transition-all relative ${
                      safariStep === 0
                        ? "bg-accent/15 text-accent ring-2 ring-accent animate-pulse"
                        : "text-accent hover:bg-surface-2"
                    }`}
                    aria-label="공유 버튼"
                  >
                    <IconShare size={18} stroke={2} />
                    {safariStep === 0 && (
                      <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-accent animate-ping" />
                    )}
                  </button>

                  <span className="text-[11px] font-mono text-text-muted">Aa</span>
                  <span className="text-[12px] font-mono text-text-muted">⊞</span>
                </div>

                {/* 2) iOS 공유 시트 (Step 1: 앱 목록 열림 + 스크롤 강력 강조) */}
                {safariStep === 1 && (
                  <div className="absolute inset-0 z-20 bg-black/40 flex flex-col justify-end animate-in fade-in duration-200">
                    <div className="rounded-t-[24px] bg-[#2c2c2e] text-white p-3.5 pb-4 shadow-2xl flex flex-col gap-2.5 animate-in slide-in-from-bottom duration-300">
                      {/* 시트 상단 헤더 카드 */}
                      <div className="flex items-center gap-2.5 bg-[#3a3a3c] p-2.5 rounded-xl">
                        <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center text-white shrink-0 shadow-xs">
                          <BackpackLogo size={22} />
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                          <div className="text-[12px] font-semibold text-white truncate">
                            팩인백 · Pack In Bag
                          </div>
                          <div className="text-[10px] text-neutral-400 truncate">
                            packinbag.seeuson.com
                          </div>
                        </div>
                        <div className="px-2 py-0.5 rounded-full bg-[#48484a] text-[10px] text-neutral-300 flex items-center gap-0.5">
                          <span>Options</span>
                          <IconChevronRight size={10} stroke={2} />
                        </div>
                      </div>

                      {/* 가로 공유 앱 아이콘 목록 */}
                      <div className="grid grid-cols-4 gap-2 pt-0.5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-11 h-11 rounded-2xl bg-blue-500 flex items-center justify-center text-white shadow-xs">
                            <IconSend size={20} stroke={1.75} />
                          </div>
                          <span className="text-[9.5px] text-neutral-300">AirDrop</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-11 h-11 rounded-2xl bg-green-500 flex items-center justify-center text-white shadow-xs">
                            <IconMessageCircle size={20} stroke={1.75} />
                          </div>
                          <span className="text-[9.5px] text-neutral-300">메시지</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-11 h-11 rounded-2xl bg-sky-500 flex items-center justify-center text-white shadow-xs">
                            <IconMail size={20} stroke={1.75} />
                          </div>
                          <span className="text-[9.5px] text-neutral-300">Mail</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-11 h-11 rounded-2xl bg-yellow-400 flex items-center justify-center text-black font-bold text-[11px] shadow-xs">
                            TALK
                          </div>
                          <span className="text-[9.5px] text-neutral-300">카카오톡</span>
                        </div>
                      </div>

                      {/* ★ 강력 강조: 아래로 스크롤하여 메뉴 찾기 안내 배너 */}
                      <div
                        onClick={() => setSafariStep(2)}
                        className="w-full py-2.5 px-3 rounded-xl bg-blue-600 text-white text-[12px] font-bold flex items-center justify-between cursor-pointer shadow-lg ring-2 ring-blue-400/50 animate-bounce"
                      >
                        <div className="flex items-center gap-2">
                          <div className="p-1 rounded-md bg-white/20">
                            <IconArrowDown size={15} stroke={2.5} />
                          </div>
                          <span>아래로 스크롤하여 [홈 화면에 추가] 찾기</span>
                        </div>
                        <IconChevronRight size={15} stroke={2.5} />
                      </div>
                    </div>
                  </div>
                )}

                {/* 3) iOS 공유 시트 스크롤 상태 (Step 2: [홈 화면에 추가] 노출 및 탭) */}
                {safariStep === 2 && (
                  <div className="absolute inset-0 z-20 bg-black/40 flex flex-col justify-end animate-in fade-in duration-200">
                    <div className="rounded-t-[24px] bg-[#2c2c2e] text-white p-3.5 pb-4 shadow-2xl flex flex-col gap-2.5 animate-in slide-in-from-bottom duration-300">
                      {/* 고정 상단 헤더 & X 버튼 */}
                      <div className="flex items-center justify-between pb-1 border-b border-neutral-700">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center text-white shrink-0">
                            <BackpackLogo size={16} />
                          </div>
                          <div className="text-[11.5px] font-semibold text-white truncate">
                            팩인백 · Pack In Bag
                          </div>
                        </div>
                        <div className="w-6 h-6 rounded-full bg-[#3a3a3c] flex items-center justify-center text-neutral-400">
                          <IconX size={13} stroke={2} />
                        </div>
                      </div>

                      {/* 시스템 메뉴 리스트 카드 */}
                      <div className="rounded-xl bg-[#3a3a3c] divide-y divide-neutral-700/80 overflow-hidden text-[12px]">
                        <div className="p-2.5 px-3 flex items-center justify-between text-neutral-300">
                          <span>북마크에 추가</span>
                          <IconBookmark size={14} stroke={1.75} className="text-neutral-400" />
                        </div>
                        <div className="p-2.5 px-3 flex items-center justify-between text-neutral-300">
                          <span>즐겨찾기에 추가</span>
                          <IconStar size={14} stroke={1.75} className="text-neutral-400" />
                        </div>
                        <div className="p-2.5 px-3 flex items-center justify-between text-neutral-300">
                          <span>빠른 메모에 추가</span>
                          <IconNotebook size={14} stroke={1.75} className="text-neutral-400" />
                        </div>

                        {/* [홈 화면에 추가] 강조 행 */}
                        <div
                          onClick={() => setSafariStep(3)}
                          className="p-2.5 px-3 flex items-center justify-between bg-blue-600/35 text-white font-semibold ring-2 ring-blue-400 rounded-lg cursor-pointer transition-all animate-pulse"
                        >
                          <span className="text-blue-300">홈 화면에 추가</span>
                          <IconSquarePlus size={16} stroke={2.2} className="text-blue-400" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4) iOS [홈 화면에 추가] 상단 다이얼로그 (Step 3) */}
                {safariStep === 3 && (
                  <div className="absolute inset-0 z-30 bg-[#2c2c2e] text-white p-4 flex flex-col justify-between animate-in fade-in duration-200">
                    <div className="flex items-center justify-between pb-2 border-b border-neutral-700 text-[12.5px]">
                      <span className="text-neutral-400">취소</span>
                      <span className="font-semibold text-white">홈 화면에 추가</span>
                      <button
                        type="button"
                        onClick={() => setSafariStep(4)}
                        className="font-bold text-blue-400 px-2.5 py-1 rounded-md bg-blue-500/20 ring-2 ring-blue-400 animate-pulse cursor-pointer"
                      >
                        추가
                      </button>
                    </div>

                    <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#3a3a3c] border border-neutral-700 my-auto">
                      <div className="w-11 h-11 rounded-xl bg-orange-500 flex items-center justify-center text-white shrink-0 shadow-md">
                        <BackpackLogo size={24} />
                      </div>
                      <div className="min-w-0 flex-1 text-left">
                        <div className="text-[13px] font-bold text-white">팩인백</div>
                        <div className="text-[11px] text-neutral-400 truncate">
                          https://packinbag.seeuson.com
                        </div>
                      </div>
                    </div>

                    <div className="text-[11px] text-neutral-400 text-center pb-2">
                      오른쪽 상단의 [추가] 버튼을 탭하세요.
                    </div>
                  </div>
                )}

                {/* 5) 홈 화면에 앱 아이콘 생성 완료 (Step 4) */}
                {safariStep === 4 && (
                  <div className="absolute inset-0 z-30 bg-neutral-900 text-white p-6 flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-300">
                    <div className="relative mb-3">
                      <div className="w-16 h-16 rounded-[18px] bg-orange-500 flex items-center justify-center text-white shadow-xl ring-2 ring-white/20">
                        <BackpackLogo size={36} />
                      </div>
                      <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-md">
                        <IconCheck size={14} stroke={3} />
                      </div>
                    </div>
                    <div className="text-[14.5px] font-bold text-white">홈 화면에 추가 완료!</div>
                    <div className="text-[11.5px] text-neutral-400 mt-1 leading-relaxed">
                      이제 아이폰 홈 화면에서 팩인백 아이콘을 눌러 전체 화면 앱으로 편리하게 사용하세요.
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 단계별 스텝 컨트롤 버튼 바 */}
            <div className="grid grid-cols-4 gap-1.5 text-[11px]">
              <div
                onClick={() => setSafariStep(0)}
                className={`p-2 rounded-xl border transition-all cursor-pointer text-center ${
                  safariStep === 0
                    ? "border-accent bg-accent-soft/15 text-foreground font-semibold"
                    : "border-border bg-surface text-text-muted"
                }`}
              >
                <div className="text-accent font-mono text-[9.5px]">STEP 1</div>
                <div>하단 [공유]</div>
              </div>

              <div
                onClick={() => setSafariStep(1)}
                className={`p-2 rounded-xl border transition-all cursor-pointer text-center ${
                  safariStep === 1
                    ? "border-accent bg-accent-soft/15 text-foreground font-semibold"
                    : "border-border bg-surface text-text-muted"
                }`}
              >
                <div className="text-accent font-mono text-[9.5px]">STEP 2</div>
                <div>아래로 스크롤</div>
              </div>

              <div
                onClick={() => setSafariStep(2)}
                className={`p-2 rounded-xl border transition-all cursor-pointer text-center ${
                  safariStep === 2
                    ? "border-accent bg-accent-soft/15 text-foreground font-semibold"
                    : "border-border bg-surface text-text-muted"
                }`}
              >
                <div className="text-accent font-mono text-[9.5px]">STEP 3</div>
                <div>[홈 화면 추가]</div>
              </div>

              <div
                onClick={() => setSafariStep(3)}
                className={`p-2 rounded-xl border transition-all cursor-pointer text-center ${
                  safariStep >= 3
                    ? "border-accent bg-accent-soft/15 text-foreground font-semibold"
                    : "border-border bg-surface text-text-muted"
                }`}
              >
                <div className="text-accent font-mono text-[9.5px]">STEP 4</div>
                <div>상단 [추가]</div>
              </div>
            </div>
          </div>
        ) : (
          /* ======================================================== */
          /* CHROME / DESKTOP INSTALL ANIMATION                       */
          /* ======================================================== */
          <div className="p-4 sm:p-6 flex flex-col gap-4">
            {/* 상단 브라우저 프레임 */}
            <div className="rounded-xl border border-border bg-background shadow-md overflow-hidden transition-all duration-300">
              {/* 브라우저 상단 윈도우 바 */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface-2/60 text-[11px] text-text-muted">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400/80" />
                </div>
                <div className="flex items-center gap-1 font-medium text-foreground">
                  <BackpackLogo size={13} />
                  <span>팩인백 (PackinBag)</span>
                </div>
                <div className="w-10" />
              </div>

              {/* 브라우저 주소창 영역 (앱 창 모드일 때는 사라짐) */}
              {chromeStep < 3 ? (
                <div className="p-2 px-3 border-b border-border/70 bg-surface flex items-center gap-2 transition-all">
                  <div className="flex-1 flex items-center justify-between px-3 py-1.5 rounded-lg bg-surface-2 border border-border/80 text-[12px]">
                    <div className="flex items-center gap-1.5 text-text-secondary min-w-0">
                      <IconLock size={12} stroke={2} className="text-green-600 shrink-0" />
                      <span className="truncate">https://packinbag.seeuson.com</span>
                    </div>

                    {/* 주소창 우측 앱 설치 버튼 */}
                    <div className="relative shrink-0 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setChromeStep(1)}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                          chromeStep >= 1
                            ? "bg-accent text-white shadow-xs ring-2 ring-accent/30"
                            : "bg-surface border border-border text-foreground hover:bg-surface-2"
                        }`}
                      >
                        <IconDownload size={13} stroke={2} />
                        <span>앱 설치</span>
                      </button>

                      {/* 커서 포인터 (Step 1) */}
                      {chromeStep === 1 && (
                        <div className="absolute -bottom-4 -right-1 z-30 animate-bounce pointer-events-none">
                          <div className="w-4 h-4 border-2 border-accent bg-accent/30 rounded-full animate-ping absolute" />
                          <div className="w-4 h-4 bg-accent rounded-full border-2 border-white shadow-md" />
                        </div>
                      )}

                      {/* 크롬 설치 확인 팝업 (Step 2) */}
                      {chromeStep === 2 && (
                        <div className="absolute top-8 right-0 z-40 w-68 rounded-xl border border-border bg-surface p-3.5 shadow-xl animate-in fade-in zoom-in-95 duration-200">
                          <div className="flex items-start gap-2.5 mb-3">
                            <div className="p-2 rounded-lg bg-surface-2 border border-border shrink-0">
                              <BackpackLogo size={22} />
                            </div>
                            <div className="min-w-0 flex-1 text-left">
                              <div className="text-[13px] font-semibold text-foreground">
                                앱을 설치하시겠습니까?
                              </div>
                              <div className="text-[11px] text-text-muted truncate">
                                packinbag.seeuson.com
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-border">
                            <span className="px-2.5 py-1 text-[11.5px] text-text-muted rounded-md">
                              취소
                            </span>
                            <button
                              type="button"
                              onClick={() => setChromeStep(3)}
                              className="px-3 py-1 rounded-md bg-accent text-white text-[12px] font-medium shadow-xs ring-2 ring-accent/40 animate-pulse"
                            >
                              설치
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

              {/* 브라우저 본문 / 앱 창 본문 */}
              <div className="p-4 sm:p-6 bg-background flex flex-col items-center justify-center min-h-[160px] text-center">
                {chromeStep === 3 ? (
                  <div className="flex flex-col items-center gap-2.5 animate-in zoom-in-95 duration-300">
                    <div className="w-12 h-12 rounded-2xl bg-accent-soft/20 border border-accent/30 flex items-center justify-center text-accent">
                      <IconCheck size={26} stroke={2.5} />
                    </div>
                    <div>
                      <div className="text-[14px] font-semibold text-foreground">
                        독립 앱으로 설치 완료!
                      </div>
                      <div className="text-[12px] text-text-muted mt-0.5">
                        브라우저 주소창 없이 바탕화면 / 작업표시줄에서 바로 실행됩니다.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-text-muted">
                    <BackpackLogo size={32} />
                    <div className="text-[12.5px] text-foreground font-medium">
                      팩인백 웹 화면
                    </div>
                    <div className="text-[11px]">
                      주소창 오른쪽의 [앱 설치] 버튼을 누르면 다운로드됩니다.
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 단계별 스텝 설명 안내 */}
            <div className="grid grid-cols-3 gap-2 text-[11.5px]">
              <div
                onClick={() => setChromeStep(0)}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                  chromeStep <= 1
                    ? "border-accent bg-accent-soft/15 text-foreground font-semibold"
                    : "border-border bg-surface text-text-muted"
                }`}
              >
                <div className="text-accent font-mono text-[10px] mb-0.5">STEP 1</div>
                <div>주소창 우측 [앱 설치] 클릭</div>
              </div>

              <div
                onClick={() => setChromeStep(2)}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                  chromeStep === 2
                    ? "border-accent bg-accent-soft/15 text-foreground font-semibold"
                    : "border-border bg-surface text-text-muted"
                }`}
              >
                <div className="text-accent font-mono text-[10px] mb-0.5">STEP 2</div>
                <div>팝업에서 [설치] 버튼 확인</div>
              </div>

              <div
                onClick={() => setChromeStep(3)}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                  chromeStep === 3
                    ? "border-accent bg-accent-soft/15 text-foreground font-semibold"
                    : "border-border bg-surface text-text-muted"
                }`}
              >
                <div className="text-accent font-mono text-[10px] mb-0.5">STEP 3</div>
                <div>앱 창으로 즉시 실행 & 완료</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 하단 요약 안내 카드 */}
      <div className="p-3.5 rounded-xl border border-border bg-surface flex items-start gap-2.5 text-[12px] text-text-secondary">
        <div className="p-1 rounded-lg bg-surface-2 text-foreground shrink-0 mt-0.5">
          {activeTab === "safari" ? (
            <IconDeviceMobile size={16} stroke={1.75} />
          ) : (
            <IconDeviceDesktop size={16} stroke={1.75} />
          )}
        </div>
        <div className="flex-1 leading-relaxed">
          {activeTab === "safari" ? (
            <div>
              <strong className="text-foreground">Safari (iOS / iPadOS):</strong> 사파리 브라우저
              하단의 [공유] 버튼을 누른 후, 공유 시트 메뉴를 아래로 스크롤하여 [홈 화면에 추가]를
              선택하고 오른쪽 상단의 [추가]를 누르면 홈 화면에 앱 아이콘이 생성됩니다.
            </div>
          ) : (
            <div>
              <strong className="text-foreground">Chrome / Edge (데스크톱 및 안드로이드):</strong>{" "}
              브라우저 상단 주소창 우측의 설치 아이콘을 클릭하면 별도의 앱 스토어 없이 데스크톱
              앱으로 즉시 설치되어 빠른 실행이 가능합니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
