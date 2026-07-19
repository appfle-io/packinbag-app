// 에디터팩(자유문서형 팩)의 editorDoc(TipTap JSON) 크기 방어.
// Firestore 문서 하나는 1MB(=1,048,576바이트)를 넘을 수 없고, 가방/팩 문서에는 이 팩
// 말고도 다른 팩/짐/메타데이터가 함께 들어있으므로 여유를 크게 두고 제한한다.
// 표를 크게 만들거나 메모가 아주 길어지는 극단적인 경우를 막기 위한 방어선이지,
// 정상적인 사용에서는 걸릴 일이 거의 없다.
export const MAX_EDITOR_DOC_BYTES = 300 * 1024; // 300KB

// 가방 문서 전체(팩 여러 개 + 짐 + 메타데이터) 크기 방어. 메모팩 하나하나는 300KB 제한이
// 있어도, 가방 하나에 메모팩을 여러 개(최대 10개) 넣으면 합산이 Firestore 문서 1MB 한도에
// 가까워질 수 있다. 여유를 두고 900KB로 제한해서, 그 이상이면 저장 자체를 막는다.
export const MAX_BAG_DOC_BYTES = 900 * 1024; // 900KB

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

// 가방 등 임의의 JSON 직렬화 가능한 값의 바이트 크기. getEditorDocByteSize와 로직은
// 같지만 이름을 범용적으로 둬서 다른 곳(가방 전체 크기 검사 등)에서도 자연스럽게 쓴다.
export function getJsonByteSize(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  } catch {
    return 0;
  }
}

export function isEditorDocTooLarge(doc: object): boolean {
  return getEditorDocByteSize(doc) > MAX_EDITOR_DOC_BYTES;
}

// TipTap JSON 문서의 모든 text 노드를 순서대로 이어붙인 전체 텍스트(잘림 없음). 검색처럼
// "본문 전체에 이 단어가 있는지" 확인해야 하는 용도로 쓴다 - 미리보기용 짧은 버전은
// extractPlainTextPreview를 쓴다(둘 다 이 함수를 공유한다).
export function getEditorDocFullText(doc: object): string {
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

  return parts.join("").replace(/\s+/g, " ").trim();
}

// TipTap JSON 문서에서 화면 미리보기용 plain text를 뽑아낸다(길면 잘라서 "…" 붙임).
export function extractPlainTextPreview(doc: object, maxChars = MAX_EDITOR_PREVIEW_CHARS): string {
  const joined = getEditorDocFullText(doc);
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

/**
 * 메모팩을 저장하기 직전, 그 팩이 속한 가방 전체(예상되는 다음 상태)가 너무 커지지
 * 않는지 확인한다. 너무 크면 저장을 막고 이유를 문자열로 돌려준다(null이면 정상).
 */
export function checkBagSizeForSave(projectedBag: object): string | null {
  const bytes = getJsonByteSize(projectedBag);
  if (bytes > MAX_BAG_DOC_BYTES) {
    const kb = Math.round(bytes / 1024);
    const maxKb = Math.round(MAX_BAG_DOC_BYTES / 1024);
    return `가방 전체 용량이 너무 커요 (${kb}KB / 최대 ${maxKb}KB). 다른 메모나 팩을 줄이고 다시 시도해주세요.`;
  }
  return null;
}
