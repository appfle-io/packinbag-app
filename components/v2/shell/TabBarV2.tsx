"use client";

import { useEffect, useRef, useState } from "react";
import { IconBackpack, IconPackage, IconPlus, IconSettings } from "@tabler/icons-react";
import type { TabKey } from "@/components/BottomTabBar";
import { cx } from "@/components/v2/ui";

// 리디자인 v2 하단 탭바 — 떠 있는 분리형(독, 2026-10-04 결정 A).
//  [ 팩 · 가방 · 설정 ] 반투명 캡슐  +  [ + ] 빠른팩 동그라미
// - 순서는 구 UI와 같다: 팩 · 가방 · (빠른팩) · 설정 → 탭 넘기기 순서 packs → home → settings와 맞춤
// - 지금 탭은 캡슐 안 옅은 알약이 미끄러져 따라가고 글자가 진해진다
// - 빠른팩은 탭이 아니라 버튼이라 캡슐 밖 검은 동그라미로 뗀다(높이는 캡슐 높이를 그대로 따른다)
//
// 배치 규칙(숫자를 박지 않는다)
// - 부모(위치 기준 요소, relative) 아래쪽에 겹쳐 뜬다. 탭 화면 목록은 탭바 뒤로 지나간다
// - 그려진 높이를 재서 부모의 --pib-dock에 적는다 → ScreenBody가 그만큼 아래 여백·scroll-padding을 더한다
//   (글자 크기·안전영역·화면 폭이 바뀌면 ResizeObserver가 다시 잰다. 탭바가 사라지면 값도 지운다)
// - 터치 기기에서 탭 화면 안 입력칸에 글을 쓰는 동안은 키보드 위로 올라와 목록을 가리지 않게 숨긴다
const TABS: { key: TabKey; label: string; Icon: typeof IconPackage }[] = [
  { key: "packs", label: "팩", Icon: IconPackage },
  { key: "home", label: "가방", Icon: IconBackpack },
  { key: "settings", label: "설정", Icon: IconSettings },
];

const TEXT_FIELD = 'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="file"]), textarea, [contenteditable="true"]';

// 탭바 높이를 부모의 --pib-dock에 적는다. 화면 맨 아래에서 탭바 윗변까지의 거리는 html의 --pib-dock-viewport에 적는다
// (포털로 뜨는 토스트가 탭바를 가리지 않게 쓴다). 글을 쓰느라 탭바가 숨어 있으면 0
function useDockInset(ref: React.RefObject<HTMLDivElement | null>, hidden: boolean) {
  useEffect(() => {
    const el = ref.current;
    const host = el?.parentElement;
    if (!el || !host) return;
    const root = document.documentElement;
    const apply = () => {
      host.style.setProperty("--pib-dock", `${el.offsetHeight}px`);
      const lift = hidden ? 0 : Math.max(0, Math.ceil(window.innerHeight - host.getBoundingClientRect().bottom + el.offsetHeight));
      root.style.setProperty("--pib-dock-viewport", `${lift}px`);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    ro.observe(host);
    window.addEventListener("resize", apply);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", apply);
      host.style.removeProperty("--pib-dock");
      root.style.removeProperty("--pib-dock-viewport");
    };
  }, [ref, hidden]);
}

// 터치 기기에서 부모 안 입력칸에 포커스가 있는 동안 true
function useTypingInside(ref: React.RefObject<HTMLDivElement | null>) {
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const host = ref.current?.parentElement;
    if (!host) return;
    const coarse = window.matchMedia("(pointer: coarse)");
    const check = () => {
      const a = document.activeElement;
      setTyping(coarse.matches && !!a && host.contains(a) && a.matches(TEXT_FIELD));
    };
    // 포커스가 다른 칸으로 옮겨 가는 중(focusout → focusin)에는 한 프레임 뒤에 확인해 깜빡이지 않게 한다
    const onOut = () => requestAnimationFrame(check);
    host.addEventListener("focusin", check);
    host.addEventListener("focusout", onOut);
    return () => {
      host.removeEventListener("focusin", check);
      host.removeEventListener("focusout", onOut);
    };
  }, [ref]);
  return typing;
}

function TabButton({ label, active, onClick, Icon }: { label: string; active: boolean; onClick: () => void; Icon: typeof IconPackage }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cx(
        "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-full bg-transparent py-2 text-micro",
        "transition-colors duration-160 ease-snappy active:opacity-60",
        active ? "font-semibold text-ink" : "font-medium text-faint hover:text-sub",
      )}
    >
      <Icon size={22} stroke={active ? 2 : 1.75} aria-hidden="true" />
      {label}
    </button>
  );
}

export function TabBarV2({ active, onChange, onQuickAdd }: { active: TabKey; onChange: (tab: TabKey) => void; onQuickAdd: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const typing = useTypingInside(ref);
  useDockInset(ref, typing);
  const index = Math.max(0, TABS.findIndex((t) => t.key === active));

  return (
    <div
      ref={ref}
      inert={typing || undefined}
      className={cx(
        "pib-v2 pib-v2-overlay pointer-events-none absolute inset-x-0 bottom-0 z-30 px-4 pt-3 pb-safe-2",
        "transition-[transform,opacity] duration-200 ease-snappy",
        typing && "translate-y-full opacity-0",
      )}
    >
      <div className="mx-auto flex w-full max-w-md items-stretch gap-3">
        <nav aria-label="탭" className="dock-glass pointer-events-auto flex min-w-0 flex-1 rounded-full border border-line p-1 shadow-dock">
          <div className="relative flex min-w-0 flex-1">
            {/* 지금 탭 표시: 칸 하나 폭의 알약이 미끄러져 옮겨 간다 */}
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-fill transition-transform duration-280 ease-snappy"
              style={{ transform: `translateX(${index * 100}%)` }}
            />
            {TABS.map(({ key, label, Icon }) => (
              <TabButton key={key} label={label} Icon={Icon} active={active === key} onClick={() => onChange(key)} />
            ))}
          </div>
        </nav>
        <button
          type="button"
          onClick={onQuickAdd}
          aria-label="빠른팩에 적기"
          title="빠른팩에 적기"
          className={cx(
            // 너비 = 캡슐 높이(aspect-square + 줄 높이로 늘어남). min-w-14는 aspect-ratio를 못 쓰는 오래된 브라우저용 하한
            "pointer-events-auto flex aspect-square min-w-14 shrink-0 items-center justify-center rounded-full bg-ink text-on-ink shadow-dock",
            "transition-transform duration-160 ease-snappy active:scale-95",
          )}
        >
          <IconPlus size={24} stroke={2.2} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
