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

export function getNoteEditorExtensions(placeholder?: string) {
  return [
    StarterKit.configure({
      // 팩 자체의 이름은 EditableText/SwipeRenameField로 따로 관리하니, 문서 안 헤딩은
      // h1~h3 정도면 충분하다. Strike(취소선)는 StarterKit에 기본 포함되어 있다.
      heading: { levels: [1, 2, 3] },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    // Color는 TextStyle 마크 위에 style="color:..."를 얹는 방식이라 TextStyle이 먼저 필요하다.
    TextStyle,
    Color,
    Underline,
    ...(placeholder ? [Placeholder.configure({ placeholder })] : []),
  ];
}
