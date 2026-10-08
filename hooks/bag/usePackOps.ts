"use client";

import { useCallback, useEffect } from "react";
import type { Pack } from "@/lib/types";
import { resolveEditorSyncDirection, buildEditorSyncPatch } from "@/lib/packSync";
import { updateLibraryPackEditorContent } from "@/lib/packsService";
import { checkBagSizeForSave } from "@/lib/editorDocLimits";
import { useToast } from "@/components/Toast";
import type { BagDocument } from "./useBagDocument";
import { newId } from "./ids";
import { MAX_PACKS_PER_BAG } from "./useBagItems";

// 보관함 팩을 가방에 넣을 사본으로 만든다. 구 PackImportModal의 cloneAsNewPack과 같은 규칙:
// 보관함 원본과 연결(linkedLibraryPackId)해 두고, 아이템 마감일은 떼어낸다.
function cloneLibraryPackForBag(pack: Pack): Pack {
  return {
    ...pack,
    id: `pack-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    savedAsLibraryPack: true,
    linkedLibraryPackId: pack.id,
    linkedLibraryUpdatedAt: pack.updatedAt,
    items: pack.items.map((item) => ({
      ...item,
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      dueDate: undefined,
    })),
  };
}

export interface PackOpsOptions {
  doc: BagDocument;
  libraryPacks: Pack[];
  currentUid: string;
  onTrashPackFromBag: (pack: Pack, sourceBagId: string, sourceBagName: string) => void;
}

// 팩 단위 조작: 보관함에서 불러오기, 새 팩/메모 만들기, 이름 변경, 삭제(휴지통), 메모팩 저장,
// 메모팩 보관함 자동 동기화. 구 BagEditorScreen의 handleImport / handleAddPack / handleRenamePack /
// executeDeletePack / handleSaveNotePack / handleToggleAutoSync + 자동 동기화 effect와 같은 규칙이다.
export function usePackOps({ doc, libraryPacks, currentUid, onTrashPackFromBag }: PackOpsOptions) {
  const { bag, update, guard } = doc;
  const { show } = useToast();

  // 불러오기: 가방 맨 위에 넣는다. 구 화면은 10개를 넘으면 오래된 팩을 잘라냈지만,
  // v2는 기존 팩을 잃지 않도록 남은 자리만큼만 넣고 알려준다.
  const importPacks = useCallback(
    (libraryEntries: Pack[]): number => {
      if (guard()) return 0;
      const room = Math.max(0, MAX_PACKS_PER_BAG - bag.packs.length);
      const picked = libraryEntries.filter((p) => p.type !== "folder").slice(0, room).map(cloneLibraryPackForBag);
      if (picked.length === 0) {
        show("가방 하나에는 팩을 최대 10개까지 넣을 수 있어요");
        return 0;
      }
      update((prev) => ({ ...prev, packs: [...picked, ...prev.packs] }));
      if (picked.length < libraryEntries.length) {
        show(`자리가 모자라 ${picked.length}개만 추가했어요 (가방당 최대 10개)`);
      } else {
        show(picked.length > 1 ? `팩 ${picked.length}개를 가방에 추가했어요` : "팩을 가방에 추가했어요");
      }
      return picked.length;
    },
    [guard, bag.packs.length, update, show],
  );

  const addPack = useCallback(
    (kind: "checklist" | "editor", name?: string): string | null => {
      if (guard()) return null;
      if (bag.packs.length >= MAX_PACKS_PER_BAG) {
        show("가방 하나에는 팩을 최대 10개까지 넣을 수 있어요");
        return null;
      }
      const id = newId();
      const pack: Pack =
        kind === "editor"
          ? { id, name: name?.trim() || "새 메모", items: [], kind: "editor" }
          : { id, name: name?.trim() || "새 팩", items: [] };
      update((prev) => ({ ...prev, packs: [pack, ...prev.packs] }));
      return id;
    },
    [guard, bag.packs.length, update, show],
  );

  const renamePack = useCallback(
    (packId: string, name: string) => {
      if (guard()) return;
      const n = name.trim();
      if (!n) return;
      update((prev) => ({ ...prev, packs: prev.packs.map((p) => (p.id === packId ? { ...p, name: n, isInbox: false } : p)) }));
    },
    [guard, update],
  );

  // 가방에서 팩 삭제 -> 보관함 휴지통에 사본(AppShell.handleTrashPackFromBag)
  const deletePack = useCallback(
    (packId: string) => {
      if (guard()) return;
      const pack = bag.packs.find((p) => p.id === packId);
      update((prev) => ({ ...prev, packs: prev.packs.filter((p) => p.id !== packId) }));
      if (pack && (pack.items.length > 0 || pack.kind === "editor")) {
        onTrashPackFromBag(pack, bag.id, bag.name);
        show("팩을 휴지통으로 옮겼어요");
      }
    },
    [guard, bag.packs, bag.id, bag.name, update, onTrashPackFromBag, show],
  );

  // 메모팩 편집기(PackNoteEditorScreen)의 저장. 가방 문서가 Firestore 1MB에 가까워지면 막는다.
  const saveNotePack = useCallback(
    (updated: Pack) => {
      const projected = { ...bag, packs: bag.packs.map((p) => (p.id === updated.id ? updated : p)) };
      const sizeError = checkBagSizeForSave(projected);
      if (sizeError) {
        show(sizeError);
        return;
      }
      update((prev) => ({ ...prev, packs: prev.packs.map((p) => (p.id === updated.id ? updated : p)) }));
    },
    [bag, update, show],
  );

  const toggleAutoSync = useCallback(
    (packId: string) => {
      if (guard()) return;
      update((prev) => ({
        ...prev,
        packs: prev.packs.map((p) => (p.id === packId ? { ...p, autoSyncEnabled: !p.autoSyncEnabled } : p)),
      }));
    },
    [guard, update],
  );

  // 메모팩 보관함 자동 동기화: 이 화면이 열려 있는 동안, 연결된 보관함 원본과 내용이 다르면
  // 더 최신인 쪽으로 맞춘다(lib/packSync.ts). 내용이 같으면 "none"이라 핑퐁이 생기지 않는다.
  useEffect(() => {
    let changed = false;
    const nextPacks = bag.packs.map((p) => {
      if (p.kind !== "editor" || !p.autoSyncEnabled || !p.linkedLibraryPackId) return p;
      const lib = libraryPacks.find((lp) => lp.id === p.linkedLibraryPackId);
      if (!lib) return p;
      const direction = resolveEditorSyncDirection(p, lib);
      if (direction === "none") return p;
      if (direction === "library-wins") {
        changed = true;
        return { ...p, ...buildEditorSyncPatch(lib) };
      }
      updateLibraryPackEditorContent(currentUid, p.linkedLibraryPackId, buildEditorSyncPatch(p)).catch((err) => {
        console.error("[팩인백] 메모팩 보관함 동기화 실패:", err);
      });
      return p;
    });
    if (changed) update((prev) => ({ ...prev, packs: prev.packs.map((p) => nextPacks.find((n) => n.id === p.id) ?? p) }));
    // bag.packs / libraryPacks가 바뀔 때만 다시 비교한다(구 화면과 동일)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bag.packs, libraryPacks]);

  return { importPacks, addPack, renamePack, deletePack, saveNotePack, toggleAutoSync };
}