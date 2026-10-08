"use client";

import { useRef, useState } from "react";
import { IconMenu2 } from "@tabler/icons-react";
import { tapHaptic } from "@/lib/haptics";
import { Button } from "./Button";
import { Sheet } from "./Sheet";
import { SectionHeader } from "./SectionHeader";
import { cx } from "./cx";

// 끌어서 순서 바꾸기 시트(가방 폴더 칩 · 가방 목록 · 팩 탭 항목이 같이 쓴다).
// - 줄마다 오른쪽 ≡ 손잡이를 잡고 위아래로 끌면 다른 줄이 비켜나며 자리가 바뀐다. 한 칸 지날 때마다 가벼운 햅틱(iOS 앱)
// - 묶음(groups)이 여러 개면 묶음 안에서만 옮긴다(예: 팩 탭은 폴더 / 팩·메모)
// - "완료"를 눌러야 저장(onSave). X·바깥을 누르면 바꾼 순서를 버린다
// - 손잡이에만 touch-action:none을 줘서, 손잡이 밖을 밀면 목록이 평소처럼 스크롤된다
// 서버 호출은 하지 않는다(저장은 부르는 쪽 onSave).

interface ReorderItem {
  id: string;
  label: string;
  sub?: string;
  icon?: React.ReactNode;
}

export interface ReorderGroup {
  key: string;
  title?: string;
  items: ReorderItem[];
}

type Orders = Record<string, string[]>;

const ordersOf = (groups: ReorderGroup[]): Orders => Object.fromEntries(groups.map((g) => [g.key, g.items.map((i) => i.id)]));

export function ReorderSheet({
  open,
  title,
  groups,
  hint,
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  groups: ReorderGroup[];
  hint?: string;
  onClose: () => void;
  // 묶음 key -> 새 순서(id 배열)
  onSave: (orders: Orders) => void;
}) {
  // 열 때마다 지금 순서로 새로 시작한다(닫히는 동안에는 그대로 둬서 내려가는 모습 유지)
  const [orders, setOrders] = useState<Orders>(() => ordersOf(groups));
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setOrders(ordersOf(groups));
  }

  const byId = new Map(groups.flatMap((g) => g.items.map((i) => [i.id, i] as const)));
  const changed = groups.some((g) => (orders[g.key] ?? []).join("\u0000") !== g.items.map((i) => i.id).join("\u0000"));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <Button
          block
          onClick={() => {
            if (changed) onSave(orders);
            onClose();
          }}
        >
          완료
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {hint && <p className="m-0 text-caption text-faint">{hint}</p>}
        {groups.map((g) =>
          (orders[g.key] ?? []).length === 0 ? null : (
            <section key={g.key} className="flex flex-col">
              {g.title && <SectionHeader>{g.title}</SectionHeader>}
              <ReorderList
                ids={orders[g.key] ?? []}
                byId={byId}
                onChange={(ids) => setOrders((o) => ({ ...o, [g.key]: ids }))}
              />
            </section>
          ),
        )}
      </div>
    </Sheet>
  );
}

function ReorderList({
  ids,
  byId,
  onChange,
}: {
  ids: string[];
  byId: Map<string, ReorderItem>;
  onChange: (ids: string[]) => void;
}) {
  const [drag, setDrag] = useState<{ from: number; to: number; dy: number; h: number } | null>(null);
  // 놓는 순간 한 번은 애니메이션 없이 제자리에 붙인다(DOM 순서가 바뀌면서 튀는 것 방지)
  const [settling, setSettling] = useState(false);
  const startY = useRef(0);

  const onDown = (i: number) => (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const row = e.currentTarget.closest("li");
    startY.current = e.clientY;
    setDrag({ from: i, to: i, dy: 0, h: row?.offsetHeight || 52 });
    tapHaptic();
  };

  const onMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag) return;
    const dy = e.clientY - startY.current;
    const to = Math.max(0, Math.min(ids.length - 1, drag.from + Math.round(dy / drag.h)));
    if (to !== drag.to) tapHaptic();
    setDrag({ ...drag, dy, to });
  };

  const onUp = () => {
    if (!drag) return;
    const { from, to } = drag;
    setDrag(null);
    if (from === to) return;
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setSettling(true);
    onChange(next);
    requestAnimationFrame(() => requestAnimationFrame(() => setSettling(false)));
  };

  const shiftOf = (i: number) => {
    if (!drag || i === drag.from) return 0;
    if (drag.from < drag.to && i > drag.from && i <= drag.to) return -drag.h;
    if (drag.from > drag.to && i >= drag.to && i < drag.from) return drag.h;
    return 0;
  };

  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {ids.map((id, i) => {
        const item = byId.get(id);
        if (!item) return null;
        const dragging = drag?.from === i;
        const y = dragging && drag ? drag.dy : shiftOf(i);
        return (
          <li
            key={id}
            style={{ transform: `translateY(${y}px)` }}
            className={cx(
              "relative flex min-h-13 select-none items-center gap-3 border-b border-line bg-canvas",
              dragging ? "z-10 shadow-sheet" : !settling && "transition-transform duration-160 ease-snappy",
            )}
          >
            {item.icon}
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-body text-ink">{item.label}</span>
              {item.sub && <span className="truncate text-caption text-sub">{item.sub}</span>}
            </span>
            <button
              type="button"
              aria-label={`${item.label} 끌어서 순서 바꾸기`}
              onPointerDown={onDown(i)}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              className={cx(
                "-mr-3 flex size-11 shrink-0 touch-none items-center justify-center bg-transparent",
                dragging ? "cursor-grabbing text-ink" : "cursor-grab text-faint",
              )}
            >
              <IconMenu2 size={20} stroke={1.9} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
