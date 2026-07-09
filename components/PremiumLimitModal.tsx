"use client";

import { useState } from "react";
import Portal from "@/components/Portal";
import { IconX, IconSparkles } from "@tabler/icons-react";
import UnlockCodeDialog from "@/components/UnlockCodeDialog";

// 무료 제한(팩 라이브러리 개수, 동시 가방 개수, 커스텀 색상 등)에 걸렸을 때 공통으로
// 띄우는 안내 모달. "이용권 코드 입력하기"를 누르면 같은 모달 자리에서 바로
// UnlockCodeDialog로 전환된다 - 설정 화면까지 이동하지 않고 그 자리에서 해결 가능.
export default function PremiumLimitModal({
  message,
  onClose,
  onUnlocked,
}: {
  message: string;
  onClose: () => void;
  onUnlocked: (expiresAt: string | null) => void;
}) {
  const [showCodeInput, setShowCodeInput] = useState(false);

  if (showCodeInput) {
    return (
      <UnlockCodeDialog
        onClose={onClose}
        onSuccess={(expiresAt) => {
          setShowCodeInput(false);
          onUnlocked(expiresAt);
        }}
      />
    );
  }

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.45)" }}
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-xs rounded-2xl bg-surface p-4 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-medium flex items-center gap-1.5">
              <IconSparkles size={16} stroke={1.75} color="var(--accent)" />
              프리미엄 기능이에요
            </span>
            <button onClick={onClose} aria-label="닫기">
              <IconX size={18} stroke={1.75} color="var(--text-secondary)" />
            </button>
          </div>

          <p className="text-[13px] text-text-secondary leading-relaxed">
            {message}
          </p>

          <button
            onClick={() => setShowCodeInput(true)}
            className="rounded-lg py-2.5 text-[14px] font-medium"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            이용권 코드 입력하기
          </button>
        </div>
      </div>
    </Portal>
  );
}
