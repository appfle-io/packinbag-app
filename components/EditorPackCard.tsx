"use client";

import { useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import {
  IconTrash,
  IconChevronDown,
  IconChevronRight,
  IconGripVertical,
  IconPencil,
  IconNotes,
  IconDeviceFloppy,
  IconDeviceFloppyFilled,
  IconRefresh,
  IconFileText,
  IconLock,
} from "@tabler/icons-react";
import { Pack } from "@/lib/types";
import { getPackColorHex } from "@/lib/packColors";
import { getNoteEditorExtensions } from "@/lib/noteEditorExtensions";
import { isPdfUrl } from "@/lib/fileUrlUtils";
import { openExternalLink } from "@/lib/openExternalLink";
import SwipeRenameField from "./SwipeRenameField";
import ConfirmDialog from "./ConfirmDialog";
import Avatar from "./Avatar";
import ImageLightbox from "./ImageLightbox";
import PdfPreviewModal from "./PdfPreviewModal";
import PremiumLimitModal from "./PremiumLimitModal";

// "checklist" 팩의 PackCard와 짝이 되는 "editor" 팩(자유문서형 메모 팩)용 카드.
// 짐(Item) 그리드 대신, 접혀있을 땐 미리보기 텍스트 한두 줄만, 펼치면 TipTap을
// 읽기전용으로 렌더해서 체크박스/제목/표가 그대로 보이게 한다. 실제 수정은 연필
// 아이콘으로 전체화면 편집기(PackNoteEditorScreen)를 열어야 한다 - 노션 페이지
// 진입하듯 별도 화면에서 편집하고, 이 카드 자체는 보기 전용 미리보기 역할만 한다.
// 보관함 저장/새로고침/삭제(+함께삭제) 등 팩 자체를 다루는 기능은 PackCard와 동일하게 제공한다.
export default function EditorPackCard({
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
  isPackDragOverPosition,
  isDragOver,
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
  isPackDragOverPosition?: "before" | "after" | null;
  isDragOver?: boolean;
  readOnly?: boolean;
  // 지금 이 팩을 편집 중인 다른 사람들(최대 3명). 있으면 연필 아이콘 왼쪽에 아바타로 보여준다.
  editors?: { uid: string; nickname: string; avatarId: string }[];
  // 이 팩에 첨부된 사진/PDF(pack.images)를 눌렀을 때 PDF 미리보기를 프리미엄 전용으로
  // 막을지 판단하는 값. BagEditorScreen이 계산해둔 premium을 그대로 넘겨받는다.
  premium?: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [showPdfPremiumModal, setShowPdfPremiumModal] = useState(false);
  const accentHex = getPackColorHex(pack.color);
  const displayState = pack.displayState ?? "normal";
  const isCollapsed = displayState === "collapsed";
  const packImages = pack.images ?? [];

  // 펼쳐졌을 때만 읽기전용 에디터를 만든다(접힌 상태에서는 미리보기 텍스트만 보여주면
  // 되니 무거운 TipTap 인스턴스를 만들 필요가 없다).
  const editor = useEditor({
    extensions: getNoteEditorExtensions(),
    content: pack.editorDoc ?? "",
    editable: false,
    immediatelyRender: false,
  });

  // NotebookEditorPackSection과 동일한 이유로(deps 배열로 강제 재생성하는 패턴이
  // React 19 + Tiptap에서 flushSync 콘솔 에러를 일으킴) 에디터는 한 번만 만들고,
  // 내용 동기화는 렌더링과 분리된 effect로 따로 처리한다.
  useEffect(() => {
    if (!editor || isCollapsed) return;
    editor.commands.setContent(pack.editorDoc ?? "", false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, isCollapsed, pack.editorDoc]);

  return (
    <div
      data-pack-drop-id={pack.id}
      className="flex flex-col rounded-xl border p-[calc(14px*var(--pack-card-scale,1))] md:p-[calc(20px*var(--pack-card-scale,1))] min-h-0 shadow-sm"
      style={{
        borderColor: isDragOver ? "var(--accent)" : "var(--border)",
        boxShadow: isDragOver
          ? isPackDragOverPosition === "after"
            ? "0 2px 0 0 var(--accent)"
            : "0 -2px 0 0 var(--accent)"
          : undefined,
        background: accentHex ? `${accentHex}26` : "var(--pack-card-bg)",
        opacity: isPackDragSource ? 0.4 : 1,
        transition: "box-shadow 120ms ease, border-color 120ms ease, opacity 120ms ease",
      }}
    >
      <div className="flex items-center justify-between mb-2.5 shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {onStartPackDrag && (
            <span
              onPointerDown={(e) => {
                e.stopPropagation();
                onStartPackDrag(e.clientX, e.clientY);
              }}
              className="shrink-0 touch-none cursor-grab"
              style={{ color: "var(--text-muted)", transform: "scale(var(--pack-card-scale,1))" }}
              aria-label="드래그해서 팩 순서 바꾸기"
            >
              <IconGripVertical size={17} stroke={1.75} />
            </span>
          )}
          <IconNotes size={15} stroke={1.75} color="var(--text-muted)" className="shrink-0" />
          <SwipeRenameField
            value={pack.name}
            onChange={onRenamePack}
            readOnly={readOnly}
            onDoubleClick={
              onChangeDisplayState
                ? () => onChangeDisplayState(isCollapsed ? "normal" : "collapsed")
                : undefined
            }
            className="text-[calc(17px*var(--pack-card-font-scale,1)*var(--font-scale-factor,1))] font-medium truncate text-left min-w-0"
            inputClassName="text-[calc(17px*var(--pack-card-font-scale,1)*var(--font-scale-factor,1))] font-medium min-w-0 flex-1"
          />
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          {editors && editors.length > 0 && (
            <div className="flex items-center -space-x-1.5" aria-label="편집 중인 사람">
              {editors.map((e) => (
                <Avatar key={e.uid} avatarId={e.avatarId} size={20} ring />
              ))}
            </div>
          )}
          {!readOnly && (
            <button onClick={onOpenEditor} aria-label="메모 편집">
              <span style={{ transform: "scale(var(--pack-card-scale,1))" }}>
                <IconPencil size={17} stroke={1.75} color="var(--text-secondary)" />
              </span>
            </button>
          )}
          {onChangeDisplayState && (
            <button
              onClick={() => onChangeDisplayState(isCollapsed ? "normal" : "collapsed")}
              aria-label={isCollapsed ? "팩 펼치기" : "팩 접기"}
              style={{ transform: "scale(var(--pack-card-scale,1))" }}
            >
              {isCollapsed ? (
                <IconChevronRight size={17} stroke={1.75} color="var(--text-secondary)" />
              ) : (
                <IconChevronDown size={17} stroke={1.75} color="var(--text-secondary)" />
              )}
            </button>
          )}
        </div>
      </div>

      {!isCollapsed && (
        <>
          {packImages.length > 0 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar mb-2 shrink-0">
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
            onClick={(e) => {
              // 읽기전용 에디터 내용은 이제 일반 클릭으로는 무시하고(글씨 드래그 선택/접기폄치는
              // 브라우저가 그대로 처리하게 둘), 링크(<a>) 클릭만 직접 감지해서 연다 -
              // PackNoteEditorScreen과 동일한 패턴(Link 마크가 openOnClick:false라서 자동 탐색이 안 됨).
              const anchor = (e.target as HTMLElement).closest("a");
              if (!anchor) return;
              const href = anchor.getAttribute("href");
              if (!href) return;
              e.preventDefault();
              e.stopPropagation();
              openExternalLink(href);
            }}
            onDoubleClick={onOpenEditor}
            className="text-left rounded-lg -mx-1 px-1 py-1 overflow-hidden"
            style={{ maxHeight: "calc(228px * var(--pack-card-scale,1))", overflowY: "auto", cursor: "text" }}
          >
            {editor?.isEmpty && (
              <p className="text-[13px] text-text-muted py-2">
                더블클릭해서 메모를 수정해보세요
              </p>
            )}
            <div>
              <EditorContent editor={editor} className="pib-note-editor pib-note-editor-readonly" />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2.5 mt-2.5 border-t border-border shrink-0">
            {!readOnly && (
              <>
                {pack.linkedLibraryPackId && onRefreshFromLibrary && (
                  <button onClick={onRefreshFromLibrary} aria-label="팩 다시 불러오기">
                    <span style={{ transform: "scale(var(--pack-card-scale,1))" }}>
                      <IconRefresh size={18} stroke={1.75} color="var(--text-secondary)" />
                    </span>
                  </button>
                )}
                {onSaveToLibrary && (
                  <button onClick={onSaveToLibrary} aria-label="팩 저장">
                    <span style={{ transform: "scale(var(--pack-card-scale,1))" }}>
                      {isSyncedWithLibrary ? (
                        <IconDeviceFloppyFilled size={18} stroke={1.75} color="var(--accent)" />
                      ) : (
                        <IconDeviceFloppy size={18} stroke={1.75} color="var(--text-secondary)" />
                      )}
                    </span>
                  </button>
                )}
                <button onClick={() => setConfirmDelete(true)} aria-label="팩 삭제">
                  <span style={{ transform: "scale(var(--pack-card-scale,1))" }}>
                    <IconTrash size={18} stroke={1.75} color="var(--text-secondary)" />
                  </span>
                </button>
              </>
            )}
          </div>
        </>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="이 팩을 가방에서 삭제할까요?"
          message="메모 내용도 함께 사라져요."
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
