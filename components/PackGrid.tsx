"use client";

import { Pack } from "@/lib/types";
import { canDeleteFromLibrary, isInSyncWithLibrary } from "@/lib/packSync";
import PackCard from "./PackCard";

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
}) {
  const renderCard = (pack: Pack) => (
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
    />
  );

  // 팩 카드 "넓히기"는 가로폭이 아니라 짐 영역의 높이만 늘어나는 방식이라, 컬럼 span
  // 계산이 필요없다 - 그냥 흐르는 2열 그리드(items-start)로 두면 카드가 커진 행만
  // 자연스럽게 높아지고, 옆 카드는 그대로 위쪽에 붙어 보인다. 예전의 4개씩 2x2
  // 페이지네이션(가로 스크롤 스냅)은 카드 높이가 서로 달라지면 어색해져서 제거했다.
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 items-start">
      {packs.map(renderCard)}
    </div>
  );
}
