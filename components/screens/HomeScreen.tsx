"use client";

import { useEffect, useRef, useState } from "react";
import {
  IconPlus,
  IconSettings,
  IconTicket,
  IconHelpCircle,
  IconTrash,
  IconCheck,
} from "@tabler/icons-react";
import { Bag, Pack } from "@/lib/types";
import { useAuth } from "@/contexts/AuthProvider";
import { arrangeList, moveIdInOrder } from "@/lib/listSort";
import BagCard from "@/components/BagCard";
import SortSelect from "@/components/SortSelect";
import QuickPackBar from "@/components/QuickPackBar";
import JoinBagDialog from "@/components/JoinBagDialog";
import NewBagOptionsSheet from "@/components/NewBagOptionsSheet";
import NoteImportModal, { NoteImportResult } from "@/components/NoteImportModal";
import SampleBagSheet from "@/components/SampleBagSheet";
import HelpTutorialModal from "@/components/HelpTutorialModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import { homeHelpSlides } from "@/lib/helpTutorial/homeSlides";
import { useToast } from "@/components/Toast";

// 길게 누른(롱프레스) 걸로 판정하는 시간. 이보다 짧게 떼면 그냥 탭(가방 열기)으로 처리한다.
const LONG_PRESS_MS = 400;
// 롱프레스 판정 전에 이 픽셀 이상 움직이면 스크롤 의도로 보고 롱프레스를 취소한다.
const MOVE_CANCEL_PX = 10;

