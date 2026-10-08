"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import {
  IconShare,
  IconAlertTriangle,
  IconUsers,
  IconLoader2,
} from "@tabler/icons-react";
import { Pack } from "@/lib/types";
import { getNoteEditorExtensions } from "@/lib/noteEditorExtensions";
import { useAuth } from "@/contexts/AuthProvider";
import {
  isShortUrlFeatureEnabled,
  isAlreadyShortLink,
  fetchLinkMeta,
  parseShortLinkUrl,
  type LinkMeta,
} from "@/lib/shortLinkService";
import { getCachedLinkMeta, setLinkMetaCache } from "@/lib/linkLabelCache";
import { replaceLinkTextInEditor } from "@/lib/noteEditorLinkPaste";
import { openExternalLink } from "@/lib/openExternalLink";
import { downloadFileFromUrl } from "@/lib/downloadFile";

const TEXT_COLORS = [
  // 기본/무채색 계열
  { id: "default", hex: "#1f2937", label: "기본 다크" },
  { id: "gray", hex: "#6b7280", label: "그레이" },
  { id: "darkgray", hex: "#374151", label: "다크 그레이" },
  { id: "brown", hex: "#92400e", label: "브라운" },
  // 레드/오렌지/옐로 계열
  { id: "red", hex: "#ef4444", label: "레드" },
  { id: "darkred", hex: "#991b1b", label: "다크 레드" },
  { id: "rose", hex: "#f43f5e", label: "로즈" },
  { id: "orange", hex: "#f97316", label: "오렌지" },
  { id: "amber", hex: "#f59e0b", label: "앰버" },
  { id: "yellow", hex: "#eab308", label: "옐로" },
  // 그린/시안 계열
  { id: "lime", hex: "#84cc16", label: "라임" },
  { id: "green", hex: "#10b981", label: "그린" },
  { id: "darkgreen", hex: "#15803d", label: "다크 그린" },
  { id: "teal", hex: "#14b8a6", label: "틸" },
  { id: "cyan", hex: "#06b6d4", label: "시안" },
  // 블루/퍼플/핑크 계열
  { id: "skyblue", hex: "#0ea5e9", label: "스카이블루" },
  { id: "blue", hex: "#3b82f6", label: "블루" },
  { id: "navy", hex: "#1e40af", label: "네이비" },
  { id: "indigo", hex: "#6366f1", label: "인디고" },
  { id: "purple", hex: "#8b5cf6", label: "바이올렛" },
  { id: "darkpurple", hex: "#5b21b6", label: "딥 퍼플" },
  { id: "magenta", hex: "#d946ef", label: "마젠타" },
  { id: "pink", hex: "#ec4899", label: "핑크" },
];
import {
  MAX_EDITOR_DOC_BYTES,
  checkEditorDocSizeForSave,
  checkEditorDocDepthForSave,
  extractPlainTextPreview,
  getEditorDocByteSize,
} from "@/lib/editorDocLimits";
import { extractDocAttachmentUrls, migratePackImagesToDoc } from "@/lib/editorDocAttachmentUtils";
import { isPremiumUser, MAX_PACK_IMAGES } from "@/lib/premiumLimits";
import { getFileKind, getFileExtensionLabel } from "@/lib/fileUrlUtils";
import { uploadPackImage, deletePackImage } from "@/lib/storageService";
import { useToast } from "@/components/Toast";
import { useSwipeBack } from "@/lib/useSwipeBack";
import { useIsDesktop } from "@/lib/useIsDesktop";
import { IconChevronLeft, IconDots, IconRefresh } from "@tabler/icons-react";
import { IconButton, cx } from "@/components/v2/ui";
import { ConfirmSheet } from "@/components/v2/bag/sheets/ConfirmSheet";
import { PremiumSheet } from "@/components/v2/sheets/PremiumSheet";
import { LinkSheet, type LinkRequest } from "@/components/v2/note/LinkSheet";
import { NoteToolbar } from "@/components/v2/note/NoteToolbar";
import { NoteMoreSheet } from "@/components/v2/note/NoteMoreSheet";
import { NoteTableSheet } from "@/components/v2/note/NoteTableSheet";
import { NoteColorSheet, NoteTocSheet } from "@/components/v2/note/NoteColorSheet";
import { MemoShareSheet } from "@/components/v2/note/MemoShareSheet";
import { PhotoViewer } from "@/components/v2/bag/PhotoViewer";
import { PdfViewer } from "@/components/v2/bag/PdfViewer";
import { mergeEditorDocs } from "@/lib/syncMerge";
import { useOnlineGuard } from "@/components/v2/shell/useOnlineGuard";
import { sweepRemovedAttachments } from "@/lib/storageCleanup";

// 문서를 통째로 바꿔 넣되, 커서가 있던 맨 위 문단을 새 문서에서 찾아 같은 자리로 돌려놓는다
// (위쪽에 다른 사람이 문단을 넣어도 치던 자리가 튀지 않게). 예외는 삼킨다 - 커서는 부가 기능이다.
function applyDocKeepingCursor(ed: Editor, nextDoc: object | string) {
  const from = ed.state.selection.from;
  let blockJson: string | null = null;
  let offsetInBlock = 0;
  ed.state.doc.forEach((node, offset) => {
    if (blockJson === null && from >= offset && from <= offset + node.nodeSize) {
      blockJson = JSON.stringify(node.toJSON());
      offsetInBlock = from - offset;
    }
  });
  ed.commands.setContent(nextDoc, false);
  try {
    let target: number | null = null;
    ed.state.doc.forEach((node, offset) => {
      if (target === null && blockJson !== null && JSON.stringify(node.toJSON()) === blockJson) {
        target = offset + Math.min(offsetInBlock, node.nodeSize - 1);
      }
    });
    const pos = Math.max(1, Math.min(target ?? from, ed.state.doc.content.size));
    ed.commands.setTextSelection(pos);
  } catch {
    // 커서 복원 실패는 무시
  }
}

