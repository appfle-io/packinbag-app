"use client";

import { useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import {
  IconDotsVertical,
  IconDeviceFloppy,
  IconDeviceFloppyFilled,
  IconRefresh,
  IconArrowsExchange,
  IconArrowRight,
  IconTrash,
  IconGripVertical,
  IconChevronDown,
  IconChevronRight,
  IconNotes,
  IconFileText,
  IconLock,
  IconPencil,
} from "@tabler/icons-react";
import { Pack } from "@/lib/types";
import { getPackColorHex } from "@/lib/packColors";
import { getNoteEditorExtensions } from "@/lib/noteEditorExtensions";
import { getFileKind, getFileExtensionLabel } from "@/lib/fileUrlUtils";
import { openExternalLink } from "@/lib/openExternalLink";
import SwipeRenameField from "./SwipeRenameField";
import ConfirmDialog from "./ConfirmDialog";
import Avatar from "./Avatar";
import ImageLightbox from "./ImageLightbox";
import PdfPreviewModal from "./PdfPreviewModal";
import PremiumLimitModal from "./PremiumLimitModal";

// 심플뷰(NotebookView)에서 "editor" 팩(자유문서형 메모 팩)을 보여주는 섹션.
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
  onSyncLibraryLink,
  onMoveToBag,
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
  // EditorPackCard(팩뷰)와 동일 - 링크된 보관함 원본과 계속 맞춰질지(pack.autoSyncEnabled) 켜고/끄는
  // 토글 메뉴 항목(lib/packSync.ts resolveEditorSyncDirection).
  onSyncLibraryLink?: () => void;
  // 있으면 "이동" 버튼이 "⋯" 메뉴에 나타난다(NotebookPackSection과 동일한 규약).
  onMoveToBag?: () => void;
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

  const editor = useEditor({
    extensions: getNoteEditorExtensions(),
    content: pack.editorDoc ?? "",
    editable: false,
    immediatelyRender: false,
  });

  // 예전엔 useEditor 두 번째 인자(deps 배열)로 에디터 콘텐츠를 강제로 다시 만들었는데,
  // 이 패턴이 React 19 + Tiptap 조합에서 "flushSync was called from inside a
  // lifecycle method" 콘솔 에러를 일으키는 것으로 확인됨(NotebookView가 여러 
  // NotebookEditorPackSection을 맵해서 렌더링할 때, 각 인스턴스가 독립적으로
  // 에디터를 재생성하려 하면서 부모 리스트의 렌더링 도중에 동기화 충돌가 생김).
  // 에디터는 한 번만 만들고, 내용 동기화는 이후에 이루어지는 effect로 분리해서
  // 렌더링과 완전히 분리된 타이밍에서만 실행되게 한다.
  useEffect(() => {
    if (!editor || isCollapsed) return;
    const targetContent = pack.editorDoc ?? "";
    const timer = requestAnimationFrame(() => {
      if (editor.isDestroyed) return;
      editor.commands.setContent(targetContent, false);
    });
    return () => cancelAnimationFrame(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, isCollapsed, pack.editorDoc]);

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
          onDoubleClick={() => onChangeDisplayState?.(isCollapsed ? "normal" : "collapsed")}
          className="text-[15px] font-semibold truncate text-left min-w-0 flex-1"
          inputClassName="text-[15px] font-semibold min-w-0 flex-1"
        />
        {pack.autoSyncEnabled && (
          <span className="shrink-0 text-[10.5px] font-medium px-2 py-0.5 rounded-full border border-accent/50 bg-accent/5 text-accent">
            동기화됨
          </span>
        )}
        {editors && editors.length > 0 && (
          <div className="flex items-center -space-x-1.5 shrink-0" aria-label="편집 중인 사람">
            {editors.map((e) => (
              <Avatar key={e.uid} avatarId={e.avatarId} size={18} ring />
            ))}
          </div>
        )}
        {!readOnly && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onOpenEditor}
              aria-label="메모 편집"
              className="p-1 rounded hover:bg-surface-2 transition-colors flex items-center justify-center"
            >
              <IconPencil size={15} stroke={1.75} color="var(--text-secondary)" />
            </button>
            <div className="relative">
              <button
                onClick={() => setShowMenu((v) => !v)}
                aria-label="팩 메뉴"
                className="p-1 rounded hover:bg-surface-2 transition-colors flex items-center justify-center"
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
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onOpenEditor();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left hover:bg-surface-2"
                    >
                      <IconPencil size={15} stroke={1.75} />
                      메모 편집
                    </button>
                    {onMoveToBag && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onMoveToBag();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left"
                    >
                      <IconArrowRight size={15} stroke={1.75} />
                      다른 가방으로 이동
                    </button>
                  )}
                  {/* 실시간 동기화(autoSyncEnabled) 중이면 수동 다시불러오기가 의미가 없어 숨긴다. */}
                  {!pack.autoSyncEnabled && pack.linkedLibraryPackId && onRefreshFromLibrary && (
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
                  {pack.linkedLibraryPackId && onSyncLibraryLink && (
                    <button
                      onClick={() => {
                        onSyncLibraryLink();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left"
                    >
                      <IconArrowsExchange
                        size={15}
                        stroke={1.75}
                        color={pack.autoSyncEnabled ? "var(--accent)" : undefined}
                      />
                      {pack.autoSyncEnabled ? "실시간 동기화 끄기" : "실시간 동기화 켜기"}
                    </button>
                  )}
                  {!pack.autoSyncEnabled && onSaveToLibrary && (
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
          </div>
        )}
      </div>

      {!isCollapsed && packImages.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pl-6 mb-1.5">
          {packImages.map((src, idx) => {
            const kind = getFileKind(src);
            return (
              <div
                key={idx}
                className="relative shrink-0 h-12 w-12 rounded-lg overflow-hidden bg-surface-2"
              >
                {kind === "image" ? (
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
                ) : kind === "pdf" ? (
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
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      premium ? openExternalLink(src) : setShowPdfPremiumModal(true);
                    }}
                    className="relative h-full w-full flex flex-col items-center justify-center gap-0.5 text-text-secondary px-0.5"
                    aria-label={premium ? "파일 열기" : "파일 열기 (프리미엄 전용)"}
                  >
                    <IconFileText size={17} stroke={1.75} />
                    <span className="text-[7px] truncate max-w-full">
                      {getFileExtensionLabel(src) || "FILE"}
                    </span>
                    {!premium && (
                      <span
                        className="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full flex items-center justify-center"
                        style={{ background: "rgba(0,0,0,0.55)" }}
                      >
                        <IconLock size={7} stroke={2} color="#fff" />
                      </span>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* React 19 + Tiptap의 flushSync 콘솔 에러 방지: 접혔다 펼쳐질 때 EditorContent가
          새로 마운트되는 순간 클릭 이벤트 처리와 충돌하는 게 원인이었음. 조건부 마운트/언마운트
          대신 항상 DOM에 유지하고 display로만 숨겨서, 펼치기 클릭이 새 마운트를 트리거하지 않게 함. */}
      <div
        onClick={(e) => {
          const anchor = (e.target as HTMLElement).closest("a");
          if (!anchor) return;
          const href = anchor.getAttribute("href");
          if (!href) return;
          e.preventDefault();
          e.stopPropagation();
          openExternalLink(href);
        }}
        onDoubleClick={onOpenEditor}
        className="text-left w-full rounded-lg pl-6 pr-1 py-1"
        style={{
          cursor: "text",
          display: isCollapsed ? "none" : undefined,
          // 팝뷰(EditorPackCard)와 동일한 기본 최대높이 - 내용이 적으면 그만큼만 차지하고(auto),
          // 이 값을 넘으면 이제 스크롤된다. 예전엔 높이 제한이 없어서 긴 문서면 리스트 전체가 끝없이 늘어났다.
          maxHeight: 228,
          overflowY: "auto",
        }}
      >
        {editor?.isEmpty && (
          <p className="text-[13px] text-text-muted py-1">더블클릭해서 메모를 수정해보세요</p>
        )}
        <div>
          <EditorContent editor={editor} className="pib-note-editor pib-note-editor-readonly" />
        </div>
      </div>

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
          message="이미지가 아닌 파일(PDF 포함) 첨부/열기는 프리미엄 전용 기능이에요. 이용권 코드를 등록하면 바로 쓸 수 있어요."
          onClose={() => setShowPdfPremiumModal(false)}
          onUnlocked={() => setShowPdfPremiumModal(false)}
        />
      )}
    </div>
  );
}
