"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Bag } from "@/lib/types";
import { saveBagRemote, saveSharedBagMergedRemote } from "@/lib/bagsService";
import { mergeBag, sameContent } from "@/lib/syncMerge";
import { useToast } from "@/components/Toast";
import { firebaseErrorCode } from "@/lib/errorMessage";
import { subscribeBagNotes } from "@/lib/bagNotesService";
import { hydrateBag, type BagNote } from "@/lib/bagNotesCore";
import { isOfflineEnvironment } from "@/lib/premiumLimits";
import { auth } from "@/lib/firebase";
import { isPendingBag } from "@/lib/v2/pendingCreates";

// 가방 문서 하나를 편집하는 동안의 로컬 상태 + 자동저장 + 다른 멤버·기기 변경 반영.
// - 모든 변경은 500ms 디바운스 후 저장한다. 혼자 쓰는 가방은 saveBagRemote(쓰기 1번),
//   함께 쓰는 가방(멤버 2명+)은 saveSharedBagMergedRemote(트랜잭션: 읽기 1 + 쓰기 1)로 서버 최신본과 합쳐서 쓴다.
// - 새 가방(isNew)의 첫 변경은 즉시 저장하고 onSave로 AppShell에 "확정"을 알린다.
// - 화면을 나가거나 앱이 백그라운드로 가면 대기 중인 저장을 바로 내보낸다.
// - AppShell이 구독 중인 bags(추가 읽기 없음)에서 최신 버전이 오면:
//   내 변경이 없으면 그대로 반영, 저장 대기 중이면 버리지 않고 아이템 단위로 합친다(lib/syncMerge).
//   (예전에는 저장 대기 중에 온 변경을 건너뛰고 다시 반영하지 않아, 내 저장이 그 변경을 덮어썼다.)
// - 내 저장이 되돌아온 스냅샷(내용 동일)은 기준점만 옮기고 다시 그리지도, 다시 저장하지도 않는다(무한 저장 방지).
// - 메모 본문(2026-10-08): 가방 목록에는 메모 본문이 없다(lib/bagNotesService). 이 가방이 열려 있는 동안만
//   bags/{id}/notes를 구독해서 메모팩에 본문을 채워 넣고(hydrateBag), 저장할 때는 다시 떼어서 쓴다.
//   본문이 도착하기 전(notesReady=false)에는 메모 편집기를 열지 않는다(BagScreenV2) - 빈 문서로 덮어쓰지 않게.
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
  // 메모 본문을 받았는지(받기 전에는 메모 편집기를 열지 않는다)
  notesReady: boolean;
}

// 메모 본문을 notes에서 받아야 하는 가방인지. 오프라인 모드·만들기 대기 가방은 본문이 가방 안에 그대로 있다
function usesRemoteNotes(bagId: string): boolean {
  if (isOfflineEnvironment()) return false;
  if (isPendingBag(auth.currentUser?.uid, bagId)) return false;
  return true;
}

function notesSignature(notes: Map<string, BagNote> | null): string {
  if (!notes) return "";
  return [...notes.entries()].map(([id, n]) => `${id}:${n.rev}:${n.raw.length}`).sort().join("|");
}

export function useBagDocument({ initialBag, bags, isNew, readOnly, onRequestUnlock, onSave }: BagDocumentOptions): BagDocument {
  const { show } = useToast();
  const [bag, setBag] = useState<Bag>(initialBag);
  // 내가 마지막으로 받은 서버 버전(병합 기준점, 본문 포함). 내 변경 = base와 화면 bag의 차이
  const baseRef = useRef<Bag>(initialBag);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDirtyRef = useRef(false);
  const isApplyingRemoteRef = useRef(false);
  const skipFirstRef = useRef(true);
  const hasConfirmedNewRef = useRef(false);
  const isNewRef = useRef(isNew);
  const bagRef = useRef(bag);
  const onSaveRef = useRef(onSave);

  // --- 메모 본문 구독 ---------------------------------------------------------
  const remoteNotes = useMemo(() => usesRemoteNotes(initialBag.id), [initialBag.id]);
  const [notes, setNotes] = useState<Map<string, BagNote> | null>(null);
  const [notesReady, setNotesReady] = useState(!remoteNotes);
  // 서버에 있다고 알고 있는 본문(packId → raw). 구독으로 받은 뒤에만 채운다(그 전에는 null = 지우기 금지)
  const knownRef = useRef<Map<string, string> | null>(null);
  useEffect(() => {
    if (!remoteNotes) return;
    return subscribeBagNotes(
      initialBag.id,
      (map) => {
        knownRef.current = new Map([...map.entries()].map(([id, n]) => [id, n.raw]));
        setNotes(map);
        setNotesReady(true);
      },
      (err) => {
        // 읽기 실패(권한 등): 가방 안 본문(이전 전 데이터)만으로 연다. 지우기는 하지 않는다
        console.warn("[팩인백] 메모 본문 구독 실패:", err);
        knownRef.current = null;
        setNotesReady(true);
      },
    );
  }, [initialBag.id, remoteNotes]);

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
      (target.memberIds.length > 1
        ? saveSharedBagMergedRemote(target, baseRef.current, knownRef.current)
        : saveBagRemote(target, knownRef.current)
      )
        .then((written) => {
          // 방금 쓴 본문은 서버에 있다고 기록(같은 본문을 다시 쓰지 않게)
          if (written.size > 0 && knownRef.current) written.forEach((raw, id) => knownRef.current!.set(id, raw));
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
  // 목록의 가방에는 메모 본문이 없으므로 notes로 채워서(hydrateBag) 쓴다. 목록에 아직 없으면(방금 만든 가방) 처음 가방에 채운다.
  // 목록 소식과 본문 소식은 따로 도착한다. 본문은 "그 메모의 notes가 바뀐 경우"에만 바꾼다 - 내가 메모를 고친 직후
  // 목록 소식이 먼저 오면, 아직 이전 notes로 채운 본문이 방금 쓴 글을 되돌리지 않게.
  const listBag = bags.find((b) => b.id === initialBag.id);
  const notesSigRef = useRef("");
  const prevNotesRef = useRef<Map<string, BagNote> | null>(null);
  useEffect(() => {
    if (!listBag && !notes) return;
    const prevNotes = prevNotesRef.current;
    prevNotesRef.current = notes;
    const base = baseRef.current;
    const hydrated = hydrateBag(listBag ?? initialBag, notes);
    const basePacks = new Map(base.packs.map((p) => [p.id, p]));
    const remoteBag: Bag = {
      ...hydrated,
      packs: hydrated.packs.map((p) => {
        if (p.kind !== "editor") return p;
        if (notes?.get(p.id)?.raw !== prevNotes?.get(p.id)?.raw) return p; // 이 메모의 본문이 바뀜 → 새 본문
        const bp = basePacks.get(p.id);
        return bp && bp.editorDoc !== undefined ? { ...p, editorDoc: bp.editorDoc } : p;
      }),
    };
    if (remoteBag === base) return;
    const sig = notesSignature(notes);
    const notesChanged = sig !== notesSigRef.current;
    notesSigRef.current = sig;
    // 가방 문서는 그대로인데 메모 본문만 바뀐 경우(다른 멤버가 메모만 고침, 처음 본문 도착)는 updatedAt이 같다 → 본문 변화로 판단
    if (!notesChanged && remoteBag.updatedAt && base.updatedAt && remoteBag.updatedAt <= base.updatedAt) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialBag은 처음 값만 쓴다
  }, [listBag, notes]);

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

  return { bag, update, applyServerChange, guard, notesReady };
}
