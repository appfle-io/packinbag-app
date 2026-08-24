"use client";

import { useState } from "react";
import { IconShare, IconEye, IconCopy, IconCheck, IconExternalLink } from "@tabler/icons-react";
import ShareCardModal from "@/components/ShareCardModal";
import { GUIDE_SAMPLE_BAG } from "@/lib/guideSampleData";

export default function GuideShareDemo() {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyReadOnlyLink = async () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/v/sample-guide-view`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      alert(`[보기 전용 링크 복사 완료!]\n\n${url}\n\n새 브라우저 탭에 붙여넣으면 수정/체크가 잠긴 실제 보기 전용 화면을 볼 수 있어요.`);
      setTimeout(() => setCopiedLink(false), 3000);
    } catch {
      alert(`[보기 전용 링크]\n\n${url}\n\n브라우저 주소창에 입력해보세요.`);
    }
  };

  return (
    <div className="w-full flex flex-col gap-3 select-none">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12px]">
        {/* 1. 그룹원 초대 카드 버튼 */}
        <button
          type="button"
          onClick={() => setShowInviteModal(true)}
          className="rounded-xl bg-surface/30 border border-border/50 hover:border-accent p-3.5 flex flex-col gap-1.5 text-left transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <IconShare size={15} className="text-accent" />
              <span>그룹원 초대 (공동 편집)</span>
            </div>
            <span className="text-[10.5px] px-2 py-0.5 rounded bg-accent-soft text-accent font-medium">
              실제 모달 열기 &rarr;
            </span>
          </div>
          <p className="text-[11.5px] text-text-muted leading-relaxed">
            친구와 함께 짐을 추가/체크하는 실제 초대 모달을 열어보세요.
          </p>
        </button>

        {/* 2. 보기 전용 링크 복사 버튼 */}
        <div className="rounded-xl bg-surface/30 border border-border/50 p-3.5 flex flex-col justify-between gap-2">
          <div className="flex flex-col gap-1 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <IconEye size={15} className="text-accent" />
                <span>보기 전용 링크 (읽기 전용)</span>
              </div>
            </div>
            <p className="text-[11.5px] text-text-muted leading-relaxed">
              체크/수정이 잠긴 안전한 열람용 링크예요. 복사 후 직접 열어보세요.
            </p>
          </div>

          <div className="flex items-center gap-1.5 pt-1">
            <button
              type="button"
              onClick={handleCopyReadOnlyLink}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg border text-[11.5px] font-medium transition-colors ${
                copiedLink
                  ? "bg-accent text-white border-accent"
                  : "bg-surface/50 border-border/60 hover:border-accent text-foreground"
              }`}
            >
              {copiedLink ? <IconCheck size={13} stroke={3} /> : <IconCopy size={13} />}
              <span>{copiedLink ? "링크 복사됨!" : "링크 복사하기"}</span>
            </button>

            <a
              href="/v/sample-guide-view"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg bg-surface/50 border border-border/60 hover:border-accent text-[11.5px] font-medium text-text-secondary hover:text-foreground transition-colors shrink-0"
              title="새 탭에서 실제 보기 페이지 열기"
            >
              <IconExternalLink size={13} />
              <span>새 탭 열기</span>
            </a>
          </div>
        </div>
      </div>

      {/* 실제 앱의 그룹원 초대 모달 팝업 */}
      {showInviteModal && (
        <ShareCardModal
          bag={GUIDE_SAMPLE_BAG}
          currentUid="sample-user"
          initialTab="members"
          onClose={() => setShowInviteModal(false)}
        />
      )}
    </div>
  );
}
