"use client";

import { useState, useEffect, useRef } from "react";
import { IconTrash, IconCopy, IconRefresh, IconCheck } from "@tabler/icons-react";
import ItemEditModal from "@/components/ItemEditModal";
import { GUIDE_SAMPLE_BAG, GUIDE_SAMPLE_ITEM, GUIDE_SAMPLE_MEMBERS } from "@/lib/guideSampleData";

export default function GuideGestureDemo() {
  const [currentOffset, setCurrentOffset] = useState<number>(0);
  const [isUserInteracting, setIsUserInteracting] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [items, setItems] = useState([GUIDE_SAMPLE_ITEM]);
  const [activeItemId, setActiveItemId] = useState(GUIDE_SAMPLE_ITEM.id);

  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const currentOffsetRef = useRef(0);
  const userTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 사용자 조작이 없을 때 오른쪽(복사) -> 복귀 -> 왼쪽(삭제) -> 복귀 스와이프 안내 자동 루프
  useEffect(() => {
    if (isUserInteracting || items.length === 0) return;

    const sequence = [56, 0, -56, 0];
    let step = 0;
    const timer = setInterval(() => {
      step = (step + 1) % sequence.length;
      const nextOffset = sequence[step];
      setCurrentOffset(nextOffset);
      currentOffsetRef.current = nextOffset;
    }, 2200);

    return () => clearInterval(timer);
  }, [isUserInteracting, items.length]);

  // 포인터(터치/마우스) 드래그 핸들러 - 양방향 스와이프 지원 (오른쪽: 복사, 왼쪽: 삭제)
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
    if (val < -25) {
      setCurrentOffset(-56);
    } else if (val > 25) {
      setCurrentOffset(56);
    } else {
      setCurrentOffset(0);
    }

    if (userTimerRef.current) clearTimeout(userTimerRef.current);
    userTimerRef.current = setTimeout(() => {
      setIsUserInteracting(false);
    }, 5000);
  };

  const [copiedToast, setCopiedToast] = useState(false);

  const handleCopy = async (id: string) => {
    const target = items.find((i) => i.id === id);
    if (!target) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(target.text);
      }
    } catch {}
    setCopiedToast(true);
    setCurrentOffset(0);
    setTimeout(() => setCopiedToast(false), 2000);
  };

  const handleDelete = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setCurrentOffset(0);
  };

  const handleRestore = () => {
    setItems([GUIDE_SAMPLE_ITEM]);
    setCurrentOffset(0);
  };

  if (items.length === 0) {
    return (
      <div className="w-full flex items-center justify-between p-3.5 rounded-xl border border-dashed border-border bg-surface/20 text-[12px] select-none">
        <span className="text-text-muted">모든 짐이 삭제되었습니다.</span>
        <button
          type="button"
          onClick={handleRestore}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface border border-border hover:border-accent text-accent font-medium transition-colors"
        >
          <IconRefresh size={13} />
          <span>되살리기</span>
        </button>
      </div>
    );
  }

  const activeItem = items[0];

  return (
    <div className="w-full flex flex-col gap-2.5 select-none">
      {/* 캔버스 배경 */}
      <div className="p-3.5 rounded-2xl bg-white dark:bg-surface border border-border flex flex-col gap-2.5 relative">
        {copiedToast && (
          <div className="absolute top-2 right-3 z-10 px-2.5 py-1 rounded-lg bg-accent text-white text-[11px] font-medium shadow-md animate-in fade-in zoom-in-95">
            텍스트를 복사했어요
          </div>
        )}
        {items.map((item, idx) => (
          <div
            key={item.id}
            className={`relative w-full overflow-hidden rounded-xl border border-border/80 ${
              idx === 0
                ? currentOffset > 0
                  ? "bg-accent/15"
                  : currentOffset < 0
                  ? "bg-red-500/10"
                  : "bg-surface-2/40"
                : "bg-surface-2/40"
            } cursor-grab active:cursor-grabbing touch-pan-y`}
            onPointerDown={idx === 0 ? handlePointerDown : undefined}
            onPointerMove={idx === 0 ? handlePointerMove : undefined}
            onPointerUp={idx === 0 ? handlePointerUp : undefined}
            onPointerCancel={idx === 0 ? handlePointerUp : undefined}
            onDoubleClick={() => {
              setActiveItemId(item.id);
              setShowEditModal(true);
            }}
          >
            {/* 왼쪽 액션 레이어: 오른쪽으로 밀었을 때 좌측에 복사 버튼 */}
            {idx === 0 && (
              <div className="absolute inset-0 flex items-center justify-start px-3 text-[12px] font-medium">
                <button
                  type="button"
                  onClick={() => handleCopy(item.id)}
                  className="flex items-center gap-1 text-accent font-semibold p-1 transition-opacity duration-150 cursor-pointer"
                  style={{ opacity: currentOffset > 15 ? 1 : 0 }}
                >
                  <IconCopy size={15} stroke={2} />
                  <span>복사</span>
                </button>
              </div>
            )}

            {/* 오른쪽 액션 레이어: 왼쪽으로 밀었을 때 우측에 삭제 버튼 */}
            {idx === 0 && (
              <div className="absolute inset-0 flex items-center justify-end px-3 text-[12px] font-medium">
                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  className="flex items-center gap-1 text-red-500 hover:text-red-600 font-semibold p-1 transition-opacity duration-150 cursor-pointer"
                  style={{ opacity: currentOffset < -15 ? 1 : 0 }}
                >
                  <IconTrash size={15} stroke={2} />
                  <span>삭제</span>
                </button>
              </div>
            )}

            {/* 전면 카드 행 */}
            <div
              className="relative flex items-center justify-between p-3 bg-white dark:bg-surface border border-border rounded-xl transition-transform duration-200 ease-out shadow-xs cursor-pointer"
              style={{
                transform: idx === 0 ? `translateX(${currentOffset}px)` : "translateX(0px)",
              }}
              onClick={() =>
                setItems((prev) =>
                  prev.map((i) => (i.id === item.id ? { ...i, checked: !i.checked } : i))
                )
              }
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`h-4 w-4 rounded flex items-center justify-center shrink-0 border transition-colors ${
                    item.checked
                      ? "bg-accent border-accent text-white"
                      : "border-border-strong bg-surface"
                  }`}
                >
                  {item.checked && <IconCheck size={11} stroke={3} />}
                </div>
                <span
                  className={`text-[13px] font-medium truncate ${
                    item.checked ? "line-through text-text-muted" : "text-foreground"
                  }`}
                >
                  {item.text}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveItemId(item.id);
                    setShowEditModal(true);
                  }}
                  className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-surface-2 text-text-secondary hover:text-foreground transition-colors cursor-pointer border border-border/60"
                >
                  상세 수정
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 실제 앱의 ItemEditModal */}
      {showEditModal && activeItem && (
        <ItemEditModal
          packs={GUIDE_SAMPLE_BAG.packs}
          selectionMode="single"
          initialSelectedPackIds={["pack-1"]}
          mode="edit"
          initialType="check"
          initialText={items.find((i) => i.id === activeItemId)?.text || ""}
          initialDueDate={items.find((i) => i.id === activeItemId)?.dueDate}
          members={GUIDE_SAMPLE_MEMBERS}
          onClose={() => setShowEditModal(false)}
          onSave={(_targetPackIds, data) => {
            setItems((prev) =>
              prev.map((i) =>
                i.id === activeItemId
                  ? { ...i, text: data.text, dueDate: data.dueDate, assigneeUid: data.assigneeUid }
                  : i
              )
            );
            setShowEditModal(false);
          }}
        />
      )}
    </div>
  );
}
