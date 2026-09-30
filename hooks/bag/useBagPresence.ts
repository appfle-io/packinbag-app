"use client";

import { useEffect, useMemo, useState } from "react";
import { joinPresence, subscribeToPresence, setEditingNotePack, PRESENCE_STALE_MS, type RawPresence } from "@/lib/presenceService";

export interface BagPresenceOptions {
  bagId: string;
  currentUid: string;
  nickname: string;
  avatarId: string;
  // 멤버 2명 이상인 공유 가방에서만 접속 정보를 주고받는다(구 화면과 동일)
  shared: boolean;
  isNew: boolean;
  offline: boolean;
  // 지금 내가 열어 둔 메모팩 id (없으면 null)
  editingNotePackId: string | null;
}

// 접속자 표시 + 메모팩 동시 편집 알림. 구 BagEditorScreen의 presence 블록과 같은 조건으로 동작한다.
export function useBagPresence({ bagId, currentUid, nickname, avatarId, shared, isNew, offline, editingNotePackId }: BagPresenceOptions) {
  const [entries, setEntries] = useState<RawPresence[]>([]);
  // 오래된 접속자를 걸러내기 위해 30초마다 다시 계산
  const [now, setNow] = useState(() => Date.now());

  const active = shared && !isNew && !offline;

  useEffect(() => {
    if (!active) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 공유 해제/오프라인 전환 시 목록 비우기
      setEntries([]);
      return;
    }
    const leave = joinPresence(bagId, currentUid, nickname, avatarId, true);
    const unsub = subscribeToPresence(bagId, setEntries);
    return () => {
      unsub();
      leave();
    };
  }, [active, bagId, currentUid, nickname, avatarId]);

  useEffect(() => {
    if (!active || !editingNotePackId) return;
    setEditingNotePack(bagId, currentUid, editingNotePackId);
    return () => {
      setEditingNotePack(bagId, currentUid, null);
    };
  }, [active, bagId, currentUid, editingNotePackId]);

  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(t);
  }, [active]);

  const others = useMemo(
    () => entries.filter((e) => e.uid !== currentUid && now - e.updatedAtMs < PRESENCE_STALE_MS),
    [entries, currentUid, now],
  );

  const onlineUids = useMemo(() => new Set(others.map((e) => e.uid)), [others]);

  const otherNoteEditor = editingNotePackId ? others.find((e) => e.editingPackId === editingNotePackId) : undefined;

  const noteEditorsOf = (packId: string) => others.filter((e) => e.editingPackId === packId).slice(0, 3);

  return { others, onlineUids, otherNoteEditor, noteEditorsOf };
}