"use client";

import {
  IconSettings,
  IconBackpack,
  IconSquareRoundedPlus,
  IconPackage,
} from "@tabler/icons-react";

export type TabKey = "home" | "packs" | "settings";

export default function BottomTabBar({
  active,
  onChange,
  onQuickAdd,
}: {
  active: TabKey;
  onChange: (tab: TabKey) => void;
  onQuickAdd: () => void;
}) {
  // 4칸 중 pill이 위치할 칸 인덱스 (packs=0, home=1, settings=3)
  const pillIndex = active === "packs" ? 0 : active === "home" ? 1 : 3;

  return (
    <nav
      className="relative flex shrink-0 pt-1.5 backdrop-blur-md z-30"
      style={{
        background: "color-mix(in srgb, var(--surface-2) 88%, transparent)",
        borderTop: "1px solid var(--border)",
        paddingBottom: "max(8px, env(safe-area-inset-bottom))",
      }}
    >
      {/* 슬라이딩 pill 인디케이터 */}
      <div
        className="absolute inset-y-1 left-0 flex items-stretch justify-center pointer-events-none"
        style={{
          width: "25%",
          transform: `translateX(${pillIndex * 100}%)`,
          transition: "transform 260ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <div
          className="h-full rounded-2xl border border-accent/20"
          style={{ width: "76%", background: "var(--accent-soft)" }}
        />
      </div>

      {/* 1. 팩 보관함 탭 */}
      <button
        onClick={() => onChange("packs")}
        aria-label="팩 보관함"
        className="relative z-10 flex flex-1 flex-col items-center justify-center py-1.5 gap-1 transition-transform active:scale-95"
      >
        <IconPackage
          size={24}
          stroke={1.75}
          color={active === "packs" ? "var(--accent)" : "var(--text-secondary)"}
        />
        <span
          className="text-[11px] font-medium tracking-tight leading-none"
          style={{
            color: active === "packs" ? "var(--accent)" : "var(--text-secondary)",
          }}
        >
          팩
        </span>
      </button>

      {/* 2. 가방 보관함 탭 */}
      <button
        onClick={() => onChange("home")}
        aria-label="가방 보관함"
        className="relative z-10 flex flex-1 flex-col items-center justify-center py-1.5 gap-1 transition-transform active:scale-95"
      >
        <IconBackpack
          size={24}
          stroke={1.75}
          color={active === "home" ? "var(--accent)" : "var(--text-secondary)"}
        />
        <span
          className="text-[11px] font-medium tracking-tight leading-none"
          style={{
            color: active === "home" ? "var(--accent)" : "var(--text-secondary)",
          }}
        >
          가방
        </span>
      </button>

      {/* 3. 빠른팩 (스퀘어 플러스) */}
      <button
        onClick={onQuickAdd}
        aria-label="빠른팩 입력"
        className="relative z-10 flex flex-1 flex-col items-center justify-center py-1.5 gap-1 transition-transform active:scale-95 group"
      >
        <IconSquareRoundedPlus
          size={24}
          stroke={1.85}
          color="var(--text-secondary)"
          className="group-hover:text-accent transition-colors"
        />
        <span className="text-[11px] font-medium tracking-tight leading-none text-text-secondary group-hover:text-accent transition-colors">
          빠른팩
        </span>
      </button>

      {/* 4. 설정 탭 */}
      <button
        onClick={() => onChange("settings")}
        aria-label="설정"
        className="relative z-10 flex flex-1 flex-col items-center justify-center py-1.5 gap-1 transition-transform active:scale-95"
      >
        <IconSettings
          size={24}
          stroke={1.75}
          color={active === "settings" ? "var(--accent)" : "var(--text-secondary)"}
        />
        <span
          className="text-[11px] font-medium tracking-tight leading-none"
          style={{
            color: active === "settings" ? "var(--accent)" : "var(--text-secondary)",
          }}
        >
          설정
        </span>
      </button>
    </nav>
  );
}



