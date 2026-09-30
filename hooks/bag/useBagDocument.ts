"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Bag } from "@/lib/types";
import { saveBagRemote } from "@/lib/bagsService";
import { useToast } from "@/components/Toast";
import { firebaseErrorCode } from "@/lib/errorMessage";

// 가방 문서 하나를 편집하는 동안의 로컬 상태 + 자동저장 + 다른 멤버 변경 반영.
// 구 BagEditorScreen의 "실시간 동기화" 블록과 같은 규칙을 그대로 옮겼다.
// - 모든 변경은 500ms 디바운스 후 가방 문서 전체를 저장한다(saveBagRemote: 오프라인이면 로컬 저장).
// - 새 가방(isNew)의 첫 변경은 즉시 저장하고 onSave로 AppShell에 "확정"을 알린다.
// - 화면을 나가거나 앱이 백그라운드로 가면 대기 중인 저장을 바로 내보낸다.
// - AppShell이 구독 중인 bags에서 이 가방의 최신 버전이 오면, 내 변경이 저장 대기/진행 중이
//   아닐 때만 반영한다(내 편집을 덮어쓰지 않기 위해).
// 구 화면의 undo/redo 스택은 v2에서 쓰지 않아 옮기지 않았다(삭제는 토스트 "되돌리기"로 처리).

const AUTOSAVE_DEBOUNCE_MS = 500;

export interface BagDocumentOptions {
  initialBag: Bag;
  bags: Bag[];
  isNew: boolean;
  readOnly: boolean;
  onRequestUnlock: () => void;
  onSave: (bag: Bag) => void;
}

export interface BagDocument {
  bag: Bag;
  // 사용자 변경. 자동저장 대상이 된다.
  update: (updater: (bag: Bag) => Bag) => void;
  // 서버에 이미 반영된 변경을 로컬에만 따라 적용할 때(예: 서버 트랜잭션으로 팩 이동). 자동저장하지 않는다.
  applyServerChange: (updater: (bag: Bag) => Bag) => void;
  // 잠긴 가방이면 이용권 안내를 띄우고 true를 돌려준다. 호출한 쪽은 그대로 return 한다.
  guard: () => boolean;
}

export function useBagDocument({ initialBag, bags, isNew, readOnly, onRequestUnlock, onSave }: BagDocumentOptions): BagDocument {
  const { show } = useToast();
  const [bag, setBag] = useState<Bag>(initialBag);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDirtyRef = useRef(false);
  const isApplyingRemoteRef = useRef(false);
  const skipFirstRef = useRef(true);
  const hasConfirmedNewRef = useRef(false);
  const isNewRef = useRef(isNew);
  const bagRef = useRef(bag);
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    isNewRef.current = isNew;
  }, [isNew]);
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);
  useEffect(() => {
    bagRef.current = bag;
  }, [bag]);

  const persist = useCallback(
    (target: Bag, silent: boolean) =>
      saveBagRemote(target)
        .then(() => {
          if (isNewRef.current && !hasConfirmedNewRef.current) {
            hasConfirmedNewRef.current = true;
            onSaveRef.current(target);
          }
        })
        .catch((err) => {
          console.error("[팩인백] 실시간 저장 실패:", err);
          if (!silent) show(`실시간 저장에 실패했어요 (${firebaseErrorCode(err)})`);
        }),
    [show],
  );

  // 변경 감지 -> 디바운스 저장
  useEffect(() => {
    if (skipFirstRef.current) {
      skipFirstRef.current = false;
      return;
    }
    if (isApplyingRemoteRef.current) {
      isApplyingRemoteRef.current = false;
      // 서버에서 온 변경만 반영한 경우엔 저장하지 않는다. 단, 그 직전 내 변경이 아직 저장 대기
      // 중이었다면(위 cleanup이 타이머를 지웠으므로) 지금 상태로 다시 저장을 예약해야 내 변경이 사라지지 않는다.
      if (!isDirtyRef.current) return;
    }
    isDirtyRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    const delay = isNewRef.current && !hasConfirmedNewRef.current ? 0 : AUTOSAVE_DEBOUNCE_MS;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      persist(bag, false).finally(() => {
        isDirtyRef.current = false;
      });
    }, delay);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [bag, persist]);

  // 화면 이탈/백그라운드 전환 시 대기 중인 저장 즉시 반영
  useEffect(() => {
    const flush = () => {
      if (!timerRef.current && !isDirtyRef.current) return;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      isDirtyRef.current = false;
      persist(bagRef.current, true);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
      flush();
    };
  }, [persist]);

  // 다른 멤버의 변경 반영 (AppShell이 subscribeToUserBags로 받은 목록에서 이 가방을 찾는다)
  const remoteBag = bags.find((b) => b.id === initialBag.id);
  useEffect(() => {
    if (!remoteBag) return;
    if (isDirtyRef.current) return;
    const local = bagRef.current;
    if (remoteBag === local) return;
    if (remoteBag.updatedAt && local.updatedAt && remoteBag.updatedAt <= local.updatedAt) return;
    isApplyingRemoteRef.current = true;
    setBag(remoteBag);
  }, [remoteBag]);

  const update = useCallback((updater: (b: Bag) => Bag) => setBag(updater), []);

  const applyServerChange = useCallback((updater: (b: Bag) => Bag) => {
    isApplyingRemoteRef.current = true;
    setBag(updater);
  }, []);

  const guard = useCallback(() => {
    if (!readOnly) return false;
    onRequestUnlock();
    return true;
  }, [readOnly, onRequestUnlock]);

  return { bag, update, applyServerChange, guard };
}