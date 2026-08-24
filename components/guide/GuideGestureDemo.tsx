"use client";

import { useState, useEffect, useRef } from "react";
import { IconTrash, IconClick, IconRotate, IconCheck } from "@tabler/icons-react";
import ItemEditModal from "@/components/ItemEditModal";
import { GUIDE_SAMPLE_BAG, GUIDE_SAMPLE_ITEM, GUIDE_SAMPLE_MEMBERS } from "@/lib/guideSampleData";

export default function GuideGestureDemo() {
  const [currentOffset, setCurrentOffset] = useState<number>(0);
  const [isUserInteracting, setIsUserInteracting] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [item, setItem] = useState(GUIDE_SAMPLE_ITEM);
  const [isDeleted, setIsDeleted] = useState<boolean>(false);

  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const currentOffsetRef = useRef(0);
  const userTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 사용자 조작이 없을 때 왼쪽 삭제 스와이프 안내 자동 루프 (0 -> -56 -> 0)
  useEffect(() => {
    if (isUserInteracting || isDeleted) return;

    const sequence = [-56, 0];
    let step = 0;
    const timer = setInterval(() => {
      step = (step + 1) % sequence.length;
      const nextOffset = sequence[step];
      setCurrentOffset(nextOffset);
      currentOffsetRef.current = nextOffset;
    }, 2400);

    return () => clearInterval(timer);
  }, [isUserInteracting, isDeleted]);

  const pauseAutoAndSetOffset = (offset: number) => {
    setIsUserInteracting(true);
    setCurrentOffset(offset);
    currentOffsetRef.current = offset;

    if (userTimerRef.current) clearTimeout(userTimerRef.current);
    userTimerRef.current = setTimeout(() => {
      setIsUserInteracting(false);
    }, 5000);
  };

  // 포인터(터치/마우스) 드래그 핸들러 - 왼쪽으로만 스와이프 허용 (실제 앱과 동일)
  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    setIsUserInteracting(true);
    if (userTimerRef.current) clearTimeout(userTimerRef.current);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const diff = e.clientX - startXRef.current;
    // 오른쪽으로는 이동 안 됨(최대 0), 왼쪽으로만 최대 -70px
    const clamped = Math.max(-70, Math.min(0, diff));
    setCurrentOffset(clamped);
    currentOffsetRef.current = clamped;
  };

  const handlePointerUp = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    const val = currentOffsetRef.current;
    if (val < -25) {
      setCurrentOffset(-56);
    } else {
      setCurrentOffset(0);
    }

    if (userTimerRef.current) clearTimeout(userTimerRef.current);
    userTimerRef.current = setTimeout(() => {
      setIsUserInteracting(false);
    }, 5000);
  };

  const handleDelete = () => {
    setIsDeleted(true);
    setCurrentOffset(0);
  };

  const handleRestore = () => {
    setIsDeleted(false);
    setCurrentOffset(0);
  };

  if (isDeleted) {
    return (
      <div className="w-full flex items-center justify-between p-3.5 rounded-xl border border-dashed border-border bg-surface/20 text-[12px] select-none">
        <span className="text-text-muted">짐이 삭제되었습니다.</span>
        <button
          type="button"
          onClick={handleRestore}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface border border-border hover:border-accent text-accent font-medium transition-colors"
        >
          <IconRotate size={13} />
          <span>되살리기</span>
        </button>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-2.5 select-none">
      {/* 1) 스와이프 및 더블클릭 대상 아이템 행 */}
      <div
        className="relative w-full overflow-hidden rounded-xl border border-border/50 bg-surface-2/30 cursor-grab active:cursor-grabbing touch-pan-y"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={() => setShowEditModal(true)}
        onTouchEnd={(e) => {
          const now = Date.now();
          // @ts-expect-error - custom property for double tap tracking
          if (e.currentTarget._lastTap && now - e.currentTarget._lastTap < 350) {
            setShowEditModal(true);
          }
          // @ts-expect-error - custom property for double tap tracking
          e.currentTarget._lastTap = now;
        }}
      >
        {/* 배경 액션 레이어: 왼쪽으로 밀었을 때 우측에 삭제 버튼 */}
        <div className="absolute inset-0 flex items-center justify-end px-3 text-[12px] font-medium">
          <button
            type="button"
            onClick={handleDelete}
            className="flex items-center gap-1 text-red-500 hover:text-red-600 font-semibold p-1 transition-opacity duration-150 cursor-pointer"
            style={{ opacity: currentOffset < -15 ? 1 : 0 }}
          >
            <IconTrash size={15} stroke={2} />
            <span>삭제</span>
          </button>
        </div>

        {/* 전면 카드 행 */}
        <div
          className="relative flex items-center justify-between p-3.5 bg-surface border-border transition-transform duration-200 ease-out"
          style={{ transform: `translateX(${currentOffset}px)` }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-4 w-4 rounded border border-border-strong bg-surface/60 flex items-center justify-center shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-[13px] font-medium text-foreground truncate">{item.text}</span>
              <span className="text-[10.5px] text-text-muted">
                왼쪽으로 밀면 삭제 · 더블탭하면 상세 수정
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowEditModal(true);
              }}
              className="text-[11px] font-medium px-2 py-1 rounded-lg bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-foreground transition-colors cursor-pointer"
            >
              수정 모달
            </button>
          </div>
        </div>
      </div>

      {/* 2) 인터랙션 제어 버튼 바 */}
      <div className="flex items-center justify-between gap-1.5 pt-0.5">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => pauseAutoAndSetOffset(-56)}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors ${
              currentOffset === -56
                ? "bg-red-500/15 border-red-500/40 text-red-600 dark:text-red-400"
                : "bg-surface/50 border-border/60 hover:border-border text-text-secondary"
            }`}
          >
            ← 왼쪽으로 밀기 (삭제)
          </button>
          <button
            type="button"
            onClick={() => pauseAutoAndSetOffset(0)}
            className="px-2.5 py-1 rounded-lg border border-border/60 bg-surface/50 hover:border-border text-[11px] text-text-secondary transition-colors"
          >
            제자리로
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowEditModal(true)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-accent/40 bg-accent-soft text-accent text-[11px] font-semibold hover:bg-accent hover:text-white transition-colors cursor-pointer"
        >
          <IconClick size={13} stroke={2} />
          <span>더블탭 수정 열기</span>
        </button>
      </div>

      {/* 실제 앱의 ItemEditModal */}
      {showEditModal && (
        <ItemEditModal
          packs={GUIDE_SAMPLE_BAG.packs}
          selectionMode="single"
          initialSelectedPackIds={["pack-1"]}
          mode="edit"
          initialType="check"
          initialText={item.text}
          initialDueDate={item.dueDate}
          members={GUIDE_SAMPLE_MEMBERS}
          onClose={() => setShowEditModal(false)}
          onSave={(_targetPackIds, data) => {
            setItem((prev) => ({
              ...prev,
              text: data.text,
              dueDate: data.dueDate,
              assigneeUid: data.assigneeUid,
            }));
            setShowEditModal(false);
          }}
        />
      )}
    </div>
  );
}
