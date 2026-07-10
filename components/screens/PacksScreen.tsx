"use client";

import { useEffect, useRef, useState } from "react";
import { IconPlus } from "@tabler/icons-react";
import { Pack } from "@/lib/types";
import { useAuth } from "@/contexts/AuthProvider";
import { arrangeList, moveIdInOrder } from "@/lib/listSort";
import PackTile from "@/components/PackTile";
import SortSelect from "@/components/SortSelect";
import { useToast } from "@/components/Toast";

const LONG_PRESS_MS = 400;
const MOVE_CANCEL_PX = 10;

export default function PacksScreen({
  packs,
  lockedPackIds,
  onOpenPack,
  onNewPack,
}: {
  packs: Pack[];
  // 무료 전환으로 잠긴 팩 id 목록. 타일에 자물쇠 표시만 하고, 탭하면 여전히 열린다 -
  // 실제 읽기 전용 처리는 PackLibraryEditorScreen(AppShell이 계산해서 넘긴 readOnly)이 한다.
  lockedPackIds?: Set<string>;
  onOpenPack: (pack: Pack) => void;
  onNewPack: () => void;
}) {
  const { profile, updatePackSortBy, togglePackPinned, updatePackOrder } = useAuth();
  const { show } = useToast();
  const sortBy = profile?.packSortBy ?? "createdAt";
  const pinnedIds = profile?.pinnedPackIds ?? [];
  const arrangedPacks = arrangeList(packs, { sortBy, pinnedIds, order: profile?.packOrder });
  const pinnedSet = new Set(pinnedIds);

  // 길게 눌러서 순서 바꾸기 (HomeScreen의 가방 그리드와 동일한 패턴)
  const [reorderDrag, setReorderDrag] = useState<{ id: string; x: number; y: number; overId: string | null } | null>(
    null
  );
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStartRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const justDraggedRef = useRef(false);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleTilePointerDown = (packId: string, e: React.PointerEvent) => {
    if (pinnedSet.has(packId)) return;
    const x = e.clientX;
    const y = e.clientY;
    longPressStartRef.current = { id: packId, x, y };
    clearLongPressTimer();
    longPressTimerRef.current = setTimeout(() => {
      setReorderDrag({ id: packId, x, y, overId: null });
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
        if (d && d.overId && d.overId !== d.id && !pinnedSet.has(d.overId)) {
          const currentIds = arrangedPacks.filter((p) => !pinnedSet.has(p.id)).map((p) => p.id);
          const nextOrder = moveIdInOrder(currentIds, d.id, d.overId);
          updatePackOrder(nextOrder).catch(() => show("순서를 저장하지 못했어요"));
        }
        if (d) justDraggedRef.current = true;
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
    <div className="flex-1 overflow-y-auto p-4">
      <div className="flex items-baseline gap-2 mb-4">
        <h1 className="text-[22px] font-bold">팩</h1>
        <span className="text-[12px] text-text-muted">
          한 번 만들어두면 여러 가방에서 두고두고 써요
        </span>
      </div>

      {packs.length > 0 && (
        <div className="flex justify-end mb-3">
          <SortSelect value={sortBy} onChange={(v) => updatePackSortBy(v).catch(() => show("변경사항을 저장하지 못했어요"))} />
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
        {arrangedPacks.map((pack) => (
          <div
            key={pack.id}
            data-pack-tile-drop-id={pack.id}
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
              onTogglePin={() => togglePackPinned(pack.id).catch(() => show("고정 상태를 저장하지 못했어요"))}
              isDragSource={reorderDrag?.id === pack.id}
              isDragOver={reorderDrag?.overId === pack.id}
              onClick={() => onOpenPack(pack)}
            />
          </div>
        ))}
        <button
          onClick={onNewPack}
          className="aspect-square rounded-xl border border-dashed border-border-strong flex items-center justify-center text-text-muted"
        >
          <IconPlus size={22} stroke={1.75} />
        </button>
      </div>

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
          {packs.find((p) => p.id === reorderDrag.id)?.name || "팩"}
        </div>
      )}
    </div>
  );
}
