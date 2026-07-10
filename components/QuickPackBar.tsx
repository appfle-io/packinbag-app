"use client";

import { IconBolt, IconChevronRight } from "@tabler/icons-react";
import { Pack } from "@/lib/types";

// 팩/가방 화면 맨 아래, 스크롤 그리드와 별개로 항상 고정된 자리에 떠 있는 슬림 바.
// "빠른팩"에 아이템이 하나도 없으면(=한 번도 안 썼거나 다 정리해서 비웠으면) 아예
// 렌더링하지 않는다(HIDE) - 문서 자체는 지워지지 않고 남아있다가, 다시 빠른입력하면
// 그대로 재사용된다.
export default function QuickPackBar({
  pack,
  onClick,
}: {
  pack: Pack | undefined;
  onClick: () => void;
}) {
  if (!pack || pack.items.length === 0) return null;

  const preview = pack.items
    .slice(-3)
    .map((i) => i.text || "(빈 항목)")
    .join(", ");

  return (
    <button
      onClick={onClick}
      className="shrink-0 mx-4 mb-3 flex items-center gap-2.5 rounded-xl border border-border px-3 py-2.5 text-left"
      style={{ background: "var(--accent-soft)" }}
    >
      <span
        className="shrink-0 h-8 w-8 rounded-full flex items-center justify-center"
        style={{ background: "var(--accent)" }}
      >
        <IconBolt size={16} stroke={1.75} color="#fff" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="text-[13px] font-medium" style={{ color: "var(--accent-strong)" }}>
            빠른팩
          </span>
          <span className="text-[11px] text-text-muted shrink-0">{pack.items.length}개</span>
        </span>
        <span className="block text-[11.5px] text-text-secondary truncate mt-0.5">
          {preview}
        </span>
      </span>
      <IconChevronRight size={16} stroke={1.75} color="var(--text-muted)" className="shrink-0" />
    </button>
  );
}
