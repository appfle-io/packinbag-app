"use client";

import { useEffect, useState } from "react";
import { IconCloudOff, IconWifi, IconX } from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/components/Toast";
import { RECONNECTED_EVENT, useConnectivity } from "@/lib/v2/connectivity";

const BAR = "flex min-h-11 w-full shrink-0 select-none items-center gap-2 border-b border-line pl-4 font-ui text-caption text-ink";
const CLOSE = "inline-flex size-11 shrink-0 items-center justify-center bg-transparent text-sub active:opacity-60";

// 지금 연결 상태를 알려 주는 한 줄(리디자인 v2 · 연결 흐름 F). 구 OfflineStatusBar 대체.
// - 계정 모드 + 끊김: "연결이 끊겨 저장해 둔 내용을 보고 있어요". 다시 연결되면 줄이 사라지고 토스트
// - 오프라인 모드 + 연결됨: "인터넷에 연결됐어요 · 로그인"(로그인하면 이 기기 데이터를 계정에 합친다)
// - 오프라인 모드 + 끊김(폐쇄망에서 쓰는 중): 아무것도 띄우지 않는다
export function ConnectionBar() {
  const { user, isOfflineMode, switchToOnlineMode } = useAuth();
  const { show } = useToast();
  const connectivity = useConnectivity();
  const [dismissedLogin, setDismissedLogin] = useState(false);

  // 계정 모드에서 끊겼다가 다시 연결되면 한 번 알려 준다(바뀐 내용은 Firestore가 알아서 올린다)
  useEffect(() => {
    if (isOfflineMode || !user) return;
    const onBack = () => show("다시 연결됐어요. 바뀐 내용을 맞추고 있어요");
    window.addEventListener(RECONNECTED_EVENT, onBack);
    return () => window.removeEventListener(RECONNECTED_EVENT, onBack);
  }, [isOfflineMode, user, show]);

  if (!user) return null;

  if (!isOfflineMode && connectivity === "offline") {
    return (
      <div role="status" aria-live="polite" className={`${BAR} bg-fill pr-4`}>
        <IconCloudOff size={16} stroke={1.9} className="shrink-0 text-sub" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate py-3">연결이 끊겨 저장해 둔 내용을 보고 있어요. 바뀐 내용은 연결되면 올라가요</span>
      </div>
    );
  }

  if (isOfflineMode && connectivity === "online" && !dismissedLogin) {
    return (
      <aside role="status" aria-live="polite" className={`${BAR} bg-brand-soft`}>
        <IconWifi size={16} stroke={1.9} className="shrink-0 text-brand" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">인터넷에 연결됐어요. 로그인하면 이 기기 가방을 계정에 합쳐요</span>
        <button type="button" onClick={switchToOnlineMode} className="h-11 shrink-0 bg-transparent px-2 font-semibold text-brand active:opacity-60">
          로그인
        </button>
        <button type="button" onClick={() => setDismissedLogin(true)} aria-label="닫기" className={CLOSE}>
          <IconX size={18} stroke={1.9} />
        </button>
      </aside>
    );
  }

  return null;
}
