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
  IconMinus,
  IconPlus,
  IconPaperclip,
  IconFileText,
  IconLock,
  IconLoader2,
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
import { MAX_PACK_IMAGES } from "@/lib/premiumLimits";
import { isPdfUrl } from "@/lib/fileUrlUtils";
import { uploadPackImage, deletePackImage } from "@/lib/storageService";
import EditableText from "@/components/EditableText";
import ConfirmDialog from "@/components/ConfirmDialog";
import Portal from "@/components/Portal";
import ImageLightbox from "@/components/ImageLightbox";
import PdfPreviewModal from "@/components/PdfPreviewModal";
import PremiumLimitModal from "@/components/PremiumLimitModal";
import { useToast } from "@/components/Toast";
import { useSwipeBack } from "@/lib/useSwipeBack";

const AUTOSAVE_DEBOUNCE_MS = 600;
// PDF는 이미지처럼 압축되지 않고 원본 크기 그대로 올라가므로, 큰 파일을 막기 위해
// 따로 크기 상한을 둔다 (BagEditorScreen의 MAX_BAG_PDF_BYTES와 동일한 기준).
const MAX_PACK_PDF_BYTES = 3 * 1024 * 1024;

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
  bagId,
  premium,
}: {
  pack: Pack;
  readOnly?: boolean;
  // 지금 다른 사람이 같은 가방에서 이 팩을 편집 중이면 그 사람 닉네임(없거나 null이면 다른
  // 편집자 없음). 가방 속에서만 의미가 있어서(보관함 단독 편집은 공유되지 않으므로)
  // BagEditorScreen에서만 넘겨준다.
  otherEditorNickname?: string | null;
  onBack: () => void;
  onSave: (pack: Pack) => void;
  // 있으면 헤더에 삭제 버튼을 보여준다(팩 보관함에서 열었을 때만 - 가방 속에서는 카드
  // 자체의 삭제 버튼을 쓰므로 넘기지 않는다).
  onDeletePack?: () => void;
  // 있으면 "가방 안에서 열린 메모팩"이라는 뜻 - 툴바 파일첨부(사진/PDF) 기능이 이 값이
  // 있을 때만 노출된다(보관함의 단독 편집 화면에는 이 기능이 없다). 업로드 경로
  // (bags/{bagId}/packs/{packId}/...)와 storage.rules 멤버십 검증에 다 쓰인다.
  bagId?: string;
  // 지금 이 사용자가 프리미엄인지 - PDF 첨부/미리보기는 프리미엄 전용이라 BagEditorScreen이
  // 계산해둔 premium을 그대로 넘겨받는다.
  premium?: boolean;
}) {
  const swipeBackRef = useSwipeBack<HTMLDivElement>(onBack);
  const { show } = useToast();
  const [name, setName] = useState(pack.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  // 툴바 파일첨부(사진/PDF) 관련 상태 - BagEditorScreen의 가방 이미지 기능과 동일한 패턴.
  const [uploadingImages, setUploadingImages] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [imageDeleteIndex, setImageDeleteIndex] = useState<number | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [showPdfPremiumModal, setShowPdfPremiumModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 다른 사람이 같은 메모를 지금 편집 중이면 무조건 읽기전용으로 전환한다(선택 아님) -
  // 동시에 고치면 한쪽 내용이 덮어쓰이는 사고를 막기 위함이다. 그 사람이 편집을 끝내는 순간
  // (otherEditorNickname이 null이 되는 순간) 자동으로 다시 편집 가능해진다.
  const effectiveReadOnly = !!readOnly || !!otherEditorNickname;
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

  // readOnly는 고정값이지만 otherEditorNickname은 화면을 열어둔 채 바뀌는 값이라(다른 사람이
  // 편집을 시작/종료하는 순간), useEditor 생성 시점의 editable 값만으로는
  // 반영되지 않아서 editor.setEditable로 직접 동기화한다.
  useEffect(() => {
    editor?.setEditable(!effectiveReadOnly);
  }, [editor, effectiveReadOnly]);

  // 다른 사람이 지금 편집 중이라 내가 강제 읽기전용으로 보고 있는 동안에는, 그 사람이
  // 저장할 때마다 부모(BagEditorScreen)의 실시간 구독을 통해 내려오는 최신
  // pack.editorDoc을 그대로 에디터에 반영해 "라이브"로 보이게 한다. setContent의
  // 두 번째 인자(emitUpdate=false)로 이 반영이 다시 자동저장 흐름을 타지 않게 막는다
  // (내 편집이 아니라 수신한 값을 그대로 보여주는 것일 뿐이므로).
  const lastSyncedDocRef = useRef(pack.editorDoc);
  useEffect(() => {
    if (!editor || !otherEditorNickname) return;
    if (pack.editorDoc === lastSyncedDocRef.current) return;
    lastSyncedDocRef.current = pack.editorDoc;
    editor.commands.setContent(pack.editorDoc ?? "", false);
  }, [editor, otherEditorNickname, pack.editorDoc]);

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

  // 글자 크기 -/+ 버튼. 지금 선택(또는 커서 위치)의 fontSize 마크 속성만 바꿔서, 문서 전체가 아니라
  // 드래그로 선택한 텍스트(또는 이제부터 입력할 텍스트)만 크기가 바뀌게 한다. 3~20px 범위로
  // 제한하고, 마크가 없으면(서식 안 적용) 10px를 기준으로 보고 거기서 가감을 조절한다.
  const getCurrentFontSize = (): number => {
    const raw = editor?.getAttributes("textStyle")?.fontSize as string | undefined;
    const parsed = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(parsed) ? parsed : 10;
  };

  const changeFontSize = (delta: number) => {
    if (effectiveReadOnly || !editor) return;
    const next = Math.min(20, Math.max(3, getCurrentFontSize() + delta));
    editor.chain().focus().setFontSize(`${next}px`).run();
  };

  // 화면을 나갈 때 디바운스 대기 중인 변경이 있으면 그 즉시 반영한다. otherEditorNickname이 마운트
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

  // 툴바 파일첨부(사진/PDF) - BagEditorScreen의 가방 이미지 기능과 완전히 동일한 로직
  // (무료/유료 차이, PDF 프리미엄 전용, 크기 제한)을 그대로 옮겨온 것. 가방 안에서 열린
  // 메모팩(bagId가 있을 때)에서만 동작한다. packRef.current를 기준으로 계산해서, 이름/문서
  // 변경과 이미지 변경이 서로의 최신 상태를 덮어쓰지 않게 한다.
  const packImages = pack.images ?? [];

  const handleAddAttachments = async (files: FileList | null) => {
    if (effectiveReadOnly || !bagId) return;
    if (!files || files.length === 0) return;
    const currentImages = packRef.current.images ?? [];
    const selected = Array.from(files).slice(0, MAX_PACK_IMAGES - currentImages.length);

    const isPdfFile = (f: File) =>
      f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    const pdfFiles = selected.filter(isPdfFile);
    const toUpload = premium ? selected : selected.filter((f) => !isPdfFile(f));
    if (pdfFiles.length > 0 && !premium) {
      setShowPdfPremiumModal(true);
    }
    if (toUpload.length === 0) return;

    const oversizedPdf = toUpload.find((f) => isPdfFile(f) && f.size > MAX_PACK_PDF_BYTES);
    if (oversizedPdf) {
      show("PDF 파일은 3MB 이하만 첨부할 수 있어요");
      return;
    }

    setUploadingImages(true);
    try {
      const urls = await Promise.all(
        toUpload.map((f) => uploadPackImage(bagId, packRef.current.id, f))
      );
      const updated: Pack = { ...packRef.current, images: [...currentImages, ...urls] };
      packRef.current = updated;
      onSave(updated);
    } catch {
      show("파일 업로드에 실패했어요");
    } finally {
      setUploadingImages(false);
    }
  };

  const removeAttachment = (idx: number) => {
    if (effectiveReadOnly) return;
    const images = packRef.current.images ?? [];
    const url = images[idx];
    const updated: Pack = { ...packRef.current, images: images.filter((_, i) => i !== idx) };
    packRef.current = updated;
    onSave(updated);
    deletePackImage(url);
  };

  const ToolbarButton = ({
    onClick,
    active,
    label,
    disabled,
    children,
  }: {
    onClick: () => void;
    active?: boolean;
    label: string;
    disabled?: boolean;
    children: React.ReactNode;
  }) => (
    <button
      onClick={onClick}
      aria-label={label}
      disabled={effectiveReadOnly || disabled}
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
        {!effectiveReadOnly && (
          <span
            className="shrink-0 text-[10px]"
            style={{ color: percentOfLimit > 90 ? "var(--danger)" : "var(--text-muted)" }}
          >
            {percentOfLimit}%
          </span>
        )}
        {onDeletePack && !effectiveReadOnly && (
          <button onClick={() => setConfirmDelete(true)} aria-label="팩 삭제" className="-m-2.5 p-2.5 shrink-0">
            <IconTrash size={19} stroke={1.75} color="var(--danger)" />
          </button>
        )}
      </div>

      {bagId && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf,.pdf"
          multiple
          hidden
          onChange={(e) => handleAddAttachments(e.target.files)}
        />
      )}

      {bagId && packImages.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 mb-3 shrink-0">
          {packImages.map((src, idx) => {
            const isPdf = isPdfUrl(src);
            return (
              <div
                key={idx}
                className="relative shrink-0 h-14 w-14 rounded-lg overflow-hidden bg-surface-2"
              >
                {isPdf ? (
                  <button
                    onClick={() =>
                      premium ? setPdfPreviewUrl(src) : setShowPdfPremiumModal(true)
                    }
                    className="relative h-full w-full flex flex-col items-center justify-center gap-0.5 text-text-secondary"
                    aria-label={premium ? "PDF 미리보기" : "PDF 미리보기 (프리미엄 전용)"}
                  >
                    <IconFileText size={20} stroke={1.75} />
                    <span className="text-[9px]">PDF</span>
                    {!premium && (
                      <span
                        className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full flex items-center justify-center"
                        style={{ background: "rgba(0,0,0,0.55)" }}
                      >
                        <IconLock size={9} stroke={2} color="#fff" />
                      </span>
                    )}
                  </button>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={src}
                    alt=""
                    onClick={() => setLightboxIndex(idx)}
                    className="h-full w-full object-cover"
                  />
                )}
                {!effectiveReadOnly && (
                  <button
                    onClick={() => setImageDeleteIndex(idx)}
                    className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(0,0,0,0.5)" }}
                  >
                    <IconX size={10} stroke={2} color="#fff" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {otherEditorNickname && (
        <div
          className="mx-4 mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] shrink-0"
          style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
        >
          <IconUsers size={14} stroke={1.75} className="shrink-0" />
          <span>{otherEditorNickname}님이 지금 편집 중이라 읽기전용으로 보고 있어요 · 수정 내용이 라이브로 반영돼요</span>
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
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={() => changeFontSize(-1)}
              aria-label="글자 크기 줄이기"
              disabled={getCurrentFontSize() <= 3}
              className="rounded-lg p-1.5 disabled:opacity-30"
            >
              <IconMinus size={14} stroke={1.75} />
            </button>
            <span className="text-[11px] w-6 text-center tabular-nums" style={{ color: "var(--text-secondary)" }}>
              {getCurrentFontSize()}
            </span>
            <button
              onClick={() => changeFontSize(1)}
              aria-label="글자 크기 키우기"
              disabled={getCurrentFontSize() >= 20}
              className="rounded-lg p-1.5 disabled:opacity-30"
            >
              <IconPlus size={14} stroke={1.75} />
            </button>
          </div>
          <div className="w-px h-5 bg-border shrink-0 mx-0.5" />
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
          {bagId && (
            <ToolbarButton
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImages || packImages.length >= MAX_PACK_IMAGES}
              label="사진 또는 PDF 첨부"
            >
              {uploadingImages ? (
                <IconLoader2 size={17} stroke={1.75} className="animate-spin" />
              ) : (
                <IconPaperclip size={17} stroke={1.75} />
              )}
            </ToolbarButton>
          )}
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
          message="휴지통으로 옮겨져서 설정 > 휴지통에서 복구할 수 있어요."
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false);
            onDeletePack?.();
          }}
        />
      )}

      {imageDeleteIndex !== null && (
        <ConfirmDialog
          title="이 파일을 삭제할까요?"
          message="삭제하면 되돌릴 수 없어요."
          onCancel={() => setImageDeleteIndex(null)}
          onConfirm={() => {
            const idx = imageDeleteIndex;
            setImageDeleteIndex(null);
            removeAttachment(idx);
          }}
        />
      )}

      {lightboxIndex !== null && (
        <ImageLightbox
          images={packImages}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}

      {pdfPreviewUrl && (
        <PdfPreviewModal url={pdfPreviewUrl} onClose={() => setPdfPreviewUrl(null)} />
      )}

      {showPdfPremiumModal && (
        <PremiumLimitModal
          message="PDF 첨부/미리보기는 프리미엄 전용 기능이에요. 이용권 코드를 등록하면 바로 쓸 수 있어요."
          onClose={() => setShowPdfPremiumModal(false)}
          onUnlocked={() => {
            setShowPdfPremiumModal(false);
            show("이용권 코드가 적용됐어요! PDF 기능을 다시 시도해주세요");
          }}
        />
      )}
    </div>
  );
}
