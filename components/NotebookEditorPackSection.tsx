"use client";

import { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import {
  IconDotsVertical,
  IconDeviceFloppy,
  IconDeviceFloppyFilled,
  IconRefresh,
  IconTrash,
  IconGripVertical,
  IconChevronDown,
  IconChevronRight,
  IconNotes,
  IconFileText,
  IconLock,
} from "@tabler/icons-react";
import { Pack } from "@/lib/types";
import { getPackColorHex } from "@/lib/packColors";
import { getNoteEditorExtensions } from "@/lib/noteEditorExtensions";
import { isPdfUrl } from "@/lib/fileUrlUtils";
import SwipeRenameField from "./SwipeRenameField";
import ConfirmDialog from "./ConfirmDialog";
import Avatar from "./Avatar";
import ImageLightbox from "./ImageLightbox";
import PdfPreviewModal from "./PdfPreviewModal";
import PremiumLimitModal from "./PremiumLimitModal";

// 메모장뷰(NotebookView)에서 "editor" 팩(자유문서형 메모 팩)을 보여주는 섹션.
// NotebookPackSection과 헤더 구조(접기 토글/드래그핸들/색점/이름/⋯메뉴)는 동일하게
// 맞추되, 짐 그리드 대신 TipTap을 읽기전용으로 렌더한 내용을 보여준다. 탭하면
// 전체화면 편집기(PackNoteEditorScreen)로 들어간다 - EditorPackCard(팩뷰)와 동일한 패턴.
export default function NotebookEditorPackSection({
  pack,
  isSyncedWithLibrary,
  canDeleteFromLibrary,
  onRenamePack,
  onSaveToLibrary,
  onRefreshFromLibrary,
  onDeletePack,
  onChangeDisplayState,
  onOpenEditor,
  onStartPackDrag,
  isPackDragSource,
  isDragOver,
  isLast,
  isPackDragOverPosition,
  readOnly,
  editors,
  premium,
}: {
  pack: Pack;
  isSyncedWithLibrary?: boolean;
  canDeleteFromLibrary?: boolean;
  onRenamePack: (name: string) => void;
  onSaveToLibrary?: () => void;
  onRefreshFromLibrary?: () => void;
  onDeletePack: (alsoDeleteLibrary: boolean) => void;
  onChangeDisplayState?: (nextState: "normal" | "collapsed") => void;
  onOpenEditor: () => void;
  onStartPackDrag?: (clientX: number, clientY: number) => void;
  isPackDragSource?: boolean;
  isDragOver?: boolean;
  isLast?: boolean;
  isPackDragOverPosition?: "before" | "after" | null;
  readOnly?: boolean;
  // 지금 이 팩을 편집 중인 다른 사람들(최대 3명). 있으면 "⋯" 메뉴 왼쪽에 아바타로 보여준다.
  editors?: { uid: string; nickname: string; avatarId: string }[];
  // 이 팩에 첨부된 사진/PDF(pack.images)를 눌렀을 때 PDF 미리보기를 프리미엄 전용으로
  // 막을지 판단하는 값. BagEditorScreen이 계산해둔 premium을 그대로 넘겨받는다.
  premium?: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [showPdfPremiumModal, setShowPdfPremiumModal] = useState(false);
  const accentHex = getPackColorHex(pack.color);
  const isCollapsed = (pack.displayState ?? "normal") === "collapsed";
  const packImages = pack.images ?? [];

  const editor = useEditor(
    {
      extensions: getNoteEditorExtensions(),
      content: pack.editorDoc ?? "",
      editable: false,
      immediatelyRender: false,
    },
    [isCollapsed ? null : pack.editorDoc]
  );

  return (
    <div
      data-pack-drop-id={pack.id}
      className={`py-2 ${isLast ? "" : "border-b border-border"}`}
      style={{
        boxShadow: isDragOver
          ? isPackDragOverPosition === "after"
            ? "inset 0 -2px 0 0 var(--accent)"
            : "inset 0 2px 0 0 var(--accent)"
          : undefined,
        opacity: isPackDragSource ? 0.4 : 1,
        transition: "box-shadow 120ms ease, opacity 120ms ease",
      }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <button
          onClick={() => onChangeDisplayState?.(isCollapsed ? "normal" : "collapsed")}
          aria-label={isCollapsed ? "섹션 펼치기" : "섹션 접기"}
          className="shrink-0"
        >
          {isCollapsed ? (
            <IconChevronRight size={15} stroke={1.75} color="var(--text-secondary)" />
          ) : (
            <IconChevronDown size={15} stroke={1.75} color="var(--text-secondary)" />
          )}
        </button>
        {onStartPackDrag && (
          <span
            onPointerDown={(e) => {
              e.stopPropagation();
              onStartPackDrag(e.clientX, e.clientY);
            }}
            className="shrink-0 touch-none cursor-grab"
            style={{ color: "var(--text-muted)" }}
            aria-label="드래그해서 팩 순서 바꾸기"
          >
            <IconGripVertical size={15} stroke={1.75} />
          </span>
        )}
        {accentHex && (
          <span
            className="shrink-0 h-1.5 w-1.5 rounded-full"
            style={{ background: accentHex }}
          />
        )}
        <IconNotes size={13} stroke={1.75} color="var(--text-muted)" className="shrink-0" />
        <SwipeRenameField
          value={pack.name}
          onChange={onRenamePack}
          readOnly={readOnly}
          className="text-[15px] font-semibold truncate text-left min-w-0 flex-1"
          inputClassName="text-[15px] font-semibold min-w-0 flex-1"
        />
        {editors && editors.length > 0 && (
          <div className="flex items-center -space-x-1.5 shrink-0" aria-label="편집 중인 사람">
            {editors.map((e) => (
              <Avatar key={e.uid} avatarId={e.avatarId} size={18} ring />
            ))}
          </div>
        )}
        {!readOnly && (
          <div className="relative shrink-0">
            <button
              onClick={() => setShowMenu((v) => !v)}
              aria-label="팩 메뉴"
              className="flex items-center justify-center"
            >
              <IconDotsVertical size={16} stroke={1.75} color="var(--text-secondary)" />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div
                  className={`absolute right-0 z-50 rounded-lg border border-border shadow-lg overflow-hidden ${
                    isLast ? "bottom-full mb-1" : "top-full mt-1"
                  }`}
                  style={{ background: "var(--surface)", minWidth: 140 }}
                >
                  {pack.linkedLibraryPackId && onRefreshFromLibrary && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onRefreshFromLibrary();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left"
                    >
                      <IconRefresh size={15} stroke={1.75} />
                      다시 불러오기
                    </button>
                  )}
                  {onSaveToLibrary && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onSaveToLibrary();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left"
                    >
                      {isSyncedWithLibrary ? (
                        <IconDeviceFloppyFilled size={15} stroke={1.75} color="var(--accent)" />
                      ) : (
                        <IconDeviceFloppy size={15} stroke={1.75} />
                      )}
                      팩으로 저장
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setConfirmDelete(true);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left"
                    style={{ color: "var(--danger)" }}
                  >
                    <IconTrash size={15} stroke={1.75} />
                    팩 삭제
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {!isCollapsed && (
        <>
          {packImages.length > 0 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar pl-6 mb-1.5">
              {packImages.map((src, idx) => {
                const isPdf = isPdfUrl(src);
                return (
                  <div
                    key={idx}
                    className="relative shrink-0 h-12 w-12 rounded-lg overflow-hidden bg-surface-2"
                  >
                    {isPdf ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          premium ? setPdfPreviewUrl(src) : setShowPdfPremiumModal(true);
                        }}
                        className="relative h-full w-full flex items-center justify-center text-text-secondary"
                        aria-label={premium ? "PDF 미리보기" : "PDF 미리보기 (프리미엄 전용)"}
                      >
                        <IconFileText size={17} stroke={1.75} />
                        {!premium && (
                          <span
                            className="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full flex items-center justify-center"
                            style={{ background: "rgba(0,0,0,0.55)" }}
                          >
                            <IconLock size={7} stroke={2} color="#fff" />
                          </span>
                        )}
                      </button>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={src}
                        alt=""
                        onClick={(e) => {
                          e.stopPropagation();
                          setLightboxIndex(idx);
                        }}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div
            role="button"
            tabIndex={0}
            onClick={onOpenEditor}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onOpenEditor();
            }}
            className="text-left w-full rounded-lg pl-6 pr-1 py-1 overflow-hidden cursor-pointer"
          >
            {editor?.isEmpty && (
              <p className="text-[13px] text-text-muted py-1">탭해서 메모를 작성해보세요</p>
            )}
            <div style={{ pointerEvents: "none" }}>
              <EditorContent editor={editor} className="pib-note-editor pib-note-editor-readonly" />
            </div>
          </div>
        </>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="이 팩을 가방에서 삭제할까요?"
          message="휴지통으로 옮겨져서 설정 > 휴지통에서 복구할 수 있어요."
          checkboxLabel={
            canDeleteFromLibrary ? "보관함에 저장된 원본도 함께 삭제" : undefined
          }
          onCancel={() => setConfirmDelete(false)}
          onConfirm={(alsoDeleteLibrary) => {
            setConfirmDelete(false);
            onDeletePack(canDeleteFromLibrary ? alsoDeleteLibrary : false);
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
          onUnlocked={() => setShowPdfPremiumModal(false)}
        />
      )}
    </div>
  );
}
