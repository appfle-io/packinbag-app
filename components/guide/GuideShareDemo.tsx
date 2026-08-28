"use client";

import { useState } from "react";
import { IconShare, IconEye, IconCopy, IconCheck, IconExternalLink } from "@tabler/icons-react";
import ShareCardModal from "@/components/ShareCardModal";
import { GUIDE_SAMPLE_BAG } from "@/lib/guideSampleData";
import { useToast } from "@/components/Toast";

export default function GuideShareDemo() {
  const { show } = useToast();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyReadOnlyLink = async () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/v/sample-guide-view`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      show("보기 전용 링크가 복사되었어요! 새 탭에 붙여넣어 보세요.");
      setTimeout(() => setCopiedLink(false), 3000);
    } catch {
      show("링크 복사에 실패했어요");
    }
  };

  return (
    <div className="w-full flex flex-col gap-3 select-none">
      <div className="p-3.5 rounded-2xl bg-white dark:bg-surface border border-border flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[12px]">
          {/* 1. 그룹원 초대 카드 버튼 */}
          <button
            type="button"
            onClick={() => setShowInviteModal(true)}
            className="rounded-xl bg-white dark:bg-surface-2 border border-border hover:border-accent p-3.5 flex flex-col justify-between gap-3 text-left transition-colors cursor-pointer group shadow-xs min-h-[90px]"
          >
            <div className="flex items-center gap-1.5 font-bold text-foreground">
              <IconShare size={15} className="text-accent" />
              <span>그룹원 초대 (공동 편집)</span>
            </div>
            <div className="flex items-center justify-end">
              <span className="text-[11px] px-2.5 py-1 rounded-md bg-accent-soft text-accent font-semibold">
                초대 모달 열기 &rarr;
              </span>
            </div>
          </button>

          {/* 2. 보기 전용 링크 복사 버튼 */}
          <div className="rounded-xl bg-white dark:bg-surface-2 border border-border p-3.5 flex flex-col justify-between gap-3 shadow-xs min-h-[90px]">
            <div className="flex items-center gap-1.5 font-bold text-foreground">
              <IconEye size={15} className="text-accent" />
              <span>보기 전용 링크 (읽기 전용)</span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleCopyReadOnlyLink}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg border text-[11.5px] font-medium transition-colors cursor-pointer ${
                  copiedLink
                    ? "bg-accent text-white border-accent shadow-2xs"
                    : "bg-surface-2 hover:bg-surface-3 border-border text-foreground"
                }`}
              >
                {copiedLink ? <IconCheck size={13} stroke={3} /> : <IconCopy size={13} />}
                <span>{copiedLink ? "복사됨" : "링크 복사"}</span>
              </button>

              <a
                href="/v/sample-guide-view"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg bg-surface-2 hover:bg-surface-3 border border-border text-[11.5px] font-medium text-text-secondary hover:text-foreground transition-colors shrink-0"
              >
                <IconExternalLink size={13} />
                <span>열기</span>
              </a>
            </div>
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
