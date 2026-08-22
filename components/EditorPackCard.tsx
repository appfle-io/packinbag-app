"use client";

import { useMemo, useState } from "react";
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
  IconArrowsExchange,
  IconArrowRight,
  IconFileText,
  IconLock,
} from "@tabler/icons-react";
import { Pack } from "@/lib/types";
import { getPackColorHex } from "@/lib/packColors";
import { collectEditorDocPreviewLines } from "@/lib/editorDocPreview";
import { getFileKind, getFileExtensionLabel } from "@/lib/fileUrlUtils";
import { openExternalLink } from "@/lib/openExternalLink";
import SwipeRenameField from "./SwipeRenameField";
import ConfirmDialog from "./ConfirmDialog";
import Avatar from "./Avatar";
import ImageLightbox from "./ImageLightbox";
import PdfPreviewModal from "./PdfPreviewModal";
import PremiumLimitModal from "./PremiumLimitModal";

import MemoRichTextView from "./MemoRichTextView";

// "checklist" 팩의 PackCard와 짝이 되는 "editor" 팩(자유문서형 메모 팩)용 카드.
// 짐(Item) 그리드 대신, 접혀있을 땐 숨기고, 펼치면 가볍게 파싱된 리치 서식(헤딩/볼드/체크박스/
// 인용구/하이라이트/코드)으로 내용을 선명하게 보여준다. 실제 수정은 연필 아이콘이나 더블클릭으로
// 전체화면 편집기(PackNoteEditorScreen)를 열어 진행한다.
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
  onSyncLibraryLink,
  onMoveToBag,
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
  // 링크된 보관함 원본과 계속 맞춰질지(pack.autoSyncEnabled) 켜고/끄는 토글 버튼
  // (lib/packSync.ts resolveEditorSyncDirection으로 이 화면이 열려있는 동안 계속 재검사된다).
  // 없으면(링크 안 된 팩) 버튼 자체가 안 보인다.
  onSyncLibraryLink?: () => void;
  // 있으면 "다른 가방으로 이동" 버튼이 보인다(PackCard와 동일한 규약).
  onMoveToBag?: () => void;
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

  const hasContent = Boolean(pack.editorDoc || pack.editorPreviewText);

  return (
    <div
      data-pack-drop-id={pack.id}
      className="flex flex-col rounded-xl border p-[calc(14px*var(--pack-card-scale,1))] md:p-[calc(20px*var(--pack-card-scale,1))] min-h-0 shadow-sm"
      style={{
        borderColor: isDragOver
          ? "var(--accent)"
          : "var(--border)",
        boxShadow: isDragOver
          ? isPackDragOverPosition === "after"
            ? "0 2px 0 0 var(--accent)"
            : "0 -2px 0 0 var(--accent)"
          : undefined,
        background: accentHex
          ? `color-mix(in srgb, ${accentHex} var(--pack-card-bg-pct, 100%), transparent)`
          : "var(--pack-card-bg)",
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
          {pack.autoSyncEnabled && (
            <span className="shrink-0 text-[10.5px] font-medium px-2 py-0.5 rounded-full border border-accent/50 bg-accent/5 text-accent">
              동기화됨
            </span>
          )}
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

      {!isCollapsed && packImages.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-2 shrink-0">
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

      <div
        onDoubleClick={onOpenEditor}
        className="text-left rounded-lg -mx-1 px-1 py-1"
        style={{
          maxHeight: "calc(228px * var(--pack-card-scale,1))",
          overflowY: "auto",
          cursor: "text",
          display: isCollapsed ? "none" : undefined,
        }}
      >
        {hasContent ? (
          <MemoRichTextView
            doc={pack.editorDoc}
            previewText={pack.editorPreviewText}
          />
        ) : (
          <p className="text-[13px] text-text-muted py-2">
            더블클릭해서 메모를 수정해보세요
          </p>
        )}
      </div>

      {!isCollapsed && (
        <div className="flex items-center justify-end gap-3 pt-2.5 mt-2.5 border-t border-border shrink-0">
            {!readOnly && (
              <>
                {onMoveToBag && (
                  <button onClick={onMoveToBag} aria-label="다른 가방으로 이동">
                    <span style={{ transform: "scale(var(--pack-card-scale,1))" }}>
                      <IconArrowRight size={18} stroke={1.75} color="var(--text-secondary)" />
                    </span>
                  </button>
                )}
                {/* 실시간 동기화(autoSyncEnabled) 중이면 보관함과 항상 자동으로 맞춰지므로,
                    수동 저장/다시불러오기 버튼은 의미가 없어 숨긴다 - 동기화 토글만 남긴다. */}
                {!pack.autoSyncEnabled && pack.linkedLibraryPackId && onRefreshFromLibrary && (
                  <button onClick={onRefreshFromLibrary} aria-label="팩 다시 불러오기">
                    <span style={{ transform: "scale(var(--pack-card-scale,1))" }}>
                      <IconRefresh size={18} stroke={1.75} color="var(--text-secondary)" />
                    </span>
                  </button>
                )}
                {pack.linkedLibraryPackId && onSyncLibraryLink && (
                  <button
                    onClick={onSyncLibraryLink}
                    aria-label={pack.autoSyncEnabled ? "실시간 동기화 끄기" : "실시간 동기화 켜기"}
                  >
                    <span style={{ transform: "scale(var(--pack-card-scale,1))" }}>
                      <IconArrowsExchange
                        size={18}
                        stroke={1.75}
                        color={pack.autoSyncEnabled ? "var(--accent)" : "var(--text-secondary)"}
                      />
                    </span>
                  </button>
                )}
                {!pack.autoSyncEnabled && onSaveToLibrary && (
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
          message="이미지가 아닌 파일(PDF 포함) 첨부/열기는 프리미엄 전용 기능이에요. 이용권 코드를 등록하면 바로 쓸 수 있어요."
          onClose={() => setShowPdfPremiumModal(false)}
          onUnlocked={() => setShowPdfPremiumModal(false)}
        />
      )}
    </div>
  );
}
