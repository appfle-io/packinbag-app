"use client";

import { IconSettings, IconBackpack, IconPlus } from "@tabler/icons-react";

export type TabKey = "home" | "settings";

// v68: 하단탭 3개 재구성. 왼쪽=가방보관함, 가운데="+"(빠른입력, 탭 아님, 액션 버튼 그대로 유지),
// 오른쪽=설정. "팩" 탭은 사라지고 가방보관함 화면에서 왼쪽 끝을 오른쪽으로 스와이프하면
// 팩 트리(PacksScreen)가 풀스크린으로 열리는 방식으로 대체됨(AppShell.tsx의 스와이프 처리 참고).
export default function BottomTabBar({
  active,
  onChange,
  onQuickAdd,
}: {
  active: TabKey;
  onChange: (tab: TabKey) => void;
  // 중앙의 큰 원형 버튼은 탭이 아니라 "빠른입력" 액션이다. 눌러도 화면이 전환되지 않고
  // QuickAddModal이 뜬다. 이번 하단탭 재구성과 무관하게 그대로 유지된다.
  onQuickAdd: () => void;
}) {
  // 2칸 중 pill이 위치할 칸 인덱스 (home=0, settings=1)
  const pillIndex = active === "home" ? 0 : 1;

  return (
    <nav
      className="relative flex shrink-0 pt-2"
      style={{
        background: "var(--surface-2)",
        borderTop: "1px solid var(--border)",
        paddingBottom: "max(9px, env(safe-area-inset-bottom))",
      }}
    >
      {/* 슬라이딩 pill 인디케이터: 가방/설정 두 탭 사이에서만 슬라이드된다 (중앙은 탭이 아니라
          고정된 액션 버튼이라 인디케이터 대상에서 제외). */}
      <div
        className="absolute inset-y-1.5 left-0 flex items-stretch justify-center pointer-events-none"
        style={{
          width: "33.3333%",
          transform: `translateX(${pillIndex * 200}%)`,
          transition: "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <div
          className="h-full rounded-2xl"
          style={{ width: "72%", background: "var(--accent-soft)" }}
        />
      </div>

      <button
        onClick={() => onChange("home")}
        aria-label="가방 보관함"
        className="relative z-10 flex flex-1 items-center justify-center py-[15px] transition-transform active:scale-90"
      >
        <IconBackpack
          size={34}
          stroke={1.75}
          color={active === "home" ? "var(--accent)" : "var(--text-secondary)"}
        />
      </button>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center">
        <button
          onClick={onQuickAdd}
          aria-label="빠른입력"
          className="absolute -top-11 flex h-[92px] w-[92px] items-center justify-center rounded-full transition-transform active:scale-90"
          style={{
            background: "var(--accent)",
            border: "5px solid var(--surface-2)",
            boxShadow: "0 10px 22px -4px var(--accent), 0 3px 8px rgba(0,0,0,0.2)",
          }}
        >
          <IconPlus size={46} stroke={3} color="#fff" />
        </button>
      </div>

      <button
        onClick={() => onChange("settings")}
        aria-label="설정"
        className="relative z-10 flex flex-1 items-center justify-center py-[15px] transition-transform active:scale-90"
      >
        <IconSettings
          size={34}
          stroke={1.75}
          color={active === "settings" ? "var(--accent)" : "var(--text-secondary)"}
        />
      </button>
    </nav>
  );
}
