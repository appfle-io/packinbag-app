"use client";

import { Pack } from "@/lib/types";
import { canDeleteFromLibrary, isInSyncWithLibrary } from "@/lib/packSync";
import NotebookPackSection from "./NotebookPackSection";

// PackGrid(팩뷰)와 동일한 props를 받는 메모장뷰. 팩을 카드 그리드가 아니라
// "헤더 + 내용"이 위아래로 이어지는 문서형 목록으로 보여준다. 기능은 100% 동일 -
// 드래그로 팩간 이동/순서변경, 스와이프 수정·삭제, 저장/새로고침/삭제 모두 동작한다.
export default function NotebookView({
  packs,
  libraryPacks,
  onToggleItem,
  onChangeItemText,
  onDeleteItem,
  onAddItem,
  onEditItem,
  onRenamePack,
  onSaveToLibrary,
  onDeletePack,
  onChangeDisplayState,
  onRefreshFromLibrary,
  onStartItemDrag,
  dragSourceItemId,
  dragOverItemId,
  dragOverItemPosition,
  dragOverPackId,
  dragOverPackPosition,
  onStartPackDrag,
  dragSourcePackId,
}: {
  packs: Pack[];
  libraryPacks: Pack[];
  onToggleItem: (packId: string, itemId: string) => void;
  onChangeItemText: (
    packId: string,
    itemId: string,
    text: string,
    style?: { bold?: boolean; strike?: boolean; color?: string }
  ) => void;
  onDeleteItem: (packId: string, itemId: string) => void;
  onAddItem: (packId: string, type: "check" | "text") => void;
  onEditItem?: (packId: string, itemId: string) => void;
  onRenamePack: (packId: string, name: string) => void;
  onToggleAll: (packId: string, checked: boolean) => void;
  onSaveToLibrary: (packId: string) => void;
  onDeletePack: (packId: string, alsoDeleteLibrary: boolean) => void;
  onChangeDisplayState: (packId: string, nextState: "normal" | "wide" | "collapsed") => void;
  onRefreshFromLibrary: (packId: string) => void;
  onStartItemDrag?: (packId: string, itemId: string, text: string, clientX: number, clientY: number) => void;
  dragSourceItemId?: string | null;
  dragOverItemId?: string | null;
  dragOverItemPosition?: "before" | "after" | null;
  dragOverPackId?: string | null;
  dragOverPackPosition?: "before" | "after" | null;
  onStartPackDrag?: (packId: string, name: string, clientX: number, clientY: number) => void;
  dragSourcePackId?: string | null;
}) {
  return (
    <div className="flex flex-col">
      {packs.map((pack, idx) => (
        <NotebookPackSection
          key={pack.id}
          pack={pack}
          isLast={idx === packs.length - 1}
          isSyncedWithLibrary={isInSyncWithLibrary(pack, libraryPacks)}
          canDeleteFromLibrary={canDeleteFromLibrary(pack, libraryPacks)}
          onToggleItem={(itemId) => onToggleItem(pack.id, itemId)}
          onChangeItemText={(itemId, text, style) => onChangeItemText(pack.id, itemId, text, style)}
          onDeleteItem={(itemId) => onDeleteItem(pack.id, itemId)}
          onAddCheckItem={() => onAddItem(pack.id, "check")}
          onAddTextItem={() => onAddItem(pack.id, "text")}
          onEditItem={onEditItem ? (itemId) => onEditItem(pack.id, itemId) : undefined}
          onRenamePack={(name) => onRenamePack(pack.id, name)}
          onToggleAll={(checked) => onToggleAll(pack.id, checked)}
          onSaveToLibrary={() => onSaveToLibrary(pack.id)}
          onDeletePack={(alsoDeleteLibrary) => onDeletePack(pack.id, alsoDeleteLibrary)}
          onChangeDisplayState={(nextState) => onChangeDisplayState(pack.id, nextState)}
          onRefreshFromLibrary={() => onRefreshFromLibrary(pack.id)}
          onStartItemDrag={
            onStartItemDrag
              ? (itemId, text, x, y) => onStartItemDrag(pack.id, itemId, text, x, y)
              : undefined
          }
          dragSourceItemId={dragSourceItemId}
          dragOverItemId={dragOverItemId}
          dragOverItemPosition={dragOverItemPosition}
          isDragOver={dragOverPackId === pack.id}
          isPackDragOverPosition={dragOverPackId === pack.id ? dragOverPackPosition : null}
          onStartPackDrag={
            onStartPackDrag ? (x, y) => onStartPackDrag(pack.id, pack.name, x, y) : undefined
          }
          isPackDragSource={dragSourcePackId === pack.id}
        />
      ))}
    </div>
  );
}
