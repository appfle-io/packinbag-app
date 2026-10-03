"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { EASE_OUT, settleDuration, shouldCommit, useHorizontalSwipe } from "@/lib/useHorizontalSwipe";
import { cx } from "./cx";

// 탭 화면 안에서 한 단계씩 들어가는 화면 묶음(팩 폴더, 가방 → 보관함).
// - 들어갈 때: 새 화면이 오른쪽에서 밀려 들어오고, 원래 화면은 왼쪽으로 조금 물러난다.
// - 나올 때(뒤로 버튼·경로): 반대로.
// - 오른쪽으로 밀면 위 화면이 손가락을 따라 밀려나고 아래 화면이 드러난다. 충분히 밀었거나
//   빠르게 튕기면 그 속도대로 마저 나가고, 아니면 제자리로 돌아온다. 왼쪽으로 미는 건 바깥(탭 넘기기)에 양보한다.
// - 바로 아래 화면은 계속 그려 두므로(숨김) 돌아왔을 때 스크롤 위치가 그대로다.
//
// stack: 맨 아래부터 맨 위까지 화면 키. renderPage는 키마다 화면 전체(헤더 포함)를 그린다.
// onBack: 맨 위 화면을 닫는 함수(부모가 stack에서 맨 위를 빼야 한다).

const MOVE_MS = 300;
// 아래 화면이 물러나 있는 정도(화면 폭 대비)
const PARALLAX = 0.3;
const EDGE_SHADOW = "-8px 0 24px rgba(0, 0, 0, 0.08)";

type Motion = { kind: "push" | "pop"; top: string; leaving?: string; id: number };

function px(x: number) {
  return `translate3d(${Math.round(x)}px, 0, 0)`;
}

function slide(el: HTMLElement, from: string, to: string, ms: number, opts?: { keep?: boolean; done?: () => void }) {
  el.getAnimations().forEach((a) => a.cancel());
  el.style.transition = "";
  el.style.transform = to;
  const anim = el.animate([{ transform: from }, { transform: to }], { duration: ms, easing: EASE_OUT });
  anim.onfinish = () => {
    if (!opts?.keep) {
      el.style.transform = "";
      el.style.boxShadow = "";
    }
    opts?.done?.();
  };
}

