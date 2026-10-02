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
  // 폰 세로에서도 아이템을 2열로(사용자 설정). 칸이 좁아지니 줄 간격을 조금 좁히고 긴 이름은 두 줄까지만
  dense?: boolean;
  // 사용 가이드(코치마크)에서 강조할 팩(화면의 첫 체크리스트 팩만 true)
  guide?: boolean;
  // 여러 개 선택 중이면 고른 아이템 id(아니면 undefined). 선택 중에는 체크 대신 동그라미 선택 표시
  selectedIds?: Set<string>;
}

// 가방 안 체크리스트 팩 하나. 머리줄을 누르면 접고 펼치고, 길게 누르면 팩 메뉴.
// 아이템은 가방 화면(@container/bag) 폭에 맞춰 1·2·3열 격자로(왼쪽→오른쪽, 위→아래). 글(text) 아이템은 한 줄 전체.
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
  dense,
  guide,
  selectedIds,
}: PackSectionProps) {
  const checks = pack.items.filter((i) => i.type === "check");
  const done = checks.filter((i) => i.checked).length;
  const allDone = checks.length > 0 && done === checks.length;
  const header = useLongPress(onPackMenu, onToggleOpen);

  return (
    <section
      data-pack-id={pack.id}
      data-guide={guide ? "bag-pack" : undefined}
      className={cx(
        "flex break-inside-avoid flex-col",
        inbox ? "mb-2 rounded-card border border-line bg-card px-4" : "border-b border-line",
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        {...header}
        className={cx(
          "flex w-full select-none items-center justify-between gap-3 bg-transparent text-left",
          dense ? "min-h-12" : "min-h-13",
        )}
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
          <ul
            className={cx(
              "m-0 grid list-none p-0 pb-2",
              dense ? "grid-cols-2 gap-x-3" : "grid-cols-1",
              "@2xl/bag:grid-cols-2 @2xl/bag:gap-x-6 @4xl/bag:grid-cols-3",
            )}
          >
            {items.map((item) => (
              <ItemLine
                key={item.id}
                item={item}
                assignee={item.assigneeUid ? memberNames[item.assigneeUid] : undefined}
                highlighted={highlightItemId === item.id}
                dense={dense}
                selected={selectedIds ? selectedIds.has(item.id) : undefined}
                onToggle={() => onToggleItem(item.id)}
                onMenu={() => onItemMenu(item.id)}
              />
            ))}
            {items.length === 0 && <li className="col-span-full py-2 text-caption text-faint">남은 아이템이 없어요</li>}
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
                {inbox.organizing ? "나누는 중…" : "팩으로 나눠 담기"}
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
  dense,
  selected,
  onToggle,
  onMenu,
}: {
  item: Item;
  assignee?: string;
  highlighted?: boolean;
  dense?: boolean;
  // undefined면 보통 모드, true/false면 여러 개 선택 모드(누르면 선택/해제 - 부모가 onToggle에서 처리)
  selected?: boolean;
  onToggle: () => void;
  onMenu: () => void;
}) {
  const isCheck = item.type === "check";
  const selecting = selected !== undefined;
  const press = useLongPress(onMenu, isCheck || selecting ? onToggle : onMenu);
  const done = isCheck && !!item.checked;
  return (
    <li data-item-id={item.id} className={cx("min-w-0", !isCheck && "col-span-full")}>
      <button
        type="button"
        {...press}
        aria-pressed={selecting ? selected : isCheck ? done : undefined}
        className={cx(
          "flex w-full select-none items-center rounded-field bg-transparent text-left",
          dense ? "min-h-11 gap-2" : "min-h-12 gap-3",
          "transition-colors duration-160 ease-snappy active:bg-fill",
          (highlighted || selected) && "bg-brand-soft",
        )}
      >
        {selecting ? (
          <span
            aria-hidden="true"
            className={cx(
              "flex size-5 shrink-0 items-center justify-center rounded-full border-check",
              selected ? "border-brand bg-brand text-on-brand" : "border-line-strong",
            )}
          >
            {selected && <IconCheck size={14} stroke={2.6} />}
          </span>
        ) : isCheck ? (
          <CheckMark checked={done} />
        ) : (
          <span aria-hidden="true" className="size-5.5 shrink-0" />
        )}
        <span
          className={cx(
            "min-w-0 flex-1 text-body transition-colors duration-160 ease-snappy",
            dense && "line-clamp-2 break-keep",
            done ? "text-faint" : "text-ink",
            !isCheck && "text-sub",
            item.bold && "font-semibold",
          )}
        >
          {item.text}
        </span>
        {assignee && <Badge className={cx("truncate", dense ? "max-w-16" : "max-w-24")}>{assignee}</Badge>}
      </button>
    </li>
  );
}