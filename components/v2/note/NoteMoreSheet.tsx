"use client";

import type { Editor } from "@tiptap/react";
import {
  IconCode,
  IconItalic,
  IconList,
  IconMinus,
  IconPalette,
  IconPlus,
  IconShare,
  IconStrikethrough,
  IconUnderline,
} from "@tabler/icons-react";
import { ListRow, SectionHeader, Sheet, Toggle, cx } from "@/components/v2/ui";

// 메모 편집기 더보기: 툴바에 없는 서식(기울임·밑줄·취소선·코드·제목 단계·글자 크기·글씨 색)과
// 맞춤법 · 목차 · 공유 · 용량 · 삭제. 서식·문단 버튼은 적용하고 바로 닫는다(글자 크기 -/+는 연달아 누르므로 열어 둔다).
// 글자를 고른 뒤에는 툴바가 서식 줄로 바뀌므로 보통은 여기까지 올 필요가 없다.
function FormatButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "inline-flex h-11 flex-1 items-center justify-center rounded-field transition-colors duration-160 ease-snappy disabled:opacity-40",
        active ? "bg-brand-soft text-brand" : "bg-fill text-ink active:bg-line",
      )}
    >
      {children}
    </button>
  );
}

const HEADING_OPTIONS = [
  { level: 0, label: "본문" },
  { level: 1, label: "제목 1" },
  { level: 2, label: "제목 2" },
  { level: 3, label: "제목 3" },
] as const;

export function NoteMoreSheet({
  open,
  onClose,
  editor,
  readOnly,
  fontSize,
  onFontSize,
  onOpenColor,
  spellcheck,
  onToggleSpellcheck,
  hasHeadings,
  onOpenToc,
  canShare,
  onShare,
  percentOfLimit,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  editor: Editor | null;
  readOnly: boolean;
  fontSize: number;
  onFontSize: (delta: number) => void;
  onOpenColor: () => void;
  spellcheck: boolean;
  onToggleSpellcheck: () => void;
  hasHeadings: boolean;
  onOpenToc: () => void;
  canShare: boolean;
  onShare: () => void;
  percentOfLimit: number;
  // 보관함에서 연 메모만(가방 안 메모는 팩 시트에서 삭제)
  onDelete?: () => void;
}) {
  const ed = editor;
  const level = ed ? ([1, 2, 3] as const).find((l) => ed.isActive("heading", { level: l })) ?? 0 : 0;
  // 적용하고 시트를 닫는다(편집기로 바로 돌아가게)
  const apply = (fn: (e: Editor) => void) => () => {
    if (!ed) return;
    fn(ed);
    onClose();
  };
  const setLevel = (l: number) =>
    apply((e) => {
      const chain = e.chain().focus();
      if (l === 0) chain.setParagraph().run();
      else chain.setHeading({ level: l as 1 | 2 | 3 }).run();
    })();

  return (
    <Sheet open={open} onClose={onClose} title="더보기">
      <div className="flex flex-col gap-6">
        {!readOnly && ed && (
          <section className="flex flex-col gap-3">
            <SectionHeader>서식</SectionHeader>
            <div className="flex gap-2">
              <FormatButton label="기울임" active={ed.isActive("italic")} onClick={apply((e) => e.chain().focus().toggleItalic().run())}>
                <IconItalic size={20} stroke={1.9} />
              </FormatButton>
              <FormatButton label="밑줄" active={ed.isActive("underline")} onClick={apply((e) => e.chain().focus().toggleUnderline().run())}>
                <IconUnderline size={20} stroke={1.9} />
              </FormatButton>
              <FormatButton label="취소선" active={ed.isActive("strike")} onClick={apply((e) => e.chain().focus().toggleStrike().run())}>
                <IconStrikethrough size={20} stroke={1.9} />
              </FormatButton>
              <FormatButton label="코드 블록" active={ed.isActive("codeBlock")} onClick={apply((e) => e.chain().focus().toggleCodeBlock().run())}>
                <IconCode size={20} stroke={1.9} />
              </FormatButton>
            </div>
            <div role="radiogroup" aria-label="문단 종류" className="grid grid-cols-4 gap-1 rounded-field bg-fill p-1">
              {HEADING_OPTIONS.map((o) => (
                <button
                  key={o.level}
                  type="button"
                  role="radio"
                  aria-checked={level === o.level}
                  onClick={() => setLevel(o.level)}
                  className={cx(
                    "h-9 rounded-control text-caption transition-colors duration-160 ease-snappy",
                    level === o.level ? "bg-card font-semibold text-ink ring-1 ring-line" : "bg-transparent font-medium text-sub",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="flex-1 text-body text-ink">글자 크기</span>
              <button
                type="button"
                aria-label="글자 작게"
                disabled={fontSize <= 8}
                onClick={() => onFontSize(-1)}
                className="inline-flex size-11 items-center justify-center rounded-field bg-fill text-ink active:bg-line disabled:opacity-40"
              >
                <IconMinus size={18} stroke={2} />
              </button>
              <span className="w-8 text-center text-body font-semibold tabular-nums">{fontSize}</span>
              <button
                type="button"
                aria-label="글자 크게"
                disabled={fontSize >= 28}
                onClick={() => onFontSize(1)}
                className="inline-flex size-11 items-center justify-center rounded-field bg-fill text-ink active:bg-line disabled:opacity-40"
              >
                <IconPlus size={18} stroke={2} />
              </button>
            </div>
            <ListRow
              divider={false}
              title="글씨 색"
              leading={<IconPalette size={20} stroke={1.75} className="text-sub" aria-hidden="true" />}
              onClick={onOpenColor}
              chevron
            />
          </section>
        )}

        <section className="flex flex-col">
          <SectionHeader>메모</SectionHeader>
          {!readOnly && (
            <div className="border-b border-line">
              <Toggle checked={spellcheck} onChange={onToggleSpellcheck} label="맞춤법 검사" description="틀린 글자 아래 빨간 밑줄" />
            </div>
          )}
          {hasHeadings && (
            <ListRow
              title="목차"
              leading={<IconList size={20} stroke={1.75} className="text-sub" aria-hidden="true" />}
              onClick={onOpenToc}
              chevron
            />
          )}
          {canShare && (
            <ListRow
              title="공유"
              subtitle="링크로 보거나 보관함에 담을 수 있어요"
              leading={<IconShare size={20} stroke={1.75} className="text-sub" aria-hidden="true" />}
              onClick={onShare}
              chevron
            />
          )}
          {!readOnly && (
            <div className={cx("flex min-h-13 items-center justify-between py-2", onDelete && "border-b border-line")}>
              <span className="text-body text-ink">용량</span>
              <span className={cx("text-caption font-semibold", percentOfLimit > 90 ? "text-alert" : "text-sub")}>{percentOfLimit}% 사용</span>
            </div>
          )}
          {onDelete && !readOnly && (
            <ListRow divider={false} title={<span className="text-alert">메모 삭제</span>} onClick={onDelete} />
          )}
        </section>
      </div>
    </Sheet>
  );
}
