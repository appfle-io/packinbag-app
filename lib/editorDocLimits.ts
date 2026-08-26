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
export function getEditorDocFullText(doc: object | string | null | undefined): string {
  if (!doc) return "";
  let parsedDoc: unknown = doc;
  if (typeof doc === "string") {
    try {
      parsedDoc = JSON.parse(doc);
    } catch {
      return "";
    }
  }
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
  walk(parsedDoc);

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

// 이전에는 Firestore가 맵/배열 중첩을 문서당 최대 20단계로 제한해서,
// editorDoc이 객체 트리 그대로 들어갈 때 목록 안의 토글이나 서식으로 인해 깊이 초과 오류가 났었습니다.
// 현재는 Firestore 저장 시 editorDoc을 JSON 문자열로 직렬화(lib/editorDocSerialize.ts)하여
// Firestore 깊이를 항상 1단계로 유지하므로 중첩 깊이로 인한 Firestore 제약이 완전히 해결되었습니다.
export const MAX_EDITOR_DOC_NESTING_DEPTH = 60;

function computeNestingDepth(value: unknown): number {
  if (Array.isArray(value)) {
    if (value.length === 0) return 1;
    let max = 0;
    for (const v of value) {
      const d = computeNestingDepth(v);
      if (d > max) max = d;
    }
    return 1 + max;
  }
  if (value !== null && typeof value === "object") {
    const vals = Object.values(value as Record<string, unknown>);
    if (vals.length === 0) return 1;
    let max = 0;
    for (const v of vals) {
      const d = computeNestingDepth(v);
      if (d > max) max = d;
    }
    return 1 + max;
  }
  return 0;
}

// TipTap 문서 자신의 최대 중첩 깊이를 잰다.
export function getEditorDocNestingDepth(doc: object): number {
  return computeNestingDepth(doc);
}

export function isEditorDocTooDeeplyNested(doc: object): boolean {
  return getEditorDocNestingDepth(doc) > MAX_EDITOR_DOC_NESTING_DEPTH;
}

/**
 * 저장 직전에 호출한다. Firestore 저장은 JSON 문자열 직렬화로 깊이 제한이 해소되었으므로
 * 항상 null(정상)을 반환합니다.
 */
export function checkEditorDocDepthForSave(doc: object): string | null {
  if (isEditorDocTooDeeplyNested(doc)) {
    return "메모 안의 중첩 구조가 너무 깊어요. 일부 항목을 바깥으로 꺼내서 정리해주세요.";
  }
  return null;
}
