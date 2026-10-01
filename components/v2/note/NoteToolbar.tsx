"use client";

import type { Editor } from "@tiptap/react";
import {
  IconBold,
  IconClearFormatting,
  IconDots,
  IconH1,
  IconH2,
  IconH3,
  IconHeading,
  IconItalic,
  IconLink,
  IconListCheck,
  IconLoader2,
  IconLock,
  IconPalette,
  IconPaperclip,
  IconStrikethrough,
  IconTable,
  IconTableOptions,
  IconUnderline,
} from "@tabler/icons-react";
import { cx } from "@/components/v2/ui";

// 메모 편집기 툴바 한 줄: 체크박스 · 제목 · 굵게 · 표 · 링크 · 첨부 · 더보기.
// 글자를 고르면 같은 자리가 굵게 · 기울임 · 밑줄 · 취소선 · 글씨 색 · 링크 · 서식 지우기로 바뀐다
// (iOS 복사/붙여넣기 말풍선과 겹치지 않게 떠 있는 메뉴 대신 툴바 자체를 바꾼다).
// 커서가 표 안이면 행+ · 열+ · 행- · 열- · 표 메뉴 · 굵게 · 더보기.
// 버튼은 누를 때 편집기 포커스를 뺏지 않는다(onMouseDown preventDefault).
function ToolButton({
  label,
  active,
  disabled,
  danger,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  danger?: boolean;
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
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cx(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-field transition-colors duration-160 ease-snappy",
        "disabled:pointer-events-none disabled:opacity-40",
        active ? "bg-brand-soft text-brand" : danger ? "text-alert active:bg-fill" : "text-ink active:bg-fill",
      )}
    >
      {children}
    </button>
  );
}

// 본문 → 제목1 → 제목2 → 제목3 → 본문
export function cycleHeading(editor: Editor) {
  const chain = editor.chain().focus();
  if (editor.isActive("heading", { level: 1 })) chain.setHeading({ level: 2 }).run();
  else if (editor.isActive("heading", { level: 2 })) chain.setHeading({ level: 3 }).run();
  else if (editor.isActive("heading", { level: 3 })) chain.setParagraph().run();
  else chain.setHeading({ level: 1 }).run();
}

