"use client";

import { useState } from "react";
import {
  IconSquareCheck,
  IconAlignLeft,
  IconDeviceFloppy,
  IconDeviceFloppyFilled,
  IconRefresh,
  IconTrash,
  IconGripVertical,
  IconChevronDown,
  IconChevronRight,
} from "@tabler/icons-react";
import { Pack } from "@/lib/types";
import { getProgressRatio } from "@/lib/itemStats";
import { getPackColorHex } from "@/lib/packColors";
import { useAuth } from "@/contexts/AuthProvider";
import ItemRow from "./ItemRow";
import EditableText from "./EditableText";
import ConfirmDialog from "./ConfirmDialog";
import ProgressRing from "./ProgressRing";

// 메모장뷰(가방 속 팩을 "헤더 + 내용"이 이어지는 문서형 레이아웃으로 보여주는 방식)의
// 팩 하나. PackCard와 기능은 100% 동일하지만(드래그이동/스와이프수정삭제/저장/새로고침/
// 삭제 등), 카드 박스 형태 대신 얇은 구분선을 가진 섹션 형태로 보여준다. 짐 영역은
// 최소 2열부터 화면 크기에 맞게 늘어나는 반응형 그리드(노트 형태의 여러줄 배치)를 쓴다.
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
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { profile } = useAuth();
  const moveCompletedToBottom = profile?.packSettings?.moveCompletedToBottom ?? true;
  const ratio = getProgressRatio(pack.items);
  const accentHex = getPackColorHex(pack.color);
  const isCollapsed = (pack.displayState ?? "normal") === "collapsed";
  const displayItems = moveCompletedToBottom
    ? [...pack.items].sort(
        (a, b) => Number(a.type === "check" && !!a.checked) - Number(b.type === "check" && !!b.checked)
      )
    : pack.items;

  return (
    <div
      data-pack-drop-id={pack.id}
      className={`py-3 ${isLast ? "" : "border-b border-border"}`}
      style={{
        boxShadow: isDragOver ? "inset 0 0 0 2px var(--accent)" : undefined,
        borderRadius: isDragOver ? 8 : undefined,
        opacity: isPackDragSource ? 0.4 : 1,
        transition: "box-shadow 120ms ease, opacity 120ms ease",
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={() => onChangeDisplayState?.(isCollapsed ? "normal" : "collapsed")}
          aria-label={isCollapsed ? "섹션 펼치기" : "섹션 접기"}
          className="shrink-0"
        >
          {isCollapsed ? (
            <IconChevronRight size={16} stroke={1.75} color="var(--text-secondary)" />
          ) : (
            <IconChevronDown size={16} stroke={1.75} color="var(--text-secondary)" />
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
            <IconGripVertical size={16} stroke={1.75} />
          </span>
        )}
        {accentHex && (
          <span
            className="shrink-0 h-2 w-2 rounded-full"
            style={{ background: accentHex }}
          />
        )}
        <EditableText
          value={pack.name}
          onChange={onRenamePack}
          className="text-[16px] font-semibold truncate text-left min-w-0 flex-1"
          inputClassName="text-[16px] font-semibold min-w-0 flex-1"
        />
        {ratio !== null && <ProgressRing ratio={ratio} size={18} accentHex={accentHex ?? undefined} />}
        <span className="text-[12.5px] text-text-secondary shrink-0">{pack.items.length}개</span>
      </div>

      {!isCollapsed && (
        <>
          <div
            className="grid grid-cols-[repeat(auto-fit,minmax(max(140px,46%),1fr))] md:grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-2 md:gap-2.5 pl-6"
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
              />
            ))}
          </div>

          <div className="flex items-center gap-5 pt-2.5 mt-2.5 pl-6 text-[13px] text-text-secondary">
            <button onClick={onAddCheckItem} className="flex items-center gap-1.5">
              <IconSquareCheck size={16} stroke={1.75} />
              체크항목
            </button>
            <button onClick={onAddTextItem} className="flex items-center gap-1.5">
              <IconAlignLeft size={16} stroke={1.75} />
              텍스트
            </button>
            <div className="flex items-center gap-3 ml-auto">
              {pack.linkedLibraryPackId && (
                <button onClick={onRefreshFromLibrary} aria-label="팩 다시 불러오기">
                  <IconRefresh size={17} stroke={1.75} color="var(--text-secondary)" />
                </button>
              )}
              <button onClick={onSaveToLibrary} aria-label="팩 저장">
                {isSyncedWithLibrary ? (
                  <IconDeviceFloppyFilled size={17} stroke={1.75} color="var(--accent)" />
                ) : (
                  <IconDeviceFloppy size={17} stroke={1.75} color="var(--text-secondary)" />
                )}
              </button>
              <button onClick={() => setConfirmDelete(true)} aria-label="팩 삭제">
                <IconTrash size={17} stroke={1.75} color="var(--text-secondary)" />
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