const AUTOSAVE_DEBOUNCE_MS = 600;
// 이미지가 아닌 파일(PDF/기타 문서 형식)은 이미지처럼 압축되지 않고 원본 크기 그대로
// 올라가므로, 큰 파일을 막기 위해 따로 크기 상한을 둔다(2026-08~ 10MB로 상향).
const MAX_PACK_ATTACHMENT_FILE_BYTES = 10 * 1024 * 1024;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

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
  initialSearchQuery,
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
  // 지금 이 사용자가 프리미엄인지 - 이미지가 아닌 파일(PDF 포함) 첨부/미리보기는 프리미엄 전용이라 BagEditorScreen이
  // 계산해둔 premium을 그대로 넘겨받는다.
  premium?: boolean;
  // 검색창에서 메모 결과를 눌러 들어왔을 때 해당 검색어 위치로 자동 스크롤 & 블록 선택
  initialSearchQuery?: string;
}) {
  const commitSaveRef = useRef<(() => void) | null>(null);
  // v2: 이미 공유한 메모를 고친 뒤 나갈 때 공유 스냅샷을 조용히 갱신(아래 refreshShareRef.current 정의 참고)
  const refreshShareRef = useRef<(() => void) | null>(null);
  const handleBack = useCallback(() => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
      if (!effectiveReadOnlyRef.current) {
        commitSaveRef.current?.();
      }
    }
    refreshShareRef.current?.();
    onBack();
  }, [onBack]);

  const swipeBackRef = useSwipeBack<HTMLDivElement>(handleBack);
  const { show } = useToast();
  // v2: 공유 링크·첨부 올리기는 인터넷이 필요하다(오프라인 모드 첨부는 이 기기 저장이라 그대로 된다)
  const { guard: guardOnline } = useOnlineGuard();
  const { user, profile, updatePackSettings, isOfflineMode } = useAuth();
  // 사용자의 유료(프리미엄) 여부: 오프라인 모드는 무조건 무제한
  const isEffectivePremium =
    isOfflineMode
      ? true
      : premium !== undefined
        ? premium
        : profile?.role === "master" || (user && profile ? isPremiumUser(user.email, profile) : false);

  const noteSpellcheckEnabled = profile?.packSettings?.noteSpellcheckEnabled ?? false;
  const shortUrlFeatureEnabled = !isOfflineMode && isShortUrlFeatureEnabled(user?.email, profile);
  const [name, setName] = useState(pack.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

  // 툴바 파일첨부(사진/PDF) 관련 상태 - BagEditorScreen의 가방 이미지 기능과 동일한 패턴.
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadProgressMessage, setUploadProgressMessage] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewName, setPdfPreviewName] = useState<string | null>(null);
  const [showPdfPremiumModal, setShowPdfPremiumModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const effectiveReadOnly = !!readOnly;
  // 문서가 너무 커져서 지금 상태로는 저장이 막혔는지. true인 동안은 자동저장을 건너뛰고
  // 배너로 알려서, 사용자가 내용을 줄여야 한다는 걸 바로 알 수 있게 한다(타이핑한 내용
  // 자체는 화면에 그대로 남아있어 잃어버리지 않는다).
  const [sizeBlocked, setSizeBlocked] = useState(false);
  // 토글(> 접기)이나 리스트를 여러 단계 겹쳐 쌓아서 Firestore의 중첩 제한(최대 20단계)을
  // 넘을 위험이 있을 때 true. sizeBlocked와 동일하게 자동저장을 건너뛰고 배너로 알린다.
  const [depthBlocked, setDepthBlocked] = useState(false);
  // 목차(TOC): 모바일은 우하단 플로팅 버튼 + 바텀시트, 데스크톱(넓은 화면)은 우측 사이드
  // 레일로 상시 노출한다. 헤딩이 하나도 없으면 버튼/레일 자체를 숨긴다.
  const isDesktop = useIsDesktop();
  const [tocOpen, setTocOpen] = useState(false);
  const [headings, setHeadings] = useState<{ pos: number; level: number; text: string }[]>([]);

  const packRef = useRef(pack);
  // 이번에 열어 둔 동안 본문·사진 칸에 한 번이라도 있었던 첨부 주소
  const seenAttachmentUrlsRef = useRef<Set<string>>(
    new Set([...(pack.images ?? []), ...extractDocAttachmentUrls(pack.editorDoc)]),
  );
  const nameRef = useRef(name);
  useEffect(() => {
    nameRef.current = name;
  }, [name]);

  // 링크(Link 마크)를 탭했을 때 띄우는 선택 시트의 대상 URL. "짧은 URL로 변경"이 가능한
  // 링크(프리미엄 + 토글 ON + 아직 축약 전)만 이 메뉴를 띄우고, 그러지 않으면 바로 연다.
  const [linkMenuUrl, setLinkMenuUrl] = useState<string | null>(null);
  // 이미 축약된 링크를 탭했을 때, 본인이 만든 링크로 확인되면(fetchLinkMeta의 canEdit) 이
  // 값이 채워져 "열기/수정" 선택 시트가 뜬다. 다른 사람이 만든 링크면 메뉴 없이 바로 열린다.
  const [manageLinkTarget, setManageLinkTarget] = useState<{ url: string; meta: LinkMeta } | null>(null);

  // --- v2 전용 시트 상태 (구 UI에서는 쓰지 않음) ---
  const [moreOpen, setMoreOpen] = useState(false);
  const [tableSheetOpen, setTableSheetOpen] = useState(false);
  const [confirmDeleteTable, setConfirmDeleteTable] = useState(false);
  // 툴바 링크 버튼(구 UI의 window.prompt 대신 링크 시트의 주소 입력 단계)
  const [insertLinkReq, setInsertLinkReq] = useState<{ initialUrl: string; canUnlink: boolean } | null>(null);
  // 링크 시트 요청. 시트가 같은 요청인지 참조로 비교하므로 렌더마다 새로 만들지 않는다
  const v2LinkRequest = useMemo<LinkRequest | null>(() => {
    if (insertLinkReq) return { kind: "insert", ...insertLinkReq };
    if (manageLinkTarget) return { kind: "manage", url: manageLinkTarget.url, meta: manageLinkTarget.meta, canUnlink: !effectiveReadOnly };
    if (linkMenuUrl) return { kind: "tap", url: linkMenuUrl, canUnlink: !effectiveReadOnly };
    return null;
  }, [insertLinkReq, manageLinkTarget, linkMenuUrl, effectiveReadOnly]);

  const handleLinkClick = useCallback((href: string) => {
    if (isAlreadyShortLink(href)) {
      if (!user) {
        openExternalLink(href);
        return;
      }
      fetchLinkMeta(href, user).then((meta) => {
        if (meta?.canEdit) {
          setManageLinkTarget({ url: href, meta });
        } else {
          openExternalLink(href);
        }
      });
      return;
    }

    const canShorten = shortUrlFeatureEnabled && !!user;
    if (canShorten) {
      setLinkMenuUrl(href);
    } else {
      openExternalLink(href);
    }
  }, [user, shortUrlFeatureEnabled]);

  // 기존 pack.images에 있던 첨부파일들을 본문(editorDoc) 상단으로 자동 마이그레이션
  const initialMigratedDoc = useMemo(() => {
    if (pack.images && pack.images.length > 0) {
      const { doc } = migratePackImagesToDoc(pack.editorDoc, pack.images);
      return doc;
    }
    return pack.editorDoc ?? "";
  }, [pack.images, pack.editorDoc]);

  const editorRef = useRef<Editor | null>(null);

  // 툴바 파일 첨부 / 붙여넣기(Paste) / 드래그 앤 드롭(Drop)으로 커서/지정 위치에 파일 삽입
  const handleUploadAndInsertFiles = useCallback(
    async (files: FileList | File[] | null, insertPos?: number) => {
      const uploadTargetId = bagId || user?.uid;
      if (effectiveReadOnly || !uploadTargetId) return;
      if (!files || files.length === 0) return;

      // 메모팩 첨부파일은 프리미엄 전용 기능 (무료 회원은 첨부 불가)
      if (!isEffectivePremium) {
        setShowPdfPremiumModal(true);
        return;
      }

      const fileArray = Array.from(files);
      const isNonImageFile = (f: File) => !f.type.startsWith("image/");
      const oversized = fileArray.find(
        (f) => isNonImageFile(f) && f.size > MAX_PACK_ATTACHMENT_FILE_BYTES
      );
      if (oversized) {
        show("이미지가 아닌 파일은 10MB 이하만 첨부할 수 있어요");
        return;
      }

      const isImg = fileArray.every((f) => f.type.startsWith("image/"));
      const msg = isImg
        ? fileArray.length === 1
          ? "이미지를 첨부하고 있어요..."
          : `${fileArray.length}장의 이미지를 첨부하고 있어요...`
        : "파일을 첨부하고 있어요...";
      setUploadProgressMessage(msg);
      setUploadingImages(true);
      try {
        const ed = editorRef.current;
        for (const file of fileArray) {
          const url = isOfflineMode
            ? await readFileAsDataUrl(file)
            : await uploadPackImage(uploadTargetId, packRef.current.id, file, !!bagId);
          const kind = getFileKind(url);
          if (!ed) continue;

          if (kind === "image") {
            if (typeof insertPos === "number") {
              ed.chain()
                .focus()
                .insertContentAt(insertPos, {
                  type: "imageAttachment",
                  attrs: { src: url, alt: file.name },
                })
                .run();
            } else {
              ed.chain()
                .focus()
                .setImageAttachment({
                  src: url,
                  alt: file.name,
                })
                .run();
            }
          } else {
            const ext = getFileExtensionLabel(url) || "FILE";
            if (typeof insertPos === "number") {
              ed.chain()
                .focus()
                .insertContentAt(insertPos, {
                  type: "fileAttachment",
                  attrs: {
                    src: url,
                    fileName: file.name,
                    fileKind: kind === "pdf" ? "pdf" : "file",
                    fileExtension: ext,
                  },
                })
                .run();
            } else {
              ed.chain()
                .focus()
                .setFileAttachment({
                  src: url,
                  fileName: file.name,
                  fileKind: kind === "pdf" ? "pdf" : "file",
                  fileExtension: ext,
                })
                .run();
            }
          }
        }
        show("본문에 추가했어요");
      } catch {
        show("파일 업로드에 실패했어요");
      } finally {
        setUploadingImages(false);
        setUploadProgressMessage(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [effectiveReadOnly, bagId, user, isEffectivePremium]
  );

  const handleUploadRef = useRef(handleUploadAndInsertFiles);
  handleUploadRef.current = handleUploadAndInsertFiles;

  const editor = useEditor(
    {
      extensions: getNoteEditorExtensions({
        placeholder: "메모를 입력해보세요",
      }),
      content: initialMigratedDoc,
      editable: !effectiveReadOnly,
      immediatelyRender: false,
      editorProps: {
        handleClick: (_view, _pos, event) => {
          const target = event.target as HTMLElement | null;

          // 1. 링크 클릭
          const anchor = target?.closest("a");
          if (anchor) {
            const href = anchor.getAttribute("href");
            if (href) {
              event.preventDefault();
              handleLinkClick(href);
              return true;
            }
          }

          // 2. 이미지 클릭 -> 라이트박스 열람
          const img = target?.closest<HTMLElement>("img[data-image-src], [data-image-src]");
          if (img) {
            const src = img.getAttribute("data-image-src") || (img as HTMLImageElement).src;
            if (src) {
              event.preventDefault();
              const allDocImages = extractDocAttachmentUrls(editorRef.current?.getJSON()).filter(
                (u) => getFileKind(u) === "image"
              );
              const list = allDocImages.length > 0 ? allDocImages : [src];
              const idx = list.indexOf(src);
              setLightboxImages(list);
              setLightboxIndex(idx >= 0 ? idx : 0);
              return true;
            }
          }

          // 3. 파일 카드 클릭 -> PDF 미리보기 또는 다운로드
          const fileCard = target?.closest<HTMLElement>("[data-file-src]");
          if (fileCard) {
            const src = fileCard.getAttribute("data-file-src");
            const kind = fileCard.getAttribute("data-file-kind");
            const fileName = fileCard.getAttribute("data-file-name");
            if (src) {
              event.preventDefault();
              // 오프라인 첨부(data URL)는 첨부 당시 종류를 못 알아 "file"로 들어간 PDF가 있다 → 주소로도 한 번 더 본다
              if (kind === "pdf" || getFileKind(src) === "pdf") {
                setPdfPreviewName(fileName);
                setPdfPreviewUrl(src);
              } else {
                // 미리보기가 없는 파일은 원래 이름으로 바로 저장(예전에는 새 탭 열기라 오프라인 파일은 열리지 않았다)
                void downloadFileFromUrl(src, fileName).then((r) => {
                  if (r === "failed") show("파일을 저장하지 못했어요");
                });
              }
              return true;
            }
          }

          return false;
        },
        handlePaste: (_view, event) => {
          const clipboardData = event.clipboardData;
          if (!clipboardData) return false;

          const files: File[] = [];

          // 1. files 검사
          if (clipboardData.files && clipboardData.files.length > 0) {
            for (let i = 0; i < clipboardData.files.length; i++) {
              const f = clipboardData.files[i];
              if (f) files.push(f);
            }
          }

          // 2. files가 비어있을 때 items에서 이미지 추출 (Windows 캡처 도구, PrintScreen, 브라우저 이미지 복사 등)
          if (files.length === 0 && clipboardData.items && clipboardData.items.length > 0) {
            for (let i = 0; i < clipboardData.items.length; i++) {
              const item = clipboardData.items[i];
              if (item.kind === "file" || item.type.startsWith("image/")) {
                const f = item.getAsFile();
                if (f) files.push(f);
              }
            }
          }

          if (files.length > 0) {
            event.preventDefault();
            handleUploadRef.current(files);
            return true;
          }

          return false;
        },
        handleDrop: (view, event, _slice, moved) => {
          if (!moved && event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
            event.preventDefault();
            const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });
            handleUploadRef.current(event.dataTransfer.files, coordinates?.pos);
            return true;
          }
          return false;
        },
        attributes: {
          spellcheck: noteSpellcheckEnabled ? "true" : "false",
          autocapitalize: "off",
          autocomplete: "off",
        },
      },
    },
    []
  );
  editorRef.current = editor;

  // 마운트 시 기존 pack.images에 있던 파일들이 본문으로 마이그레이션되었으면 즉시 원격 저장에 반영
  useEffect(() => {
    if (!pack.images || pack.images.length === 0) return;
    const { doc, migrated } = migratePackImagesToDoc(pack.editorDoc, pack.images);
    if (migrated) {
      const updated: Pack = {
        ...packRef.current,
        editorDoc: doc,
        editorPreviewText: extractPlainTextPreview(doc),
        images: [], // 본문으로 일원화 완료
        updatedAt: new Date().toISOString(),
      };
      packRef.current = updated;
      onSave(updated);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 기존 작성된 메모팩 내용이 마운트 시 즉시 정상 렌더링되도록 보장 (마운트 시 1회만 실행)
  const initialContentSeededRef = useRef(false);
  useEffect(() => {
    if (!editor || initialContentSeededRef.current) return;
    const targetDoc = initialMigratedDoc || pack.editorDoc;
    if (targetDoc && editor.isEmpty) {
      editor.commands.setContent(targetDoc, false);
    }
    initialContentSeededRef.current = true;
  }, [editor, initialMigratedDoc, pack.editorDoc]);

  // 맞춤법 검사 On/Off 변경 시 에디터 DOM에 즉시 반영
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const el = editor.view.dom;
    if (el) {
      el.setAttribute("spellcheck", noteSpellcheckEnabled ? "true" : "false");
    }
  }, [editor, noteSpellcheckEnabled]);

  useEffect(() => {
    editor?.setEditable(!effectiveReadOnly);
  }, [editor, effectiveReadOnly]);

  const refreshHeadings = useCallback(() => {
    if (!editor) return;
    const list: { pos: number; level: number; text: string }[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "heading") {
        list.push({
          pos,
          level: (node.attrs.level as number) ?? 1,
          text: node.textContent.trim() || "제목 없음",
        });
      }
    });
    setHeadings(list);
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    refreshHeadings();
    const handler = () => refreshHeadings();
    editor.on("update", handler);
    return () => {
      editor.off("update", handler);
    };
  }, [editor, refreshHeadings]);

  const scrollToHeading = (pos: number) => {
    if (!editor) return;
    editor.chain().focus().setTextSelection(pos + 1).scrollIntoView().run();
    setTocOpen(false);
  };

  // 검색 결과를 통해 들어왔을 때 해당 검색어 위치로 스크롤 & 블록 선택 & 펄스 하이라이트
  useEffect(() => {
    if (!editor || !initialSearchQuery) return;
    const query = initialSearchQuery.trim().toLowerCase();
    if (!query) return;

    const performHighlight = () => {
      if (!editor || editor.isDestroyed) return;
      const editorDom = editor.view?.dom;
      if (!editorDom) return;

      let foundPos: number | null = null;
      editor.state.doc.descendants((node, pos) => {
        if (foundPos !== null) return false;
        if (node.isText && node.text) {
          const idx = node.text.toLowerCase().indexOf(query);
          if (idx !== -1) {
            foundPos = pos + idx;
            return false;
          }
        }
      });

      // DOM 요소 찾기
      let targetElement: HTMLElement | null = null;
      if (foundPos !== null) {
        try {
          const domPos = editor.view.nodeDOM(foundPos) as HTMLElement | null;
          if (domPos && domPos instanceof HTMLElement) {
            targetElement = domPos;
          } else {
            const resolved = editor.view.domAtPos(foundPos);
            targetElement = (resolved.node instanceof HTMLElement)
              ? resolved.node
              : resolved.node.parentElement;
          }
        } catch {
          // fallback
        }
      }

      // fallback: TreeWalker로 텍스트 노드 탐색 (100% 보장)
      if (!targetElement) {
        const walker = document.createTreeWalker(editorDom, NodeFilter.SHOW_TEXT);
        let textNode: Node | null;
        while ((textNode = walker.nextNode())) {
          if (textNode.nodeValue && textNode.nodeValue.toLowerCase().includes(query)) {
            targetElement = textNode.parentElement;
            break;
          }
        }
      }

      if (targetElement) {
        targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
        targetElement.classList.remove("pib-text-search-highlight");
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        targetElement.offsetWidth;
        targetElement.classList.add("pib-text-search-highlight");
        window.setTimeout(() => {
          targetElement?.classList.remove("pib-text-search-highlight");
        }, 2800);
      }

      if (foundPos !== null) {
        editor
          .chain()
          .focus()
          .setTextSelection({ from: foundPos, to: foundPos + query.length })
          .run();
      }
    };

    const timer1 = window.setTimeout(performHighlight, 150);
    const timer2 = window.setTimeout(performHighlight, 500);

    return () => {
      window.clearTimeout(timer1);
      window.clearTimeout(timer2);
    };
  }, [editor, initialSearchQuery]);

  const lastSyncedDocRef = useRef<unknown>(pack.editorDoc);
  const [remoteUpdatedBanner, setRemoteUpdatedBanner] = useState(false);
  const pendingRemoteDocRef = useRef<object | null>(null);

  useEffect(() => {
    if (!editor) return;
    const incomingDoc = pack.editorDoc;
    // 내가 로컬에서 편집/저장하여 발생한 prop 변경이거나 이미 동기화된 문서면 건너뛴다
    if (incomingDoc === lastSyncedDocRef.current || incomingDoc === packRef.current.editorDoc) return;

    // 내용이 실질적으로 다른지 확인 (깊은 JSON 비교)
    const isActuallyDifferent =
      JSON.stringify(incomingDoc ?? null) !== JSON.stringify(lastSyncedDocRef.current ?? null);
    if (!isActuallyDifferent) {
      lastSyncedDocRef.current = incomingDoc;
      return;
    }

    // 사용자가 지금 에디터를 타이핑 중이면 커서 튐 방지를 위해 보류하고 알림 배너 표시
    // 타이핑 중이어도 보류하지 않고 바로 합친다. 마지막으로 동기화한 문서(base) 대비 내 변경과 상대 변경을
    // 문단 단위로 합쳐서(lib/syncMerge) 서로 다른 문단은 둘 다 살리고, 치던 문단에 커서를 그대로 둔다.
    // 내 변경은 이미 자동저장이 예약돼 있어서 그 저장이 합친 문서를 올린다(추가 읽기·쓰기 없음).
    const base = lastSyncedDocRef.current as object | undefined;
    const mine = editor.getJSON();
    const next = editor.isFocused
      ? (mergeEditorDocs(base, mine, (incomingDoc as object | undefined) ?? undefined) ?? "")
      : (incomingDoc ?? "");
    lastSyncedDocRef.current = incomingDoc;
    packRef.current = { ...pack, editorDoc: packRef.current.editorDoc };
    if (pack.name !== nameRef.current && document.activeElement?.getAttribute("aria-label") !== "메모 이름") {
      setName(pack.name);
      nameRef.current = pack.name;
    }
    if (JSON.stringify(next) !== JSON.stringify(mine)) applyDocKeepingCursor(editor, next);
    refreshHeadings();
    setRemoteUpdatedBanner(false);
  }, [editor, pack, refreshHeadings]);

  // 렌더링된 링크(<a>) 중 우리 서비스 짧은/커스텀 링크의 화면 표시 텍스트를 캐시된 표시
  // 이름(label)으로 바꿔치기한다. 문서(editorDoc) 자체의 텍스트/href는 그대로 두고 DOM
  // 렌더링만 바꾸는 방식이라(TipTap 문서 모델은 손대지 않음) 저장/자동저장 로직과 완전히
  // 분리되어 있다. 아직 원본 그대로거나(라벨 적용 전) 이전에 우리가 라벨로 바꿔치기해둔
  // 자리만 갱신해서, 사용자가 링크 글자를 직접 다른 문구로 적어둔 경우까지 덮어쓰지 않는다.
  const applyLinkLabels = useCallback(() => {
    if (!editor) return;
    const anchors = editor.view.dom.querySelectorAll<HTMLAnchorElement>("a[href]");
    anchors.forEach((a) => {
      const href = a.getAttribute("href");
      if (!href) return;
      const parsed = parseShortLinkUrl(href);
      if (!parsed) return;
      const cached = getCachedLinkMeta(href);
      if (cached === undefined) {
        fetchLinkMeta(href, user).then((meta) => {
          setLinkMetaCache(parsed.kind, parsed.code, meta);
          applyLinkLabels();
        });
        return;
      }
      const desiredText = cached?.label || href;
      const appliedBefore = a.dataset.pibLinkPatched === "1";
      const isOriginalRawText = a.textContent === href;
      if ((isOriginalRawText || appliedBefore) && a.textContent !== desiredText) {
        a.textContent = desiredText;
        a.dataset.pibLinkPatched = desiredText !== href ? "1" : "";
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, user]);

  useEffect(() => {
    if (!editor) return;
    applyLinkLabels();
    editor.on("update", applyLinkLabels);
    return () => {
      editor.off("update", applyLinkLabels);
    };
  }, [editor, applyLinkLabels]);

  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipFirstRef = useRef(true);
  // 마지막으로 공유 스냅샷을 올린 뒤 내용이 바뀌었는지(v2 자동 갱신용)
  const editedSinceShareRef = useRef(false);

  const commitSave = (docOverride?: object) => {
    const doc = docOverride ?? editor?.getJSON();
    if (!doc) return;
    const sizeError = checkEditorDocSizeForSave(doc);
    if (sizeError) {
      setSizeBlocked(true);
      return;
    }
    setSizeBlocked(false);
    const depthError = checkEditorDocDepthForSave(doc);
    if (depthError) {
      setDepthBlocked(true);
      return;
    }
    setDepthBlocked(false);
    // 이번에 열어 둔 동안 본문에 있었던 첨부를 모은다(닫을 때 지운 것만 정리 - sweepRemovedAttachments)
    extractDocAttachmentUrls(doc).forEach((u) => seenAttachmentUrlsRef.current.add(u));
    const updated: Pack = {
      ...packRef.current,
      name: nameRef.current,
      editorDoc: doc,
      editorPreviewText: extractPlainTextPreview(doc),
      updatedAt: new Date().toISOString(),
    };
    packRef.current = updated;
    lastSyncedDocRef.current = doc;
    onSave(updated);
    editedSinceShareRef.current = true;
  };
  commitSaveRef.current = commitSave;

  // 공유 링크는 스냅샷(복사본)이라 메모를 고쳐도 저절로 바뀌지 않는다. v2에서는 이미 공유한 메모(publicShareToken)를
  // 고친 뒤 편집기를 나갈 때 한 번 지금 내용으로 다시 올린다(app/api/share-pack은 같은 토큰으로 덮어쓴다).
  // 공유하지 않은 메모나 안 고친 메모는 요청하지 않는다. 실패해도 조용히 넘어간다(다음에 공유 시트를 열면 다시 갱신됨).
  refreshShareRef.current = () => {
    if (!editedSinceShareRef.current) return;
    const current = packRef.current;
    if (!current.publicShareToken || !user || isOfflineMode) return;
    editedSinceShareRef.current = false;
    user
      .getIdToken()
      .then((idToken) =>
        fetch("/api/share-pack", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ packId: current.id, pack: current, bagId }),
        }),
      )
      .catch((err) => console.error("[팩인백] 공유 스냅샷 자동 갱신 실패:", err));
  };

  const handleUnlink = (pos: number | null) => {
    if (!editor || effectiveReadOnly) return;
    if (typeof pos === "number" && pos >= 0) {
      editor.chain().focus().setTextSelection(pos + 1).extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    }
    show("링크를 해제했어요");
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
  // 드래그로 선택한 텍스트(또는 이제부터 입력할 텍스트)만 크기가 바뀌게 한다. 8~28px 범위로
  // 제한하고, 마크가 없으면(서식 안 적용) 실제로 렌더링되는 기본 크기인 16px을 기준으로 보고
  // 거기서 가감을 조절한다 (기존엔 10px을 기준으로 잘못 가정해서, 서식 없는 글에 처음 +를
  // 누르면 실제로 보이던 16px에서 11px로 갑자기 작아져 보이는 버그가 있었음).
  const DEFAULT_FONT_SIZE = 16;
  const getCurrentFontSize = (): number => {
    const raw = editor?.getAttributes("textStyle")?.fontSize as string | undefined;
    const parsed = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(parsed) ? parsed : DEFAULT_FONT_SIZE;
  };

  const changeFontSize = (delta: number) => {
    if (effectiveReadOnly || !editor) return;
    const next = Math.min(28, Math.max(8, getCurrentFontSize() + delta));
    editor.chain().focus().setFontSize(`${next}px`).run();
  };

  // 화면을 나갈 때 디바운스 대기 중인 변경이 있으면 그 즉시 반영한다. otherEditorNickname이 마운트
  // 이후에도 바뀌는 값이라 effectiveReadOnly를 ref로도 따로 추적해서(이 effect의 클로저가
  // 마운트 시점의 값을 고정해서 들고 있는 문제를 피한다).
  const effectiveReadOnlyRef = useRef(effectiveReadOnly);
  useEffect(() => {
    effectiveReadOnlyRef.current = effectiveReadOnly;
  }, [effectiveReadOnly]);

  // 에디터 blur 시점에 보류 중이던 원격 최신 변경이 있으면 즉시 자동 적용
  useEffect(() => {
    if (!editor) return;
    const handleBlur = () => {
      if (pendingRemoteDocRef.current) {
        const nextDoc = pendingRemoteDocRef.current;
        pendingRemoteDocRef.current = null;
        lastSyncedDocRef.current = nextDoc;
        editor.commands.setContent(nextDoc, false);
        refreshHeadings();
        setRemoteUpdatedBanner(false);
      }
    };
    editor.on("blur", handleBlur);
    return () => {
      editor.off("blur", handleBlur);
    };
  }, [editor, refreshHeadings]);

  // 모바일/태블릿 PWA 및 브라우저에서 화면을 끄거나 홈으로 스와이프(백그라운드 전환),
  // 혹은 화면을 나갈 때 디바운스 대기 중인 변경사항이 iOS WebKit 동결(Freeze)로 증발하지 않도록 즉시 플러시한다.
  useEffect(() => {
    const flushAutosave = () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
        if (!effectiveReadOnlyRef.current) {
          commitSave();
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushAutosave();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", flushAutosave);
    window.addEventListener("beforeunload", flushAutosave);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", flushAutosave);
      window.removeEventListener("beforeunload", flushAutosave);
      flushAutosave();
      // 뒤로가기가 아닌 경로로 화면이 없어져도 공유 스냅샷을 갱신(이미 했으면 아무 일도 안 함)
      refreshShareRef.current?.();
      // 본문에서 지운 첨부를 Storage에서도 지운다(다른 곳이 쓰면 남김, 공유 가방은 건드리지 않음).
      // 편집기를 닫은 뒤라 되돌리기로 되살릴 수 없는 시점이다(2026-10-07)
      if (!effectiveReadOnlyRef.current && !isOfflineMode) {
        void sweepRemovedAttachments({
          packId: packRef.current.id,
          bagId,
          seen: seenAttachmentUrlsRef.current,
          finalUrls: [
            ...(packRef.current.images ?? []),
            ...extractDocAttachmentUrls(packRef.current.editorDoc),
          ],
        }).catch(() => {});
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

  // ===== 화면 =====
  // 위의 상태·핸들러(자동저장, 원격 반영, 첨부 업로드, 링크 라벨, 검색 이동)를 쓴다.
  // 헤더(뒤로·공유·더보기) → 큰 제목 → 상태 한 줄 → 툴바 한 줄 → 본문. 나머지는 전부 v2 시트.
  {
    const canAttach = !effectiveReadOnly && !!(bagId || user);
    const syncOn = !!pack.autoSyncEnabled;
    const status: "remote" | "size" | "depth" | "together" | "sync" | null = remoteUpdatedBanner
      ? "remote"
      : sizeBlocked
        ? "size"
        : depthBlocked
          ? "depth"
          : otherEditorNickname
            ? "together"
            : bagId && pack.linkedLibraryPackId
              ? "sync"
              : null;

    const applyRemote = () => {
      if (!pendingRemoteDocRef.current || !editor) return;
      const nextDoc = pendingRemoteDocRef.current;
      pendingRemoteDocRef.current = null;
      lastSyncedDocRef.current = nextDoc;
      editor.commands.setContent(nextDoc, false);
      refreshHeadings();
      setRemoteUpdatedBanner(false);
    };

    // 보관함 자동 동기화 켜기/끄기: 가방 팩 시트(usePackOps.toggleAutoSync)와 같은 필드를 onSave로 바꾼다
    const toggleAutoSync = () => {
      if (effectiveReadOnly) return;
      const updated: Pack = { ...packRef.current, autoSyncEnabled: !syncOn };
      packRef.current = updated;
      onSave(updated);
      show(!syncOn ? "보관함 팩과 자동으로 맞춰요" : "보관함 동기화를 껐어요");
    };

    const closeLink = () => {
      setInsertLinkReq(null);
      setLinkMenuUrl(null);
      setManageLinkTarget(null);
    };
    const openInsertLink = () => {
      if (effectiveReadOnly || !editor) return;
      const href = (editor.getAttributes("link").href as string | undefined) || "";
      setInsertLinkReq({ initialUrl: href, canUnlink: editor.isActive("link") });
    };
    // 글자를 골랐거나 링크 안이면 그 글자에, 아니면 주소를 글자로 넣어 링크로 만든다
    const insertLink = (url: string) => {
      if (!editor) return;
      if (editor.isActive("link") || !editor.state.selection.empty) {
        editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
      } else {
        editor
          .chain()
          .focus()
          .insertContent({ type: "text", text: url, marks: [{ type: "link", attrs: { href: url } }] })
          .run();
      }
    };

    const statusText =
      status === "remote"
        ? "다른 기기에서 고친 내용이 있어요"
        : status === "size"
          ? "용량이 커서 저장이 멈췄어요. 표나 글을 조금 줄여 주세요"
          : status === "depth"
            ? "목록·토글이 너무 깊게 겹쳐 저장이 멈췄어요. 몇 개를 바깥으로 꺼내 주세요"
            : status === "together"
              ? `${otherEditorNickname}님과 함께 쓰는 중이에요`
              : syncOn
                ? "보관함 팩과 자동 동기화 중"
                : "보관함 팩과 동기화 꺼짐";

    return (
      <div ref={swipeBackRef} className="pib-v2 flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-canvas">
        {/* 상단 버튼 줄 (가방 화면과 같은 h-11) */}
        <div className="flex h-11 shrink-0 items-center justify-between px-2">
          <IconButton label="뒤로" onClick={handleBack}>
            <IconChevronLeft size={22} stroke={1.9} />
          </IconButton>
          <div className="flex items-center">
            {!isOfflineMode && !pack.isQuickPack && (
              <IconButton label="공유" onClick={() => guardOnline(() => setShowShareModal(true))}>
                <IconShare size={22} stroke={1.75} />
              </IconButton>
            )}
            <IconButton label="더보기" onClick={() => setMoreOpen(true)}>
              <IconDots size={22} stroke={1.75} />
            </IconButton>
          </div>
        </div>

        {/* 제목 */}
        <div className="shrink-0 px-5 pt-2 pb-3">
          <input
            value={name}
            readOnly={effectiveReadOnly}
            aria-label="메모 이름"
            placeholder="새 메모"
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              const next = name.trim() || "새 메모";
              if (next !== packRef.current.name) handleRenamePack(next);
              else if (next !== name) setName(next);
            }}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            className="m-0 w-full bg-transparent text-title font-bold text-ink outline-none placeholder:text-faint"
          />
        </div>

        {/* 상태 한 줄: 최신본 반영 > 저장 멈춤 > 함께 편집 > 보관함 동기화 */}
        {status && (
          <div className="shrink-0 px-5 pb-3">
            <div
              role={status === "size" || status === "depth" ? "alert" : "status"}
              className={cx(
                "flex min-h-11 items-center gap-2 rounded-field bg-fill px-3 text-caption",
                status === "size" || status === "depth" ? "text-alert" : "text-sub",
              )}
            >
              {status === "size" || status === "depth" ? (
                <IconAlertTriangle size={16} stroke={1.9} className="shrink-0" aria-hidden="true" />
              ) : status === "together" ? (
                <IconUsers size={16} stroke={1.9} className="shrink-0 text-brand" aria-hidden="true" />
              ) : (
                <IconRefresh size={16} stroke={1.9} className={cx("shrink-0", status === "sync" && syncOn && "text-brand")} aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1">{statusText}</span>
              {status === "remote" && (
                <button type="button" onClick={applyRemote} className="-my-2 h-11 shrink-0 bg-transparent px-2 font-semibold text-brand active:opacity-60">
                  반영
                </button>
              )}
              {status === "sync" && !effectiveReadOnly && (
                <button type="button" onClick={toggleAutoSync} className="-my-2 h-11 shrink-0 bg-transparent px-2 font-semibold text-brand active:opacity-60">
                  {syncOn ? "끄기" : "켜기"}
                </button>
              )}
            </div>
          </div>
        )}

        {canAttach && (
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              handleUploadAndInsertFiles(e.target.files);
              if (e.target) e.target.value = "";
            }}
          />
        )}

        {!effectiveReadOnly && (
          <NoteToolbar
            editor={editor}
            canAttach={canAttach}
            attachLocked={!isEffectivePremium}
            uploading={uploadingImages}
            onLink={openInsertLink}
            onAttach={() => {
              if (!isEffectivePremium) {
                setShowPdfPremiumModal(true);
                return;
              }
              guardOnline(() => fileInputRef.current?.click(), { localOk: true });
            }}
            onTableMenu={() => setTableSheetOpen(true)}
            onMore={() => setMoreOpen(true)}
            onColor={() => setShowColorPicker(true)}
          />
        )}

        {/* 본문 (+ 넓은 화면은 오른쪽 목차) */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="relative min-h-0 flex-1 overflow-hidden">
            {uploadingImages && (
              <div className="pointer-events-none absolute top-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-4 py-2 text-caption text-on-ink shadow-sheet">
                <IconLoader2 size={16} stroke={2.2} className="animate-spin" />
                <span>{uploadProgressMessage || "파일을 첨부하고 있어요"}</span>
              </div>
            )}
            <div
              className="pib-v2-no-scrollbar h-full overflow-y-auto overscroll-contain px-5 py-4"
              onClick={(e) => {
                const anchor = (e.target as HTMLElement).closest("a");
                if (!anchor) return;
                const href = anchor.getAttribute("href");
                if (!href) return;
                e.preventDefault();
                handleLinkClick(href);
              }}
            >
              <div className="mx-auto w-full max-w-3xl pb-20">
                <EditorContent editor={editor} className="pib-note-editor" />
              </div>
            </div>
          </div>
          {isDesktop && headings.length > 0 && (
            <nav aria-label="목차" className="w-52 shrink-0 overflow-y-auto border-l border-line px-3 py-3">
              <p className="m-0 px-2 pb-2 text-caption font-semibold text-sub">목차</p>
              {headings.map((h, i) => (
                <button
                  key={`${h.pos}-${i}`}
                  type="button"
                  onClick={() => scrollToHeading(h.pos)}
                  className={cx(
                    "flex min-h-9 w-full items-center truncate rounded-field bg-transparent px-2 text-left active:bg-fill",
                    h.level === 1 ? "text-caption font-semibold text-ink" : h.level === 2 ? "pl-5 text-caption text-ink" : "pl-8 text-micro text-sub",
                  )}
                >
                  <span className="truncate">{h.text}</span>
                </button>
              ))}
            </nav>
          )}
        </div>

        {/* 시트 */}
        <NoteMoreSheet
          open={moreOpen}
          onClose={() => setMoreOpen(false)}
          editor={editor}
          readOnly={effectiveReadOnly}
          fontSize={getCurrentFontSize()}
          onFontSize={changeFontSize}
          onOpenColor={() => {
            setMoreOpen(false);
            setShowColorPicker(true);
          }}
          spellcheck={noteSpellcheckEnabled}
          onToggleSpellcheck={() => {
            const next = !noteSpellcheckEnabled;
            updatePackSettings({ noteSpellcheckEnabled: next });
            show(next ? "맞춤법 검사를 켰어요" : "맞춤법 검사를 껐어요");
          }}
          hasHeadings={headings.length > 0}
          onOpenToc={() => {
            setMoreOpen(false);
            setTocOpen(true);
          }}
          canShare={false}
          onShare={() => guardOnline(() => setShowShareModal(true))}
          percentOfLimit={percentOfLimit}
          onDelete={
            onDeletePack
              ? () => {
                  setMoreOpen(false);
                  setConfirmDelete(true);
                }
              : undefined
          }
        />
        <NoteTableSheet
          open={tableSheetOpen}
          onClose={() => setTableSheetOpen(false)}
          editor={editor}
          onDeleteTable={() => {
            setTableSheetOpen(false);
            setConfirmDeleteTable(true);
          }}
        />
        <NoteColorSheet
          open={showColorPicker}
          onClose={() => setShowColorPicker(false)}
          colors={TEXT_COLORS}
          onPick={(hex) => editor?.chain().focus().setColor(hex).run()}
          onClear={() => editor?.chain().focus().unsetColor().run()}
        />
        <NoteTocSheet open={tocOpen} onClose={() => setTocOpen(false)} headings={headings} onPick={scrollToHeading} />
        <LinkSheet
          request={v2LinkRequest}
          user={user}
          onClose={closeLink}
          onOpen={(url) => openExternalLink(url)}
          onUnlink={() => handleUnlink(null)}
          onInsert={insertLink}
          onShortened={(originalUrl, shortUrl, label) => {
            const parsed = parseShortLinkUrl(shortUrl);
            if (parsed) {
              setLinkMetaCache(parsed.kind, parsed.code, { kind: parsed.kind, code: parsed.code, longUrl: originalUrl, label, canEdit: true });
            }
            replaceLinkTextInEditor(editor, originalUrl, shortUrl);
            show("링크를 바꾸었어요");
          }}
          onEdited={(meta, result) => {
            setLinkMetaCache(meta.kind, meta.code, { ...meta, ...result });
            applyLinkLabels();
            show("링크를 수정했어요");
          }}
        />
        <ConfirmSheet
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          title="이 메모를 삭제할까요?"
          message="휴지통으로 옮겨져서 설정 > 휴지통에서 되살릴 수 있어요."
          confirmLabel="삭제"
          danger
          onConfirm={() => onDeletePack?.()}
        />
        <ConfirmSheet
          open={confirmDeleteTable}
          onClose={() => setConfirmDeleteTable(false)}
          title="이 표를 삭제할까요?"
          confirmLabel="삭제"
          danger
          onConfirm={() => editor?.chain().focus().deleteTable().run()}
        />
        <PremiumSheet
          open={showPdfPremiumModal}
          message="메모에 사진·파일을 첨부하거나 여는 건 프리미엄 기능이에요."
          onClose={() => setShowPdfPremiumModal(false)}
          onUnlocked={() => {
            setShowPdfPremiumModal(false);
            show("프리미엄이 적용됐어요. 다시 시도해 주세요");
          }}
        />

        {/* 사진·PDF 크게 보기: 가방 화면과 같은 v2 뷰어 */}
        {lightboxIndex !== null && (
          <PhotoViewer
            images={lightboxImages.length > 0 ? lightboxImages : packImages}
            index={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
            onNavigate={setLightboxIndex}
          />
        )}
        {pdfPreviewUrl && <PdfViewer url={pdfPreviewUrl} fileName={pdfPreviewName} onClose={() => setPdfPreviewUrl(null)} />}
        {!isOfflineMode && (
          <MemoShareSheet
            open={showShareModal}
            // 공유 스냅샷(편집 중인 문서 포함)은 시트가 열려 있을 때만 만든다 - 타이핑마다 getJSON을 돌리지 않게
            pack={
              showShareModal
                ? {
                    ...pack,
                    name,
                    editorDoc: editor?.getJSON() || pack.editorDoc,
                    editorPreviewText: editor ? extractPlainTextPreview(editor.getJSON()) : pack.editorPreviewText,
                  }
                : pack
            }
            bagId={bagId}
            onTokenGenerated={(token) => {
              if (packRef.current.publicShareToken !== token) {
                const updated: Pack = { ...packRef.current, publicShareToken: token };
                packRef.current = updated;
                onSave(updated);
              }
            }}
            onClose={() => setShowShareModal(false)}
          />
        )}
      </div>
    );
  }
}
