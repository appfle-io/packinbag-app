"use client";

import { useState } from "react";
import { IconCards, IconCheck, IconFileText } from "@tabler/icons-react";
import ShareCardModal from "@/components/ShareCardModal";
import { GUIDE_SAMPLE_BAG } from "@/lib/guideSampleData";

export default function GuideShareCardsDemo() {
  const [showShareModal, setShowShareModal] = useState(false);

  return (
    <div className="w-full flex flex-col gap-2.5 select-none">
      <div className="grid grid-cols-3 gap-2 text-center text-[11.5px]">
        <button
          type="button"
          onClick={() => setShowShareModal(true)}
          className="rounded-xl bg-surface/30 p-3 border border-border/50 hover:border-accent flex flex-col items-center gap-1.5 transition-colors cursor-pointer group"
        >
          <div className="p-2 rounded-lg bg-accent-soft text-accent group-hover:scale-105 transition-transform">
            <IconCards size={18} />
          </div>
          <span className="font-semibold text-foreground">탑승권 카드</span>
          <span className="text-[10px] text-accent font-medium">모달 열기 &rarr;</span>
        </button>

        <button
          type="button"
          onClick={() => setShowShareModal(true)}
          className="rounded-xl bg-surface/30 p-3 border border-border/50 hover:border-accent flex flex-col items-center gap-1.5 transition-colors cursor-pointer group"
        >
          <div className="p-2 rounded-lg bg-accent-soft text-accent group-hover:scale-105 transition-transform">
            <IconFileText size={18} />
          </div>
          <span className="font-semibold text-foreground">영수증 카드</span>
          <span className="text-[10px] text-accent font-medium">모달 열기 &rarr;</span>
        </button>

        <button
          type="button"
          onClick={() => setShowShareModal(true)}
          className="rounded-xl bg-surface/30 p-3 border border-border/50 hover:border-accent flex flex-col items-center gap-1.5 transition-colors cursor-pointer group"
        >
          <div className="p-2 rounded-lg bg-accent-soft text-accent group-hover:scale-105 transition-transform">
            <IconCheck size={18} />
          </div>
          <span className="font-semibold text-foreground">폴라로이드 카드</span>
          <span className="text-[10px] text-accent font-medium">모달 열기 &rarr;</span>
        </button>
      </div>

      {/* 실제 프로젝트의 공유 카드 3종 모달 (ShareCardModal) */}
      {showShareModal && (
        <ShareCardModal
          bag={GUIDE_SAMPLE_BAG}
          currentUid="sample-user"
          initialTab="card"
          onClose={() => setShowShareModal(false)}
        />
      )}

      {/*
        [보관용: 커스텀 공유 카드 디자인]
        아래는 추후 전용 SNS 템플릿 추가 시 활용 가능한 커스텀 카드 코드입니다.
        - D-Day 그라디언트 카드
        - 짐 챙김 진행률 게이지 카드
        - 미니멀 체크리스트 요약 카드
      */}
    </div>
  );
}
