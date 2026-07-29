"use client";

import Portal from "@/components/Portal";
import { IconExternalLink, IconLink } from "@tabler/icons-react";
import { useOverlayLayer, SHEET_OFFSET } from "@/lib/overlayLayer";
import { useEscapeToClose } from "@/lib/useEscapeToClose";

// 짐/메모/메모팩 안의 링크를 눌렀을 때 뜨는 작은 선택 시트. "짧은 URL로 변경"이
// 가능한 상황(프리미엄 + 토글 ON + 아직 축약 전인 링크)에서만 이 메뉴 자체가 열리고,
// 그렇지 않으면 호출한 쪽에서 바로 openExternalLink()로 열어버리고 이 메뉴를 띄우지 않는다
// (그래서 이 컴포넌트는 "열기"/"축약" 두 선택지를 조건 없이 항상 함께 보여준다).
export default function LinkActionMenu({
  url,
  onOpen,
  onShorten,
  onClose,
}: {
  url: string;
  onOpen: () => void;
  onShorten: () => void;
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
        </div>
      </div>
    </Portal>
  );
}
