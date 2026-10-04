"use client";

import { useCallback } from "react";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/components/Toast";
import { NEEDS_ONLINE_MESSAGE, useOffline } from "@/lib/v2/connectivity";

/**
 * 인터넷이 꼭 필요한 기능(AI · 업로드 · 초대 · 공유 링크 · 문의 · 이용권 · 계정 작업) 앞에 두는 문(연결 흐름 D).
 * 끊겨 있으면 시트를 열거나 서버를 부르지 않고 "인터넷에 연결되면 쓸 수 있어요"를 먼저 알린다 - 누른 뒤 실패시키지 않는다.
 * localOk: 오프라인 모드(이 기기 저장)에서는 연결 없이도 되는 기능(사진·파일 첨부)이면 true
 */
export function useOnlineGuard() {
  const offline = useOffline();
  const { isOfflineMode } = useAuth();
  const { show } = useToast();
  const guard = useCallback(
    (fn: () => void, options?: { localOk?: boolean }) => {
      if (offline && !(options?.localOk && isOfflineMode)) {
        show(NEEDS_ONLINE_MESSAGE);
        return;
      }
      fn();
    },
    [offline, isOfflineMode, show],
  );
  return { offline, guard };
}
