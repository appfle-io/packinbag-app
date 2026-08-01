// 짐(Item) 텍스트 부분 서식 편집기(ItemRichTextField)에서 쓰는 최소 TipTap 확장 구성.
// 메모팩(lib/noteEditorExtensions.ts)과 달리 짐 텍스트는 항상 "문단 하나짜리 한 줄"이라,
// 표/제목/목록/링크 같은 무거운 확장은 전부 빼고 굵게/밑줄/취소선 + 실행취소만 남긴다.
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";

export function getItemTextExtensions(placeholder?: string) {
  return [
    StarterKit.configure({
      heading: false,
      blockquote: false,
      bulletList: false,
      orderedList: false,
      listItem: false,
      codeBlock: false,
      horizontalRule: false,
      // Enter로 새 문단이 생기지 않게 한다 - 짐 텍스트는 항상 한 줄이라야 하고,
      // Enter는 ItemRichTextField가 직접 가로채서 저장(커밋)으로 처리한다.
    }),
    Underline,
    ...(placeholder ? [Placeholder.configure({ placeholder })] : []),
  ];
}
