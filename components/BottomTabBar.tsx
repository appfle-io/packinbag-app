"use client";

import { IconPackage, IconBackpack, IconSettings } from "@tabler/icons-react";

export type TabKey = "packs" | "home" | "settings";

export default function BottomTabBar({
  active,
  onChange,
}: {
  active: TabKey;
  onChange: (tab: TabKey) => void;
}) {
  // 3칸 중 pill이 위치할 칸 인덱스 (packs=0, home=1, settings=2)
  const pillIndex = active === "packs" ? 0 : active === "settings" ? 2 : 1;

  return (
    <nav
      className="relative flex shrink-0 pt-2.5"
      style={{
        background: "var(--surface)",
        borderTop: "1px solid var(--border)",
        paddingBottom: "max(14px, env(safe-area-inset-bottom))",
      }}
    >
      {/* 슬라이딩 pill 인디케이터: 좌/우 탭에서만 보이고 홈에서는 사라짐 */}
      <div
        className="absolute inset-y-1.5 left-0 flex items-stretch justify-center pointer-events-none"
        style={{
          width: "33.3333%",
          transform: `translateX(${pillIndex * 100}%)`,
          transition: "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <div
          className="h-full rounded-2xl"
          style={{
            width: "72%",
            background: "var(--accent-soft)",
            opacity: active === "home" ? 0 : 1,
            transition: "opacity 200ms ease",
          }}
        />
      </div>

      <button
        onClick={() => onChange("packs")}
        aria-label="팩 관리"
        className="relative z-10 flex flex-1 items-center justify-center py-[19px] transition-transform active:scale-90"
      >
        <IconPackage
          size={25}
          stroke={1.75}
          color={active === "packs" ? "var(--accent)" : "var(--text-secondary)"}
        />
      </button>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center">
        <button
          onClick={() => onChange("home")}
          aria-label="홈"
          className="absolute -top-11 flex h-[92px] w-[92px] items-center justify-center rounded-full transition-transform active:scale-90"
          style={{
            background: active === "home" ? "var(--accent)" : "var(--surface-2)",
            border: "5px solid var(--surface)",
            boxShadow:
              active === "home"
                ? "0 10px 22px -4px var(--accent), 0 3px 8px rgba(0,0,0,0.2)"
                : "0 4px 12px rgba(0,0,0,0.15)",
            transition: "background 240ms ease, box-shadow 240ms ease",
          }}
        >
          <IconBackpack
            size={42}
            stroke={1.75}
            color={active === "home" ? "#fff" : "var(--text-secondary)"}
          />
        </button>
      </div>

      <button
        onClick={() => onChange("settings")}
        aria-label="설정"
        className="relative z-10 flex flex-1 items-center justify-center py-[19px] transition-transform active:scale-90"
      >
        <IconSettings
          size={25}
          stroke={1.75}
          color={active === "settings" ? "var(--accent)" : "var(--text-secondary)"}
        />
      </button>
    </nav>
  );
}
