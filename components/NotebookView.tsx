"use client";

import { /* BagReactionDoc, */ Pack, /* ReactionEmoji */ } from "@/lib/types";
import { canDeleteFromLibrary, isInSyncWithLibrary } from "@/lib/packSync";
import NotebookPackSection from "./NotebookPackSection";
import NotebookEditorPackSection from "./NotebookEditorPackSection";

// PackGrid(팩뷰)와 동일한 props를 받는 메모장뷰. 팩을 카드 그리드가 아니라
// "헤더 + 내용"이 위아래로 이어지는 문서형 목록으로 보여준다. 기능은 100% 동일 -
// 드래그로 팩간 이동/순서변경, 스와이프 수정·삭제, 저장/새로고침/삭제 모두 동작한다.
export default function NotebookView({
  packs,
  libraryPacks,
  onToggleItem,
  onChangeItemText,
  onDeleteItem,
  onEditItem,
  onRenamePack,
  onToggleAll,
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
  hideChecked,
  onAddItem,
  selectedPackId,
  selectedItemIds,
  onToggleSelectItem,
  getItemThreadInfo,
  onOpenItemThread,
  onOpenNotePackEditor,
  getNoteEditors,
  /*
  getItemReactionDoc,
  currentUid,
  onToggleItemReaction,
  onOpenReactionPicker,
  */
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
  hideChecked?: boolean;
  onAddItem?: (packId: string, data: { type: "check" | "text"; text: string }) => void;
  selectedPackId?: string | null;
  selectedItemIds?: Set<string> | null;
  onToggleSelectItem?: (packId: string, itemId: string) => void;
  getItemThreadInfo?: (itemId: string) => { commentCount: number };
  onOpenItemThread?: (packId: string, itemId: string, itemText: string) => void;
  // 에디터팩(자유문서형) 섬션의 "편집" 진입점 - 있으면 NotebookEditorPackSection이 렌더된다
  // (없으면 kind==='editor' 팩도 일반 NotebookPackSection으로 폴백된다).
  onOpenNotePackEditor?: (packId: string) => void;
  // 이 팩을 지금 편집 중인 다른 사람들(최대 3명)을 조회한다.
  getNoteEditors?: (packId: string) => { uid: string; nickname: string; avatarId: string }[];
  /*
  getItemReactionDoc?: (itemId: string) => BagReactionDoc | undefined;
  currentUid?: string;
  onToggleItemReaction?: (itemId: string, emoji: ReactionEmoji, currentlyReacted: boolean) => void;
  onOpenReactionPicker?: (itemId: string, itemText: string) => void;
  */
}) {
  return (
    <div className="flex flex-col">
      {packs.map((pack, idx) => {
        if (pack.kind === "editor") {
          return (
            <NotebookEditorPackSection
              key={pack.id}
              pack={pack}
              isLast={idx === packs.length - 1}
              isSyncedWithLibrary={isInSyncWithLibrary(pack, libraryPacks)}
              canDeleteFromLibrary={canDeleteFromLibrary(pack, libraryPacks)}
              onRenamePack={(name) => onRenamePack(pack.id, name)}
              onSaveToLibrary={() => onSaveToLibrary(pack.id)}
              onRefreshFromLibrary={() => onRefreshFromLibrary(pack.id)}
              onDeletePack={(alsoDeleteLibrary) => onDeletePack(pack.id, alsoDeleteLibrary)}
              onChangeDisplayState={(nextState) => onChangeDisplayState(pack.id, nextState)}
              onOpenEditor={() => onOpenNotePackEditor?.(pack.id)}
              editors={getNoteEditors?.(pack.id) ?? []}
              isDragOver={dragOverPackId === pack.id}
              isPackDragOverPosition={dragOverPackId === pack.id ? dragOverPackPosition : null}
              onStartPackDrag={
                onStartPackDrag ? (x, y) => onStartPackDrag(pack.id, pack.name, x, y) : undefined
              }
              isPackDragSource={dragSourcePackId === pack.id}
            />
          );
        }
        return (
        <NotebookPackSection
          key={pack.id}
          pack={pack}
          isLast={idx === packs.length - 1}
          isSyncedWithLibrary={isInSyncWithLibrary(pack, libraryPacks)}
          canDeleteFromLibrary={canDeleteFromLibrary(pack, libraryPacks)}
          onToggleItem={(itemId) => onToggleItem(pack.id, itemId)}
          onChangeItemText={(itemId, text, style) => onChangeItemText(pack.id, itemId, text, style)}
          onDeleteItem={(itemId) => onDeleteItem(pack.id, itemId)}
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
          hideChecked={hideChecked}
          onAddItem={onAddItem ? (data) => onAddItem(pack.id, data) : undefined}
          selectedItemIds={selectedPackId === pack.id ? selectedItemIds : null}
          onToggleSelectItem={onToggleSelectItem ? (itemId) => onToggleSelectItem(pack.id, itemId) : undefined}
          getItemThreadInfo={getItemThreadInfo}
          onOpenItemThread={
            onOpenItemThread ? (itemId, itemText) => onOpenItemThread(pack.id, itemId, itemText) : undefined
          }
          /*
          getItemReactionDoc={getItemReactionDoc}
          currentUid={currentUid}
          onToggleItemReaction={onToggleItemReaction}
          onOpenReactionPicker={onOpenReactionPicker}
          */
        />
        );
      })}
    </div>
  );
}
