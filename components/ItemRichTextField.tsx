"use client";

import { useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { IconBold, IconUnderline, IconStrikethrough } from "@tabler/icons-react";
import { getItemTextExtensions } from "@/lib/itemTextExtensions";
import { spansToTiptapDoc, tiptapDocToSpans, spansToPlainText } from "@/lib/richText";
import { RichSpan } from "@/lib/types";

// 짐(Item)의 텍스트형(type:"text") 항목에 굵게/밑줄/취소선을 "선택한 부분에만" 적용할 수
// 있게 해주는 한 줄짜리 미니 리치텍스트 입력창. ItemFormModal/ItemEditModal 둘 다에서
// 텍스트 항목을 만들거나 고칠 때 이 컴포넌트를 쓴다(체크형 항목은 서식 자체가 없으므로
// 해당 없음). TipTap을 아주 가볍게(문단 하나, 굵게/밑줄/취소선만) 구성해서 재사용한다.
export default function ItemRichTextField({
  initialSpans,
  placeholder,
  autoFocus,
  disabled,
  onChange,
  onCommit,
}: {
  initialSpans: RichSpan[];
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  // 내용이 바뀔 때마다(굵게 토글, 타이핑 등) 호출된다.
  onChange: (payload: { text: string; spans: RichSpan[] }) => void;
  // Enter(줄바꿈 없이)를 누르면 호출된다 - 모달의 "추가" 버튼과 동일한 동작을 유도할 때 쓴다.
  onCommit?: () => void;
}) {
  // 툴바 버튼의 활성 상태(isActive)는 선택 영역이 바뀔 때마다 다시 계산해야 하는데,
  // TipTap의 useEditor 자체는 selectionUpdate/transaction에 리렌더를 자동으로 걸어주지
  // 않는다. 그래서 그 이벤트들을 직접 구독해서 강제로 리렌더시키는 카운터를 둔다.
  const [, forceRerender] = useState(0);

  const editor = useEditor({
    extensions: getItemTextExtensions(placeholder),
    content: spansToTiptapDoc(initialSpans),
    autofocus: autoFocus ? "end" : false,
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "pib-item-rich-text-input",
      },
      handleKeyDown: (_view, event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          onCommit?.();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const spans = tiptapDocToSpans(editor.getJSON());
      onChange({ text: spansToPlainText(spans), spans });
    },
    onSelectionUpdate: () => forceRerender((n) => n + 1),
    onTransaction: () => forceRerender((n) => n + 1),
  });

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    return () => {
      editor?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ToolbarButton = ({
    active,
    label,
    onClick,
    children,
  }: {
    active?: boolean;
    label: string;
    onClick: () => void;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-label={label}
      className="flex items-center justify-center rounded shrink-0"
      style={{
        background: active ? "var(--accent)" : "var(--surface-2)",
        color: active ? "#fff" : "var(--text-secondary)",
        width: 30,
        height: 30,
      }}
    >
      {children}
    </button>
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5">
        <EditorContent editor={editor} className="pib-item-rich-text" />
      </div>
      <div className="flex items-center flex-wrap gap-2.5">
        <ToolbarButton
          active={editor?.isActive("bold")}
          label="굵게"
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <IconBold size={16} stroke={2.25} />
        </ToolbarButton>
        <ToolbarButton
          active={editor?.isActive("underline")}
          label="밑줄"
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        >
          <IconUnderline size={16} stroke={2.25} />
        </ToolbarButton>
        <ToolbarButton
          active={editor?.isActive("strike")}
          label="취소선"
          onClick={() => editor?.chain().focus().toggleStrike().run()}
        >
          <IconStrikethrough size={16} stroke={2.25} />
        </ToolbarButton>
      </div>
    </div>
  );
}
