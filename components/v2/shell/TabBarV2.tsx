"use client";

import { IconBackpack, IconPackage, IconPlus, IconSettings } from "@tabler/icons-react";
import type { TabKey } from "@/components/BottomTabBar";
import { cx } from "@/components/v2/ui";

// 리디자인 v2 하단 탭바. 구 BottomTabBar(알약 표시)와 같은 props라 AppShell에서 플래그로 바꿔 끼운다.
// - 순서는 구 UI와 같다: 팩 · 가방 · 빠른팩 · 설정 (탭 넘기기 순서 packs → home → settings와 맞춤)
// - 지금 탭은 진한 글자 + 굵은 아이콘, 나머지는 흐린 글자. 알약·배경 강조 없음(미니멀)
// - 빠른팩은 탭이 아니라 버튼이라 검은 동그라미 + 로 구분한다
const TABS: { key: TabKey; label: string; Icon: typeof IconPackage }[] = [
  { key: "packs", label: "팩", Icon: IconPackage },
  { key: "home", label: "가방", Icon: IconBackpack },
  { key: "settings", label: "설정", Icon: IconSettings },
];

function TabButton({ label, active, onClick, Icon }: { label: string; active: boolean; onClick: () => void; Icon: typeof IconPackage }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cx(
        "flex h-13 flex-1 flex-col items-center justify-center gap-1 bg-transparent text-micro",
        "transition-colors duration-160 ease-snappy active:opacity-60",
        active ? "font-semibold text-ink" : "font-medium text-faint",
      )}
    >
      <Icon size={22} stroke={active ? 1.9 : 1.75} aria-hidden="true" />
      {label}
    </button>
  );
}

export function TabBarV2({ active, onChange, onQuickAdd }: { active: TabKey; onChange: (tab: TabKey) => void; onQuickAdd: () => void }) {
  const [packs, home, settings] = TABS;
  return (
    <nav aria-label="탭" className="pib-v2 pb-safe-2 relative z-30 flex shrink-0 border-t border-line bg-canvas pt-1">
      <TabButton label={packs.label} Icon={packs.Icon} active={active === packs.key} onClick={() => onChange(packs.key)} />
      <TabButton label={home.label} Icon={home.Icon} active={active === home.key} onClick={() => onChange(home.key)} />
      <button
        type="button"
        onClick={onQuickAdd}
        aria-label="빠른팩에 적기"
        className="flex h-13 flex-1 flex-col items-center justify-center gap-1 bg-transparent text-micro font-medium text-faint active:opacity-60"
      >
        <span aria-hidden="true" className="inline-flex size-6 items-center justify-center rounded-full bg-ink text-on-ink">
          <IconPlus size={16} stroke={2.4} />
        </span>
        빠른팩
      </button>
      <TabButton label={settings.label} Icon={settings.Icon} active={active === settings.key} onClick={() => onChange(settings.key)} />
    </nav>
  );
}
