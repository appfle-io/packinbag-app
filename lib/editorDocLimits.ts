// 에디터팩(자유문서형 팩)의 editorDoc(TipTap JSON) 크기 방어.
// Firestore 문서 하나는 1MB(=1,048,576바이트)를 넘을 수 없고, 가방/팩 문서에는 이 팩
// 말고도 다른 팩/짐/메타데이터가 함께 들어있으므로 여유를 크게 두고 제한한다.
// 표를 크게 만들거나 메모가 아주 길어지는 극단적인 경우를 막기 위한 방어선이지,
// 정상적인 사용에서는 걸릴 일이 거의 없다.
export const MAX_EDITOR_DOC_BYTES = 300 * 1024; // 300KB

// 팩 보관함 타일/가방 속 카드 미리보기에 보여줄 텍스트 길이 상한.
export const MAX_EDITOR_PREVIEW_CHARS = 120;

export function getEditorDocByteSize(doc: object): number {
  try {
    // Blob이 없는 환경(SSR) 대비 TextEncoder로 UTF-8 바이트 길이를 잰다.
    return new TextEncoder().encode(JSON.stringify(doc)).length;
  } catch {
    return 0;
  }
}

export function isEditorDocTooLarge(doc: object): boolean {
  return getEditorDocByteSize(doc) > MAX_EDITOR_DOC_BYTES;
}

// TipTap JSON 문서에서 화면 미리보기용 plain text를 뽑아낸다. 노드를 얕게 순회하면서
// text 노드만 이어붙이고, 문단/제목/표 행이 바뀔 때마다 공백으로 구분한다.
// 표 셀 안까지 재귀적으로 들어가므로 표 내용도 미리보기에 섞여 나온다.
export function extractPlainTextPreview(doc: object, maxChars = MAX_EDITOR_PREVIEW_CHARS): string {
  const parts: string[] = [];

  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as { type?: string; text?: string; content?: unknown[] };
    if (typeof n.text === "string" && n.text) parts.push(n.text);
    if (Array.isArray(n.content)) {
      n.content.forEach(walk);
      // 블록 단위(문단/제목/표 행 등)가 끝날 때마다 구분자를 넣어 단어가 붙어보이지 않게 한다.
      if (n.type && n.type !== "text") parts.push(" ");
    }
  };
  walk(doc);

  const joined = parts.join("").replace(/\s+/g, " ").trim();
  if (joined.length <= maxChars) return joined;
  return joined.slice(0, maxChars).trimEnd() + "…";
}

/**
 * 저장 직전에 호출한다. 문서가 너무 크면 저장을 막고 이유를 문자열로 돌려준다
 * (null이면 정상 - 그대로 저장 진행).
 */
export function checkEditorDocSizeForSave(doc: object): string | null {
  if (isEditorDocTooLarge(doc)) {
    const kb = Math.round(getEditorDocByteSize(doc) / 1024);
    const maxKb = Math.round(MAX_EDITOR_DOC_BYTES / 1024);
    return `메모 용량이 너무 커요 (${kb}KB / 최대 ${maxKb}KB). 표나 텍스트를 조금 줄이고 다시 저장해주세요.`;
  }
  return null;
}
