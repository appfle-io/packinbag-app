"use client";

import { useEffect, useState } from "react";
import {
  IconX,
  IconCopy,
  IconCheck,
  IconExternalLink,
  IconShare,
  IconLoader2,
  IconNotes,
} from "@tabler/icons-react";
import { Pack } from "@/lib/types";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/components/Toast";
import Portal from "@/components/Portal";
import { useOverlayLayer, POPOVER_OFFSET } from "@/lib/overlayLayer";
import { useEscapeToClose } from "@/lib/useEscapeToClose";
import MemoDocViewer from "@/components/MemoDocViewer";

interface MemoPackShareModalProps {
  pack: Pack;
  onClose: () => void;
}

export default function MemoPackShareModal({ pack, onClose }: MemoPackShareModalProps) {
  const { user } = useAuth();
  const { show } = useToast();
  const ambientLayer = useOverlayLayer();
  const resolvedZIndex = ambientLayer + POPOVER_OFFSET;
  useEscapeToClose(onClose);

  const [shareToken, setShareToken] = useState<string | null>(pack.publicShareToken ?? null);
  const [loadingToken, setLoadingToken] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    let active = true;
    async function syncLatestShareSnapshot() {
      if (!user) return;
      setLoadingToken(true);
      try {
        const idToken = await user.getIdToken();
        const res = await fetch("/api/share-pack", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            packId: pack.id,
            pack,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (active && data.token) {
            setShareToken(data.token);
          }
        }
      } catch (err) {
        console.error("공유 스냅샷 동기화 실패:", err);
      } finally {
        if (active) setLoadingToken(false);
      }
    }

    syncLatestShareSnapshot();
    return () => {
      active = false;
    };
  }, [user, pack]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shareUrl = shareToken ? `${origin}/p/${shareToken}` : "";

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      show("웹 공유 링크가 복사되었어요");
      setTimeout(() => setLinkCopied(false), 2500);
    } catch {
      show("링크 복사에 실패했어요");
    }
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs transition-opacity"
        style={{ zIndex: resolvedZIndex }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl md:max-w-3xl max-h-[90vh] rounded-2xl bg-surface border border-border flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between p-3.5 px-4 sm:px-5 border-b border-border bg-surface shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-xl bg-accent-soft text-accent">
                <IconNotes size={19} />
              </div>
              <div>
                <h2 className="text-[15px] font-semibold text-foreground">메모팩 공유</h2>
                <p className="text-[11.5px] text-text-muted">웹 문서 열람 및 실시간 공동 작성을 지원해요</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-text-muted hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer"
              aria-label="닫기"
            >
              <IconX size={18} />
            </button>
          </div>

          {/* 상단 링크 복사 & 공유 바 (항상 노출) */}
          <div className="p-3.5 px-4 sm:px-5 bg-surface-2/50 border-b border-border flex flex-col gap-2.5 shrink-0">
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center px-3.5 py-2 rounded-xl bg-surface border border-border text-[12.5px] text-text-secondary truncate shadow-2xs">
                {loadingToken ? (
                  <span className="flex items-center gap-1.5 text-text-muted">
                    <IconLoader2 size={13} className="animate-spin" /> 웹 공유 링크를 생성하고 있어요...
                  </span>
                ) : (
                  <span className="font-mono truncate">{shareUrl || "공유 링크 준비 중..."}</span>
                )}
              </div>

              <button
                type="button"
                onClick={handleCopyLink}
                disabled={!shareUrl}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12.5px] font-medium transition-colors cursor-pointer shrink-0 shadow-2xs ${
                  linkCopied
                    ? "bg-accent text-white"
                    : "bg-surface border border-border hover:border-accent text-foreground disabled:opacity-50"
                }`}
              >
                {linkCopied ? <IconCheck size={15} stroke={2.5} /> : <IconCopy size={15} />}
                <span>{linkCopied ? "복사 완료" : "링크 복사"}</span>
              </button>

              {shareUrl && (
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 rounded-xl bg-surface border border-border hover:border-accent text-text-secondary hover:text-foreground transition-colors shrink-0 shadow-2xs"
                  title="새 브라우저 탭에서 웹 문서 열기"
                >
                  <IconExternalLink size={16} />
                </a>
              )}
            </div>

            {/* 실시간 협업 팁 뱃지 */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent-soft/50 border border-accent/20 text-[11.5px] text-foreground">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
              </span>
              <span className="text-text-secondary truncate">
                <strong className="text-accent font-semibold">실시간 동시 작성 지원:</strong> 가방 속 멤버와 함께 이 메모를 열면 실시간 커서와 타이핑이 즉시 연결돼요.
              </span>
            </div>
          </div>

          {/* 본문 미리보기 페이퍼 (Document Paper Preview) */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-surface-2/20 flex flex-col items-center">
            <div className="w-full max-w-2xl rounded-2xl bg-surface border border-border/80 p-6 sm:p-8 shadow-sm flex flex-col gap-4">
              {/* 문서 헤더 */}
              <div className="flex flex-col gap-1 pb-3 border-b border-border/60">
                <span className="text-[11px] font-semibold text-accent uppercase tracking-wider">
                  메모팩 문서 뷰어
                </span>
                <h1 className="text-[19px] font-bold text-foreground leading-snug">
                  {pack.name || "제목 없는 메모"}
                </h1>
              </div>

              {/* 문서 서식 본문 */}
              <MemoDocViewer pack={pack} />
            </div>
          </div>

          {/* 모달 하단 바 */}
          <div className="p-3 px-4 sm:px-5 border-t border-border bg-surface flex items-center justify-between gap-2 shrink-0">
            <span className="text-[11.5px] text-text-muted">
              링크를 가진 사람은 누구나 서식이 적용된 이 문서를 웹에서 열람할 수 있어요.
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-[12.5px] font-medium bg-surface-2 hover:bg-surface-3 text-foreground transition-colors cursor-pointer shrink-0"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
