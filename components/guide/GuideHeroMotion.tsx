"use client";

import { useState, useEffect } from "react";
import { IconDeviceLaptop, IconBottle, IconShirt, IconSparkles } from "@tabler/icons-react";
import BackpackLogo from "@/components/BackpackLogo";

export default function GuideHeroMotion() {
  const [stage, setStage] = useState<number>(0); // 0: 대기, 1: 팩1 진입, 2: 팩2 진입, 3: 팩3 진입, 4: 패킹 완료

  useEffect(() => {
    const timer = setInterval(() => {
      setStage((prev) => (prev + 1) % 5);
    }, 1400);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full relative overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-b from-surface/30 to-surface/10 p-6 flex flex-col items-center justify-center min-h-[220px] select-none shadow-xs">
      {/* 배경 장식 원 */}
      <div className="absolute w-48 h-48 rounded-full bg-accent/10 blur-2xl pointer-events-none -top-10" />

      {/* 애니메이션 스테이지 영역 */}
      <div className="relative w-full max-w-[280px] h-[140px] flex items-center justify-center">
        {/* 날아오는 팩 1 (전자기기) */}
        <div
          className={`absolute z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/70 bg-surface shadow-md text-[12px] font-semibold text-foreground transition-all duration-700 ease-in-out ${
            stage === 0
              ? "-top-4 -left-6 opacity-0 scale-75 rotate-[-12deg]"
              : stage === 1
              ? "top-1 left-2 opacity-100 scale-100 rotate-[-6deg]"
              : "top-14 left-1/2 -translate-x-1/2 opacity-0 scale-50 rotate-0"
          }`}
        >
          <div className="p-1 rounded-md bg-accent-soft text-accent">
            <IconDeviceLaptop size={14} />
          </div>
          <span>전자기기 팩</span>
        </div>

        {/* 날아오는 팩 2 (세면도구) */}
        <div
          className={`absolute z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/70 bg-surface shadow-md text-[12px] font-semibold text-foreground transition-all duration-700 ease-in-out ${
            stage <= 1
              ? "-top-4 -right-6 opacity-0 scale-75 rotate-[12deg]"
              : stage === 2
              ? "top-1 right-2 opacity-100 scale-100 rotate-[6deg]"
              : "top-14 left-1/2 -translate-x-1/2 opacity-0 scale-50 rotate-0"
          }`}
        >
          <div className="p-1 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <IconBottle size={14} />
          </div>
          <span>세면도구 팩</span>
        </div>

        {/* 날아오는 팩 3 (의류) */}
        <div
          className={`absolute z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/70 bg-surface shadow-md text-[12px] font-semibold text-foreground transition-all duration-700 ease-in-out ${
            stage <= 2
              ? "-top-8 left-1/2 -translate-x-1/2 opacity-0 scale-75"
              : stage === 3
              ? "-top-1 left-1/2 -translate-x-1/2 opacity-100 scale-100"
              : "top-14 left-1/2 -translate-x-1/2 opacity-0 scale-50"
          }`}
        >
          <div className="p-1 rounded-md bg-blue-500/15 text-blue-600 dark:text-blue-400">
            <IconShirt size={14} />
          </div>
          <span>의류 팩</span>
        </div>

        {/* 중앙 여행 가방 (배낭) */}
        <div
          className={`relative z-10 flex flex-col items-center justify-center transition-transform duration-300 ease-out mt-6 ${
            stage === 1 || stage === 2 || stage === 3 ? "scale-105 -translate-y-1" : "scale-100 translate-y-0"
          }`}
        >
          {/* 가방 입구 반짝임 */}
          {stage === 4 && (
            <div className="absolute -top-3 flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-accent text-white text-[11px] font-bold shadow-md animate-bounce z-30">
              <IconSparkles size={12} />
              <span>패킹 완료!</span>
            </div>
          )}

          {/* 배낭 본체 */}
          <div className="relative p-3 rounded-2xl bg-surface/80 border-2 border-accent/40 shadow-lg flex items-center justify-center">
            <BackpackLogo size={64} />
            {/* 가방 속 담긴 팩 카운트 뱃지 */}
            <div className="absolute -bottom-2 -right-2 px-2 py-0.5 rounded-full bg-accent text-white text-[10.5px] font-extrabold shadow-sm border-2 border-surface">
              {stage === 0 ? "0" : stage === 1 ? "1" : stage === 2 ? "2" : stage === 3 ? "3" : "3"} / 3
            </div>
          </div>
        </div>
      </div>

      {/* 하단 모션 설명 캡션 */}
      <div className="mt-2 text-center">
        <p className="text-[13.5px] font-bold text-foreground">
          가방 속에 팩을 쏙! 여행 준비 끝
        </p>
        <p className="text-[11.5px] text-text-muted mt-0.5">
          카테고리별로 팩을 만들어 가방에 담아 스마트하게 체크해요
        </p>
      </div>
    </div>
  );
}
