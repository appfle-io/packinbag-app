"use client";

import { useEffect, useRef, useState } from "react";
import { IconArrowUp, IconCheck, IconChevronRight } from "@tabler/icons-react";
import { IconButton, SegmentedControl, Sheet, cx } from "@/components/v2/ui";

type QuickType = "check" | "text";

const TYPE_OPTIONS = [
  { value: "check" as const, label: "체크" },
  { value: "text" as const, label: "글" },
];

// 시트가 올라온 뒤(Sheet가 패널에 포커스를 준 다음) 입력칸으로 포커스를 옮긴다
const FOCUS_DELAY_MS = 320;

// 리디자인 v2 빠른팩 입력 시트(하단 탭바 "빠른팩"). 구 QuickAddModal 대체.
// - 생각날 때 빨리 적어 두는 용도라 종류(체크/글)와 이름만 받는다. 엔터로 연속 입력, 시트는 열린 채 유지
// - 이번에 넣은 것은 위에 바로 보여 준다(닫으면 사라지는 화면용 목록, 저장은 onAdd가 맡는다)
// - 아래 "빠른팩 열기"로 모아 둔 아이템을 정리하러 바로 간다
export function QuickAddSheet({
  open,
  onClose,
  onAdd,
  savedCount,
  onOpenQuickPack,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (data: { type: QuickType; text: string }) => void;
  // 빠른팩에 이미 모여 있는 아이템 수(이번에 넣은 것 포함)
  savedCount: number;
  onOpenQuickPack?: () => void;
}) {
  const [type, setType] = useState<QuickType>("check");
  const [text, setText] = useState("");
  const [justAdded, setJustAdded] = useState<{ id: number; type: QuickType; text: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  // 새로 열 때마다 이번 입력 목록·입력칸을 비운다(닫히는 동안에는 그대로 둬서 내려가는 모습 유지)
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setJustAdded([]);
      setText("");
    }
  }

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), FOCUS_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [open]);

  const commit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onAdd({ type, text: trimmed });
    seq.current += 1;
    setJustAdded((prev) => [...prev, { id: seq.current, type, text: trimmed }]);
    setText("");
    inputRef.current?.focus();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="빠른팩"
      footer={
        <form
          onSubmit={(e) => {
            e.preventDefault();
            commit();
          }}
          className="flex items-center gap-2"
        >
          <label className="flex h-11 min-w-0 flex-1 items-center rounded-full border border-line bg-card px-4">
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-label="빠른팩에 넣을 아이템"
              placeholder={type === "check" ? "챙길 것을 적고 엔터" : "메모할 글을 적고 엔터"}
              enterKeyHint="send"
              className="min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-faint"
            />
          </label>
          <IconButton type="submit" label="추가" variant="solid" disabled={!text.trim()} className={cx(!text.trim() && "bg-line-strong")}>
            <IconArrowUp size={20} stroke={2.2} />
          </IconButton>
        </form>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="m-0 text-caption text-sub">생각날 때 바로 적어 두세요. 나중에 팩 탭의 빠른팩에서 원하는 팩이나 가방으로 옮기면 돼요.</p>

        <SegmentedControl label="아이템 종류" options={TYPE_OPTIONS} value={type} onChange={setType} />

        {justAdded.length > 0 && (
          <section aria-label="방금 넣은 아이템" className="flex flex-col">
            <p className="m-0 pb-1 text-micro font-semibold text-faint">방금 넣은 것 {justAdded.length}개</p>
            <ul className="m-0 flex list-none flex-col p-0">
              {justAdded.map((entry, i) => (
                <li
                  key={entry.id}
                  className={cx("flex min-h-11 items-center gap-3", i < justAdded.length - 1 && "border-b border-line")}
                >
                  {entry.type === "check" ? (
                    <IconCheck size={18} stroke={2} className="shrink-0 text-brand" aria-hidden="true" />
                  ) : (
                    <span aria-hidden="true" className="size-4 shrink-0" />
                  )}
                  <span className={cx("min-w-0 flex-1 truncate text-body", entry.type === "check" ? "text-ink" : "text-sub")}>
                    {entry.text}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {onOpenQuickPack && savedCount > 0 && (
          <button
            type="button"
            onClick={onOpenQuickPack}
            className="flex min-h-12 w-full items-center gap-3 rounded-card bg-fill px-4 text-left active:bg-line"
          >
            <span className="min-w-0 flex-1 text-body font-semibold text-ink">빠른팩 열기</span>
            <span className="text-caption text-sub">{savedCount}개</span>
            <IconChevronRight size={16} stroke={1.75} className="shrink-0 text-faint" aria-hidden="true" />
          </button>
        )}
      </div>
    </Sheet>
  );
}
