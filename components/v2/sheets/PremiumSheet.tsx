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
  syncPurchaseToServer,
  PurchaseCancelledError,
  type PremiumOffering,
} from "@/lib/purchaseService";
import { Button, Sheet } from "@/components/v2/ui";

type Step = "choice" | "code";

// 구 PremiumLimitModal + UnlockCodeDialog를 시트 하나로 합친 v2 버전.
// - message: 왜 이 창이 떴는지(무료 한도 등). 닫히는 동안에도 보이게 마지막 값을 유지한다.
// - 이메일/프로필은 useAuth에서 직접 읽는다.
//
// 2026-10-09 플랫폼별로 나눴다:
// - iOS 앱: 인앱결제(구매 · 구매 복원)만. 이용권 코드 입력은 보이지 않는다 - App Store 심사 가이드라인 3.1.1
//   (인앱결제 밖의 방법으로 기능을 여는 코드·키 금지). 이미 코드로 프리미엄인 사람은 그대로 프리미엄이다.
// - 웹·포터블: 결제가 안 되므로 이용권 코드 입력만.
// - 구매·복원이 끝나면 서버가 RevenueCat에 직접 확인해 바로 기록한다(syncPurchaseToServer → app/api/sync-purchase).
//   예전에는 웹훅이 올 때까지 화면·서버가 무료로 보였고, 같은 계정 복원은 웹훅이 없어 아예 반영되지 않았다.
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
  const native = isNativePlatform();

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
  // 상품을 못 불러왔을 때(네트워크·App Store 계약 미완료 등). "다시 불러오기"로 풀린다
  const [offeringFailed, setOfferingFailed] = useState(false);
  const [busy, setBusy] = useState<"purchase" | "restore" | "code" | null>(null);

  useEffect(() => {
    if (!open || unlimited || offering || offeringFailed || !native) return;
    let cancelled = false;
    fetchPremiumOffering().then((o) => {
      if (cancelled) return;
      if (o) setOffering(o);
      else setOfferingFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [open, unlimited, offering, offeringFailed, native]);

  const offeringLoading = native && !unlimited && !offering && !offeringFailed;

  // 구매·복원 뒤 서버 기록까지 확인한다. 서버 확인이 늦어도(키 미설정·일시 오류) 기기에서 활성이면 적용된 것으로 본다 -
  // 웹훅이 곧 서버에도 남긴다
  const finishUnlock = async (activeOnDevice: boolean) => {
    const synced = user ? await syncPurchaseToServer(user) : false;
    if (activeOnDevice || synced) {
      onUnlocked(null);
      return true;
    }
    return false;
  };

  const handlePurchase = async () => {
    if (!offering || busy) return;
    setBusy("purchase");
    try {
      const active = await purchasePremiumLifetime(offering);
      const ok = await finishUnlock(active);
      // 보호자 승인(Ask to Buy) 대기 등으로 아직 결제가 끝나지 않은 경우
      if (!ok) show("결제가 확인되면 프리미엄이 적용돼요");
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
      const ok = restored ? await finishUnlock(true) : false;
      if (!ok) show("구매 내역을 찾지 못했어요");
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

  const canPurchase = native && !!offering && !unlimited;

  const nativeFooter = (
    <div className="flex flex-col gap-2">
      {canPurchase ? (
        <Button block disabled={busy !== null} onClick={handlePurchase}>
          {busy === "purchase" ? "구매 중" : `${offering?.priceString ?? ""}에 평생 프리미엄`}
        </Button>
      ) : offeringFailed ? (
        <Button block variant="secondary" onClick={() => setOfferingFailed(false)}>
          다시 불러오기
        </Button>
      ) : (
        <Button block disabled>
          {offeringLoading ? "불러오는 중" : "프리미엄 이용 중"}
        </Button>
      )}
      {/* 구매 복원은 상품을 못 불러와도 늘 보인다(심사 가이드라인: 복원 수단 필수) */}
      {!unlimited && (
        <Button variant="text" size="sm" block disabled={busy !== null} onClick={handleRestore}>
          {busy === "restore" ? "복원 확인 중" : "이미 구매했다면 복원하기"}
        </Button>
      )}
    </div>
  );

  const webFooter =
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
        <Button block onClick={() => setStep("code")}>
          이용권 코드 입력
        </Button>
      </div>
    );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={!native && step === "code" ? "이용권 코드" : "프리미엄"}
      footer={native ? nativeFooter : webFooter}
    >
      {!native && step === "code" ? (
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
        <div className="flex flex-col gap-3">
          <p className="m-0 text-body text-sub">{kept}</p>
          {native && offeringFailed && (
            <p className="m-0 text-caption text-faint">지금은 구매 정보를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.</p>
          )}
          {native && canPurchase && (
            <p className="m-0 text-caption text-faint">한 번 결제하면 계속 쓸 수 있어요(구독 아님). 같은 Apple ID로 다른 기기에서도 복원할 수 있어요.</p>
          )}
        </div>
      )}
    </Sheet>
  );
}
