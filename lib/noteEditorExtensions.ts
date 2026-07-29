// 에디터팩(자유문서형 팩)에서 쓰는 TipTap 확장 구성. 읽기전용 렌더(EditorPackCard 미리보기
// 펼침)와 실제 편집 화면(PackNoteEditorScreen) 둘 다 같은 구성을 써야 저장된 문서가 항상
// 동일하게 보인다 - 여기 한 곳에서만 관리한다.
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Placeholder from "@tiptap/extension-placeholder";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { FontSize } from "./fontSizeExtension";
import { ToggleBlock, ToggleSummary, ToggleContent } from "./toggleBlockExtension";

export function getNoteEditorExtensions(placeholder?: string) {
  return [
    StarterKit.configure({
      // 팩 자체의 이름은 EditableText/SwipeRenameField로 따로 관리하니, 문서 안 헤딩은
      // h1~h3 정도면 충분하다. Strike(취소선)는 StarterKit에 기본 포함되어 있다.
      heading: { levels: [1, 2, 3] },
      // blockquote가 기본으로 "> " 입력을 가로채여 인용구로 바꾸는데, 이 입력을
      // 토글 블록(ToggleBlock, 다음 줄)이 대신 쓰게 하려고 blockquote 자체를 끈다.
      // 어차피 툴바에도 인용구 버튼이 없고 스타일도 따로 정의된 적 없다.
      blockquote: false,
    }),
    ToggleBlock,
    ToggleSummary,
    ToggleContent,
    TaskList,
    TaskItem.configure({ nested: true }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    // Color는 TextStyle 마크 위에 style="color:..."를 얹는 방식이라 TextStyle이 먼저 필요하다.
    // FontSize도 동일하게 TextStyle 위에 style="font-size:..."를 얹는다(lib/fontSizeExtension.ts) -
    // 둘 다 전체 문서가 아니라 지금 선택(또는 커서 위치부터 새로 입력할)한 텍스트에만 적용된다.
    TextStyle,
    Color,
    FontSize,
    Underline,
    // 링크 마크. openOnClick은 false로 둘 - TipTap 기본 동작은 편집 중에도 클릭하면
    // 바로 탐색해버려서 커서를 원하는 위치에 놓기 어려울 수 있음. 대신
    // PackNoteEditorScreen.tsx가 <a> 태그 클릭을 직접 감지해서 열기/짧은 URL로 변경 선택
    // 시트를 띄우거나 바로 openExternalLink()로 연다. autolink/linkOnPaste는 켜둘 -
    // 타이핑이나 URL 붙여넣기는 TipTap이 자동으로 링크로 만들어준다(축약은 붙여넣기
    // 시점이 아니라 링크를 탭했을 때 사용자가 직접 선택해야만 일어난다).
    Link.configure({
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
    }),
    ...(placeholder ? [Placeholder.configure({ placeholder })] : []),
  ];
}
