// 짐(Item) 텍스트의 "부분 서식"(RichSpan[])과 TipTap(ProseMirror) JSON 문서를 서로
// 변환하는 유틸리티. 짐 텍스트는 항상 문단 하나짜리 한 줄 문서로 취급한다(Enter는
// 줄바꿈이 아니라 저장/커밋으로 처리 - components/ItemRichTextField.tsx 참고).
//
// 왜 필요한가: lib/types.ts의 Item.spans(RichSpan[])는 예전부터 선언만 되어있고
// 실제로는 쓰이지 않았다(전체 텍스트에 적용되는 bold/strike/color 필드를 대신 써왔음).
// 이제 짐 텍스트 일부만 굵게/밑줄/취소선을 줄 수 있게 하면서 이 필드를 실제로 채운다.
import { Item, RichSpan } from "@/lib/types";

// spans 배열을 이어붙인 순수 텍스트(검색/링크화/복사 등 text 필드가 필요한 모든 곳에서 사용).
export function spansToPlainText(spans: RichSpan[]): string {
  return spans.map((s) => s.text).join("");
}

// TipTap 에디터의 getJSON() 결과(문단 하나) -> RichSpan[].
// 빈 문단(글자를 다 지운 경우)이면 빈 배열을 돌려준다.
export function tiptapDocToSpans(doc: unknown): RichSpan[] {
  const content = (doc as { content?: { content?: unknown[] }[] })?.content?.[0]?.content ?? [];
  const spans: RichSpan[] = [];
  for (const node of content as { type?: string; text?: string; marks?: { type?: string }[] }[]) {
    if (node.type !== "text" || !node.text) continue;
    const marks = node.marks ?? [];
    const bold = marks.some((m) => m.type === "bold") || undefined;
    const underline = marks.some((m) => m.type === "underline") || undefined;
    const strike = marks.some((m) => m.type === "strike") || undefined;
    spans.push({ text: node.text, bold, underline, strike });
  }
  return spans;
}

// RichSpan[] -> TipTap 문서(JSON). 빈 배열이면 빈 문단.
export function spansToTiptapDoc(spans: RichSpan[]): object {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: spans
          .filter((s) => s.text.length > 0)
          .map((s) => ({
            type: "text",
            text: s.text,
            ...(s.bold || s.underline || s.strike
              ? {
                  marks: [
                    s.bold && { type: "bold" },
                    s.underline && { type: "underline" },
                    s.strike && { type: "strike" },
                  ].filter(Boolean),
                }
              : {}),
          })),
      },
    ],
  };
}

// 짐 하나에서 렌더링/편집용 spans를 얻는다. 실제 spans가 있으면 그대로 쓰고, 없으면
// (예전 데이터, 또는 부분 서식 없이 통째로 저장된 짐) 기존 bold/strike/color 필드를
// 전체 텍스트 스팬 하나로 감싸서 돌려준다 - 렌더링/편집 쪽에서 "spans 유무"를 따로
// 신경 쓰지 않고 항상 이 함수만 쓰면 되게 하기 위함.
export function getItemSpans(
  item: Pick<Item, "text" | "spans" | "bold" | "strike">
): RichSpan[] {
  if (item.spans && item.spans.length > 0) return item.spans;
  if (!item.text) return [];
  return [{ text: item.text, bold: item.bold || undefined, strike: item.strike || undefined }];
}
