"use client";

import { useState } from "react";
import { IconCards, IconCheck, IconFileText, IconNotes } from "@tabler/icons-react";
import ShareCardModal from "@/components/ShareCardModal";
import MemoPackShareModal from "@/components/MemoPackShareModal";
import { GUIDE_SAMPLE_BAG } from "@/lib/guideSampleData";

export default function GuideShareCardsDemo() {
  const [showShareModal, setShowShareModal] = useState(false);
  const [showMemoShareModal, setShowMemoShareModal] = useState(false);

  // 가이드용 샘플 메모팩
  const sampleMemoPack = GUIDE_SAMPLE_BAG.packs.find((p) => p.kind === "editor") || {
    id: "sample-memo-pack",
    name: "도쿄 3박4일 여행 일정 & 맛집 리스트",
    type: "pack",
    kind: "editor",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: [],
    editorPreviewText: "Day 1: 나리타 공항 도착 (14:15)\n- N'EX 타고 신주쿠역 이동\n- 저녁: 신주쿠 츠케멘\n- 도쿄도청 전망대 야경",
  };

  return (
    <div className="w-full flex flex-col gap-2.5 select-none">
      {/* 1. SNS 공유 카드 3종 버튼 */}
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

      {/* 2. 신규: 메모팩 단독 서식 유지 웹 문서 공유 모달 열기 버튼 */}
      <button
        type="button"
        onClick={() => setShowMemoShareModal(true)}
        className="rounded-xl bg-surface/30 border border-border/50 hover:border-accent p-3 flex items-center justify-between gap-2 text-left transition-colors cursor-pointer group mt-0.5"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-lg bg-accent-soft text-accent group-hover:scale-105 transition-transform shrink-0">
            <IconNotes size={18} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[12.5px] font-semibold text-foreground truncate">
              메모팩 단독 웹 문서 공유
            </span>
            <span className="text-[11px] text-text-muted truncate">
              서식과 표가 유지된 단정한 웹 문서 공유 모달을 열어보세요.
            </span>
          </div>
        </div>

        <span className="text-[10.5px] px-2.5 py-1 rounded-lg bg-accent text-white font-semibold shrink-0">
          모달 열기 &rarr;
        </span>
      </button>

      {/* 실제 프로젝트의 공유 카드 3종 모달 (ShareCardModal) */}
      {showShareModal && (
        <ShareCardModal
          bag={GUIDE_SAMPLE_BAG}
          currentUid="sample-user"
          initialTab="card"
          onClose={() => setShowShareModal(false)}
        />
      )}

      {/* 메모팩 전용 서식 유지 웹 문서 공유 모달 (MemoPackShareModal) */}
      {showMemoShareModal && (
        <MemoPackShareModal
          pack={sampleMemoPack}
          onClose={() => setShowMemoShareModal(false)}
        />
      )}
    </div>
  );
}
