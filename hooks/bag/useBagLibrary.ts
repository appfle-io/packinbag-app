"use client";

import { useCallback, useMemo } from "react";
import type { Bag, Item, Pack } from "@/lib/types";
import { isInSyncWithLibrary } from "@/lib/packSync";
import { movePackBetweenBagsRemote } from "@/lib/bagsService";
import { useToast } from "@/components/Toast";
import { firebaseErrorCode } from "@/lib/errorMessage";
import type { BagDocument } from "./useBagDocument";
import { newId } from "./ids";
import { MAX_PACKS_PER_BAG } from "./useBagItems";

// 가방 속 팩 ↔ 팩 보관함, 그리고 다른 가방으로 옮기기 (리디자인 v2).
// 보관함 저장 규칙(v41~ 구 화면과 같음):
// - 아직 보관함에 없음(unsaved): 확인 후 새 팩으로 저장. 같은 이름이 있으면 다른 이름을 받는다.
// - 저장 후 내용이 달라짐(changed): 새로운 팩으로 저장 / 보관함 원본에 덮어쓰기 / 보관함에서 다시 불러오기.
//   단 다른 가방·기기에서 보관함 원본이 먼저 바뀌었으면(libraryNewer) 덮어쓰기는 숨긴다(linkedLibraryUpdatedAt 비교).
// - 보관함과 같음(same): "변경사항이 없어요"만.
// 보관함으로 보낼 때는 이 가방에서만 의미 있는 값(체크 상태·담당자·아이템 마감일)을 뺀다.

export type LibraryStatus =
  | { kind: "unsaved" }
  | { kind: "same"; source: Pack }
  | { kind: "changed"; source: Pack; libraryNewer: boolean };

// 보관함에 넣을 아이템: 체크 해제, 담당자·마감일 제거(다음에 다시 쓸 템플릿이라서)
const toLibraryItems = (items: Item[]): Item[] =>
  items.map((i) => ({
    ...i,
    checked: i.type === "check" ? false : undefined,
    assigneeUid: undefined,
    dueDate: undefined,
  }));