export default function HomeScreen({
  bags,
  initialInviteCode,
  lockedBagIds,
  quickPack,
  onOpenBag,
  onNewBag,
  onImportNote,
  onJoinBag,
  onOpenSettings,
  onOpenQuickPack,
  onBulkDeleteBags,
}: {
  bags: Bag[];
  initialInviteCode?: string;
  // 무료 전환으로 잠긴(내가 소유한) 가방 id 목록. 카드에 자물쇠 표시만 하고, 탭하면
  // 여전히 열린다 - 실제 읽기 전용 처리는 BagEditorScreen(AppShell이 계산해서 넘긴 readOnly)이 한다.
  lockedBagIds?: Set<string>;
  quickPack?: Pack;
  onOpenBag: (bag: Bag) => void;
  onNewBag: () => void;
  onImportNote: (result: NoteImportResult) => void;
  onJoinBag: (code: string) => Promise<void>;
  onOpenSettings: () => void;
  onOpenQuickPack: () => void;
  // 길게 눌러 다중선택한 가방들을 한꺼번에 삭제 (AppShell이 이미지/초대코드 정리까지 처리).
  onBulkDeleteBags: (bagIds: string[]) => void;
}) {
  const [showJoin, setShowJoin] = useState(!!initialInviteCode);
  const [showNewBagOptions, setShowNewBagOptions] = useState(false);
  const [showNoteImport, setShowNoteImport] = useState(false);
  const [showSampleSheet, setShowSampleSheet] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const { profile, updateBagSortBy, toggleBagPinned, updateBagOrder } = useAuth();
  const { show } = useToast();
  const sortBy = profile?.bagSortBy ?? "createdAt";
  const pinnedIds = profile?.pinnedBagIds ?? [];
  const arrangedBags = arrangeList(bags, { sortBy, pinnedIds, order: profile?.bagOrder });
  const pinnedSet = new Set(pinnedIds);

  // --- 길게 눌러서 순서 바꾸기 / 다중선택 ------------------------------------
  // 고정된 가방은 드래그 대상에서 제외한다(항상 맨 앞에 고정). 놓는 순간 지금 화면에
  // 보이던 순서를 그대로 bagOrder로 저장하고 정렬기준을 "custom"으로 전환한다
  // (updateBagOrder가 이 둘을 한 번에 처리).
  //
  // 길게 누르고 "그대로 뗀" 경우(실제로 다른 카드 위로 옮기지 않은 경우)는 다중선택
  // 모드 진입으로 취급한다. 즉 같은 롱프레스 제스처가 "움직이면 순서변경", "가만히
  // 있다 떼면 다중선택 시작"으로 나뉜다 - 그래서 두 기능이 서로 충돌하지 않는다.
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

  const enterSelectMode = (bagId: string) => {
    setSelectMode(true);
    setSelectedIds(new Set([bagId]));
  };

  const toggleSelected = (bagId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(bagId)) next.delete(bagId);
      else next.add(bagId);
      return next;
    });
  };

  const cancelSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const handleCardPointerDown = (bagId: string, e: React.PointerEvent) => {
    if (selectMode) return; // 선택 모드에서는 탭만으로 토글하므로 롱프레스가 필요 없음
    const x = e.clientX;
    const y = e.clientY;
    longPressStartRef.current = { id: bagId, x, y };
    clearLongPressTimer();
    longPressTimerRef.current = setTimeout(() => {
      if (pinnedSet.has(bagId)) {
        // 고정된 카드는 순서를 바꿀 수 없지만, 길게 눌러 다중선택 모드로 들어가는 건 허용한다.
        enterSelectMode(bagId);
        justDraggedRef.current = true;
      } else {
        setReorderDrag({ id: bagId, x, y, overId: null });
      }
    }, LONG_PRESS_MS);
  };

  const handleCardPointerMove = (e: React.PointerEvent) => {
    const start = longPressStartRef.current;
    if (!start || reorderDrag) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) clearLongPressTimer();
  };

  const handleCardPointerUp = () => {
    clearLongPressTimer();
  };

  useEffect(() => {
    if (!reorderDrag) return;

    const handleMove = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const cardEl = el?.closest("[data-bag-drop-id]") as HTMLElement | null;
      const overId = cardEl?.getAttribute("data-bag-drop-id") ?? null;
      setReorderDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY, overId } : d));
    };

    const handleUp = () => {
      setReorderDrag((d) => {
        if (d) {
          if (d.overId && d.overId !== d.id && !pinnedSet.has(d.overId)) {
            // 실제로 다른 카드 위로 옮겨서 놓은 경우 -> 순서 변경
            const currentIds = arrangedBags.filter((b) => !pinnedSet.has(b.id)).map((b) => b.id);
            const nextOrder = moveIdInOrder(currentIds, d.id, d.overId);
            updateBagOrder(nextOrder).catch(() => show("순서를 저장하지 못했어요"));
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
            <h1 className="text-[22px] font-bold shrink-0">가방</h1>
            <span className="text-[12px] text-text-muted truncate">
              팩을 모아 자유롭게 정리하는 공간이에요
            </span>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <button
              onClick={() => setShowHelp(true)}
              aria-label="사용법 도움말"
              className="-m-2 p-2"
            >
              <IconHelpCircle size={21} stroke={1.75} color="var(--text-secondary)" />
            </button>
            <button
              onClick={onOpenSettings}
              aria-label="설정"
              className="-m-2 p-2"
            >
              <IconSettings size={22} stroke={1.75} color="var(--text-secondary)" />
            </button>
          </div>
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
          <div className="flex items-center justify-between mb-3 gap-2">
            <button
              onClick={() => setShowJoin(true)}
              className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[12px] shrink-0"
            >
              <IconTicket size={14} stroke={1.75} />
              코드로 참여
            </button>
            {bags.length > 0 && (
              <SortSelect value={sortBy} onChange={(v) => updateBagSortBy(v).catch(() => show("변경사항을 저장하지 못했어요"))} />
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-3">
        {bags.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24">
            <button
              onClick={() => setShowNewBagOptions(true)}
              className="h-14 w-14 rounded-full flex items-center justify-center"
              style={{ background: "var(--accent)" }}
            >
              <IconPlus size={26} stroke={1.75} color="#fff" />
            </button>
            <span className="text-[13px] text-text-muted">
              새 가방 만들기
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
            {arrangedBags.map((bag) => (
              <div
                key={bag.id}
                data-bag-drop-id={bag.id}
                className="relative"
                onPointerDown={(e) => handleCardPointerDown(bag.id, e)}
                onPointerMove={handleCardPointerMove}
                onPointerUp={handleCardPointerUp}
                onPointerCancel={handleCardPointerUp}
                onClickCapture={(e) => {
                  if (justDraggedRef.current) {
                    justDraggedRef.current = false;
                    e.stopPropagation();
                    e.preventDefault();
                  }
                }}
              >
                <BagCard
                  bag={bag}
                  locked={lockedBagIds?.has(bag.id)}
                  pinned={pinnedSet.has(bag.id)}
                  onTogglePin={
                    selectMode
                      ? undefined
                      : () => toggleBagPinned(bag.id).catch(() => show("고정 상태를 저장하지 못했어요"))
                  }
                  isDragSource={reorderDrag?.id === bag.id}
                  isDragOver={reorderDrag?.overId === bag.id}
                  onClick={() => (selectMode ? toggleSelected(bag.id) : onOpenBag(bag))}
                />
                {selectMode && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div
                      className="h-9 w-9 rounded-full flex items-center justify-center"
                      style={{
                        background: selectedIds.has(bag.id) ? "var(--accent)" : "rgba(255,255,255,0.9)",
                        border: selectedIds.has(bag.id) ? "none" : "1.5px solid var(--border-strong)",
                        boxShadow: "0 1px 6px rgba(0,0,0,0.2)",
                      }}
                    >
                      {selectedIds.has(bag.id) && <IconCheck size={18} stroke={3} color="#fff" />}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {!selectMode && (
              <button
                onClick={() => setShowNewBagOptions(true)}
                className="aspect-square rounded-xl border border-dashed border-border-strong flex items-center justify-center text-text-muted"
              >
                <IconPlus size={22} stroke={1.75} />
              </button>
            )}
          </div>
        )}
      </div>

      <QuickPackBar pack={quickPack} onClick={onOpenQuickPack} />

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
          {bags.find((b) => b.id === reorderDrag.id)?.name || "가방"}
        </div>
      )}

      {/* 다중선택 모드일 때 화면 가운데 하단에 떠 있는 삭제 버튼.
          이 화면(HomeScreen) 루트가 relative라서 앱 컬럼 폭 기준으로 가운데 정렬된다.
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
            aria-label="선택한 가방 삭제"
            className="pointer-events-auto h-14 w-14 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-90 disabled:opacity-40"
            style={{ background: "var(--danger)" }}
          >
            <IconTrash size={24} stroke={1.75} color="#fff" />
          </button>
        </div>
      )}

      {showJoin && (
        <JoinBagDialog
          initialCode={initialInviteCode}
          onCancel={() => setShowJoin(false)}
          onConfirm={async (code) => {
            await onJoinBag(code);
            setShowJoin(false);
          }}
        />
      )}

      {showNewBagOptions && (
        <NewBagOptionsSheet
          onClose={() => setShowNewBagOptions(false)}
          onBlank={() => {
            setShowNewBagOptions(false);
            onNewBag();
          }}
          onFromSample={() => {
            setShowNewBagOptions(false);
            setShowSampleSheet(true);
          }}
          onFromNote={() => {
            setShowNewBagOptions(false);
            setShowNoteImport(true);
          }}
        />
      )}

      {showSampleSheet && (
        <SampleBagSheet
          onClose={() => setShowSampleSheet(false)}
          onSelect={(result) => {
            setShowSampleSheet(false);
            onImportNote(result);
          }}
        />
      )}

      {showNoteImport && (
        <NoteImportModal
          onClose={() => setShowNoteImport(false)}
          onResult={(result) => {
            setShowNoteImport(false);
            onImportNote(result);
          }}
        />
      )}

      {showHelp && (
        <HelpTutorialModal slides={homeHelpSlides} onClose={() => setShowHelp(false)} />
      )}

      {showBulkDeleteConfirm && (
        <ConfirmDialog
          title={`가방 ${selectedIds.size}개를 삭제할까요?`}
          message="삭제된 가방은 되돌릴 수 없어요. 가방에 담긴 모든 팩과 짐이 함께 사라져요."
          onCancel={() => setShowBulkDeleteConfirm(false)}
          onConfirm={() => {
            const ids = Array.from(selectedIds);
            setShowBulkDeleteConfirm(false);
            cancelSelectMode();
            onBulkDeleteBags(ids);
          }}
        />
      )}
    </div>
  );
}