export function NoteToolbar({
  editor,
  canAttach,
  attachLocked,
  uploading,
  onLink,
  onAttach,
  onTableMenu,
  onMore,
  onColor,
}: {
  editor: Editor | null;
  canAttach: boolean;
  // 무료 회원: 첨부 버튼에 자물쇠(누르면 프리미엄 안내)
  attachLocked: boolean;
  uploading: boolean;
  onLink: () => void;
  onAttach: () => void;
  onTableMenu: () => void;
  onMore: () => void;
  onColor: () => void;
}) {
  if (!editor) return <div className="h-11 shrink-0 border-b border-line" />;
  const inTable = editor.isActive("table");
  // 글자를 드래그로 고른 상태(표 여러 칸 선택·사진 같은 노드 선택은 제외)
  const sel = editor.state.selection;
  const textSelected = !sel.empty && !("$anchorCell" in sel) && !("node" in sel);
  const level = [1, 2, 3].find((l) => editor.isActive("heading", { level: l }));
  const HeadingIcon = level === 1 ? IconH1 : level === 2 ? IconH2 : level === 3 ? IconH3 : IconHeading;
  const run = (fn: (e: Editor) => void) => () => fn(editor);

  return (
    <div
      role="toolbar"
      aria-label={textSelected ? "고른 글자 서식" : inTable ? "표 편집" : "글 서식"}
      className="pib-v2-no-scrollbar flex shrink-0 items-center justify-between gap-1 overflow-x-auto border-b border-line px-2"
    >
      {textSelected ? (
        <>
          <ToolButton label="굵게" active={editor.isActive("bold")} onClick={run((e) => e.chain().focus().toggleBold().run())}>
            <IconBold size={22} stroke={1.9} />
          </ToolButton>
          <ToolButton label="기울임" active={editor.isActive("italic")} onClick={run((e) => e.chain().focus().toggleItalic().run())}>
            <IconItalic size={22} stroke={1.9} />
          </ToolButton>
          <ToolButton label="밑줄" active={editor.isActive("underline")} onClick={run((e) => e.chain().focus().toggleUnderline().run())}>
            <IconUnderline size={22} stroke={1.9} />
          </ToolButton>
          <ToolButton label="취소선" active={editor.isActive("strike")} onClick={run((e) => e.chain().focus().toggleStrike().run())}>
            <IconStrikethrough size={22} stroke={1.9} />
          </ToolButton>
          <ToolButton label="글씨 색" active={!!editor.getAttributes("textStyle").color} onClick={onColor}>
            <IconPalette size={22} stroke={1.75} />
          </ToolButton>
          <ToolButton label={editor.isActive("link") ? "링크 고치기 · 해제" : "링크 넣기"} active={editor.isActive("link")} onClick={onLink}>
            <IconLink size={22} stroke={1.75} />
          </ToolButton>
          <ToolButton label="서식 지우기" onClick={run((e) => e.chain().focus().unsetAllMarks().run())}>
            <IconClearFormatting size={22} stroke={1.75} />
          </ToolButton>
        </>
      ) : inTable ? (
        <>
          <ToolButton label="아래에 행 추가" onClick={run((e) => e.chain().focus().addRowAfter().run())}>
            <span className="text-caption font-semibold">행+</span>
          </ToolButton>
          <ToolButton label="오른쪽에 열 추가" onClick={run((e) => e.chain().focus().addColumnAfter().run())}>
            <span className="text-caption font-semibold">열+</span>
          </ToolButton>
          <ToolButton label="이 행 삭제" danger onClick={run((e) => e.chain().focus().deleteRow().run())}>
            <span className="text-caption font-semibold">행-</span>
          </ToolButton>
          <ToolButton label="이 열 삭제" danger onClick={run((e) => e.chain().focus().deleteColumn().run())}>
            <span className="text-caption font-semibold">열-</span>
          </ToolButton>
          <ToolButton label="표 메뉴" onClick={onTableMenu}>
            <IconTableOptions size={22} stroke={1.75} />
          </ToolButton>
          <ToolButton label="굵게" active={editor.isActive("bold")} onClick={run((e) => e.chain().focus().toggleBold().run())}>
            <IconBold size={22} stroke={1.9} />
          </ToolButton>
        </>
      ) : (
        <>
          <ToolButton
            label="체크박스 목록"
            active={editor.isActive("taskList")}
            onClick={run((e) => e.chain().focus().toggleTaskList().run())}
          >
            <IconListCheck size={22} stroke={1.75} />
          </ToolButton>
          <ToolButton label={level ? `제목 ${level} (누르면 다음 단계)` : "제목 (누르면 제목 1)"} active={!!level} onClick={run(cycleHeading)}>
            <HeadingIcon size={22} stroke={1.75} />
          </ToolButton>
          <ToolButton label="굵게" active={editor.isActive("bold")} onClick={run((e) => e.chain().focus().toggleBold().run())}>
            <IconBold size={22} stroke={1.9} />
          </ToolButton>
          <ToolButton label="표 넣기" onClick={run((e) => e.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run())}>
            <IconTable size={22} stroke={1.75} />
          </ToolButton>
          <ToolButton label={editor.isActive("link") ? "링크 고치기 · 해제" : "링크 넣기"} active={editor.isActive("link")} onClick={onLink}>
            <IconLink size={22} stroke={1.75} />
          </ToolButton>
          {canAttach && (
            <ToolButton label={attachLocked ? "사진 · 파일 첨부 (프리미엄)" : "사진 · 파일 첨부"} disabled={uploading} onClick={onAttach}>
              {uploading ? (
                <IconLoader2 size={22} stroke={1.75} className="animate-spin" />
              ) : (
                <span className="relative inline-flex">
                  <IconPaperclip size={22} stroke={1.75} />
                  {attachLocked && (
                    <span className="absolute -right-1 -bottom-1 inline-flex size-4 items-center justify-center rounded-full bg-ink text-on-ink">
                      <IconLock size={10} stroke={2.2} />
                    </span>
                  )}
                </span>
              )}
            </ToolButton>
          )}
        </>
      )}
      {!textSelected && (
        <ToolButton label="더보기" onClick={onMore}>
          <IconDots size={22} stroke={1.75} />
        </ToolButton>
      )}
    </div>
  );
}
