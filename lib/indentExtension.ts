"use client";

import { Extension } from "@tiptap/core";

export const IndentExtension = Extension.create({
  name: "indentExtension",

  addKeyboardShortcuts() {
    return {
      Tab: ({ editor }) => {
        // 1. 일반 불릿/순서 목록 (bulletList, orderedList)
        if (editor.can().sinkListItem("listItem")) {
          return editor.commands.sinkListItem("listItem");
        }
        // 2. 체크박스 목록 (taskList / taskItem)
        if (editor.can().sinkListItem("taskItem")) {
          return editor.commands.sinkListItem("taskItem");
        }
        // 3. 일반 문단 / 토글 / 기타 노드: 4칸 공백 들여쓰기 삽입
        return editor.commands.insertContent("    ");
      },

      "Shift-Tab": ({ editor }) => {
        // 1. 일반 불릿/순서 목록 내어쓰기
        if (editor.can().liftListItem("listItem")) {
          return editor.commands.liftListItem("listItem");
        }
        // 2. 체크박스 목록 내어쓰기
        if (editor.can().liftListItem("taskItem")) {
          return editor.commands.liftListItem("taskItem");
        }
        // 3. 일반 문단 / 텍스트: 앞쪽 4칸 공백 / 탭 제거 (Outdent)
        const { state } = editor;
        const { $from } = state.selection;
        const lineText = $from.parent.textContent;
        if (lineText.startsWith("    ")) {
          const startPos = $from.start();
          return editor
            .chain()
            .focus()
            .deleteRange({ from: startPos, to: startPos + 4 })
            .run();
        } else if (lineText.startsWith("\t")) {
          const startPos = $from.start();
          return editor
            .chain()
            .focus()
            .deleteRange({ from: startPos, to: startPos + 1 })
            .run();
        }
        return false;
      },
    };
  },
});
