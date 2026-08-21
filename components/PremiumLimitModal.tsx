"use client";

import { useEffect, useState } from "react";
import Portal from "@/components/Portal";
import { IconX, IconSparkles, IconLoader2 } from "@tabler/icons-react";
import UnlockCodeDialog from "@/components/UnlockCodeDialog";
import { useOverlayLayer, POPOVER_OFFSET } from "@/lib/overlayLayer";
import { useEscapeToClose } from "@/lib/useEscapeToClose";
import { useToast } from "@/components/Toast";
import { UserProfile } from "@/lib/types";
import { isUnlimitedAiUser } from "@/lib/aiUsageService";
import {
  isNativePlatform,
  fetchPremiumOffering,
  purchasePremiumLifetime,
  restorePremiumPurchase,
  PurchaseCancelledError,
  PremiumOffering,
} from "@/lib/purchaseService";

// 무료 제한(팩 라이브러리 개수, 동시 가방 개수, 커스텀 색상 등)에 걸렸을 때 공통으로
// 띄우는 안내 모달. "이용권 코드 입력하기"를 누르면 같은 모달 자리에서 바로
// UnlockCodeDialog로 전환된다 - 설정 화면까지 이동하지 않고 그 자리에서 해결 가능.
export default function PremiumLimitModal({
  message,
  onClose,
  onUnlocked,
  email,
  profile,
}: {
  message: string;
  onClose: () => void;
  onUnlocked: (expiresAt: string | null) => void;
  // 인앱결제(영구구매) 버튼을 함께 보여주려면 둘 다 넘겨야 한다(네이티브 앱 + 이미 무제한
  // 이용권이 아닌 경우에만 보임). 없으면(기존 호출부) 이용권 코드 입력만 보여준다.
  email?: string | null;
  profile?: UserProfile | null;
}) {
  const [showCodeInput, setShowCodeInput] = useState(false);
  const ambientLayer = useOverlayLayer();
  useEscapeToClose(showCodeInput ? undefined : onClose);
  const { show } = useToast();

  // 이용권 코드로 이미 무제한 이용 중이면 굳이 인앱결제 버튼을 보여줄 이유가 없다(2026-08-21
  // 확정: 무제한 이용권 보유자만 결제 UI 숨김).
  const unlimited = isUnlimitedAiUser(email, profile ?? null);
  const [offering, setOffering] = useState<PremiumOffering | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (unlimited || !isNativePlatform()) return;
    let cancelled = false;
    fetchPremiumOffering().then((o) => {
      if (!cancelled) setOffering(o);
    });
    return () => {
      cancelled = true;
    };
  }, [unlimited]);

  const handlePurchase = async () => {
    if (!offering || purchasing) return;
    setPurchasing(true);
    try {
      await purchasePremiumLifetime(offering);
      // 실제 \"영구 프리미엄\" 기록은 RevenueCat 웹훅(app/api/revenuecat-webhook)이 서버에서 남기므로,
      // 여기서는 구매 플로우가 에러 없이 끝난 것만으로 onUnlocked 처리하면 된다.
      onUnlocked(null);
    } catch (err) {
      if (!(err instanceof PurchaseCancelledError)) {
        console.error("[팩인백] 인앱결제 실패:", err);
        show("구매를 처리하지 못했어요. 잠시 후 다시 시도해주세요");
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    if (restoring) return;
    setRestoring(true);
    try {
      const restored = await restorePremiumPurchase();
      if (restored) {
        onUnlocked(null);
      } else {
        show("구매 내역을 찾지 못했어요");
      }
    } catch (err) {
      console.error("[팩인백] 구매 복원 실패:", err);
      show("구매 복원에 실패했어요");
    } finally {
      setRestoring(false);
    }
  };

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
        className="fixed inset-0 flex items-center justify-center p-4"
        style={{ zIndex: ambientLayer + POPOVER_OFFSET, background: "rgba(0,0,0,0.45)" }}
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

          {offering && (
            <>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
                <span className="text-[11px] text-text-muted">또는</span>
                <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
              </div>

              <button
                onClick={handlePurchase}
                disabled={purchasing}
                className="rounded-lg py-2.5 text-[14px] font-medium flex items-center justify-center gap-1.5 disabled:opacity-60"
                style={{ background: "var(--surface-2)", color: "var(--foreground)" }}
              >
                {purchasing ? (
                  <IconLoader2 size={16} stroke={1.75} className="animate-spin" />
                ) : null}
                {offering.priceString}에 평생 프리미엄 구매하기
              </button>

              <button
                onClick={handleRestore}
                disabled={restoring}
                className="text-[12px] text-text-muted underline text-center disabled:opacity-60"
              >
                {restoring ? "복원 확인 중..." : "이미 구매했다면 복원하기"}
              </button>
            </>
          )}
        </div>
      </div>
    </Portal>
  );
}
