"use client";

import { IconCheck, IconChevronDown, IconListDetails } from "@tabler/icons-react";
import type { Item, Pack } from "@/lib/types";
import { Badge, Button, CheckMark, cx, useLongPress } from "@/components/v2/ui";

export interface PackSectionProps {
  pack: Pack;
  // 필터(남은 것)로 걸러진 뒤 보여줄 아이템
  items: Item[];
  open: boolean;
  onToggleOpen: () => void;
  onToggleItem: (itemId: string) => void;
  onItemMenu: (itemId: string) => void;
  onPackMenu: () => void;
  // uid -> 표시 이름 (담당자 배지)
  memberNames: Record<string, string>;
  // 미분류 섹션 전용
  inbox?: { canOrganize: boolean; organizing: boolean; onOrganize: () => void };
  highlightItemId?: string | null;
}

// 가방 안 체크리스트 팩 하나(= 카테고리 섹션). 머리줄을 누르면 접고 펼치고, 길게 누르면 팩 메뉴.
export function PackSection({
  pack,
  items,
  open,
  onToggleOpen,
  onToggleItem,
  onItemMenu,
  onPackMenu,
  memberNames,
  inbox,
  highlightItemId,
}: PackSectionProps) {
  const checks = pack.items.filter((i) => i.type === "check");
  const done = checks.filter((i) => i.checked).length;
  const allDone = checks.length > 0 && done === checks.length;
  const header = useLongPress(onPackMenu, onToggleOpen);

  return (
    <section
      data-pack-id={pack.id}
      className={cx(
        "flex break-inside-avoid flex-col",
        inbox ? "mb-2 rounded-card border border-line bg-card px-4" : "border-b border-line",
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        {...header}
        className="flex min-h-13 w-full select-none items-center justify-between gap-3 bg-transparent text-left"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-body font-bold">{pack.name}</span>
          {allDone && <IconCheck size={16} stroke={2.4} className="shrink-0 text-brand" aria-label="다 챙김" />}
        </span>
        <span className="flex shrink-0 items-center gap-2 text-caption text-sub">
          {checks.length > 0 ? `${done} / ${checks.length}` : `${pack.items.length}`}
          <IconChevronDown
            size={16}
            stroke={1.9}
            aria-hidden="true"
            className={cx("text-faint transition-transform duration-200 ease-snappy", open && "rotate-180")}
          />
        </span>
      </button>

      <div className={cx("grid transition-[grid-template-rows] duration-200 ease-snappy", open ? "collapse-open" : "collapse-closed")}>
        <div className="min-h-0 overflow-hidden">
          <ul className="m-0 flex list-none flex-col p-0 pb-2">
            {items.map((item) => (
              <ItemLine
                key={item.id}
                item={item}
                assignee={item.assigneeUid ? memberNames[item.assigneeUid] : undefined}
                highlighted={highlightItemId === item.id}
                onToggle={() => onToggleItem(item.id)}
                onMenu={() => onItemMenu(item.id)}
              />
            ))}
            {items.length === 0 && <li className="py-2 text-caption text-faint">남은 아이템이 없어요</li>}
          </ul>
          {inbox?.canOrganize && pack.items.length > 0 && (
            <div className="pb-3">
              <Button
                variant="text"
                size="sm"
                block
                disabled={inbox.organizing}
                onClick={inbox.onOrganize}
                leading={<IconListDetails size={16} stroke={1.9} />}
                className="border border-dashed border-line-strong"
              >
                {inbox.organizing ? "정리하는 중…" : "카테고리로 정리하기"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ItemLine({
  item,
  assignee,
  highlighted,
  onToggle,
  onMenu,
}: {
  item: Item;
  assignee?: string;
  highlighted?: boolean;
  onToggle: () => void;
  onMenu: () => void;
}) {
  const isCheck = item.type === "check";
  const press = useLongPress(onMenu, isCheck ? onToggle : onMenu);
  const done = isCheck && !!item.checked;
  return (
    <li data-item-id={item.id}>
      <button
        type="button"
        {...press}
        aria-pressed={isCheck ? done : undefined}
        className={cx(
          "flex min-h-12 w-full select-none items-center gap-3 rounded-field bg-transparent text-left",
          "transition-colors duration-160 ease-snappy active:bg-fill",
          highlighted && "bg-brand-soft",
        )}
      >
        {isCheck ? <CheckMark checked={done} /> : <span aria-hidden="true" className="size-5.5 shrink-0" />}
        <span
          className={cx(
            "min-w-0 flex-1 text-body transition-colors duration-160 ease-snappy",
            done ? "text-faint" : "text-ink",
            !isCheck && "text-sub",
            item.bold && "font-semibold",
          )}
        >
          {item.text}
        </span>
        {assignee && <Badge className="max-w-24 truncate">{assignee}</Badge>}
      </button>
    </li>
  );
}