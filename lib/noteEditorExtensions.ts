import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
const CustomTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: (element) => element.style.backgroundColor || element.getAttribute("data-bg-color") || null,
        renderHTML: (attributes) => {
          if (!attributes.backgroundColor) return {};
          return {
            style: `background-color: ${attributes.backgroundColor}`,
          };
        },
      },
      alignment: {
        default: null,
        parseHTML: (element) => element.style.textAlign || element.getAttribute("data-align") || null,
        renderHTML: (attributes) => {
          if (!attributes.alignment) return {};
          return {
            style: `text-align: ${attributes.alignment}`,
          };
        },
      },
    };
  },
});

const CustomTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: (element) => element.style.backgroundColor || element.getAttribute("data-bg-color") || null,
        renderHTML: (attributes) => {
          if (!attributes.backgroundColor) return {};
          return {
            style: `background-color: ${attributes.backgroundColor}`,
          };
        },
      },
      alignment: {
        default: null,
        parseHTML: (element) => element.style.textAlign || element.getAttribute("data-align") || null,
        renderHTML: (attributes) => {
          if (!attributes.alignment) return {};
          return {
            style: `text-align: ${attributes.alignment}`,
          };
        },
      },
    };
  },
});

const CustomTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      density: {
        default: "normal",
        parseHTML: (element) => element.getAttribute("data-density") || "normal",
        renderHTML: (attributes) => {
          if (!attributes.density || attributes.density === "normal") return {};
          return {
            "data-density": attributes.density,
          };
        },
      },
    };
  },
});
import Placeholder from "@tiptap/extension-placeholder";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { FontSize } from "./fontSizeExtension";
import { ToggleBlock, ToggleSummary, ToggleContent } from "./toggleBlockExtension";
import { IndentExtension } from "./indentExtension";
import { ImageAttachment, FileAttachment } from "./noteEditorAttachmentExtensions";

export interface NoteEditorExtensionOptions {
  placeholder?: string;
}

export function getNoteEditorExtensions(options?: string | NoteEditorExtensionOptions) {
  const opts: NoteEditorExtensionOptions =
    typeof options === "string" ? { placeholder: options } : options ?? {};

  return [
    StarterKit.configure({
      // 팩 자체의 이름은 EditableText/SwipeRenameField로 따로 관리하니, 문서 안 헤딩은
      // h1~h3 정도면 충분하다. Strike(취소선)는 StarterKit에 기본 포함되어 있다.
      heading: { levels: [1, 2, 3] },
      // blockquote가 기본으로 "> " 입력을 가로채여 인용구로 바꾸는데, 이 입력을
      // 토글 블록(ToggleBlock, 다음 줄)이 대신 쓰게 하려고 blockquote 자체를 끈다.
      blockquote: false,
    }),
    ToggleBlock,
    ToggleSummary,
    ToggleContent,
    TaskList,
    TaskItem.configure({ nested: true }),
    IndentExtension,
    ImageAttachment,
    FileAttachment,
    CustomTable.configure({ resizable: true, cellMinWidth: 72, handleWidth: 8 }),
    TableRow,
    CustomTableHeader,
    CustomTableCell,
    // Color는 TextStyle 마크 위에 style="color:..."를 얹는 방식이라 TextStyle이 먼저 필요하다.
    // FontSize도 동일하게 TextStyle 위에 style="font-size:..."를 얹는다(lib/fontSizeExtension.ts) -
    // 둘 다 전체 문서가 아니라 지금 선택(또는 커서 위치부터 새로 입력할)한 텍스트에만 적용된다.
    TextStyle,
    Color,
    FontSize,
    Underline,
    // 링크 마크. openOnClick은 false로 둘 - TipTap 기본 동작은 편집 중에도 클릭하면
    // 바로 탐색해버려서 커서를 원하는 위치에 놓기 어려울 수 있음. 대신
    // PackNoteEditorScreen.tsx가 <a> 태그 클릭을 직접 감지해서 열기/해제/짧은 URL로 변경 선택
    // 시트를 띄우거나 바로 openExternalLink()로 연다.
    // autolink: false로 두어 임의 단어(예: v1.2.0, test.me 등) 타이핑 중 원치 않게 링크가 걸리는 것을 막고,
    // URL 붙여넣기(linkOnPaste: true) 시에만 자동으로 링크로 만들어준다.
    Link.configure({
      openOnClick: false,
      autolink: false,
      linkOnPaste: true,
      HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
    }),
    ...(opts.placeholder ? [Placeholder.configure({ placeholder: opts.placeholder })] : []),
  ];
}
