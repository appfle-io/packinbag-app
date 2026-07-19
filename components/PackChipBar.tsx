"use client";

import { Pack } from "@/lib/types";

export type PackChipState = "selected" | "source" | "normal";

// 짐을 드래그해서 팩 사이로 옮길 때의 상단 드롭존 바, 그리고 짐 추가/수정 모달
// 안의 "담을 팩 선택" 칩 목록이 서로 다른 상호작용(드래그오버 판정 vs 클릭선택)을
// 쓰지만 같은 모양을 보여줘야 해서 렌더링만 이 컴포넌트로 공유한다.
export default function PackChipBar({
  packs,
  label,
  getState,
  onSelectPack,
  dropIds = false,
}: {
  packs: Pack[];
  label: string;
  getState: (packId: string) => PackChipState;
  // 있으면 칩을 클릭해서 담을 팩을 바꿀 수 있고(모달), 없으면 클릭 불가(드래그 바).
  onSelectPack?: (packId: string) => void;
  // 있으면 각 칩에 data-pack-drop-id를 달아 포인터 드래그 오버 판정에 쓸 수 있게 한다.
  dropIds?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 flex-wrap">
      <span className="text-[12px] text-text-muted shrink-0 pl-1 whitespace-nowrap w-full">
        {label}
      </span>
      {packs.map((p) => {
        const state = getState(p.id);
        return (
          <button
            key={p.id}
            type="button"
            data-pack-drop-id={dropIds ? p.id : undefined}
            onClick={onSelectPack ? () => onSelectPack(p.id) : undefined}
            className="shrink-0 rounded-full px-4 py-2.5 text-[14px] font-medium whitespace-nowrap"
            style={{
              background: state === "selected" ? "var(--accent)" : "var(--surface-2)",
              color:
                state === "selected"
                  ? "#fff"
                  : state === "source"
                  ? "var(--text-muted)"
                  : undefined,
              border:
                state === "source"
                  ? "1px dashed var(--border-strong)"
                  : "1px solid transparent",
            }}
          >
            {p.name || "팩"}
          </button>
        );
      })}
    </div>
  );
}