export function useBagLibrary({
  doc,
  libraryPacks,
  bags,
  currentUid,
  onSaveToLibrary,
}: {
  doc: BagDocument;
  libraryPacks: Pack[];
  bags: Bag[];
  currentUid: string;
  // AppShell.handleSaveAsLibraryPack: 새 팩이면 무료 개수 제한을 서버가 검사한다(넘으면 프리미엄 안내)
  onSaveToLibrary: (pack: Pack) => void;
}) {
  const { show } = useToast();
  const { bag, update, applyServerChange, guard } = doc;

  const liveLibrary = useMemo(() => libraryPacks.filter((p) => !p.trashedAt && p.type !== "folder"), [libraryPacks]);

  const statusOf = useCallback(
    (pack: Pack): LibraryStatus => {
      const source = pack.linkedLibraryPackId ? liveLibrary.find((p) => p.id === pack.linkedLibraryPackId) : undefined;
      if (!source) return { kind: "unsaved" };
      if (isInSyncWithLibrary(pack, liveLibrary)) return { kind: "same", source };
      const libraryNewer = !!source.updatedAt && !!pack.linkedLibraryUpdatedAt && source.updatedAt > pack.linkedLibraryUpdatedAt;
      return { kind: "changed", source, libraryNewer };
    },
    [liveLibrary],
  );

  const nameTaken = (name: string) => liveLibrary.some((p) => p.name.trim() === name.trim());

  const patchPack = (packId: string, patch: Partial<Pack>) =>
    update((prev) => ({ ...prev, packs: prev.packs.map((p) => (p.id === packId ? { ...p, ...patch } : p)) }));

  // 메모 본문을 아직 못 받은 메모(lib/bagNotesService)를 보관함에 보내면 빈 메모가 된다 → 받은 뒤에(2026-10-08)
  const noteNotLoaded = (pack: Pack) => {
    if (pack.kind === "editor" && pack.editorDoc === undefined && pack.noteSeparated) {
      show("메모를 불러오는 중이에요. 잠시 후 다시 해 주세요");
      return true;
    }
    return false;
  };

  // 새 팩으로 저장(처음 저장 / "새로운 팩으로 저장"). 이 가방 팩은 새 보관함 팩과 연결된다.
  const saveAsNew = (packId: string, name: string) => {
    if (guard()) return;
    const pack = bag.packs.find((p) => p.id === packId);
    if (!pack) return;
    if (noteNotLoaded(pack)) return;
    const now = new Date().toISOString();
    const libraryPack: Pack = {
      id: newId(),
      name: name.trim() || pack.name,
      kind: pack.kind,
      items: pack.kind === "editor" ? [] : toLibraryItems(pack.items),
      editorDoc: pack.kind === "editor" ? pack.editorDoc : undefined,
      editorPreviewText: pack.kind === "editor" ? pack.editorPreviewText : undefined,
      updatedAt: now,
    };
    onSaveToLibrary(libraryPack);
    patchPack(packId, { linkedLibraryPackId: libraryPack.id, linkedLibraryUpdatedAt: now, savedAsLibraryPack: true });
    show(`'${libraryPack.name}'을(를) 팩 보관함에 저장했어요`);
  };

  // 보관함 원본에 덮어쓰기(이 가방 내용 -> 보관함)
  const overwriteLibrary = (packId: string) => {
    if (guard()) return;
    const pack = bag.packs.find((p) => p.id === packId);
    const status = pack ? statusOf(pack) : null;
    if (!pack || !status || status.kind === "unsaved") return;
    if (noteNotLoaded(pack)) return;
    const now = new Date().toISOString();
    onSaveToLibrary({
      ...status.source,
      name: pack.name,
      items: pack.kind === "editor" ? [] : toLibraryItems(pack.items),
      editorDoc: pack.kind === "editor" ? pack.editorDoc : status.source.editorDoc,
      editorPreviewText: pack.kind === "editor" ? pack.editorPreviewText : status.source.editorPreviewText,
      updatedAt: now,
    });
    patchPack(packId, { linkedLibraryUpdatedAt: now, savedAsLibraryPack: true });
    show("보관함 원본에 덮어썼어요");
  };

  // 보관함에서 다시 불러오기(보관함 -> 이 가방). 이름이 같은 아이템은 이 가방의 체크·담당자를 그대로 둔다.
  const refreshFromLibrary = (packId: string) => {
    if (guard()) return;
    const pack = bag.packs.find((p) => p.id === packId);
    const status = pack ? statusOf(pack) : null;
    if (!pack || !status || status.kind === "unsaved") return;
    const { source } = status;
    const prevByText = new Map(pack.items.map((i) => [i.text.trim(), i]));
    const items: Item[] =
      pack.kind === "editor"
        ? []
        : source.items.map((si) => {
            const before = prevByText.get(si.text.trim());
            return {
              ...si,
              id: before?.id ?? newId(),
              checked: si.type === "check" ? !!before?.checked : undefined,
              assigneeUid: before?.assigneeUid,
              dueDate: undefined,
            };
          });
    patchPack(packId, {
      name: source.name,
      items,
      ...(pack.kind === "editor" ? { editorDoc: source.editorDoc, editorPreviewText: source.editorPreviewText } : {}),
      linkedLibraryUpdatedAt: source.updatedAt,
      savedAsLibraryPack: true,
    });
    show("보관함 내용으로 다시 불러왔어요");
  };

  // --- 다른 가방으로 옮기기 --------------------------------------------------------------
  // 옮길 수 있는 가방: 내가 멤버이고, 잠기지 않았고, 휴지통에 없고, 팩이 가득 차지 않은 다른 가방
  const moveTargets = bags.filter(
    (b) =>
      b.id !== bag.id &&
      b.memberIds.includes(currentUid) &&
      !b.locked &&
      !(b.ownerId === currentUid && b.trashedByOwnerAt) &&
      b.packs.length < MAX_PACKS_PER_BAG,
  );

  // 두 가방을 한 트랜잭션으로 고친다(movePackBetweenBagsRemote). 서버가 이미 반영했으니 이 화면에서는
  // 팩만 빼고 다시 저장하지 않는다(applyServerChange).
  const moveToBag = async (packId: string, targetBagId: string) => {
    if (guard()) return;
    const pack = bag.packs.find((p) => p.id === packId);
    const target = moveTargets.find((b) => b.id === targetBagId);
    if (!pack || !target) return;
    try {
      const result = await movePackBetweenBagsRemote(bag.id, targetBagId, packId);
      if (!result.ok) {
        show(result.reason === "target-full" ? `'${target.name}'은(는) 팩이 가득 찼어요` : "팩을 옮기지 못했어요");
        return;
      }
      applyServerChange((prev) => ({ ...prev, packs: prev.packs.filter((p) => p.id !== packId) }));
      show(`'${pack.name}'을(를) '${target.name}'(으)로 옮겼어요`);
    } catch (err) {
      console.error("[팩인백] 다른 가방으로 팩 이동 실패:", err);
      show(`팩을 옮기지 못했어요 (${firebaseErrorCode(err)})`);
    }
  };

  return { statusOf, nameTaken, saveAsNew, overwriteLibrary, refreshFromLibrary, moveTargets, moveToBag };
}