export function PageStack({
  stack,
  renderPage,
  onBack,
  swipeEnabled = true,
}: {
  stack: string[];
  renderPage: (key: string, isTop: boolean) => React.ReactNode;
  onBack: () => void;
  swipeEnabled?: boolean;
}) {
  const sig = stack.join("\u0000");
  const top = stack[stack.length - 1];
  const below = stack.length > 1 ? stack[stack.length - 2] : undefined;

  // stack이 바뀐 순간 들어가는지/나오는지 판단한다(렌더 중 파생 상태)
  const [seen, setSeen] = useState({ sig, top, keys: stack });
  const [motion, setMotion] = useState<Motion | null>(null);
  if (seen.sig !== sig) {
    if (seen.top !== top) {
      const popped = !stack.includes(seen.top);
      setMotion({ kind: popped ? "pop" : "push", top, leaving: popped ? seen.top : undefined, id: (motion?.id ?? 0) + 1 });
    }
    setSeen({ sig, top, keys: stack });
  }

  const leaving = motion?.kind === "pop" && motion.leaving && !stack.includes(motion.leaving) ? motion.leaving : undefined;
  const layers = [below, top, leaving].filter((k): k is string => !!k);

  const layerEls = useRef(new Map<string, HTMLDivElement>());
  const containerRef = useRef<HTMLDivElement | null>(null);
  // 스와이프로 닫을 때 손을 뗀 위치·속도(다음 pop 애니메이션이 이어받는다)
  const swipeOut = useRef<{ dx: number; ms: number } | null>(null);
  const topRef = useRef(top);
  useEffect(() => {
    topRef.current = top;
  }, [top]);

  const widthOf = () => containerRef.current?.clientWidth || window.innerWidth;

  useLayoutEffect(() => {
    if (!motion) return;
    const els = layerEls.current;
    const width = widthOf();
    const done = () => setMotion((m) => (m && m.id === motion.id ? null : m));

    if (motion.kind === "push") {
      const topEl = els.get(motion.top);
      const belowEl = below ? els.get(below) : undefined;
      if (topEl) {
        topEl.style.boxShadow = EDGE_SHADOW;
        slide(topEl, px(width), px(0), MOVE_MS, { done });
      } else window.setTimeout(done, 0);
      if (belowEl) {
        belowEl.style.visibility = "visible";
        slide(belowEl, px(0), px(-width * PARALLAX), MOVE_MS, {
          done: () => {
            belowEl.style.visibility = "";
            belowEl.style.transform = "";
          },
          keep: true,
        });
      }
      return;
    }

    // pop: 나가는 화면은 오른쪽 끝으로, 새 맨 위 화면은 물러난 자리에서 제자리로
    const swipe = swipeOut.current;
    swipeOut.current = null;
    const fromX = swipe ? swipe.dx : 0;
    const ms = swipe ? swipe.ms : MOVE_MS;
    const topEl = els.get(motion.top);
    const leavingEl = motion.leaving ? els.get(motion.leaving) : undefined;
    if (topEl) {
      topEl.style.visibility = "";
      slide(topEl, px(-width * PARALLAX + fromX * PARALLAX), px(0), ms);
    }
    if (leavingEl) {
      leavingEl.style.boxShadow = EDGE_SHADOW;
      slide(leavingEl, px(fromX), px(width), ms, { keep: true, done });
    } else window.setTimeout(done, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 움직임 하나당 한 번
  }, [motion?.id]);

  const swipeRef = useHorizontalSwipe<HTMLDivElement>(
    {
      claim: (dir) => dir === 1 && swipeEnabled && !!below && !motion,
      move: (dx) => {
        const els = layerEls.current;
        const topEl = els.get(top);
        const belowEl = below ? els.get(below) : undefined;
        const width = widthOf();
        const d = Math.max(0, dx);
        if (topEl) {
          topEl.style.transform = px(d);
          topEl.style.boxShadow = EDGE_SHADOW;
        }
        if (belowEl) {
          belowEl.style.visibility = "visible";
          belowEl.style.transform = px(-width * PARALLAX + d * PARALLAX);
        }
      },
      end: (dx, velocity) => {
        const els = layerEls.current;
        const topEl = els.get(top);
        const belowEl = below ? els.get(below) : undefined;
        const width = widthOf();
        const d = Math.max(0, dx);
        if (d > 0 && shouldCommit(d, velocity, width)) {
          const ms = settleDuration(width - d, velocity, 160, MOVE_MS);
          swipeOut.current = { dx: d, ms };
          const before = top;
          onBack();
          // 닫히지 않았으면(부모가 stack을 그대로 두면) 제자리로
          window.setTimeout(() => {
            if (topRef.current !== before) return;
            swipeOut.current = null;
            if (topEl) slide(topEl, px(d), px(0), 220);
            if (belowEl) slide(belowEl, px(-width * PARALLAX + d * PARALLAX), px(-width * PARALLAX), 220, {
              keep: true,
              done: () => {
                belowEl.style.visibility = "";
                belowEl.style.transform = "";
              },
            });
          }, 120);
          return;
        }
        const ms = settleDuration(d, velocity, 160, 260);
        if (topEl) slide(topEl, px(d), px(0), ms);
        if (belowEl) {
          slide(belowEl, px(-width * PARALLAX + d * PARALLAX), px(-width * PARALLAX), ms, {
            keep: true,
            done: () => {
              belowEl.style.visibility = "";
              belowEl.style.transform = "";
            },
          });
        }
      },
    },
    swipeEnabled,
  );
  const setContainer = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      swipeRef(node);
    },
    [swipeRef],
  );

  return (
    <div
      ref={setContainer}
      className="relative min-h-0 w-full flex-1 overflow-hidden"
    >
      {layers.map((key) => {
        const isTop = key === top;
        return (
          <div
            key={key}
            ref={(node) => {
              if (node) layerEls.current.set(key, node);
              else layerEls.current.delete(key);
            }}
            aria-hidden={isTop ? undefined : true}
            inert={isTop ? undefined : true}
            className={cx("absolute inset-0 flex flex-col bg-canvas", key === below && !isTop && "invisible")}
          >
            {renderPage(key, isTop)}
          </div>
        );
      })}
    </div>
  );
}
