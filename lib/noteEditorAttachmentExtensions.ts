import { Node, mergeAttributes } from "@tiptap/core";

export interface ImageAttachmentOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    imageAttachment: {
      setImageAttachment: (options: { src: string; alt?: string; title?: string }) => ReturnType;
    };
    fileAttachment: {
      setFileAttachment: (options: {
        src: string;
        fileName: string;
        fileKind?: string;
        fileExtension?: string;
      }) => ReturnType;
    };
  }
}

export const ImageAttachment = Node.create<ImageAttachmentOptions>({
  name: "imageAttachment",
  group: "block",
  inline: false,
  draggable: true,
  atom: true,
  selectable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (element) =>
          element.getAttribute("src") ||
          element.querySelector("img")?.getAttribute("src") ||
          element.getAttribute("data-image-src"),
      },
      alt: {
        default: "첨부 이미지",
        parseHTML: (element) =>
          element.getAttribute("alt") ||
          element.querySelector("img")?.getAttribute("alt") ||
          "첨부 이미지",
      },
      title: {
        default: null,
        parseHTML: (element) =>
          element.getAttribute("title") ||
          element.querySelector("img")?.getAttribute("title"),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-type=\"image-attachment\"]",
      },
      {
        tag: "img[src]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const src = (HTMLAttributes.src as string) || "";
    const alt = (HTMLAttributes.alt as string) || "첨부 이미지";

    return [
      "div",
      mergeAttributes(this.options.HTMLAttributes, {
        class: "pib-editor-image-wrapper my-2.5 flex flex-col items-start",
        "data-type": "image-attachment",
      }),
      [
        "img",
        {
          src,
          alt,
          class:
            "pib-editor-image max-w-full md:max-w-lg max-h-[380px] object-contain rounded-lg border border-border bg-surface-2 shadow-xs cursor-pointer hover:opacity-95 transition-opacity select-none",
          loading: "lazy",
          "data-image-src": src,
        },
      ],
    ];
  },

  addCommands() {
    return {
      setImageAttachment:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    };
  },
});

export const FileAttachment = Node.create({
  name: "fileAttachment",
  group: "block",
  inline: false,
  draggable: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (element) =>
          element.getAttribute("data-file-src") ||
          element.querySelector("[data-file-src]")?.getAttribute("data-file-src"),
      },
      fileName: {
        default: "첨부 파일",
        parseHTML: (element) =>
          element.getAttribute("data-file-name") || "첨부 파일",
      },
      fileKind: {
        default: "file",
        parseHTML: (element) =>
          element.getAttribute("data-file-kind") || "file",
      },
      fileExtension: {
        default: "FILE",
        parseHTML: (element) =>
          element.getAttribute("data-file-extension") || "FILE",
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-type=\"file-attachment\"]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const src = (HTMLAttributes.src as string) || "";
    const fileName = (HTMLAttributes.fileName as string) || "첨부 파일";
    const fileKind = (HTMLAttributes.fileKind as string) || "file";
    const fileExtension = (HTMLAttributes.fileExtension as string) || "FILE";

    return [
      "div",
      {
        class: "pib-editor-file-wrapper my-2.5 max-w-md",
        "data-type": "file-attachment",
        "data-file-src": src,
        "data-file-name": fileName,
        "data-file-kind": fileKind,
        "data-file-extension": fileExtension,
      },
      [
        "div",
        {
          class:
            "pib-editor-file-card flex items-center justify-between gap-3 p-2.5 px-3 rounded-lg border border-border bg-surface hover:bg-surface-2 transition-colors cursor-pointer shadow-2xs group select-none",
          "data-file-src": src,
          "data-file-name": fileName,
          "data-file-kind": fileKind,
        },
        [
          "div",
          { class: "flex items-center gap-2.5 min-w-0 flex-1 pointer-events-none" },
          [
            "div",
            {
              class:
                "w-8 h-8 rounded-md bg-accent-soft text-accent flex items-center justify-center shrink-0 font-mono text-[10.5px] font-bold",
            },
            fileExtension,
          ],
          [
            "div",
            { class: "min-w-0 flex-1" },
            [
              "span",
              {
                class:
                  "text-[13px] font-medium text-foreground truncate block group-hover:text-accent transition-colors",
              },
              fileName,
            ],
            [
              "span",
              { class: "text-[10.5px] text-text-muted uppercase block mt-0.5" },
              fileKind === "pdf" ? "PDF 문서 (탭하여 미리보기)" : "첨부 파일 (탭하여 열기)",
            ],
          ],
        ],
      ],
    ];
  },

  addCommands() {
    return {
      setFileAttachment:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    };
  },
});
