"use client";

import { Button, Sheet } from "@/components/v2/ui";

// 글씨 색 고르기. 견본 색 목록은 편집기(구 TEXT_COLORS)가 넘겨준다 - 문서에 이미 저장된 색과 맞춰야 해서.
export function NoteColorSheet({
  open,
  onClose,
  colors,
  onPick,
  onClear,
}: {
  open: boolean;
  onClose: () => void;
  colors: { id: string; hex: string; label: string }[];
  onPick: (hex: string) => void;
  onClear: () => void;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="글씨 색"
      footer={
        <Button
          variant="secondary"
          block
          onClick={() => {
            onClear();
            onClose();
          }}
        >
          기본 색으로
        </Button>
      }
    >
      <div className="grid grid-cols-6 justify-items-center gap-3">
        {colors.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-label={c.label}
            title={c.label}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onPick(c.hex);
              onClose();
            }}
            className="size-10 rounded-full border border-line active:opacity-70"
            // 견본은 색마다 다르다
            style={{ background: c.hex }}
          />
        ))}
        <label
          title="직접 고르기"
          className="bg-rainbow relative size-10 cursor-pointer overflow-hidden rounded-full border border-line"
        >
          <span className="sr-only">직접 고르기</span>
          <input
            type="color"
            className="absolute inset-0 size-full cursor-pointer opacity-0"
            onChange={(e) => {
              if (e.target.value) {
                onPick(e.target.value);
                onClose();
              }
            }}
          />
        </label>
      </div>
    </Sheet>
  );
}

// 목차(제목 1·2·3). 탭하면 그 제목으로 이동한다.
export function NoteTocSheet({
  open,
  onClose,
  headings,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  headings: { pos: number; level: number; text: string }[];
  onPick: (pos: number) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="목차">
      <nav aria-label="목차" className="flex flex-col">
        {headings.map((h, i) => (
          <button
            key={`${h.pos}-${i}`}
            type="button"
            onClick={() => onPick(h.pos)}
            className={
              "flex min-h-11 w-full items-center truncate border-b border-line bg-transparent text-left active:bg-fill " +
              (h.level === 1 ? "text-body font-semibold text-ink" : h.level === 2 ? "pl-4 text-body text-ink" : "pl-8 text-caption text-sub")
            }
          >
            <span className="truncate">{h.text}</span>
          </button>
        ))}
      </nav>
    </Sheet>
  );
}
