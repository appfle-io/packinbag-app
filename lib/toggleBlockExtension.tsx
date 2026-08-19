"use client";

// 메모팩(TipTap 에디터)에서 ">" 입력 후 스페이스를 치면 접었다 폈다 할 수 있는 토글 블록을
// 만드는 커스텀 노드. 노션의 토글 리스트와 같은 패턴 - 첫 줄(요약/제목)은 항상 보이고,
// 그 아래 본문은 화살표를 눌러야만 펼쳐진다.
//
// 구조: toggleBlock(컨테이너) > [toggleSummary(한 줄, 제목), toggleContent(본문, 여러 블록 가능)]
// - toggleSummary: content가 "inline*"라 줄바꿈 없는 한 줄. Enter를 누르면 본문(toggleContent)
//   첫 문단으로 커서가 이동한다(같은 줄 안에서 줄바꿈되지 않게).
// - toggleContent: 열림(open=true)일 때만 보이고, 닫히면 CSS로 숨긴다(globals.css
//   .pib-toggle[data-open="false"] 참고) - 데이터 자체는 지워지지 않고 그대로 저장된다.
//
// 기본 StarterKit의 blockquote가 원래 "> "를 가로채가서(인용구로 변환), 이 확장을 쓰려면
// noteEditorExtensions.ts에서 StarterKit.configure({ blockquote: false })로 blockquote를
// 꺼줘야 이 입력규칙이 대신 동작한다.
import { Node, mergeAttributes, InputRule } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/core";

export const ToggleSummary = Node.create({
  name: "toggleSummary",
  content: "inline*",
  marks: "_",
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-type="toggle-summary"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "toggle-summary" }), 0];
  },

  // 제목 줄 키보드 단축키:
  // 1. Enter: 내용이 있으면 아래에 '새 토글' 연속 생성, 비어있으면 일반 문단으로 전환(탈출).
  // 2. Backspace (지우기): 비어있거나 맨 앞이면 토글을 해제하고 일반 문단으로 전환.
  // 3. Shift-Enter: 본문(toggleContent)으로 들어가서 작성 (접혀있으면 자동 펼침).
  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const { editor } = this;
        const { state } = editor;
        const { $from } = state.selection;
        if ($from.parent.type.name !== this.name) return false;

        const summaryNode = $from.parent;
        const isSummaryEmpty = summaryNode.textContent.trim().length === 0;
        const toggleBlockDepth = $from.depth - 1;

        if (isSummaryEmpty) {
          // 요약(제목)이 비어있는 상태에서 Enter를 치면 토글 블록을 해제하고 일반 문단으로 전환
          const toggleBlockPos = $from.before(toggleBlockDepth);
          const toggleBlockEnd = $from.after(toggleBlockDepth);
          return editor
            .chain()
            .focus()
            .insertContentAt({ from: toggleBlockPos, to: toggleBlockEnd }, { type: "paragraph" })
            .run();
        }

        // 제목에 글자가 있으면 바로 아래에 '새로운 토글 블록'을 연속 생성 (리스트처럼 동작)
        const posAfterToggleBlock = $from.after(toggleBlockDepth);
        return editor
          .chain()
          .focus()
          .insertContentAt(posAfterToggleBlock, {
            type: "toggleBlock",
            attrs: { open: true },
            content: [
              { type: "toggleSummary", content: [] },
              { type: "toggleContent", content: [{ type: "paragraph" }] },
            ],
          })
          .setTextSelection(posAfterToggleBlock + 2)
          .run();
      },
      Backspace: () => {
        const { editor } = this;
        const { state } = editor;
        const { $from, empty } = state.selection;
        if ($from.parent.type.name !== this.name) return false;

        // 커서가 요약(제목) 맨 앞에 있거나 요약이 비어있을 때 지우기(Backspace)를 누른 경우
        if (empty && $from.parentOffset === 0) {
          const summaryNode = $from.parent;
          const isSummaryEmpty = summaryNode.textContent.trim().length === 0;
          const toggleBlockDepth = $from.depth - 1;
          const toggleBlockPos = $from.before(toggleBlockDepth);
          const toggleBlockEnd = $from.after(toggleBlockDepth);

          if (isSummaryEmpty) {
            // 요약이 비어있으면 토글을 통째로 지우고 일반 문단(paragraph)으로 전환
            return editor
              .chain()
              .focus()
              .insertContentAt({ from: toggleBlockPos, to: toggleBlockEnd }, { type: "paragraph" })
              .run();
          }
        }
        return false;
      },
      "Shift-Enter": () => {
        const { editor } = this;
        const { state } = editor;
        const { $from } = state.selection;
        if ($from.parent.type.name !== this.name) return false;

        const toggleBlockDepth = $from.depth - 1;
        const toggleBlockNode = $from.node(toggleBlockDepth);
        if (toggleBlockNode && toggleBlockNode.attrs.open === false) {
          // 접혀있다면 본문으로 들어가기 전에 자동으로 펼쳐줌
          editor.commands.updateAttributes("toggleBlock", { open: true });
        }

        const afterSummary = $from.after($from.depth);
        return editor.chain().focus().setTextSelection(afterSummary + 1).run();
      },
    };
  },
});

export const ToggleContent = Node.create({
  name: "toggleContent",
  content: "block+",
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-type="toggle-content"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "toggle-content" }), 0];
  },
});

// 화살표 버튼(펼치기/접기) + 실제 내용(NodeViewContent, summary/content 둘 다 이 안에 렌더됨).
// 화살표는 contentEditable=false + onMouseDown preventDefault로, 눌러도 에디터 포커스/선택이
// 흐트러지지 않고 즉시(한 번에) 토글되게 한다.
function ToggleView({ node, updateAttributes }: NodeViewProps) {
  const open = node.attrs.open !== false;
  return (
    <NodeViewWrapper className="pib-toggle" data-open={open ? "true" : "false"}>
      <button
        type="button"
        contentEditable={false}
        className="pib-toggle-arrow"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => updateAttributes({ open: !open })}
        aria-label={open ? "접기" : "펼치기"}
      >
        ▶
      </button>
      <NodeViewContent className="pib-toggle-inner" />
    </NodeViewWrapper>
  );
}

export const ToggleBlock = Node.create({
  name: "toggleBlock",
  group: "block",
  content: "toggleSummary toggleContent",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      open: {
        default: true,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-open") !== "false",
        renderHTML: (attrs: { open: boolean }) => ({ "data-open": attrs.open ? "true" : "false" }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="toggle-block"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "toggle-block" }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ToggleView);
  },

  // "> " 입력 규칙: 커서가 있는 문단을 통째로 toggleBlock으로 바꾸고, 커서를 빈 요약(제목) 줄
  // 안으로 옮겨서 바로 제목을 이어 입력할 수 있게 한다.
  addInputRules() {
    return [
      new InputRule({
        find: /^>\s$/,
        handler: ({ chain, range }) => {
          chain()
            .insertContentAt(range, {
              type: this.name,
              attrs: { open: true },
              content: [
                { type: "toggleSummary", content: [] },
                { type: "toggleContent", content: [{ type: "paragraph" }] },
              ],
            })
            .setTextSelection(range.from + 2)
            .run();
        },
      }),
    ];
  },
});
