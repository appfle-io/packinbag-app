"use client";

import { useState } from "react";
import {
  IconDotsVertical,
  IconDeviceFloppy,
  IconDeviceFloppyFilled,
  IconRefresh,
  IconTrash,
  IconGripVertical,
  IconChevronDown,
  IconChevronRight,
  IconSquareCheck,
  IconAlignLeft,
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

// 메모장뷰(가방 속 팩을 "헤더 + 내용"이 이어지는 문서형 레이아웃으로 보여주는 방식)의
// 팩 하나. PackCard와 기능은 100% 동일하지만(드래그이동/스와이프수정삭제/저장/새로고침/
// 삭제/전체선택 등), 아이폰 메모장 체크리스트에 가깝게 보이도록 다음을 다르게 한다:
// - 카드 박스 대신 얇은 구분선을 가진 섹션
// - 짐 사이 간격을 좁힘, 짐 개수 표시 제거
// - 저장/새로고침/삭제를 하단 툴바 대신 헤더의 "⋯" 메뉴로 축소
// - 짐 추가는 하단의 얇은 "+ 항목 추가" 한 줄로 축소 (체크/텍스트 아이콘만)
// - 체크박스를 사각형 대신 둥근 모양으로
export default function NotebookPackSection({
  pack,
  isSyncedWithLibrary,
  canDeleteFromLibrary,
  onToggleItem,
  onChangeItemText,
  onDeleteItem,
  onAddCheckItem,
  onAddTextItem,
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
  isDragOver,
  onStartPackDrag,
  isPackDragSource,
  isLast,
  dragOverItemPosition,
  isPackDragOverPosition,
}: {
  pack: Pack;
  isSyncedWithLibrary: boolean;
  canDeleteFromLibrary?: boolean;
  onToggleItem: (itemId: string) => void;
  onChangeItemText: (
    itemId: string,
    text: string,
    style?: { bold?: boolean; strike?: boolean; color?: string }
  ) => void;
  onDeleteItem: (itemId: string) => void;
  onAddCheckItem: () => void;
  onAddTextItem: () => void;
  onEditItem?: (itemId: string) => void;
  onRenamePack: (name: string) => void;
  onToggleAll: (checked: boolean) => void;
  onSaveToLibrary: () => void;
  onRefreshFromLibrary: () => void;
  onDeletePack: (alsoDeleteLibrary: boolean) => void;
  // 메모장뷰는 "wide" 개념이 없다(문서가 이어지는 형태라 넓게보기가 의미없음) -
  // "collapsed"인지 아닌지(=섹션 접기/펼치기, 노션처럼)만 쓴다.
  onChangeDisplayState?: (nextState: "normal" | "collapsed") => void;
  onStartItemDrag?: (itemId: string, text: string, clientX: number, clientY: number) => void;
  dragSourceItemId?: string | null;
  dragOverItemId?: string | null;
  isDragOver?: boolean;
  onStartPackDrag?: (clientX: number, clientY: number) => void;
  isPackDragSource?: boolean;
  isLast?: boolean;
  dragOverItemPosition?: "before" | "after" | null;
  // 드래그한 팩을 이 섹션 위(before)/아래(after) 중 어디에 놓을지. isDragOver와 함께 쓴다.
  isPackDragOverPosition?: "before" | "after" | null;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const { profile } = useAuth();
  const moveCompletedToBottom = profile?.packSettings?.moveCompletedToBottom ?? true;
  const ratio = getProgressRatio(pack.items);
  const accentHex = getPackColorHex(pack.color);
  const checkItems = pack.items.filter((i) => i.type === "check");
  const allChecked = checkItems.length > 0 && checkItems.every((i) => i.checked);
  const isCollapsed = (pack.displayState ?? "normal") === "collapsed";
  const displayItems = getDisplayOrderedItems(pack.items, moveCompletedToBottom);

  return (
    <div
      data-pack-drop-id={pack.id}
      className={`py-2 ${isLast ? "" : "border-b border-border"}`}
      style={{
        boxShadow: isDragOver
          ? isPackDragOverPosition === "after"
            ? "inset 0 -2px 0 0 var(--accent)"
            : "inset 0 2px 0 0 var(--accent)"
          : undefined,
        opacity: isPackDragSource ? 0.4 : 1,
        transition: "box-shadow 120ms ease, opacity 120ms ease",
      }}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <button
          onClick={() => onChangeDisplayState?.(isCollapsed ? "normal" : "collapsed")}
          aria-label={isCollapsed ? "섹션 펼치기" : "섹션 접기"}
          className="shrink-0"
        >
          {isCollapsed ? (
            <IconChevronRight size={15} stroke={1.75} color="var(--text-secondary)" />
          ) : (
            <IconChevronDown size={15} stroke={1.75} color="var(--text-secondary)" />
          )}
        </button>
        {onStartPackDrag && (
          <span
            onPointerDown={(e) => {
              e.stopPropagation();
              onStartPackDrag(e.clientX, e.clientY);
            }}
            className="shrink-0 touch-none cursor-grab"
            style={{ color: "var(--text-muted)" }}
            aria-label="드래그해서 팩 순서 바꾸기"
          >
            <IconGripVertical size={15} stroke={1.75} />
          </span>
        )}
        {accentHex && (
          <span
            className="shrink-0 h-1.5 w-1.5 rounded-full"
            style={{ background: accentHex }}
          />
        )}
        <SwipeRenameField
          value={pack.name}
          onChange={onRenamePack}
          className="text-[15px] font-semibold truncate text-left min-w-0 flex-1"
          inputClassName="text-[15px] font-semibold min-w-0 flex-1"
        />
        {ratio !== null && (
          <button
            onClick={() => onToggleAll(!allChecked)}
            aria-label={allChecked ? "이 팩 전체해제" : "이 팩 전체선택"}
            className="shrink-0"
          >
            <ProgressRing ratio={ratio} size={16} accentHex={accentHex ?? undefined} />
          </button>
        )}
        <div className="relative shrink-0">
          <button
            onClick={() => setShowMenu((v) => !v)}
            aria-label="팩 메뉴"
            className="flex items-center justify-center"
          >
            <IconDotsVertical size={16} stroke={1.75} color="var(--text-secondary)" />
          </button>
          {showMenu && (
            <>
              {/* 메뉴 바깥을 탭하면 닫히도록 전체 화면을 덮는 투명 배경 */}
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div
                className="absolute right-0 top-full mt-1 z-50 rounded-lg border border-border shadow-lg overflow-hidden"
                style={{ background: "var(--surface)", minWidth: 140 }}
              >
                {pack.linkedLibraryPackId && (
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onRefreshFromLibrary();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left"
                  >
                    <IconRefresh size={15} stroke={1.75} />
                    다시 불러오기
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onSaveToLibrary();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left"
                >
                  {isSyncedWithLibrary ? (
                    <IconDeviceFloppyFilled size={15} stroke={1.75} color="var(--accent)" />
                  ) : (
                    <IconDeviceFloppy size={15} stroke={1.75} />
                  )}
                  팩으로 저장
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    setConfirmDelete(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left"
                  style={{ color: "var(--danger)" }}
                >
                  <IconTrash size={15} stroke={1.75} />
                  팩 삭제
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {!isCollapsed && (
        <>
          <div
            className="grid grid-cols-[repeat(auto-fit,minmax(max(120px,46%),1fr))] md:grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-y-0.5 gap-x-1.5 pl-6"
            style={{ gridAutoRows: "min-content", alignItems: "start" }}
          >
            {displayItems.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                onToggle={item.type === "check" ? () => onToggleItem(item.id) : undefined}
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
                noBackground
                roundCheckbox
              />
            ))}
          </div>

          <div className="flex items-center gap-3 pt-1 pl-6 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
            <button onClick={onAddCheckItem} className="flex items-center gap-1" aria-label="체크 항목 추가">
              <IconSquareCheck size={14} stroke={1.75} />
              항목 추가
            </button>
            <button onClick={onAddTextItem} aria-label="텍스트 추가" className="flex items-center">
              <IconAlignLeft size={14} stroke={1.75} />
            </button>
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
