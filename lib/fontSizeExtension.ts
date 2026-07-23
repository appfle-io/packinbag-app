// 메모팩(에디터팩) 툴바의 "글자 크기" -/+ 버튼용 TipTap 확장.
// 글씨 색상(Color 확장)과 동일한 방식으로 textStyle 마크 위에 fontSize 속성을 얹어서
// style="font-size: 14px" 형태로 렌더한다 - 그래서 전체 문서가 아니라 지금 선택한
// 텍스트(또는 커서 위치부터 새로 입력할 텍스트)에만 적용된다. 제목(H1/H2)은 이 마크와
// 무관하게 app/globals.css의 고정 px 스타일을 그대로 따른다.
import { Extension } from "@tiptap/core";
import "@tiptap/extension-text-style";

export interface FontSizeOptions {
  types: string[];
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}

export const FontSize = Extension.create<FontSizeOptions>({
  name: "fontSize",

  addOptions() {
    return {
      types: ["textStyle"],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }) => {
          return chain().setMark("textStyle", { fontSize }).run();
        },
      unsetFontSize:
        () =>
        ({ chain }) => {
          return chain().setMark("textStyle", { fontSize: null }).run();
        },
    };
  },
});
