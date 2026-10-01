"use client";

import type { Editor } from "@tiptap/react";
import { IconTrash } from "@tabler/icons-react";
import { useToast } from "@/components/Toast";
import {
  adjustColumnWidth,
  cycleTableDensity,
  distributeColumnWidths,
  resetColumnWidths,
  setCellBackgroundColor,
  setCellTextAlignment,
} from "@/lib/noteEditorTableUtils";
import { ListRow, SectionHeader, Sheet, cx } from "@/components/v2/ui";

// 표 메뉴: 툴바 한 줄에 못 넣은 표 조작(너비 · 행 간격 · 병합/분할 · 정렬 · 셀 색 · 표 삭제).
// 로직은 구 편집기와 같은 lib/noteEditorTableUtils를 그대로 쓴다.
const CELL_COLORS: { label: string; color: string | null }[] = [
  { label: "색 없음", color: null },
  { label: "노랑", color: "#fef9c3" },
  { label: "초록", color: "#dcfce7" },
  { label: "파랑", color: "#e0f2fe" },
  { label: "분홍", color: "#fce7f3" },
  { label: "보라", color: "#f3e8ff" },
  { label: "주황", color: "#ffedd5" },
  { label: "회색", color: "#f3f4f6" },
];

function Pill({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex h-11 flex-1 items-center justify-center rounded-field bg-fill text-caption font-semibold text-ink active:bg-line"
    >
      {children}
    </button>
  );
}

export function NoteTableSheet({
  open,
  onClose,
  editor,
  onDeleteTable,
}: {
  open: boolean;
  onClose: () => void;
  editor: Editor | null;
  // 부모가 확인 시트를 띄운다
  onDeleteTable: () => void;
}) {
  const { show } = useToast();
  const ed = editor;

  return (
    <Sheet open={open} onClose={onClose} title="표">
      {ed && (
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <SectionHeader>열 너비</SectionHeader>
            <div className="flex gap-2">
              <Pill label="지금 열 좁게" onClick={() => adjustColumnWidth(ed, -20) && show("열을 좁혔어요")}>
                좁게
              </Pill>
              <Pill label="지금 열 넓게" onClick={() => adjustColumnWidth(ed, 20) && show("열을 넓혔어요")}>
                넓게
              </Pill>
              <Pill label="모든 열 같게" onClick={() => distributeColumnWidths(ed) && show("열 너비를 똑같이 맞췄어요")}>
                같게
              </Pill>
              <Pill label="내용에 맞게" onClick={() => resetColumnWidths(ed) && show("열 너비를 내용에 맞췄어요")}>
                자동
              </Pill>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeader>칸</SectionHeader>
            <div className="flex gap-2">
              <Pill
                label="행 간격 바꾸기"
                onClick={() => {
                  const next = cycleTableDensity(ed);
                  show(`행 간격: ${next === "compact" ? "좁게" : next === "spacious" ? "넓게" : "보통"}`);
                }}
              >
                행 간격
              </Pill>
              <Pill label="고른 칸 합치기" onClick={() => ed.chain().focus().mergeCells().run()}>
                합치기
              </Pill>
              <Pill label="합친 칸 나누기" onClick={() => ed.chain().focus().splitCell().run()}>
                나누기
              </Pill>
            </div>
            <div className="flex gap-2">
              <Pill label="왼쪽 정렬" onClick={() => setCellTextAlignment(ed, "left")}>
                왼쪽
              </Pill>
              <Pill label="가운데 정렬" onClick={() => setCellTextAlignment(ed, "center")}>
                가운데
              </Pill>
              <Pill label="오른쪽 정렬" onClick={() => setCellTextAlignment(ed, "right")}>
                오른쪽
              </Pill>
            </div>
            <div className="flex gap-2">
              <Pill label="위에 행 추가" onClick={() => ed.chain().focus().addRowBefore().run()}>
                위에 행
              </Pill>
              <Pill label="왼쪽에 열 추가" onClick={() => ed.chain().focus().addColumnBefore().run()}>
                왼쪽에 열
              </Pill>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeader>칸 색</SectionHeader>
            <div className="flex flex-wrap gap-3">
              {CELL_COLORS.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  aria-label={c.label}
                  title={c.label}
                  onClick={() => setCellBackgroundColor(ed, c.color)}
                  className={cx(
                    "inline-flex size-10 items-center justify-center rounded-full border border-line-strong text-micro text-sub",
                    !c.color && "bg-card",
                  )}
                  // 칸 색 견본은 색마다 다르다
                  style={c.color ? { backgroundColor: c.color } : undefined}
                >
                  {!c.color && "없음"}
                </button>
              ))}
            </div>
          </section>

          <ListRow
            divider={false}
            leading={<IconTrash size={20} stroke={1.75} className="text-alert" aria-hidden="true" />}
            title={<span className="text-alert">표 삭제</span>}
            onClick={onDeleteTable}
          />
        </div>
      )}
    </Sheet>
  );
}
