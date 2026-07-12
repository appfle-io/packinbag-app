"use client";

import { useEffect, useRef, useState } from "react";
import { IconPlus, IconSettings, IconTrash, IconCheck } from "@tabler/icons-react";
import { Pack } from "@/lib/types";
import { useAuth } from "@/contexts/AuthProvider";
import { arrangeList, moveIdInOrder } from "@/lib/listSort";
import PackTile from "@/components/PackTile";
import SortSelect from "@/components/SortSelect";
import QuickPackBar from "@/components/QuickPackBar";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

const LONG_PRESS_MS = 400;
const MOVE_CANCEL_PX = 10;

export default function PacksScreen({
  packs,
  quickPack,
  lockedPackIds,
  onOpenPack,
  onNewPack,
  onOpenSettings,
  onBulkDeletePacks,
}: {
  // 빠른팩(quickPack)은 이 배열에 이미 섞여있을 수 있어서, 그리드 렌더링 전에
  // 걸러낸다 - 빠른팩은 그리드가 아니라 하단 QuickPackBar 전용 자리에서만 보여준다.
  packs: Pack[];
  quickPack?: Pack;
  // 무료 전환으로 잠긴 팩 id 목록. 타일에 자물쇠 표시만 하고, 탭하면 여전히 열린다 -
  // 실제 읽기 전용 처리는 PackLibraryEditorScreen(AppShell이 계산해서 넘긴 readOnly)이 한다.
  lockedPackIds?: Set<string>;
  onOpenPack: (pack: Pack) => void;
  onNewPack: () => void;
  onOpenSettings: () => void;
  // 길게 눌러 다중선택한 팩들을 한꺼번에 삭제 (AppShell이 라이브러리에서 실제로 삭제).
  onBulkDeletePacks: (packIds: string[]) => void;
}) {
  const { profile, updatePackSortBy, togglePackPinned, updatePackOrder } = useAuth();
  const { show } = useToast();
  const sortBy = profile?.packSortBy ?? "createdAt";
  const pinnedIds = profile?.pinnedPackIds ?? [];
  const gridPacks = packs.filter((p) => !p.isQuickPack);
  const arrangedPacks = arrangeList(gridPacks, { sortBy, pinnedIds, order: profile?.packOrder });
  const pinnedSet = new Set(pinnedIds);

  // 길게 눌러서 순서 바꾸기 (HomeScreen의 가방 그리드와 동일한 패턴). 길게 누르고
  // "그대로 뗀" 경우(실제로 다른 타일 위로 옮기지 않은 경우)는 다중선택 모드 진입으로
  // 취급한다 - 같은 롱프레스 제스처가 "움직이면 순서변경", "가만히 있다 떼면 다중선택
  // 시작"으로 나뉘어서 두 기능이 서로 충돌하지 않는다.
  const [reorderDrag, setReorderDrag] = useState<{ id: string; x: number; y: number; overId: string | null } | null>(
    null
  );
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStartRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const justDraggedRef = useRef(false);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // 선택된 항목이 하나도 없으면(마지막 선택을 해제했을 때) 다중선택 모드도 자동으로 빠져나간다.
  useEffect(() => {
    if (selectMode && selectedIds.size === 0) setSelectMode(false);
  }, [selectMode, selectedIds]);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const enterSelectMode = (packId: string) => {
    setSelectMode(true);
    setSelectedIds(new Set([packId]));
  };

  const toggleSelected = (packId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(packId)) next.delete(packId);
      else next.add(packId);
      return next;
    });
  };

  const cancelSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const handleTilePointerDown = (packId: string, e: React.PointerEvent) => {
    if (selectMode) return; // 선택 모드에서는 탭만으로 토글하므로 롱프레스가 필요 없음
    const x = e.clientX;
    const y = e.clientY;
    longPressStartRef.current = { id: packId, x, y };
    clearLongPressTimer();
    longPressTimerRef.current = setTimeout(() => {
      if (pinnedSet.has(packId)) {
        // 고정된 타일은 순서를 바꿀 수 없지만, 길게 눌러 다중선택 모드로 들어가는 건 허용한다.
        enterSelectMode(packId);
        justDraggedRef.current = true;
      } else {
        setReorderDrag({ id: packId, x, y, overId: null });
      }
    }, LONG_PRESS_MS);
  };

  const handleTilePointerMove = (e: React.PointerEvent) => {
    const start = longPressStartRef.current;
    if (!start || reorderDrag) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) clearLongPressTimer();
  };

  const handleTilePointerUp = () => {
    clearLongPressTimer();
  };

  useEffect(() => {
    if (!reorderDrag) return;

    const handleMove = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const tileEl = el?.closest("[data-pack-tile-drop-id]") as HTMLElement | null;
      const overId = tileEl?.getAttribute("data-pack-tile-drop-id") ?? null;
      setReorderDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY, overId } : d));
    };

    const handleUp = () => {
      setReorderDrag((d) => {
        if (d) {
          if (d.overId && d.overId !== d.id && !pinnedSet.has(d.overId)) {
            // 실제로 다른 타일 위로 옮겨서 놓은 경우 -> 순서 변경
            const currentIds = arrangedPacks.filter((p) => !pinnedSet.has(p.id)).map((p) => p.id);
            const nextOrder = moveIdInOrder(currentIds, d.id, d.overId);
            updatePackOrder(nextOrder).catch(() => show("순서를 저장하지 못했어요"));
          } else {
            // 움직이지 않고 그대로 뗀 경우 -> 다중선택 모드로 진입
            enterSelectMode(d.id);
          }
          justDraggedRef.current = true;
        }
        return null;
      });
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reorderDrag !== null]);

  return (
    <div className="relative flex-1 flex flex-col overflow-hidden">
      <div className="shrink-0 p-4 pb-0">
        <div className="flex items-center justify-between mb-4 gap-2">
          <div className="flex items-baseline gap-2 min-w-0">
            <h1 className="text-[22px] font-bold shrink-0">팩</h1>
            <span className="text-[12px] text-text-muted truncate">
              한 번 만들어두면 여러 가방에서 두고두고 써요
            </span>
          </div>
          <button
            onClick={onOpenSettings}
            aria-label="설정"
            className="-m-2 p-2 shrink-0"
          >
            <IconSettings size={22} stroke={1.75} color="var(--text-secondary)" />
          </button>
        </div>

        {selectMode ? (
          <div className="flex items-center justify-between mb-3 gap-2">
            <button
              onClick={cancelSelectMode}
              className="text-[13px] text-text-secondary px-1 py-1.5"
            >
              취소
            </button>
            <span className="text-[13px] font-medium">{selectedIds.size}개 선택됨</span>
          </div>
        ) : (
          gridPacks.length > 0 && (
            <div className="flex justify-end mb-3">
              <SortSelect value={sortBy} onChange={(v) => updatePackSortBy(v).catch(() => show("변경사항을 저장하지 못했어요"))} />
            </div>
          )
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
          {arrangedPacks.map((pack) => (
            <div
              key={pack.id}
              data-pack-tile-drop-id={pack.id}
              className="relative"
              onPointerDown={(e) => handleTilePointerDown(pack.id, e)}
              onPointerMove={handleTilePointerMove}
              onPointerUp={handleTilePointerUp}
              onPointerCancel={handleTilePointerUp}
              onClickCapture={(e) => {
                if (justDraggedRef.current) {
                  justDraggedRef.current = false;
                  e.stopPropagation();
                  e.preventDefault();
                }
              }}
            >
              <PackTile
                pack={pack}
                locked={lockedPackIds?.has(pack.id)}
                pinned={pinnedSet.has(pack.id)}
                onTogglePin={
                  selectMode
                    ? undefined
                    : () => togglePackPinned(pack.id).catch(() => show("고정 상태를 저장하지 못했어요"))
                }
                isDragSource={reorderDrag?.id === pack.id}
                isDragOver={reorderDrag?.overId === pack.id}
                onClick={() => (selectMode ? toggleSelected(pack.id) : onOpenPack(pack))}
              />
              {selectMode && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div
                    className="h-9 w-9 rounded-full flex items-center justify-center"
                    style={{
                      background: selectedIds.has(pack.id) ? "var(--accent)" : "rgba(255,255,255,0.9)",
                      border: selectedIds.has(pack.id) ? "none" : "1.5px solid var(--border-strong)",
                      boxShadow: "0 1px 6px rgba(0,0,0,0.2)",
                    }}
                  >
                    {selectedIds.has(pack.id) && <IconCheck size={18} stroke={3} color="#fff" />}
                  </div>
                </div>
              )}
            </div>
          ))}
          {!selectMode && (
            <button
              onClick={onNewPack}
              className="aspect-square rounded-xl border border-dashed border-border-strong flex items-center justify-center text-text-muted"
            >
              <IconPlus size={22} stroke={1.75} />
            </button>
          )}
        </div>
      </div>

      <QuickPackBar pack={quickPack} onClick={() => quickPack && onOpenPack(quickPack)} />

      {reorderDrag && (
        <div
          className="fixed z-[95] pointer-events-none rounded-lg px-3 py-2 text-[13px] shadow-lg"
          style={{
            left: reorderDrag.x,
            top: reorderDrag.y,
            transform: "translate(-50%, -120%)",
            background: "var(--accent)",
            color: "#fff",
          }}
        >
          {gridPacks.find((p) => p.id === reorderDrag.id)?.name || "팩"}
        </div>
      )}

      {/* 다중선택 모드일 때 화면 가운데 하단에 떠 있는 삭제 버튼.
          이 화면(PacksScreen) 루트가 relative라서 앱 컬럼 폭 기준으로 가운데 정렬된다.
          bottom-24(96px)만큼 충분히 띄운 이유: 하단탭바 중앙에는 "+"(빠른입력) FAB가
          nav 위로 44px 튀어나와 있는데(BottomTabBar.tsx), 이 화면 컨테이너 바닥이 곧
          그 nav의 윗변과 같은 자리라서 bottom-4처럼 너무 가깝게 두면 삭제 버튼이 그
          "+" 버튼과 겹쳐 보인다. 그 FAB 위로 확실히 떨어지도록 여유를 뒀다.
      */}
      {selectMode && (
        <div className="absolute inset-x-0 bottom-24 z-[96] flex justify-center pointer-events-none">
          <button
            onClick={() => selectedIds.size > 0 && setShowBulkDeleteConfirm(true)}
            disabled={selectedIds.size === 0}
            aria-label="선택한 팩 삭제"
            className="pointer-events-auto h-14 w-14 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-90 disabled:opacity-40"
            style={{ background: "var(--danger)" }}
          >
            <IconTrash size={24} stroke={1.75} color="#fff" />
          </button>
        </div>
      )}

      {showBulkDeleteConfirm && (
        <ConfirmDialog
          title={`팩 ${selectedIds.size}개를 삭제할까요?`}
          message="삭제된 팩은 되돌릴 수 없어요. 이미 가방에 불러와진 사본에는 영향이 없어요."
          onCancel={() => setShowBulkDeleteConfirm(false)}
          onConfirm={() => {
            const ids = Array.from(selectedIds);
            setShowBulkDeleteConfirm(false);
            cancelSelectMode();
            onBulkDeletePacks(ids);
          }}
        />
      )}
    </div>
  );
}
