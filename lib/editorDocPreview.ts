// 메모팩(에디터팩)의 TipTap JSON(pack.editorDoc)을 "서식 없는 순수 텍스트 + 링크만" 미리보기로
// 바꾸는 유틸. 팩뷰(EditorPackCard)가 무거운 TipTap 읽기전용 인스턴스를 카드마다 mount하는 대신
// 이 함수로 가볍게 미리보기 줄을 뽑아 쓴다 (2026-08, 팩뷰 표시 단순화).
//
// 제목/표/체크박스/토글 등 모든 서식은 무시하고 텍스트만 이어붙이되, 링크 마크(mark)가 있는
// 텍스트만 살려서 클릭 가능한 링크로 렌더링할 수 있게 { text, href } 형태로 돌려준다.
// 블록 경계(문단/제목/리스트아이템/표 셀/토글요약 등)를 만나면 한 줄을 끊는다 - 정확한 줄바꿈
// 규칙을 재현하는 게 목적이 아니라(어차피 "단순화"가 목표), 대략 원본 문단 단위로만 나뉘면 충분하다.

export interface PreviewSpan {
  text: string;
  href?: string;
}

interface DocNode {
  type?: string;
  text?: string;
  marks?: { type?: string; attrs?: { href?: string } }[];
  content?: DocNode[];
}

// 이 타입을 만나면 지금까지 모은 스팬을 한 줄로 끊는다(문단/제목/리스트아이템/표 셀/
// 토글 요약 등 - "한 줄짜리 블록"으로 취급할 수 있는 노드 타입들).
const LINE_BREAK_TYPES = new Set([
  "paragraph",
  "heading",
  "listItem",
  "taskItem",
  "tableCell",
  "tableHeader",
  "toggleSummary",
  "codeBlock",
]);

export function collectEditorDocPreviewLines(doc: unknown): PreviewSpan[][] {
  const lines: PreviewSpan[][] = [];
  let current: PreviewSpan[] = [];

  const flushLine = () => {
    if (current.length > 0) {
      lines.push(current);
      current = [];
    }
  };

  const walk = (node: DocNode | undefined) => {
    if (!node) return;
    if (node.type === "text") {
      const linkMark = node.marks?.find((m) => m?.type === "link");
      const text = node.text ?? "";
      if (text) current.push({ text, href: linkMark?.attrs?.href });
      return;
    }
    if (node.type === "hardBreak") {
      flushLine();
      return;
    }
    const children = node.content ?? [];
    for (const child of children) walk(child);
    if (node.type && LINE_BREAK_TYPES.has(node.type)) flushLine();
  };

  const root = doc as DocNode | undefined;
  for (const block of root?.content ?? []) {
    walk(block);
    flushLine();
  }

  // 완전히 빈 줄(공백만 있던 문단 등)은 제외 - 미리보기에서 의미 없는 여백만 차지한다.
  return lines.filter((line) => line.some((span) => span.text.trim().length > 0));
}
