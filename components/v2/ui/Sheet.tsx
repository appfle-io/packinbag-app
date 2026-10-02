"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconX } from "@tabler/icons-react";
import Portal from "@/components/Portal";
import { useOverlayLayer, SHEET_OFFSET, OverlayLayerProvider, LAYER_STEP } from "@/lib/overlayLayer";
import { useEscapeToClose } from "@/lib/useEscapeToClose";
import { IconButton } from "./IconButton";
import { cx } from "./cx";

const DURATION_MS = 280;
// 이만큼(px) 이상 끌어내리거나, 빠르게 튕기면 닫는다.
const CLOSE_DISTANCE = 96;
const CLOSE_VELOCITY = 0.6; // px/ms

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  // 제목 줄 오른쪽에 닫기(X) 버튼을 보일지. 기본 true.
  showClose?: boolean;
  // 하단 고정 영역(주 버튼 등). 본문이 스크롤돼도 항상 보인다.
  footer?: React.ReactNode;
  // 시트 최대 높이. 기본은 화면의 88%.
  size?: "auto" | "tall";
  children: React.ReactNode;
}

// 공용 바텀시트(팩 불러오기, 멤버·초대, 아이템 편집, 링크 메뉴 ...).
// - 기존 SlideUpSheet와 같은 Portal + overlayLayer 규칙을 따라 부모 화면 위에 항상 뜬다.
// - 핸들이나 제목 줄을 아래로 끌면 닫힌다. Esc(데스크톱)와 바깥 영역 탭으로도 닫힌다.
// - 닫히는 동안에는 내용을 유지해서 내려가는 모습이 보이게 한다.
export function Sheet({ open, onClose, title, showClose = true, footer, size = "auto", children }: SheetProps) {
  const layer = useOverlayLayer();
  const zIndex = layer + SHEET_OFFSET;
  useEscapeToClose(onClose, open);

  const [rendered, setRendered] = useState(open);
  const [shown, setShown] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ startY: number; startT: number; lastY: number; lastT: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      restoreFocus.current = document.activeElement as HTMLElement | null;
      // 마운트 직후 한 프레임 뒤에 shown을 켜야 트랜지션이 보인다.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 열림/닫힘 애니메이션 단계 전환
      setRendered(true);
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(id);
    }
    setShown(false);
    setDragY(0);
    const t = window.setTimeout(() => {
      setRendered(false);
      restoreFocus.current?.focus?.();
    }, DURATION_MS);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (shown) panelRef.current?.focus();
  }, [shown]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    drag.current = { startY: e.clientY, startT: e.timeStamp, lastY: e.clientY, lastT: e.timeStamp };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
    setDragY(Math.max(0, e.clientY - d.startY));
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const d = drag.current;
      drag.current = null;
      setDragging(false);
      if (!d) return;
      const dist = e.clientY - d.startY;
      const dt = Math.max(1, e.timeStamp - d.startT);
      if (dist > CLOSE_DISTANCE || dist / dt > CLOSE_VELOCITY) {
        onClose();
      } else {
        setDragY(0);
      }
    },
    [onClose],
  );

  if (!rendered) return null;

  const translate = shown ? dragY : 0;

  return (
    <Portal>
      <OverlayLayerProvider value={zIndex + LAYER_STEP}>
        <div className="pib-v2 pib-v2-overlay fixed inset-0" style={{ zIndex }}>
          <button
            type="button"
            aria-label="닫기"
            tabIndex={-1}
            onClick={onClose}
            className={cx(
              "absolute inset-0 bg-scrim transition-opacity duration-280 ease-snappy",
              shown ? "opacity-100" : "opacity-0",
            )}
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            className={cx(
              "absolute inset-x-0 bottom-0 mx-auto flex w-full max-w-xl flex-col rounded-t-card bg-canvas shadow-sheet outline-none",
              size === "tall" ? "h-dvh-88" : "max-h-dvh-88",
              !dragging && "transition-transform duration-280 ease-snappy",
            )}
            style={{ transform: shown ? `translateY(${translate}px)` : "translateY(100%)" }}
          >
            <div
              className="shrink-0 touch-none select-none"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <div className="flex justify-center pt-2">
                <span aria-hidden="true" className="h-1 w-9 rounded-full bg-line-strong" />
              </div>
              {(title || showClose) && (
                <div className="flex items-center justify-between pt-2 pr-2 pl-5">
                  {title ? <h2 className="m-0 text-heading font-bold">{title}</h2> : <span />}
                  {showClose && (
                    <IconButton label="닫기" onClick={onClose}>
                      <IconX size={20} stroke={1.9} />
                    </IconButton>
                  )}
                </div>
              )}
            </div>
            <div className="pib-v2-no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-3 pb-4">{children}</div>
            {footer && <div className="shrink-0 border-t border-line px-5 pt-3 pb-safe-8">{footer}</div>}
            {!footer && <div className="pb-safe-4 shrink-0" />}
          </div>
        </div>
      </OverlayLayerProvider>
    </Portal>
  );
}
