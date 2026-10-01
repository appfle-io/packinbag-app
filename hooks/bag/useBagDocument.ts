"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Bag } from "@/lib/types";
import { saveBagRemote, saveSharedBagMergedRemote } from "@/lib/bagsService";
import { mergeBag, sameContent } from "@/lib/syncMerge";
import { useToast } from "@/components/Toast";
import { firebaseErrorCode } from "@/lib/errorMessage";

// 가방 문서 하나를 편집하는 동안의 로컬 상태 + 자동저장 + 다른 멤버·기기 변경 반영.
// - 모든 변경은 500ms 디바운스 후 저장한다. 혼자 쓰는 가방은 saveBagRemote(쓰기 1번),
//   함께 쓰는 가방(멤버 2명+)은 saveSharedBagMergedRemote(트랜잭션: 읽기 1 + 쓰기 1)로 서버 최신본과 합쳐서 쓴다.
// - 새 가방(isNew)의 첫 변경은 즉시 저장하고 onSave로 AppShell에 "확정"을 알린다.
// - 화면을 나가거나 앱이 백그라운드로 가면 대기 중인 저장을 바로 내보낸다.
// - AppShell이 구독 중인 bags(추가 읽기 없음)에서 최신 버전이 오면:
//   내 변경이 없으면 그대로 반영, 저장 대기 중이면 버리지 않고 아이템 단위로 합친다(lib/syncMerge).
//   (예전에는 저장 대기 중에 온 변경을 건너뛰고 다시 반영하지 않아, 내 저장이 그 변경을 덮어썼다.)
// - 내 저장이 되돌아온 스냅샷(내용 동일)은 기준점만 옮기고 다시 그리지도, 다시 저장하지도 않는다(무한 저장 방지).
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
  // 내가 마지막으로 받은 서버 버전(병합 기준점). 내 변경 = base와 화면 bag의 차이
  const baseRef = useRef<Bag>(initialBag);

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
      (target.memberIds.length > 1 ? saveSharedBagMergedRemote(target, baseRef.current) : saveBagRemote(target))
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

  // 다른 멤버·다른 기기의 변경 반영 (AppShell이 subscribeToUserBags로 받은 목록에서 이 가방을 찾는다 - 추가 읽기 없음)
  const remoteBag = bags.find((b) => b.id === initialBag.id);
  useEffect(() => {
    if (!remoteBag) return;
    const base = baseRef.current;
    if (remoteBag === base) return;
    if (remoteBag.updatedAt && base.updatedAt && remoteBag.updatedAt <= base.updatedAt) return;
    baseRef.current = remoteBag;
    const local = bagRef.current;
    if (!isDirtyRef.current) {
      // 내 변경 없음: 그대로 반영(내용이 같으면 다시 그리지 않음)
      if (sameContent(remoteBag, local)) return;
      isApplyingRemoteRef.current = true;
      setBag(remoteBag);
      return;
    }
    // 내 저장이 대기/진행 중: 버리지 않고 합친다. 내 저장이 되돌아온 것이면(새 정보 없음) 건드리지 않는다
    const merged = mergeBag(base, local, remoteBag);
    if (sameContent(merged, local)) return;
    isApplyingRemoteRef.current = true;
    setBag(merged);
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