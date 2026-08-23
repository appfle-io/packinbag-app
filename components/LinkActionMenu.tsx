"use client";

import Portal from "@/components/Portal";
import { IconExternalLink, IconLink, IconLinkOff, IconEdit } from "@tabler/icons-react";
import { useOverlayLayer, SHEET_OFFSET } from "@/lib/overlayLayer";
import { useEscapeToClose } from "@/lib/useEscapeToClose";

// 짐/메모/메모팩 안의 링크를 눌렀을 때 뜨는 작은 선택 시트.
export default function LinkActionMenu({
  url,
  onOpen,
  onUnlink,
  onShorten,
  onCustomize,
  onManage,
  onClose,
}: {
  url: string;
  onOpen: () => void;
  onUnlink?: () => void;
  onShorten?: () => void;
  onCustomize?: () => void;
  onManage?: () => void;
  onClose: () => void;
}) {
  const ambientLayer = useOverlayLayer();
  useEscapeToClose(onClose);

  return (
    <Portal>
      <div
        className="fixed inset-0 flex items-end justify-center sm:items-center"
        style={{ zIndex: ambientLayer + SHEET_OFFSET, background: "rgba(0,0,0,0.45)" }}
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm rounded-t-2xl sm:rounded-2xl bg-surface p-4 flex flex-col gap-2"
          style={{ paddingBottom: "max(16px, calc(env(safe-area-inset-bottom) + 12px))" }}
        >
          <p className="text-[12px] text-text-muted truncate mb-1 px-1">{url}</p>
          <button
            onClick={() => {
              onClose();
              onOpen();
            }}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[14px]"
            style={{ background: "var(--surface-2)" }}
          >
            <IconExternalLink size={17} stroke={1.75} color="var(--text-secondary)" />
            링크 열기
          </button>
          {onUnlink && (
            <button
              onClick={() => {
                onClose();
                onUnlink();
              }}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[14px]"
              style={{ background: "var(--surface-2)" }}
            >
              <IconLinkOff size={17} stroke={1.75} color="var(--text-secondary)" />
              링크 해제 (일반 텍스트로 변경)
            </button>
          )}
          {onShorten && (
            <button
              onClick={() => {
                onClose();
                onShorten();
              }}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[14px]"
              style={{ background: "var(--surface-2)" }}
            >
              <IconLink size={17} stroke={1.75} color="var(--accent)" />
              짧은 URL로 변경
            </button>
          )}
          {onCustomize && (
            <button
              onClick={() => {
                onClose();
                onCustomize();
              }}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[14px]"
              style={{ background: "var(--surface-2)" }}
            >
              <IconEdit size={17} stroke={1.75} color="var(--accent)" />
              커스텀 URL로 변경
            </button>
          )}
          {onManage && (
            <button
              onClick={() => {
                onClose();
                onManage();
              }}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[14px]"
              style={{ background: "var(--surface-2)" }}
            >
              <IconEdit size={17} stroke={1.75} color="var(--accent)" />
              이름/주소 수정
            </button>
          )}
        </div>
      </div>
    </Portal>
  );
}
