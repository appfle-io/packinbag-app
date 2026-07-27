import type { Editor } from "@tiptap/react";

// TipTap 문서(ProseMirror) 안에서 정확히 일치하는 텍스트(longUrl)를 찾아 새 텍스트
// (shortUrl)로 바꾸고 link 마크를 입혀준다. 에디터팩에 붙여넣은 긴 URL을 비동기로
// 축약한 뒤(app/api/shorten-url 응답을 받은 시점) 그 자리를 대체하는 데 쓴다.
// 문서 전체를 순회하며 첫 번째로 일치하는 텍스트 노드만 바꾼다 - 같은 URL을 여러 번
// 붙여넣는 경우는 흔치 않아서 첫 매치만 처리해도 충분하다.
export function replaceLinkTextInEditor(editor: Editor | null, longUrl: string, shortUrl: string) {
  if (!editor) return;
  const { state, view } = editor;

  let match: { from: number; to: number } | null = null;
  state.doc.descendants((node, pos) => {
    if (match) return false;
    if (!node.isText || !node.text) return undefined;
    const idx = node.text.indexOf(longUrl);
    if (idx !== -1) {
      match = { from: pos + idx, to: pos + idx + longUrl.length };
      return false;
    }
    return undefined;
  });

  if (!match) return;
  const linkMarkType = state.schema.marks.link;
  if (!linkMarkType) return;

  const { from, to } = match;
  const linkMark = linkMarkType.create({ href: shortUrl });
  const tr = state.tr
    .insertText(shortUrl, from, to)
    .addMark(from, from + shortUrl.length, linkMark);
  view.dispatch(tr);
}
