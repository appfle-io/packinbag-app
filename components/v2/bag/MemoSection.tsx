"use client";

import { IconNotes, IconChevronRight } from "@tabler/icons-react";
import type { Pack } from "@/lib/types";
import { Badge, cx, useLongPress } from "@/components/v2/ui";

// 가방 안 메모팩. 미리보기 3줄, 누르면 메모 편집기로 이동. 진행률 계산에서는 빠진다.
export function MemoSection({
  pack,
  editors,
  onOpen,
  onMenu,
}: {
  pack: Pack;
  // 지금 이 메모를 편집 중인 다른 멤버 이름
  editors: string[];
  onOpen: () => void;
  onMenu: () => void;
}) {
  const press = useLongPress(onMenu, onOpen);
  const preview = (pack.editorPreviewText ?? "").trim();
  return (
    <section data-pack-id={pack.id} className="break-inside-avoid border-b border-line">
      <button type="button" {...press} className="flex w-full select-none flex-col gap-1 bg-transparent py-3 text-left">
        <span className="flex w-full items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2">
            <IconNotes size={18} stroke={1.75} className="shrink-0 text-sub" aria-hidden="true" />
            <span className="truncate text-body font-bold">{pack.name}</span>
            <Badge>메모</Badge>
            {pack.autoSyncEnabled && pack.linkedLibraryPackId && <Badge tone="brand">동기화</Badge>}
          </span>
          <IconChevronRight size={16} stroke={1.75} className="shrink-0 text-faint" aria-hidden="true" />
        </span>
        <span className={cx("line-clamp-3 text-caption", preview ? "text-sub" : "text-faint")}>{preview || "비어 있는 메모"}</span>
        {editors.length > 0 && <span className="text-micro font-semibold text-brand">{editors.join(", ")} 편집 중</span>}
      </button>
    </section>
  );
}