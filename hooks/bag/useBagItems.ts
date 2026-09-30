"use client";

import { useCallback } from "react";
import type { Bag, Item, Pack } from "@/lib/types";
import { isInSyncWithLibrary } from "@/lib/packSync";
import { useToast } from "@/components/Toast";
import type { BagDocument } from "./useBagDocument";
import { newId } from "./ids";
import { isAllPacked } from "./bagStats";

export const MAX_PACKS_PER_BAG = 10;
export const INBOX_PACK_NAME = "미분류";

export interface ItemPatch {
  text?: string;
  // null이면 담당자 해제
  assigneeUid?: string | null;
  // 다른 팩으로 옮길 때
  targetPackId?: string;
}

// 아이템 단위 조작. 구 BagEditorScreen의 handleToggleItem / handleCreateItem / handleUpdateItem /
// handleDeleteItem / handleAssignItem / handleToggleAllInBag 과 같은 규칙으로 bag.packs를 바꾼다.
// 차이점
// - 칸반 "완료 항목 자동 이동"은 v2에서 제거된 기능이라 적용하지 않는다(체크만 토글).
// - 체크 결과 모든 체크 아이템이 체크되면 lastPackedAt/lastPackedBy를 기록한다.
// - 하단 입력창으로 추가하는 아이템은 "미분류"(isInbox) 팩에 모은다.
export function useBagItems(doc: BagDocument, libraryPacks: Pack[], currentUid: string) {
  const { update, guard, bag } = doc;
  const { show } = useToast();

  const synced = useCallback(
    (p: Pack): Pack => ({ ...p, savedAsLibraryPack: isInSyncWithLibrary(p, libraryPacks) }),
    [libraryPacks],
  );

  const withPackedStamp = useCallback(
    (prev: Bag, next: Bag): Bag => {
      if (!isAllPacked(prev.packs) && isAllPacked(next.packs)) {
        return { ...next, lastPackedAt: new Date().toISOString(), lastPackedBy: currentUid };
      }
      return next;
    },
    [currentUid],
  );

  const toggleItem = useCallback(
    (packId: string, itemId: string) => {
      if (guard()) return;
      update((prev) => {
        const next: Bag = {
          ...prev,
          packs: prev.packs.map((p) =>
            p.id !== packId ? p : { ...p, items: p.items.map((i) => (i.id === itemId ? { ...i, checked: !i.checked } : i)) },
          ),
        };
        return withPackedStamp(prev, next);
      });
    },
    [guard, update, withPackedStamp],
  );

  // 다시 싸기: 모든 체크 아이템 해제 (메모팩 제외). lastPackedAt은 그대로 둔다.
  // 실수로 눌렀을 때를 위해 직전 체크 상태로 되돌리는 토스트를 띄운다.
  const uncheckAll = useCallback(() => {
    if (guard()) return;
    const checkedIds = new Set(bag.packs.flatMap((p) => p.items.filter((i) => i.type === "check" && i.checked).map((i) => i.id)));
    if (checkedIds.size === 0) return;
    update((prev) => ({
      ...prev,
      packs: prev.packs.map((p) =>
        p.kind === "editor" ? p : { ...p, items: p.items.map((i) => (i.type === "check" ? { ...i, checked: false } : i)) },
      ),
    }));
    show("모두 해제했어요. 새로 싸 볼까요?", {
      actionLabel: "되돌리기",
      onAction: () =>
        update((prev) => ({
          ...prev,
          packs: prev.packs.map((p) =>
            p.kind === "editor" ? p : { ...p, items: p.items.map((i) => (checkedIds.has(i.id) ? { ...i, checked: true } : i)) },
          ),
        })),
    });
  }, [guard, update, bag.packs, show]);

  // AI 가져오기(클립보드·메모) 결과 병합: 같은 이름의 체크리스트 팩이 있으면 이어 담고, 없으면 새 팩(10개 제한).
  // 구 BagEditorScreen.handleApplyClipboardAdd와 같은 규칙. 추가된 개수와 제한에 걸렸는지를 돌려준다.
  const applyGroupedItems = useCallback(
    (groups: { name: string; items: { text: string; checked?: boolean }[] }[]): { added: number; cappedOut: boolean } => {
      if (guard()) return { added: 0, cappedOut: false };
      let packs = [...bag.packs];
      let added = 0;
      let cappedOut = false;
      for (const g of groups) {
        if (g.items.length === 0) continue;
        const items: Item[] = g.items.map((it) => ({ id: newId(), type: "check", text: it.text, checked: !!it.checked }));
        const idx = packs.findIndex((p) => p.kind !== "editor" && !p.isInbox && p.name.trim() === g.name.trim());
        if (idx >= 0) {
          packs = packs.map((p, i) => (i === idx ? { ...p, items: [...p.items, ...items] } : p));
        } else if (packs.length < MAX_PACKS_PER_BAG) {
          packs = [{ id: newId(), name: g.name.trim() || "기타", items }, ...packs];
        } else {
          cappedOut = true;
          continue;
        }
        added += items.length;
      }
      if (added > 0) update((prev) => ({ ...prev, packs }));
      return { added, cappedOut };
    },
    [guard, bag.packs, update],
  );

  // AI 빠진 것 확인 결과를 이름으로 팩을 찾아 담는다(없으면 새 팩). 구 handleAddItemFromAudit와 같은 규칙.
  const addToNamedPack = useCallback(
    (packName: string, text: string) => {
      if (guard()) return;
      const item: Item = { id: newId(), type: "check", text, checked: false };
      update((prev) => {
        const existing = prev.packs.find((p) => p.name === packName && p.kind !== "editor" && p.type !== "folder");
        if (existing) {
          return { ...prev, packs: prev.packs.map((p) => (p.id === existing.id ? { ...p, items: [...p.items, item] } : p)) };
        }
        if (prev.packs.length >= MAX_PACKS_PER_BAG) return prev;
        return { ...prev, packs: [...prev.packs, { id: newId(), name: packName, items: [item] }] };
      });
      show(`'${packName}' 팩에 '${text}'을(를) 담았어요`);
    },
    [guard, update, show],
  );

  const setPackChecked = useCallback(
    (packId: string, checked: boolean) => {
      if (guard()) return;
      update((prev) => {
        const next: Bag = {
          ...prev,
          packs: prev.packs.map((p) =>
            p.id !== packId ? p : { ...p, items: p.items.map((i) => (i.type === "check" ? { ...i, checked } : i)) },
          ),
        };
        return withPackedStamp(prev, next);
      });
    },
    [guard, update, withPackedStamp],
  );

  const addItem = useCallback(
    (packId: string, text: string) => {
      if (guard()) return;
      const t = text.trim();
      if (!t) return;
      const item: Item = { id: newId(), type: "check", text: t, checked: false };
      update((prev) => ({
        ...prev,
        packs: prev.packs.map((p) => (p.id === packId ? synced({ ...p, items: [...p.items, item] }) : p)),
      }));
    },
    [guard, update, synced],
  );

  // 하단 입력창: "미분류" 팩(없으면 맨 위에 새로 만든다)에 추가. 팩 10개 제한에 걸리면 false.
  const addToInbox = useCallback(
    (text: string): boolean => {
      if (guard()) return false;
      const t = text.trim();
      if (!t) return false;
      const hasInbox = bag.packs.some((p) => p.isInbox && p.kind !== "editor");
      if (!hasInbox && bag.packs.length >= MAX_PACKS_PER_BAG) {
        show("가방 하나에는 팩을 최대 10개까지 넣을 수 있어요");
        return false;
      }
      const item: Item = { id: newId(), type: "check", text: t, checked: false };
      update((prev) => {
        const idx = prev.packs.findIndex((p) => p.isInbox && p.kind !== "editor");
        if (idx >= 0) {
          return {
            ...prev,
            packs: prev.packs.map((p, i) => (i === idx ? { ...p, items: [...p.items, item] } : p)),
          };
        }
        const inbox: Pack = { id: newId(), name: INBOX_PACK_NAME, items: [item], isInbox: true };
        return { ...prev, packs: [inbox, ...prev.packs] };
      });
      return true;
    },
    [guard, update, bag.packs, show],
  );

  // 이름/담당자 수정 + 다른 팩으로 이동. 같은 팩이면 제자리, 다른 팩이면 대상 팩 맨 끝으로.
  const updateItem = useCallback(
    (sourcePackId: string, itemId: string, patch: ItemPatch) => {
      if (guard()) return;
      const target = patch.targetPackId ?? sourcePackId;
      update((prev) => {
        const original = prev.packs.find((p) => p.id === sourcePackId)?.items.find((i) => i.id === itemId);
        if (!original) return prev;
        const nextItem: Item = {
          ...original,
          ...(patch.text !== undefined ? { text: patch.text.trim() || original.text } : {}),
          ...(patch.assigneeUid !== undefined ? { assigneeUid: patch.assigneeUid ?? undefined } : {}),
        };
        if (target === sourcePackId) {
          return {
            ...prev,
            packs: prev.packs.map((p) =>
              p.id === sourcePackId ? synced({ ...p, items: p.items.map((i) => (i.id === itemId ? nextItem : i)) }) : p,
            ),
          };
        }
        return {
          ...prev,
          packs: prev.packs.map((p) => {
            if (p.id === sourcePackId) return synced({ ...p, items: p.items.filter((i) => i.id !== itemId) });
            if (p.id === target) return synced({ ...p, items: [...p.items, nextItem] });
            return p;
          }),
        };
      });
      if (target !== sourcePackId) show("아이템을 옮겼어요");
    },
    [guard, update, synced, show],
  );

  const duplicateItem = useCallback(
    (packId: string, itemId: string) => {
      if (guard()) return;
      update((prev) => ({
        ...prev,
        packs: prev.packs.map((p) => {
          if (p.id !== packId) return p;
          const idx = p.items.findIndex((i) => i.id === itemId);
          if (idx < 0) return p;
          const copy: Item = { ...p.items[idx], id: newId(), ...(p.items[idx].type === "check" ? { checked: false } : {}) };
          const items = [...p.items];
          items.splice(idx + 1, 0, copy);
          return synced({ ...p, items });
        }),
      }));
    },
    [guard, update, synced],
  );

  const deleteItem = useCallback(
    (packId: string, itemId: string) => {
      if (guard()) return;
      const pack = bag.packs.find((p) => p.id === packId);
      const index = pack?.items.findIndex((i) => i.id === itemId) ?? -1;
      const removed = index >= 0 ? pack!.items[index] : undefined;
      update((prev) => ({
        ...prev,
        packs: prev.packs.map((p) => (p.id === packId ? synced({ ...p, items: p.items.filter((i) => i.id !== itemId) }) : p)),
      }));
      if (!removed) return;
      show("아이템을 삭제했어요", {
        actionLabel: "되돌리기",
        onAction: () =>
          update((prev) => ({
            ...prev,
            packs: prev.packs.map((p) => {
              if (p.id !== packId) return p;
              const items = [...p.items];
              items.splice(Math.min(index, items.length), 0, removed);
              return synced({ ...p, items });
            }),
          })),
      });
    },
    [guard, update, bag.packs, synced, show],
  );

  return {
    toggleItem,
    uncheckAll,
    setPackChecked,
    addItem,
    addToInbox,
    updateItem,
    duplicateItem,
    deleteItem,
    applyGroupedItems,
    addToNamedPack,
  };
}