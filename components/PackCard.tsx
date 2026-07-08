"use client";

import { useState } from "react";
import {
  IconSquareCheck,
  IconSquareOff,
  IconAlignLeft,
  IconBookmark,
  IconBookmarkFilled,
  IconRefresh,
  IconTrash,
  IconGripVertical,
} from "@tabler/icons-react";
import { Pack } from "@/lib/types";
import { getProgressRatio } from "@/lib/itemStats";
import { getPackColorHex } from "@/lib/packColors";
import { useAuth } from "@/contexts/AuthProvider";
import ItemRow from "./ItemRow";
import EditableText from "./EditableText";
import ConfirmDialog from "./ConfirmDialog";
import PackColorDot from "./PackColorDot";
import ProgressRing from "./ProgressRing";

export default function PackCard({
  pack,
  onToggleItem,
  onChangeItemText,
  onDeleteItem,
  onAddCheckItem,
  onAddTextItem,
  onRenamePack,
  onChangeColor,
  onToggleAll,
  onSaveToLibrary,
  onRefreshFromLibrary,
  onDeletePack,
  onStartItemDrag,
  dragSourceItemId,
  isDragOver,
  onStartPackDrag,
  isPackDragSource,
}: {
  pack: Pack;
  onToggleItem: (itemId: string) => void;
  onChangeItemText: (
    itemId: string,
    text: string,
    style?: { bold?: boolean; strike?: boolean; color?: string }
  ) => void;
  onDeleteItem: (itemId: string) => void;
  onAddCheckItem: () => void;
  onAddTextItem: () => void;
  onRenamePack: (name: string) => void;
  onChangeColor: (colorId: string | undefined) => void;
  onToggleAll: (checked: boolean) => void;
  onSaveToLibrary: () => void;
  onRefreshFromLibrary: () => void;
  onDeletePack: () => void;
  onStartItemDrag?: (itemId: string, text: string, clientX: number, clientY: number) => void;
  dragSourceItemId?: string | null;
  isDragOver?: boolean;
  onStartPackDrag?: (clientX: number, clientY: number) => void;
  isPackDragSource?: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { profile } = useAuth();
  const moveCompletedToBottom = profile?.packSettings?.moveCompletedToBottom ?? true;
  const ratio = getProgressRatio(pack.items);
  const accentHex = getPackColorHex(pack.color);
  const checkItems = pack.items.filter((i) => i.type === "check");
  const allChecked = checkItems.length > 0 && checkItems.every((i) => i.checked);
  // 실제 저장 순서는 그대로 두고, 화면에 보여줄 때만 완료 항목을 뒤로 보낸다
  // (드래그로 다른 팩에 옮기는 기능은 인덱스가 아니라 id 기반이라 영향 없음)
  const displayItems = moveCompletedToBottom
    ? [...pack.items].sort(
        (a, b) => Number(a.type === "check" && !!a.checked) - Number(b.type === "check" && !!b.checked)
      )
    : pack.items;

  return (
    <div
      data-pack-drop-id={pack.id}
      className="flex flex-col rounded-xl border p-3 md:p-4 min-h-0 shadow-sm"
      style={{
        borderColor: isDragOver ? "var(--accent)" : "var(--border)",
        boxShadow: isDragOver ? "0 0 0 2px var(--accent)" : undefined,
        background: accentHex ? `${accentHex}26` : "var(--pack-card-bg)",
        opacity: isPackDragSource ? 0.4 : 1,
        transition: "box-shadow 120ms ease, border-color 120ms ease, opacity 120ms ease",
      }}
    >
      <div className="flex items-center justify-between mb-2 shrink-0 gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
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
              <IconGripVertical size={14} stroke={1.75} />
            </span>
          )}
          <PackColorDot colorId={pack.color} onChange={onChangeColor} />
          {checkItems.length > 0 && (
            <button
              onClick={() => onToggleAll(!allChecked)}
              aria-label={allChecked ? "이 팩 전체해제" : "이 팩 전체선택"}
              className="shrink-0"
            >
              {allChecked ? (
                <IconSquareOff size={15} stroke={1.75} color="var(--text-secondary)" />
              ) : (
                <IconSquareCheck size={15} stroke={1.75} color="var(--text-secondary)" />
              )}
            </button>
          )}
          <EditableText
            value={pack.name}
            onChange={onRenamePack}
            className="text-[14px] font-medium truncate text-left min-w-0"
            inputClassName="text-[14px] font-medium min-w-0 flex-1"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {ratio !== null && <ProgressRing ratio={ratio} size={16} accentHex={accentHex ?? undefined} />}
          <span className="text-[12px] text-text-secondary">
            {pack.items.length}개
          </span>
          {pack.linkedLibraryPackId && (
            <button onClick={onRefreshFromLibrary} aria-label="팩 다시 불러오기">
              <IconRefresh size={15} stroke={1.75} color="var(--text-secondary)" />
            </button>
          )}
          <button
            onClick={onSaveToLibrary}
            aria-label="팩으로 저장"
            disabled={pack.savedAsLibraryPack}
          >
            {pack.savedAsLibraryPack ? (
              <IconBookmarkFilled size={15} stroke={1.75} color="var(--accent)" />
            ) : (
              <IconBookmark size={15} stroke={1.75} color="var(--text-secondary)" />
            )}
          </button>
          <button onClick={() => setConfirmDelete(true)} aria-label="팩 삭제">
            <IconTrash size={15} stroke={1.75} color="var(--text-secondary)" />
          </button>
        </div>
      </div>

      <div
        className="overflow-y-auto scrollbar-thin grid grid-cols-[repeat(auto-fit,minmax(128px,1fr))] md:grid-cols-[repeat(auto-fit,minmax(150px,1fr))] h-[150px] md:h-[190px]"
        style={{
          overflowY: "auto",
          gridAutoRows: "min-content",
          gap: "6px 8px",
          alignContent: "start",
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
            onStartDrag={
              onStartItemDrag
                ? (x, y) => onStartItemDrag(item.id, item.text, x, y)
                : undefined
            }
            isDragSource={dragSourceItemId === item.id}
          />
        ))}
      </div>

      <div className="flex gap-4 pt-2 mt-2 border-t border-border text-[12px] text-text-secondary shrink-0">
        <button onClick={onAddCheckItem} className="flex items-center gap-1">
          <IconSquareCheck size={14} stroke={1.75} />
          체크항목
        </button>
        <button onClick={onAddTextItem} className="flex items-center gap-1">
          <IconAlignLeft size={14} stroke={1.75} />
          텍스트
        </button>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="이 팩을 가방에서 삭제할까요?"
          message="팩에 담긴 짐도 함께 사라져요."
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false);
            onDeletePack();
          }}
        />
      )}
    </div>
  );
}
