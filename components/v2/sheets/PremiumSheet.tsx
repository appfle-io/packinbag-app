"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/components/Toast";
import { UNLOCK_CODE_LENGTH, isUnlimitedAiUser } from "@/lib/aiUsageService";
import {
  isNativePlatform,
  fetchPremiumOffering,
  purchasePremiumLifetime,
  restorePremiumPurchase,
  PurchaseCancelledError,
  type PremiumOffering,
} from "@/lib/purchaseService";
import { Button, Sheet } from "@/components/v2/ui";

type Step = "choice" | "code";

// 구 PremiumLimitModal + UnlockCodeDialog를 시트 하나로 합친 v2 버전.
// - message: 왜 이 창이 떴는지(무료 한도 등). 닫히는 동안에도 보이게 마지막 값을 유지한다.
// - 인앱결제 버튼은 네이티브 앱 + 무제한 이용권이 없을 때만 보인다(구 모달과 같은 조건).
// - 이메일/프로필은 useAuth에서 직접 읽는다(구 모달은 호출부가 넘겨야 결제 버튼이 보였다).
export function PremiumSheet({
  open,
  message,
  onClose,
  onUnlocked,
}: {
  open: boolean;
  message: string | null | undefined;
  onClose: () => void;
  // 코드 적용이면 만료 시각(없으면 영구), 구매·복원이면 null
  onUnlocked: (expiresAt: string | null) => void;
}) {
  const { user, profile } = useAuth();
  const { show } = useToast();
  const unlimited = isUnlimitedAiUser(profile?.email, profile ?? null);

  // 닫힘 애니메이션 동안 문구가 사라지지 않게 마지막 문구를 기억한다
  const [kept, setKept] = useState(message ?? "");
  if (message && message !== kept) setKept(message);

  // 다시 열릴 때마다 첫 단계로
  const [step, setStep] = useState<Step>("choice");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setStep("choice");
      setCode("");
      setError(null);
    }
  }

  const [offering, setOffering] = useState<PremiumOffering | null>(null);
  const [busy, setBusy] = useState<"purchase" | "restore" | "code" | null>(null);

  useEffect(() => {
    if (!open || unlimited || offering || !isNativePlatform()) return;
    let cancelled = false;
    fetchPremiumOffering().then((o) => {
      if (!cancelled) setOffering(o);
    });
    return () => {
      cancelled = true;
    };
  }, [open, unlimited, offering]);

  const handlePurchase = async () => {
    if (!offering || busy) return;
    setBusy("purchase");
    try {
      await purchasePremiumLifetime(offering);
      // 실제 기록은 RevenueCat 웹훅(app/api/revenuecat-webhook)이 서버에서 남긴다
      onUnlocked(null);
    } catch (err) {
      if (!(err instanceof PurchaseCancelledError)) {
        console.error("[팩인백] 인앱결제 실패:", err);
        show("구매를 처리하지 못했어요. 잠시 후 다시 시도해주세요");
      }
    } finally {
      setBusy(null);
    }
  };

  const handleRestore = async () => {
    if (busy) return;
    setBusy("restore");
    try {
      const restored = await restorePremiumPurchase();
      if (restored) onUnlocked(null);
      else show("구매 내역을 찾지 못했어요");
    } catch (err) {
      console.error("[팩인백] 구매 복원 실패:", err);
      show("구매 복원에 실패했어요");
    } finally {
      setBusy(null);
    }
  };

  const handleRedeem = async () => {
    if (!code.trim() || busy || !user) return;
    setBusy("code");
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/redeem-unlock-code", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "코드를 확인하지 못했어요. 잠시 후 다시 시도해주세요");
        return;
      }
      onUnlocked((data?.expiresAt as string | null) ?? null);
    } catch {
      setError("코드를 확인하지 못했어요. 잠시 후 다시 시도해주세요");
    } finally {
      setBusy(null);
    }
  };

  const canPurchase = !!offering && !unlimited;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={step === "code" ? "이용권 코드" : "프리미엄"}
      footer={
        step === "code" ? (
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setStep("choice")}>
              뒤로
            </Button>
            <Button className="flex-1" disabled={!code.trim() || busy === "code"} onClick={handleRedeem}>
              {busy === "code" ? "확인 중" : "적용하기"}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {canPurchase && (
              <Button block disabled={busy !== null} onClick={handlePurchase}>
                {busy === "purchase" ? "구매 중" : `${offering?.priceString ?? ""}에 평생 프리미엄`}
              </Button>
            )}
            <Button variant={canPurchase ? "secondary" : "primary"} block onClick={() => setStep("code")}>
              이용권 코드 입력
            </Button>
            {canPurchase && (
              <Button variant="text" size="sm" block disabled={busy !== null} onClick={handleRestore}>
                {busy === "restore" ? "복원 확인 중" : "이미 구매했다면 복원하기"}
              </Button>
            )}
          </div>
        )
      }
    >
      {step === "code" ? (
        <div className="flex flex-col gap-3">
          <p className="m-0 text-body text-sub">{UNLOCK_CODE_LENGTH}자리 이용권 코드를 입력해 주세요.</p>
          <input
            value={code}
            autoFocus
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleRedeem()}
            maxLength={UNLOCK_CODE_LENGTH}
            aria-label="이용권 코드"
            placeholder="코드 입력"
            autoCapitalize="characters"
            autoComplete="off"
            className="h-12 w-full rounded-field bg-fill px-4 text-center text-body-lg tracking-widest outline-none placeholder:text-faint"
          />
          {error && <p className="m-0 text-caption text-alert">{error}</p>}
        </div>
      ) : (
        <p className="m-0 text-body text-sub">{kept}</p>
      )}
    </Sheet>
  );
}
