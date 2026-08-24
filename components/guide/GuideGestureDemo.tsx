"use client";

import { useState, useEffect, useRef } from "react";
import { IconPencil, IconTrash, IconRotate } from "@tabler/icons-react";

export default function GuideGestureDemo() {
  const [currentOffset, setCurrentOffset] = useState<number>(0);
  const [isUserInteracting, setIsUserInteracting] = useState<boolean>(false);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const currentOffsetRef = useRef(0);
  const autoStepRef = useRef(0);
  const userTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 사용자 인터랙션이 없을 때만 자동 모션 실행
  useEffect(() => {
    if (isUserInteracting) return;

    const sequence = [56, 0, -56, 0];
    const timer = setInterval(() => {
      autoStepRef.current = (autoStepRef.current + 1) % sequence.length;
      const nextOffset = sequence[autoStepRef.current];
      setCurrentOffset(nextOffset);
      currentOffsetRef.current = nextOffset;
    }, 2200);

    return () => clearInterval(timer);
  }, [isUserInteracting]);

  const pauseAutoAndSetOffset = (offset: number) => {
    setIsUserInteracting(true);
    setCurrentOffset(offset);
    currentOffsetRef.current = offset;

    if (userTimerRef.current) clearTimeout(userTimerRef.current);
    // 5초간 추가 조작이 없으면 다시 자동 시연 재개
    userTimerRef.current = setTimeout(() => {
      setIsUserInteracting(false);
    }, 5000);
  };

  // 포인터(터치/마우스) 드래그 핸들러
  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    setIsUserInteracting(true);
    if (userTimerRef.current) clearTimeout(userTimerRef.current);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const diff = e.clientX - startXRef.current;
    // -70px ~ +70px 사이로 클램프
    const clamped = Math.max(-70, Math.min(70, diff));
    setCurrentOffset(clamped);
    currentOffsetRef.current = clamped;
  };

  const handlePointerUp = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    const val = currentOffsetRef.current;
    if (val > 25) {
      setCurrentOffset(56);
    } else if (val < -25) {
      setCurrentOffset(-56);
    } else {
      setCurrentOffset(0);
    }

    if (userTimerRef.current) clearTimeout(userTimerRef.current);
    userTimerRef.current = setTimeout(() => {
      setIsUserInteracting(false);
    }, 5000);
  };

  return (
    <div className="w-full flex flex-col gap-2 select-none">
      <div
        className="relative w-full overflow-hidden rounded-xl border border-border/50 bg-surface-2/30 cursor-grab active:cursor-grabbing touch-pan-y"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* 배경 액션 레이어 */}
        <div className="absolute inset-0 flex items-center justify-between px-3.5 text-[12px] font-medium pointer-events-none">
          <div
            className="flex items-center gap-1 text-accent transition-opacity duration-150"
            style={{ opacity: currentOffset > 15 ? 1 : 0 }}
          >
            <IconPencil size={15} stroke={2} />
            <span>수정</span>
          </div>

          <div
            className="flex items-center gap-1 text-red-500 transition-opacity duration-150"
            style={{ opacity: currentOffset < -15 ? 1 : 0 }}
          >
            <span>삭제</span>
            <IconTrash size={15} stroke={2} />
          </div>
        </div>

        {/* 짐 카드 */}
        <div
          className={`relative flex items-center justify-between p-3 bg-surface/40 border-y border-transparent ${
            isDraggingRef.current ? "transition-none" : "transition-transform duration-200 ease-out"
          }`}
          style={{ transform: `translateX(${currentOffset}px)` }}
        >
          <div className="flex items-center gap-2.5 min-w-0 pointer-events-none">
            <div className="h-4 w-4 rounded border border-border-strong bg-surface/60 shrink-0" />
            <span className="text-[13px] text-foreground font-medium truncate">
              여권 원본 (유효기간 6개월 이상)
            </span>
          </div>

          <span className="text-[11px] text-text-muted shrink-0 pointer-events-none">
            {currentOffset > 25 ? "수정" : currentOffset < -25 ? "삭제" : "좌우로 밀기"}
          </span>
        </div>
      </div>

      {/* 직접 탭해서 테스트할 수 있는 컨트롤 버튼 */}
      <div className="grid grid-cols-3 gap-1.5 text-[11.5px]">
        <button
          type="button"
          onClick={() => pauseAutoAndSetOffset(56)}
          className={`rounded-lg p-2 flex items-center justify-center gap-1 border transition-colors ${
            currentOffset > 25
              ? "bg-accent-soft text-accent border-accent/40 font-medium"
              : "bg-surface-2/30 text-text-secondary border-border/50 hover:text-foreground"
          }`}
        >
          <IconPencil size={13} stroke={2} />
          <span>우측 (수정)</span>
        </button>

        <button
          type="button"
          onClick={() => pauseAutoAndSetOffset(0)}
          className={`rounded-lg p-2 flex items-center justify-center gap-1 border transition-colors ${
            currentOffset === 0
              ? "bg-surface/50 text-foreground border-border/60 font-medium"
              : "bg-surface-2/20 text-text-muted border-border/40 hover:text-foreground"
          }`}
        >
          <IconRotate size={13} stroke={1.75} />
          <span>원위치</span>
        </button>

        <button
          type="button"
          onClick={() => pauseAutoAndSetOffset(-56)}
          className={`rounded-lg p-2 flex items-center justify-center gap-1 border transition-colors ${
            currentOffset < -25
              ? "bg-red-500/10 text-red-500 border-red-500/30 font-medium"
              : "bg-surface-2/30 text-text-secondary border-border/50 hover:text-foreground"
          }`}
        >
          <IconTrash size={13} stroke={2} />
          <span>좌측 (삭제)</span>
        </button>
      </div>
    </div>
  );
}
