"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import {
  IconArrowLeft,
  IconBold,
  IconItalic,
  IconUnderline,
  IconStrikethrough,
  IconH1,
  IconH2,
  IconListCheck,
  IconTable,
  IconTablePlus,
  IconTrash,
  IconAlertTriangle,
  IconPalette,
  IconX,
  IconUsers,
} from "@tabler/icons-react";
import { Pack } from "@/lib/types";
import { getNoteEditorExtensions } from "@/lib/noteEditorExtensions";
import { PACK_COLORS } from "@/lib/packColors";
import {
  MAX_EDITOR_DOC_BYTES,
  checkEditorDocSizeForSave,
  extractPlainTextPreview,
  getEditorDocByteSize,
} from "@/lib/editorDocLimits";
import EditableText from "@/components/EditableText";
import ConfirmDialog from "@/components/ConfirmDialog";
import Portal from "@/components/Portal";
import { useSwipeBack } from "@/lib/useSwipeBack";

const AUTOSAVE_DEBOUNCE_MS = 600;

// 아이폰 메모처럼 자유롭게 제목/체크박스/표를 섞어 쓰는 "에디터팩" 전체화면 편집기.
// 노션 페이지처럼 팩을 탭하면 이 화면으로 진입한다(팩 보관함/가방 속 EditorPackCard 둘 다
// 동일 화면을 재사용 - onSave로 어디에 반영할지만 다르게 넘겨받는다).
export default function PackNoteEditorScreen({
  pack,
  readOnly,
  otherEditorNickname,
  onBack,
  onSave,
  onDeletePack,
}: {
  pack: Pack;
  readOnly?: boolean;
  // 지금 다른 사람이 같은 가방에서 이 팩을 편집 중이면 그 사람 닉네임(없거나 null이면 다른
  // 편집자 없음). 가방 속에서만 의미가 있어서(라이브러리 단독 편집은 공유되지 않으므로)
  // BagEditorScreen에서만 넘겨준다.
  otherEditorNickname?: string | null;
  onBack: () => void;
  onSave: (pack: Pack) => void;
  // 있으면 헤더에 삭제 버튼을 보여준다(팩 보관함에서 열었을 때만 - 가방 속에서는 카드
  // 자체의 삭제 버튼을 쓰므로 넘기지 않는다).
  onDeletePack?: () => void;
}) {
  const swipeBackRef = useSwipeBack<HTMLDivElement>(onBack);
  const [name, setName] = useState(pack.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  // 다른 사람이 같은 메모를 편집 중이라는 배지를 보고 내가 직접 읽기전용으로 전환했는지.
  // 덮어쓰는 사고를 막기 위해 사용자가 직접 선택하는 것이지, 강제로 막지는 않는다.
  const [viewOnlyOverride, setViewOnlyOverride] = useState(false);
  const effectiveReadOnly = !!readOnly || viewOnlyOverride;
  // 문서가 너무 커져서 지금 상태로는 저장이 막혔는지. true인 동안은 자동저장을 건너뛰고
  // 배너로 알려서, 사용자가 내용을 줄여야 한다는 걸 바로 알 수 있게 한다(타이핑한 내용
  // 자체는 화면에 그대로 남아있어 잃어버리지 않는다).
  const [sizeBlocked, setSizeBlocked] = useState(false);

  const packRef = useRef(pack);
  const nameRef = useRef(name);
  useEffect(() => {
    nameRef.current = name;
  }, [name]);

  const editor = useEditor({
    extensions: getNoteEditorExtensions("메모를 입력해보세요"),
    content: pack.editorDoc ?? "",
    editable: !effectiveReadOnly,
    immediatelyRender: false,
  });

  // readOnly는 고정값이지만 viewOnlyOverride는 화면을 열어둔 채 바뀌는 값이라(같은 편집자
  // 배지를 보고 직접 읽기전용으로 전환하는 경우), useEditor 생성 시점의 editable 값만으로는
  // 반영되지 않아서 editor.setEditable로 직접 동기화한다.
  useEffect(() => {
    editor?.setEditable(!effectiveReadOnly);
  }, [editor, effectiveReadOnly]);

  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipFirstRef = useRef(true);

  const commitSave = (docOverride?: object) => {
    const doc = docOverride ?? editor?.getJSON();
    if (!doc) return;
    const sizeError = checkEditorDocSizeForSave(doc);
    if (sizeError) {
      setSizeBlocked(true);
      return;
    }
    setSizeBlocked(false);
    const updated: Pack = {
      ...packRef.current,
      name: nameRef.current,
      editorDoc: doc,
      editorPreviewText: extractPlainTextPreview(doc),
      updatedAt: new Date().toISOString(),
    };
    packRef.current = updated;
    onSave(updated);
  };

  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      if (effectiveReadOnly) return;
      if (skipFirstRef.current) {
        skipFirstRef.current = false;
        return;
      }
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = setTimeout(() => {
        commitSave(editor.getJSON());
      }, AUTOSAVE_DEBOUNCE_MS);
    };
    editor.on("update", handler);
    return () => {
      editor.off("update", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, effectiveReadOnly]);

  // 이름을 바꾸면(EditableText, 탭하면 바로 편집) 바로 저장한다 - 문서 자체는 안 건드리므로 사이즈
  // 걱정 없이 즉시 반영.
  const handleRenamePack = (nextName: string) => {
    setName(nextName);
    nameRef.current = nextName;
    if (effectiveReadOnly) return;
    commitSave(editor?.getJSON());
  };

  // 화면을 나갈 때 디바운스 대기 중인 변경이 있으면 그 즉시 반영한다. viewOnlyOverride가 마운트
  // 이후에도 바뀌는 값이라 effectiveReadOnly를 ref로도 따로 추적해서(이 effect의 클로저가
  // 마운트 시점의 값을 고정해서 들고 있는 문제를 피한다).
  const effectiveReadOnlyRef = useRef(effectiveReadOnly);
  useEffect(() => {
    effectiveReadOnlyRef.current = effectiveReadOnly;
  }, [effectiveReadOnly]);

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        if (!effectiveReadOnlyRef.current) commitSave();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bytes = editor ? getEditorDocByteSize(editor.getJSON()) : 0;
  const percentOfLimit = Math.min(100, Math.round((bytes / MAX_EDITOR_DOC_BYTES) * 100));

  const ToolbarButton = ({
    onClick,
    active,
    label,
    children,
  }: {
    onClick: () => void;
    active?: boolean;
    label: string;
    children: React.ReactNode;
  }) => (
    <button
      onClick={onClick}
      aria-label={label}
      disabled={effectiveReadOnly}
      className="rounded-lg p-2 disabled:opacity-30"
      style={{ background: active ? "var(--accent-soft)" : "transparent" }}
    >
      {children}
    </button>
  );

  return (
    <div ref={swipeBackRef} className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 p-4 pb-2 shrink-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button onClick={onBack} aria-label="뒤로가기" className="-m-2.5 p-2.5 shrink-0">
            <IconArrowLeft size={22} stroke={1.75} />
          </button>
          <EditableText
            value={name}
            onChange={handleRenamePack}
            readOnly={effectiveReadOnly}
            placeholder="새 메모"
            className="text-[17px] font-medium truncate text-left min-w-0 flex-1"
            inputClassName="text-[17px] font-medium min-w-0 flex-1"
          />
        </div>
        {onDeletePack && !effectiveReadOnly && (
          <button onClick={() => setConfirmDelete(true)} aria-label="팩 삭제" className="-m-2.5 p-2.5 shrink-0">
            <IconTrash size={19} stroke={1.75} color="var(--danger)" />
          </button>
        )}
      </div>

      {otherEditorNickname && !viewOnlyOverride && (
        <div
          className="mx-4 mb-2 flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-[12px] shrink-0"
          style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
        >
          <span className="flex items-center gap-1.5">
            <IconUsers size={14} stroke={1.75} className="shrink-0" />
            {otherEditorNickname}님이 지금 이 메모를 편집 중이에요
          </span>
          <button
            onClick={() => setViewOnlyOverride(true)}
            className="shrink-0 font-medium underline underline-offset-2"
          >
            읽기전용으로 보기
          </button>
        </div>
      )}

      {viewOnlyOverride && !readOnly && (
        <div
          className="mx-4 mb-2 flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-[12px] shrink-0"
          style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
        >
          <span>지금 읽기전용으로 보고 있어요</span>
          <button
            onClick={() => setViewOnlyOverride(false)}
            className="shrink-0 font-medium underline underline-offset-2"
            style={{ color: "var(--accent)" }}
          >
            다시 편집하기
          </button>
        </div>
      )}

      {sizeBlocked && (
        <div
          className="mx-4 mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] shrink-0"
          style={{ background: "var(--danger-soft, #fee2e2)", color: "var(--danger)" }}
        >
          <IconAlertTriangle size={15} stroke={1.75} className="shrink-0" />
          메모 용량이 너무 커서 지금 상태는 저장되지 않고 있어요. 표나 텍스트를 좀 줄여주세요.
        </div>
      )}

      {!effectiveReadOnly && (
        <div className="flex items-center gap-1 px-3 pb-2 shrink-0 overflow-x-auto no-scrollbar border-b border-border">
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleBold().run()}
            active={editor?.isActive("bold")}
            label="굵게"
          >
            <IconBold size={17} stroke={1.75} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            active={editor?.isActive("italic")}
            label="기울임"
          >
            <IconItalic size={17} stroke={1.75} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
            active={editor?.isActive("underline")}
            label="밑줄"
          >
            <IconUnderline size={17} stroke={1.75} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleStrike().run()}
            active={editor?.isActive("strike")}
            label="취소선"
          >
            <IconStrikethrough size={17} stroke={1.75} />
          </ToolbarButton>
          <div className="relative">
            <ToolbarButton
              onClick={() => setShowColorPicker((v) => !v)}
              active={showColorPicker || editor?.isActive("textStyle")}
              label="글씨 색상"
            >
              <IconPalette size={17} stroke={1.75} />
            </ToolbarButton>
          </div>
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
            active={editor?.isActive("heading", { level: 1 })}
            label="제목 1"
          >
            <IconH1 size={17} stroke={1.75} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor?.isActive("heading", { level: 2 })}
            label="제목 2"
          >
            <IconH2 size={17} stroke={1.75} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleTaskList().run()}
            active={editor?.isActive("taskList")}
            label="체크박스"
          >
            <IconListCheck size={17} stroke={1.75} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() =>
              editor
                ?.chain()
                .focus()
                .insertTable({ rows: 2, cols: 2, withHeaderRow: true })
                .run()
            }
            label="표 삽입"
          >
            <IconTable size={17} stroke={1.75} />
          </ToolbarButton>
          {editor?.isActive("table") && (
            <>
              <ToolbarButton onClick={() => editor.chain().focus().addRowAfter().run()} label="행 추가">
                <span className="text-[12px] font-medium px-0.5">행+</span>
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().deleteRow().run()} label="행 삭제">
                <span className="text-[12px] font-medium px-0.5">행-</span>
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().addColumnAfter().run()} label="열 추가">
                <span className="text-[12px] font-medium px-0.5">열+</span>
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().deleteColumn().run()} label="열 삭제">
                <span className="text-[12px] font-medium px-0.5">열-</span>
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().deleteTable().run()} label="표 삭제">
                <IconTablePlus size={17} stroke={1.75} style={{ transform: "rotate(45deg)" }} />
              </ToolbarButton>
            </>
          )}
          <span className="ml-auto shrink-0 text-[10px] pl-2" style={{ color: percentOfLimit > 90 ? "var(--danger)" : "var(--text-muted)" }}>
            {percentOfLimit}%
          </span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <EditorContent editor={editor} className="pib-note-editor" />
      </div>

      {showColorPicker && (
        <Portal>
          <div
            className="fixed inset-0 z-[105] flex items-end justify-center"
            style={{ background: "rgba(0,0,0,0.35)" }}
            onClick={() => setShowColorPicker(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-t-2xl bg-surface p-4 flex flex-col gap-3"
              style={{ paddingBottom: "max(16px, calc(env(safe-area-inset-bottom) + 12px))" }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-medium">글씨 색상</span>
                <button onClick={() => setShowColorPicker(false)} aria-label="닫기">
                  <IconX size={18} stroke={1.75} color="var(--text-secondary)" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {PACK_COLORS.filter((c) => c.hex).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      editor?.chain().focus().setColor(c.hex).run();
                      setShowColorPicker(false);
                    }}
                    aria-label={c.label}
                    className="h-9 w-9 rounded-full border border-border"
                    style={{ background: c.hex }}
                  />
                ))}
              </div>
              <button
                onClick={() => {
                  editor?.chain().focus().unsetColor().run();
                  setShowColorPicker(false);
                }}
                className="text-[13px] text-text-secondary text-left py-1"
              >
                색상 지우기
              </button>
            </div>
          </div>
        </Portal>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="이 팩을 삭제할까요?"
          message="메모 내용이 함께 사라져요."
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false);
            onDeletePack?.();
          }}
        />
      )}
    </div>
  );
}
