"use client";

import { useState } from "react";
import { IconBackpack, IconPackage, IconPlus, IconSettings, IconWifiOff } from "@tabler/icons-react";
import BackpackLogo from "@/components/BackpackLogo";
import { RAIL_QUERY, sendShellCommand, shortcutLabel, useAppShortcuts, useMediaQuery, type TabKey } from "@/lib/v2/shell";
import { DetailPaneContext } from "@/lib/v2/openDetail";
import { Button, cx } from "@/components/v2/ui";
import { TabBarV2 } from "./TabBarV2";

const TABS: { key: TabKey; label: string; Icon: typeof IconPackage; key2: string }[] = [
  { key: "packs", label: "팩", Icon: IconPackage, key2: "" },
  { key: "home", label: "가방", Icon: IconBackpack, key2: "" },
  { key: "settings", label: "설정", Icon: IconSettings, key2: "I" },
];

function RailButton({ label, active, onClick, title, children }: { label: string; active?: boolean; onClick: () => void; title?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? label}
      aria-current={active ? "page" : undefined}
      className={cx(
        "flex h-15 w-17 flex-col items-center justify-center gap-1 rounded-card text-micro transition-colors duration-160 ease-snappy",
        active ? "bg-fill font-semibold text-ink" : "bg-transparent font-medium text-faint hover:bg-fill hover:text-ink",
      )}
    >
      {children}
      {label}
    </button>
  );
}

// 리디자인 v2 넓은 화면 셸(셸 통합 2026-10-03, 웹 PC · 아이패드 가로 · 포터블 앱 공통).
//  - 900px 이상: [목록 | 상세] 2단. 목록 아래에 모바일과 같은 탭바
//  - 1200px 이상: [레일 | 목록 | 상세] 3단. 탭바 대신 왼쪽 레일(팩·가방·설정 + 아래 빠른팩)
//  목록은 탭 화면 그대로(HomeScreenV2·PacksScreenV2·SettingsScreenV2), 상세는 가방·팩·메모 화면을 겹치지 않고 오른쪽에 그린다
export function WideShell({
  tab,
  onTab,
  onQuickAdd,
  list,
  detail,
  offline,
  onNewBag,
  onNewPack,
  onCloseDetail,
  banner,
}: {
  tab: TabKey;
  onTab: (t: TabKey) => void;
  onQuickAdd: () => void;
  list: React.ReactNode;
  detail: React.ReactNode | null;
  offline: boolean;
  onNewBag: () => void;
  onNewPack: () => void;
  onCloseDetail: () => void;
  banner?: React.ReactNode;
}) {
  const rail = useMediaQuery(RAIL_QUERY);
  // 설정 하위 화면(SlideScreen)을 띄울 상세 칸 안 자리. 크기 없는 요소라 클릭을 막지 않고,
  // 거기 그린 겹 화면은 absolute inset-0으로 상세 칸(main, relative)을 덮는다
  const [paneSlot, setPaneSlot] = useState<HTMLDivElement | null>(null);

  // 단축키: ⌘N 새로 만들기 · ⌘K 검색 · ⌘I 설정 · ⌘P 빠른팩 · Esc 상세 닫기(윈도우는 Ctrl)
  // 설정 탭에서 ⌘N·⌘K를 누르면 가방 탭으로 가서 연다(탭 화면이 그려진 뒤 명령을 보낸다)
  const runInTab = (command: "new" | "search") => {
    if (tab === "settings") {
      onTab("home");
      // 탭 화면이 그려지고 명령 리스너를 다는 동안 기다린다
      window.setTimeout(() => sendShellCommand("home", command), 80);
    } else {
      sendShellCommand(tab, command);
    }
  };
  useAppShortcuts(true, {
    onNew: () => runInTab("new"),
    onSearch: () => runInTab("search"),
    onSettings: () => onTab("settings"),
    onQuickAdd,
    onEscape: onCloseDetail,
  });

  return (
    <div className="pib-v2 pt-safe flex h-dvh w-full overflow-hidden bg-canvas">
      {rail && (
        <nav aria-label="탭" className="flex w-21 shrink-0 flex-col items-center gap-1 border-r border-line py-4">
          <span className="mb-4" aria-hidden="true">
            <BackpackLogo size={32} />
          </span>
          {TABS.map(({ key, label, Icon, key2 }) => (
            <RailButton key={key} label={label} active={tab === key} onClick={() => onTab(key)} title={key2 ? `${label} (${shortcutLabel(key2)})` : label}>
              <Icon size={22} stroke={tab === key ? 1.9 : 1.75} aria-hidden="true" />
            </RailButton>
          ))}
          <div className="flex-1" />
          <RailButton label="빠른팩" onClick={onQuickAdd} title={`빠른팩에 적기 (${shortcutLabel("P")})`}>
            <span aria-hidden="true" className="inline-flex size-8 items-center justify-center rounded-full bg-ink text-on-ink">
              <IconPlus size={18} stroke={2.4} />
            </span>
          </RailButton>
          {offline && (
            <span title="오프라인 · 이 기기에만 저장돼요" className="mt-2 flex flex-col items-center gap-1 text-micro font-semibold text-sub">
              <IconWifiOff size={20} stroke={1.75} aria-hidden="true" />
              오프라인
            </span>
          )}
        </nav>
      )}

      <section aria-label="목록" className="flex w-96 shrink-0 flex-col overflow-hidden border-r border-line">
        {banner}
        {/* 탭바는 목록 위에 떠 있다(위치 기준 = 이 칸). 높이는 탭바가 재서 --pib-dock으로 적는다 */}
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <DetailPaneContext.Provider value={tab === "settings" ? paneSlot : null}>{list}</DetailPaneContext.Provider>
          {!rail && <TabBarV2 active={tab} onChange={onTab} onQuickAdd={onQuickAdd} />}
        </div>
      </section>

      <main aria-label="상세" className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <div ref={setPaneSlot} />
        {detail ?? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
            <BackpackLogo size={48} />
            <div className="flex flex-col gap-1">
              <p className="m-0 text-body-lg font-semibold text-ink">왼쪽에서 가방이나 팩을 골라 주세요</p>
              <p className="m-0 text-caption text-sub">
                새로 만들기 {shortcutLabel("N")} · 검색 {shortcutLabel("K")} · 빠른팩 {shortcutLabel("P")}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" leading={<IconPlus size={18} stroke={2} />} onClick={onNewBag}>
                새 가방
              </Button>
              <Button size="sm" variant="secondary" onClick={onNewPack}>
                새 팩
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
