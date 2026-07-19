"use client";

import { useEffect, useRef, useState } from "react";
import { IconFlame, IconChevronsRight } from "@tabler/icons-react";
import { Pack } from "@/lib/types";
import { useAuth } from "@/contexts/AuthProvider";

// 너비/모서리/배경색 전환 지속시간
const COLLAPSE_MS = 320;

// 옆으로 스와이프해서 접기 위한 임계값/판정 기준. 스크롤(세로)과 헷갈리지 않도록
// 가로 이동이 세로보다 확실히(비율) 커야 스와이프로 인정하고, 그 상태에서 이 거리
// 이상 밀어야 실제로 접힌다(살짝 스친 정도로는 원래 자리로 되돌아옴).
const SWIPE_COLLAPSE_PX = 70;
const SWIPE_INTENT_MIN_PX = 8;
const SWIPE_INTENT_RATIO = 1.4;

// 팩/가방 화면 맨 아래에 항상 고정된 자리에 떠 있는 바. "접기" 버튼을 누르거나 바를
// 옆으로 스와이프하면 오른쪽 끝으로 줄어들면서 작은 원형 버블로 변하고, 그 상태가
// 계정에 그대로 저장되어 앱을 다시 열어도 유지된다. 버블 상태에서 버블을 탭하면 다시
// 바 형태로 펼쳐지고(빠른팩 화면을 열려면 펼친 뒤 바를 한 번 더 탭해야 함), 바 형태에서는
// 스와이프가 아닌 탭이면 어디를 눌러도 바로 빠른팩 화면이 열린다.
export default function QuickPackBar({
  pack,
  onClick,
}: {
  pack: Pack | undefined;
  onClick: () => void;
}) {
  const { profile, updateQuickPackCollapsed } = useAuth();
  // 계정에 저장된 값을 로컬 상태로 미러링해서 즉시 반응(낙관적 UI)하고, 다른 기기/화면에서
  // profile 값이 바뀌면 따라간다.
  const [collapsed, setCollapsed] = useState(!!profile?.quickPackCollapsed);
  useEffect(() => {
    setCollapsed(!!profile?.quickPackCollapsed);
  }, [profile?.quickPackCollapsed]);

  const toggleCollapsed = (next: boolean) => {
    setCollapsed(next);
    updateQuickPackCollapsed(next).catch(() => {});
  };

  // --- 옆으로 스와이프해서 접기 ---------------------------------------------
  // dragX는 손가락을 따라 바가 옆으로 밀리는 시각적 피드백용. 놓는 순간 임계값을
  // 넘었으면 접히고(그러면 dragX는 즉시 0으로 리셋되고 접기 전환이 대신 이어받는다),
  // 못 넘었으면 원래 자리로 되돌아온다.
  const [dragX, setDragX] = useState(0);
  const draggingRef = useRef(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const movedRef = useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (collapsed) return; // 버블 상태에선 스와이프 없음(탭으로만 펼침)
    startRef.current = { x: e.clientX, y: e.clientY };
    draggingRef.current = true;
    movedRef.current = false;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current || !startRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (Math.abs(dx) > SWIPE_INTENT_MIN_PX || Math.abs(dy) > SWIPE_INTENT_MIN_PX) {
      movedRef.current = true;
    }
    if (Math.abs(dx) > Math.abs(dy) * SWIPE_INTENT_RATIO) {
      setDragX(dx);
    }
  };

  const endDrag = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (Math.abs(dragX) >= SWIPE_COLLAPSE_PX) {
      setDragX(0);
      toggleCollapsed(true);
    } else {
      setDragX(0);
    }
  };

  const handleBarClick = () => {
    // 스와이프 도중/직후의 클릭은 무시한다 - 손을 떼는 순간 브라우저가 click 이벤트도
    // 함께 발생시키는데, 그걸 그대로 두면 스와이프했는데 화면이 열려버리는 오작동이 생긴다.
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    if (collapsed) toggleCollapsed(false);
    else onClick();
  };

  if (!pack || pack.items.length === 0) return null;

  const preview = pack.items
    .slice(-3)
    .map((i) => i.text || "(빈 항목)")
    .join(", ");

  return (
    <div className="shrink-0 mx-4 mb-3 flex justify-end">
      <div
        onClick={handleBarClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") handleBarClick();
        }}
        className="relative flex items-center overflow-hidden text-left cursor-pointer"
        style={{
          width: collapsed ? 52 : "100%",
          height: collapsed ? 52 : 58,
          borderRadius: collapsed ? 9999 : 12,
          border: collapsed ? "none" : "1px solid var(--border)",
          background: collapsed ? "var(--accent)" : "var(--accent-soft)",
          padding: collapsed ? 0 : "10px 12px",
          gap: collapsed ? 0 : 10,
          transform: dragX !== 0 ? `translateX(${dragX}px)` : undefined,
          opacity: dragX !== 0 ? Math.max(0.5, 1 - Math.abs(dragX) / 160) : 1,
          touchAction: collapsed ? undefined : "none",
          transition: draggingRef.current
            ? "opacity 60ms linear"
            : `width ${COLLAPSE_MS}ms cubic-bezier(0.22,1,0.36,1), height ${COLLAPSE_MS}ms cubic-bezier(0.22,1,0.36,1), border-radius ${COLLAPSE_MS}ms cubic-bezier(0.22,1,0.36,1), background 220ms ease, padding ${COLLAPSE_MS}ms cubic-bezier(0.22,1,0.36,1), transform 200ms ease, opacity 200ms ease`,
        }}
      >
        {/* 펼쳐진 바 내용: 접히면 빠르게 페이드아웃된다 */}
        <span
          className="shrink-0 h-8 w-8 rounded-full flex items-center justify-center"
          style={{
            background: "var(--accent)",
            opacity: collapsed ? 0 : 1,
            transition: "opacity 180ms ease",
          }}
        >
          <IconFlame size={16} stroke={1.75} color="#fff" />
        </span>
        <span
          className="min-w-0 flex-1"
          style={{ opacity: collapsed ? 0 : 1, transition: "opacity 160ms ease" }}
        >
          <span className="flex items-center gap-1.5">
            <span className="text-[13px] font-medium whitespace-nowrap" style={{ color: "var(--accent-strong)" }}>
              빠른팩
            </span>
            <span className="text-[11px] text-text-muted shrink-0">{pack.items.length}개</span>
          </span>
          <span className="block text-[11.5px] text-text-secondary truncate mt-0.5">
            {preview}
          </span>
        </span>
        {!collapsed && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleCollapsed(true);
            }}
            aria-label="빠른팩 접기"
            className="shrink-0 -m-1.5 p-1.5"
          >
            <IconChevronsRight size={16} stroke={1.75} color="var(--text-muted)" />
          </button>
        )}

        {/* 접힌 버블 전용 내용: 아이콘만 중앙에. 바 내용과 달리 역으로 페이드인된다. */}
        <span
          className="absolute inset-0 flex items-center justify-center"
          style={{ opacity: collapsed ? 1 : 0, transition: "opacity 200ms ease", pointerEvents: "none" }}
        >
          <IconFlame size={20} stroke={1.75} color="#fff" />
        </span>
      </div>
    </div>
  );
}
