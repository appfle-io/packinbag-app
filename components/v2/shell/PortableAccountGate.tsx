"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/components/Toast";
import { isPortableApp } from "@/lib/backupService";
import { PORTABLE_ACCOUNT_PREMIUM_MESSAGE, isPremiumUser } from "@/lib/premiumLimits";
import BackpackLogo from "@/components/BackpackLogo";
import { PremiumSheet } from "@/components/v2/sheets/PremiumSheet";
import { Button } from "@/components/v2/ui";

// PC 포터블(Electron)에서 계정으로 쓰는 건 프리미엄(2026-10-21, auth.md AUTH-PORT-01).
// 무료 계정으로 로그인하면 앱 대신 이 화면: 이용권 코드 입력 · 로그아웃하고 오프라인 모드로 쓰기 · 로그아웃.
// 계정 없는 오프라인 모드는 그대로 무료. 지금은 FREE_LAUNCH라 isPremiumUser가 늘 true → 이 화면은 뜨지 않는다.
// 게스트(익명 계정)는 막지 않는다 - 로그아웃하면 게스트 데이터가 지워지고, 프리미엄은 정식 계정에서만 되므로(auth.md 확인 필요)
export function PortableAccountGate({ children }: { children: React.ReactNode }) {
  const { user, profile, isOfflineMode, isGuest, logout, startOfflineMode } = useAuth();
  const { show } = useToast();
  const [portable] = useState(isPortableApp);
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const blocked = portable && !!user && !!profile && !isOfflineMode && !isGuest && !isPremiumUser(user.email, profile);
  if (!blocked) return <>{children}</>;

  const toOffline = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await logout();
      await startOfflineMode();
    } catch (err) {
      console.error("[팩인백] 포터블 오프라인 전환 실패:", err);
      show("오프라인 모드로 바꾸지 못했어요. 다시 해 주세요");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pib-v2 pt-safe pb-safe-8 fixed inset-0 flex flex-col overflow-y-auto bg-canvas">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-6 py-10">
        <div className="flex flex-col items-center gap-3 text-center">
          <BackpackLogo size={56} />
          <h1 className="m-0 text-heading font-bold text-ink">PC 포터블은 프리미엄이에요</h1>
          <p className="m-0 text-body text-sub">{PORTABLE_ACCOUNT_PREMIUM_MESSAGE}</p>
        </div>
        <div className="flex flex-col gap-2">
          <Button block onClick={() => setPremiumOpen(true)}>
            이용권 코드 입력
          </Button>
          <Button block variant="secondary" disabled={busy} onClick={() => void toOffline()}>
            로그아웃하고 오프라인 모드로 쓰기
          </Button>
          <Button block variant="text" disabled={busy} onClick={() => void logout()}>
            로그아웃
          </Button>
        </div>
        <p className="m-0 text-center text-caption text-faint">계정의 가방은 웹 · 아이폰 앱에서 그대로 쓸 수 있어요.</p>
      </div>
      <PremiumSheet
        open={premiumOpen}
        message={PORTABLE_ACCOUNT_PREMIUM_MESSAGE}
        onClose={() => setPremiumOpen(false)}
        onUnlocked={() => {
          setPremiumOpen(false);
          show("프리미엄이 적용됐어요");
        }}
      />
    </div>
  );
}
