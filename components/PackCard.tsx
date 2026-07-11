"use client";

import { useState } from "react";
import {
  IconDeviceFloppy,
  IconDeviceFloppyFilled,
  IconRefresh,
  IconTrash,
  IconGripVertical,
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconChevronDown,
  IconChevronRight,
} from "@tabler/icons-react";
import { Pack } from "@/lib/types";
import { getProgressRatio } from "@/lib/itemStats";
import { getDisplayOrderedItems } from "@/lib/itemDisplayOrder";
import { getPackColorHex } from "@/lib/packColors";
import { useAuth } from "@/contexts/AuthProvider";
import ItemRow from "./ItemRow";
import SwipeRenameField from "./SwipeRenameField";
import ConfirmDialog from "./ConfirmDialog";
import ProgressRing from "./ProgressRing";

// 설정 > 화면설정 > 팩 크기 슬라이더 값(--pack-card-scale)에 맞춰 여백/아이콘/짐 칸
// 크기를 조절한다. 글자 크기는 별도인 --pack-card-font-scale(설정 > 팩 카드 글씨 크기
// 슬라이더)을 따로 곱해서, "카드 크기"와 "글자 크기"를 독립적으로 조절할 수 있게 한다
// (둘 다 --font-scale-factor(설정 > 글자 크기)까지 같이 곱해진다).
export default function PackCard({
  pack,
  isSyncedWithLibrary,
  canDeleteFromLibrary,
  onToggleItem,
  onChangeItemText,
  onDeleteItem,
  onEditItem,
  onRenamePack,
  onToggleAll,
  onSaveToLibrary,
  onRefreshFromLibrary,
  onDeletePack,
  onChangeDisplayState,
  onStartItemDrag,
  dragSourceItemId,
  dragOverItemId,
  dragOverItemPosition,
  isDragOver,
  onStartPackDrag,
  isPackDragSource,
  isPackDragOverPosition,
  hideChecked,
}: {
  pack: Pack;
  isSyncedWithLibrary: boolean;
  // linkedLibraryPackId가 "내" 라이브러리에 실제로 있을 때만 true - 이때만 삭제
  // 다이얼로그에 "라이브러리도 함께 삭제" 옵션을 보여줄 수 있다.
  canDeleteFromLibrary?: boolean;
  onToggleItem: (itemId: string) => void;
  onChangeItemText: (
    itemId: string,
    text: string,
    style?: { bold?: boolean; strike?: boolean; color?: string }
  ) => void;
  onDeleteItem: (itemId: string) => void;
  // 있으면 짐 수정 진입시 인라인 편집 대신 모달을 열도록 ItemRow에 전달한다.
  onEditItem?: (itemId: string) => void;
  onRenamePack: (name: string) => void;
  onToggleAll: (checked: boolean) => void;
  onSaveToLibrary: () => void;
  onRefreshFromLibrary: () => void;
  // alsoDeleteLibrary가 true면 연동된 라이브러리 원본도 함께 삭제해달라는 뜻.
  onDeletePack: (alsoDeleteLibrary: boolean) => void;
  // 카드 자체의 펼치기/접기 토글 (nextState는 "wide" | "collapsed" | "normal")
  onChangeDisplayState?: (nextState: "normal" | "wide" | "collapsed") => void;
  onStartItemDrag?: (itemId: string, text: string, clientX: number, clientY: number) => void;
  dragSourceItemId?: string | null;
  dragOverItemId?: string | null;
  // 드래그한 짐을 dragOverItemId 위(before)/아래(after) 중 어디에 놓을지.
  dragOverItemPosition?: "before" | "after" | null;
  isDragOver?: boolean;
  onStartPackDrag?: (clientX: number, clientY: number) => void;
  isPackDragSource?: boolean;
  // 드래그한 팩을 이 카드 위(before)/아래(after) 중 어디에 놓을지. isDragOver와 함께 쓴다.
  isPackDragOverPosition?: "before" | "after" | null;
  // 상단 "완료 항목 숨기기" 토글이 켜져 있으면, 체크된 체크형 짐은 화면에서 걸러낸다
  // (데이터 자체는 그대로 - 필터링일 뿐 삭제 아님).
  hideChecked?: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { profile } = useAuth();
  const moveCompletedToBottom = profile?.packSettings?.moveCompletedToBottom ?? true;
  const ratio = getProgressRatio(pack.items);
  const accentHex = getPackColorHex(pack.color);
  const checkItems = pack.items.filter((i) => i.type === "check");
  const allChecked = checkItems.length > 0 && checkItems.every((i) => i.checked);
  const displayState = pack.displayState ?? "normal";
  const isCollapsed = displayState === "collapsed";
  const isWide = displayState === "wide";
  // 실제 저장 순서는 그대로 두고, 화면에 보여줄 때만 완료 항목을 뒤로 보낸다
  // (드래그로 다른 팩에 옮기는 기능은 인덱스가 아니라 id 기반이라 영향 없음)
  const orderedItems = getDisplayOrderedItems(pack.items, moveCompletedToBottom);
  const displayItems = hideChecked
    ? orderedItems.filter((i) => !(i.type === "check" && i.checked))
    : orderedItems;

  return (
    <div
      data-pack-drop-id={pack.id}
      className="flex flex-col rounded-xl border p-[calc(14px*var(--pack-card-scale,1))] md:p-[calc(20px*var(--pack-card-scale,1))] min-h-0 shadow-sm"
      style={{
        borderColor: isDragOver ? "var(--accent)" : "var(--border)",
        boxShadow: isDragOver
          ? isPackDragOverPosition === "after"
            ? "0 2px 0 0 var(--accent)"
            : "0 -2px 0 0 var(--accent)"
          : undefined,
        background: accentHex ? `${accentHex}26` : "var(--pack-card-bg)",
        opacity: isPackDragSource ? 0.4 : 1,
        transition: "box-shadow 120ms ease, border-color 120ms ease, opacity 120ms ease",
      }}
    >
      <div className="flex items-center justify-between mb-2.5 shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {onStartPackDrag && (
            <span
              onPointerDown={(e) => {
                e.stopPropagation();
                onStartPackDrag(e.clientX, e.clientY);
              }}
              className="shrink-0 touch-none cursor-grab"
              style={{ color: "var(--text-muted)", transform: "scale(var(--pack-card-scale,1))" }}
              aria-label="드래그해서 팩 순서 바꾸기"
            >
              <IconGripVertical size={17} stroke={1.75} />
            </span>
          )}
          {/* 패 전체선택/해제는 이제 헤더의 진행률 링(ProgressRing)을 버튼으로 만들어 눈 - 아래 참고. */}
          <SwipeRenameField
            value={pack.name}
            onChange={onRenamePack}
            className="text-[calc(17px*var(--pack-card-font-scale,1)*var(--font-scale-factor,1))] font-medium truncate text-left min-w-0"
            inputClassName="text-[calc(17px*var(--pack-card-font-scale,1)*var(--font-scale-factor,1))] font-medium min-w-0 flex-1"
          />
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          {ratio !== null && (
            <button
              onClick={() => onToggleAll(!allChecked)}
              aria-label={allChecked ? "이 팩 전체해제" : "이 팩 전체선택"}
              style={{ transform: "scale(var(--pack-card-scale,1))" }}
            >
              <ProgressRing ratio={ratio} size={19} accentHex={accentHex ?? undefined} />
            </button>
          )}
          <span className="text-[calc(14px*var(--pack-card-font-scale,1)*var(--font-scale-factor,1))] text-text-secondary">
            {pack.items.length}개
          </span>
          {onChangeDisplayState && (
            <>
              <button
                onClick={() => onChangeDisplayState(isWide ? "normal" : "wide")}
                aria-label={isWide ? "팩 기본 크기로" : "팩 넓게 보기"}
                style={{ transform: "scale(var(--pack-card-scale,1))" }}
              >
                {isWide ? (
                  <IconArrowsMinimize size={17} stroke={1.75} color="var(--accent)" />
                ) : (
                  <IconArrowsMaximize size={17} stroke={1.75} color="var(--text-secondary)" />
                )}
              </button>
              <button
                onClick={() => onChangeDisplayState(isCollapsed ? "normal" : "collapsed")}
                aria-label={isCollapsed ? "팩 펼치기" : "팩 접기"}
                style={{ transform: "scale(var(--pack-card-scale,1))" }}
              >
                {isCollapsed ? (
                  <IconChevronRight size={17} stroke={1.75} color="var(--text-secondary)" />
                ) : (
                  <IconChevronDown size={17} stroke={1.75} color="var(--text-secondary)" />
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {!isCollapsed && (
        <>
          <div
            className={
              isWide
                ? "overflow-y-auto scrollbar-thin grid grid-cols-[repeat(auto-fit,minmax(max(calc(154px*var(--pack-card-scale,1)),46%),1fr))] md:grid-cols-[repeat(auto-fit,minmax(calc(180px*var(--pack-card-scale,1)),1fr))] max-h-[calc(360px*var(--pack-card-scale,1))] md:max-h-[calc(456px*var(--pack-card-scale,1))]"
                : "overflow-y-auto scrollbar-thin grid grid-cols-[repeat(auto-fit,minmax(max(calc(154px*var(--pack-card-scale,1)),46%),1fr))] md:grid-cols-[repeat(auto-fit,minmax(calc(180px*var(--pack-card-scale,1)),1fr))] max-h-[calc(180px*var(--pack-card-scale,1))] md:max-h-[calc(228px*var(--pack-card-scale,1))]"
            }
            style={{
              overflowY: "auto",
              gridAutoRows: "min-content",
              gap: "calc(8px * var(--pack-card-scale,1)) calc(10px * var(--pack-card-scale,1))",
              alignContent: "start",
              alignItems: "start",
            }}
          >
            {displayItems.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                onToggle={
                  item.type === "check" ? () => onToggleItem(item.id) : undefined
                }
                onChangeText={(text, style) => onChangeItemText(item.id, text, style)}
                onDelete={() => onDeleteItem(item.id)}
                onEdit={onEditItem ? () => onEditItem(item.id) : undefined}
                onStartDrag={
                  onStartItemDrag
                    ? (x, y) => onStartItemDrag(item.id, item.text, x, y)
                    : undefined
                }
                isDragSource={dragSourceItemId === item.id}
                isDragOverTarget={dragOverItemId === item.id}
                dragOverPosition={dragOverItemId === item.id ? dragOverItemPosition : null}
              />
            ))}
          </div>

          <div className="flex items-center gap-5 pt-2.5 mt-2.5 border-t border-border text-[calc(14px*var(--pack-card-font-scale,1)*var(--font-scale-factor,1))] text-text-secondary shrink-0">
            <div className="flex items-center gap-3 ml-auto">
              {pack.linkedLibraryPackId && (
                <button onClick={onRefreshFromLibrary} aria-label="팩 다시 불러오기">
                  <span style={{ transform: "scale(var(--pack-card-scale,1))" }}>
                    <IconRefresh size={18} stroke={1.75} color="var(--text-secondary)" />
                  </span>
                </button>
              )}
              <button onClick={onSaveToLibrary} aria-label="팩 저장">
                <span style={{ transform: "scale(var(--pack-card-scale,1))" }}>
                  {isSyncedWithLibrary ? (
                    <IconDeviceFloppyFilled size={18} stroke={1.75} color="var(--accent)" />
                  ) : (
                    <IconDeviceFloppy size={18} stroke={1.75} color="var(--text-secondary)" />
                  )}
                </span>
              </button>
              <button onClick={() => setConfirmDelete(true)} aria-label="팩 삭제">
                <span style={{ transform: "scale(var(--pack-card-scale,1))" }}>
                  <IconTrash size={18} stroke={1.75} color="var(--text-secondary)" />
                </span>
              </button>
            </div>
          </div>
        </>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="이 팩을 가방에서 삭제할까요?"
          message="팩에 담긴 짐도 함께 사라져요."
          checkboxLabel={
            canDeleteFromLibrary ? "라이브러리에 저장된 원본도 함께 삭제" : undefined
          }
          onCancel={() => setConfirmDelete(false)}
          onConfirm={(alsoDeleteLibrary) => {
            setConfirmDelete(false);
            onDeletePack(canDeleteFromLibrary ? alsoDeleteLibrary : false);
          }}
        />
      )}
    </div>
  );
}
