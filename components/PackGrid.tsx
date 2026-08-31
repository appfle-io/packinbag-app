"use client";

import { useState } from "react";
import { IconNotes, IconChecklist, IconChevronDown } from "@tabler/icons-react";
import { /* BagReactionDoc, */ Pack, /* ReactionEmoji */ } from "@/lib/types";
import { canDeleteFromLibrary, isInSyncWithLibrary } from "@/lib/packSync";
import PackCard from "./PackCard";
import EditorPackCard from "./EditorPackCard";

export default function PackGrid({
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
  onSyncEditorPack,
  onMoveToBag,
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
  selectedItemsByPack,
  onToggleSelectItem,
  getItemThreadInfo,
  onOpenNotePackEditor,
  getNoteEditors,
  premium,
  ddayCountTodayAsDayOne,
  memberProfiles,
  isShared,
  onClickAssignee,
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
  // 있으면 짐 수정 진입시 모달을 여는 콜백 (없으면 PackCard가 기존 인라인 편집 유지)
  onEditItem?: (packId: string, itemId: string) => void;
  onRenamePack: (packId: string, name: string) => void;
  onToggleAll: (packId: string, checked: boolean) => void;
  onSaveToLibrary: (packId: string) => void;
  onDeletePack: (packId: string, alsoDeleteLibrary: boolean) => void;
  onChangeDisplayState: (packId: string, nextState: "normal" | "wide" | "collapsed") => void;
  onRefreshFromLibrary: (packId: string) => void;
  // 링크된 메모팩만 대상으로, 보관함과 계속 맞춰질지(pack.autoSyncEnabled) 켜고/끄는 토글.
  onSyncEditorPack?: (packId: string) => void;
  // 있으면 모든 팩 카드에 "다른 가방으로 이동" 버튼이 보인다(내가 속한
  // 다른 가방이 있을 때만 BagEditorScreen이 이 콜백을 넘겨준다).
  onMoveToBag?: (packId: string) => void;
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
  // 다중선택 중이면 packId -> 그 팩에서 선택된 짐 id 집합 전체 맵. null/undefined면
  // 다중선택 모드 자체가 아님. 특정 팩이 아직 하나도 선택되지 않았어도 모드가 켜져
  // 있으면 그 팩도 "선택 가능" 상태로 보여줘야 하므로(다른 팩으로 선택을 넘길 수
  // 있게), 각 카드에는 이 맵에 없는 팩도 빈 Set을 내려준다(아래 renderCard 참고).
  selectedItemsByPack?: Record<string, Set<string>> | null;
  onToggleSelectItem?: (packId: string, itemId: string) => void;
  // 짐 댓글 조회용. 없으면(undefined) 각 ItemRow에 밑줄 표시가 안 붙는다.
  getItemThreadInfo?: (itemId: string) => { commentCount: number };
  // 에디터팩(자유문서형) 카드의 연필 버튼 탭 - 있으면 EditorPackCard가 렌더된다(없으면
  // kind==='editor' 팩은 일반 PackCard로 폴백된다 - 상위 화면이 아직 이 콜백을 연결하지
  // 않았을 때도 깨지지 않게 하기 위함).
  onOpenNotePackEditor?: (packId: string) => void;
  // 이 팩을 지금 편집 중인 다른 사람들(최대 3명)을 조회한다. 없으면 아바타가 안 보인다.
  getNoteEditors?: (packId: string) => { uid: string; nickname: string; avatarId: string }[];
  premium?: boolean;
  // 이 가방의 D-day 계산 기준. 각 짐의 마감일 뱃지 표시에 그대로 전달된다.
  ddayCountTodayAsDayOne?: boolean;
  memberProfiles?: Record<string, import("@/lib/types").BagMemberProfile>;
  isShared?: boolean;
  onClickAssignee?: (packId: string, itemId: string) => void;
  /*
  getItemReactionDoc?: (itemId: string) => BagReactionDoc | undefined;
  currentUid?: string;
  onToggleItemReaction?: (itemId: string, emoji: ReactionEmoji, currentlyReacted: boolean) => void;
  onOpenReactionPicker?: (itemId: string, itemText: string) => void;
  */
}) {
  // 다중선택 모드 전체 여부. selectedItemsByPack이 존재하면(빈 객체라도) 모드가 켜진
  // 것으로 본다 - 실제 on/off 판단은 BagEditorScreen에서 null 여부로 관리한다.
  const selectionModeActive = !!selectedItemsByPack;

  const [isMemoCollapsed, setIsMemoCollapsed] = useState(false);
  const [isChecklistCollapsed, setIsChecklistCollapsed] = useState(false);

  const renderCard = (pack: Pack) => {
    if (pack.kind === "editor") {
      return (
        <EditorPackCard
          key={pack.id}
          pack={pack}
          isSyncedWithLibrary={isInSyncWithLibrary(pack, libraryPacks)}
          canDeleteFromLibrary={canDeleteFromLibrary(pack, libraryPacks)}
          onRenamePack={(name) => onRenamePack(pack.id, name)}
          onSaveToLibrary={() => onSaveToLibrary(pack.id)}
          onRefreshFromLibrary={() => onRefreshFromLibrary(pack.id)}
          onDeletePack={(alsoDeleteLibrary) => onDeletePack(pack.id, alsoDeleteLibrary)}
          onChangeDisplayState={(nextState) => onChangeDisplayState(pack.id, nextState)}
          onOpenEditor={() => onOpenNotePackEditor?.(pack.id)}
          onSyncLibraryLink={onSyncEditorPack ? () => onSyncEditorPack(pack.id) : undefined}
          onMoveToBag={onMoveToBag ? () => onMoveToBag(pack.id) : undefined}
          editors={getNoteEditors?.(pack.id) ?? []}
          premium={premium}
          onStartPackDrag={
            onStartPackDrag ? (x, y) => onStartPackDrag(pack.id, pack.name, x, y) : undefined
          }
          isPackDragSource={dragSourcePackId === pack.id}
          isDragOver={dragOverPackId === pack.id}
          isPackDragOverPosition={dragOverPackId === pack.id ? dragOverPackPosition : null}
        />
      );
    }
    return (
      <PackCard
        key={pack.id}
        pack={pack}
        isSyncedWithLibrary={isInSyncWithLibrary(pack, libraryPacks)}
        canDeleteFromLibrary={canDeleteFromLibrary(pack, libraryPacks)}
        onToggleItem={(itemId) => onToggleItem(pack.id, itemId)}
        onChangeItemText={(itemId, text, style) =>
          onChangeItemText(pack.id, itemId, text, style)
        }
        onDeleteItem={(itemId) => onDeleteItem(pack.id, itemId)}
        onEditItem={onEditItem ? (itemId) => onEditItem(pack.id, itemId) : undefined}
        onRenamePack={(name) => onRenamePack(pack.id, name)}
        onToggleAll={(checked) => onToggleAll(pack.id, checked)}
        onSaveToLibrary={() => onSaveToLibrary(pack.id)}
        onDeletePack={(alsoDeleteLibrary) => onDeletePack(pack.id, alsoDeleteLibrary)}
        onChangeDisplayState={(nextState) => onChangeDisplayState(pack.id, nextState)}
        onRefreshFromLibrary={() => onRefreshFromLibrary(pack.id)}
        onMoveToBag={onMoveToBag ? () => onMoveToBag(pack.id) : undefined}
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
          onStartPackDrag
            ? (x, y) => onStartPackDrag(pack.id, pack.name, x, y)
            : undefined
        }
        isPackDragSource={dragSourcePackId === pack.id}
        hideChecked={hideChecked}
        onAddItem={onAddItem ? (data) => onAddItem(pack.id, data) : undefined}
        selectedItemIds={selectionModeActive ? selectedItemsByPack![pack.id] ?? new Set<string>() : null}
        onToggleSelectItem={onToggleSelectItem ? (itemId) => onToggleSelectItem(pack.id, itemId) : undefined}
        getItemThreadInfo={getItemThreadInfo}
        ddayCountTodayAsDayOne={ddayCountTodayAsDayOne}
        memberProfiles={memberProfiles}
        isShared={isShared}
        onClickAssignee={onClickAssignee ? (itemId) => onClickAssignee(pack.id, itemId) : undefined}
        /*
        getItemReactionDoc={getItemReactionDoc}
        currentUid={currentUid}
        onToggleItemReaction={onToggleItemReaction}
        onOpenReactionPicker={onOpenReactionPicker}
        */
      />
    );
  };

  const editorPacks = packs.filter((p) => p.kind === "editor");
  const checklistPacks = packs.filter((p) => p.kind !== "editor");
  const hasBoth = editorPacks.length > 0 && checklistPacks.length > 0;

  if (hasBoth) {
    return (
      <div className="flex flex-col gap-6">
        {/* 상단: 메모/문서 팩 (시원한 2열 와이드 그리드) */}
        <section className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => setIsMemoCollapsed((prev) => !prev)}
            aria-expanded={!isMemoCollapsed}
            aria-label={isMemoCollapsed ? "메모 섹션 펼치기" : "메모 섹션 접기"}
            className="flex items-center justify-between group text-left cursor-pointer select-none py-1 px-1 -mx-1 rounded-lg hover:bg-surface-2/60 transition-colors"
          >
            <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-text-secondary">
              <IconNotes size={15} className="text-accent shrink-0" />
              <span>메모</span>
              <span className="text-[11px] font-mono text-text-muted font-normal">
                {editorPacks.length}
              </span>
            </div>
            <IconChevronDown
              size={15}
              className={`text-text-muted group-hover:text-text-secondary transition-transform duration-200 ${
                isMemoCollapsed ? "-rotate-90" : "rotate-0"
              }`}
            />
          </button>
          {!isMemoCollapsed && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4 items-start">
              {editorPacks.map(renderCard)}
            </div>
          )}
        </section>

        {/* 하단: 체크리스트 팩 (3열 칸반 컬럼 그리드) */}
        <section className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => setIsChecklistCollapsed((prev) => !prev)}
            aria-expanded={!isChecklistCollapsed}
            aria-label={isChecklistCollapsed ? "체크리스트 섹션 펼치기" : "체크리스트 섹션 접기"}
            className="flex items-center justify-between group text-left cursor-pointer select-none py-1 px-1 -mx-1 rounded-lg hover:bg-surface-2/60 transition-colors"
          >
            <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-text-secondary">
              <IconChecklist size={15} className="text-accent shrink-0" />
              <span>체크리스트</span>
              <span className="text-[11px] font-mono text-text-muted font-normal">
                {checklistPacks.length}
              </span>
            </div>
            <IconChevronDown
              size={15}
              className={`text-text-muted group-hover:text-text-secondary transition-transform duration-200 ${
                isChecklistCollapsed ? "-rotate-90" : "rotate-0"
              }`}
            />
          </button>
          {!isChecklistCollapsed && (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))] gap-3 md:gap-4 items-start">
              {checklistPacks.map(renderCard)}
            </div>
          )}
        </section>
      </div>
    );
  }

  // 메모팩만 있거나 체크리스트만 있는 경우
  return (
    <div
      className={`grid gap-3 md:gap-4 items-start ${
        editorPacks.length > 0
          ? "grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))]"
          : "grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))]"
      }`}
    >
      {packs.map(renderCard)}
    </div>
  );
}
