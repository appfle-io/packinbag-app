"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import {
  IconArrowLeft,
  IconBold,
  IconItalic,
  IconUnderline,
  IconStrikethrough,
  IconH1,
  IconH2,
  IconH3,
  IconList,
  IconListCheck,
  IconTable,
  IconTablePlus,
  IconTrash,
  IconShare,
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
  IconLink,
} from "@tabler/icons-react";
import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import { Pack } from "@/lib/types";
import MemoPackShareModal from "@/components/MemoPackShareModal";
import { getNoteEditorExtensions } from "@/lib/noteEditorExtensions";
import {
  adjustColumnWidth,
  distributeColumnWidths,
  resetColumnWidths,
  cycleTableDensity,
  setCellBackgroundColor,
  setCellTextAlignment,
  getTableContext,
} from "@/lib/noteEditorTableUtils";
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
import LinkActionMenu from "@/components/LinkActionMenu";
import CustomUrlModal from "@/components/CustomUrlModal";
import ShortenUrlModal from "@/components/ShortenUrlModal";
import EditLinkModal from "@/components/EditLinkModal";

const TEXT_COLORS = [
  { id: "red", hex: "#ef4444", label: "레드" },
  { id: "orange", hex: "#f97316", label: "오렌지" },
  { id: "amber", hex: "#f59e0b", label: "옐로" },
  { id: "green", hex: "#22c55e", label: "그린" },
  { id: "teal", hex: "#14b8a6", label: "틸" },
  { id: "blue", hex: "#3b82f6", label: "블루" },
  { id: "purple", hex: "#a855f7", label: "퍼플" },
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
import { MAX_PACK_IMAGES } from "@/lib/premiumLimits";
import { getFileKind, getFileExtensionLabel, getDisplayFileName } from "@/lib/fileUrlUtils";
import { uploadPackImage, deletePackImage } from "@/lib/storageService";
import EditableText from "@/components/EditableText";
import ConfirmDialog from "@/components/ConfirmDialog";
import Portal from "@/components/Portal";
import ImageLightbox from "@/components/ImageLightbox";
import PdfPreviewModal from "@/components/PdfPreviewModal";
import PremiumLimitModal from "@/components/PremiumLimitModal";
import SlideUpSheet from "@/components/SlideUpSheet";
import { useToast } from "@/components/Toast";
import { useSwipeBack } from "@/lib/useSwipeBack";
import { useIsDesktop } from "@/lib/useIsDesktop";
import { useOverlayLayer, POPOVER_OFFSET } from "@/lib/overlayLayer";

const AUTOSAVE_DEBOUNCE_MS = 600;
// 이미지가 아닌 파일(PDF/기타 문서 형식)은 이미지처럼 압축되지 않고 원본 크기 그대로
// 올라가므로, 큰 파일을 막기 위해 따로 크기 상한을 둔다(2026-08~ 10MB로 상향).
const MAX_PACK_ATTACHMENT_FILE_BYTES = 10 * 1024 * 1024;

function SpellcheckIcon({ size = 17, stroke = 1.75 }: { size?: number; stroke?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 14l3.5 -8h1l3.5 8" />
      <path d="M5.5 11.5h5" />
      <path d="M15 19l2 2l4 -4" />
    </svg>
  );
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
  const swipeBackRef = useSwipeBack<HTMLDivElement>(onBack);
  const { show } = useToast();
  const { user, profile, updatePackSettings } = useAuth();
  const noteSpellcheckEnabled = profile?.packSettings?.noteSpellcheckEnabled ?? false;
  const shortUrlFeatureEnabled = isShortUrlFeatureEnabled(user?.email, profile);
  const [name, setName] = useState(pack.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [tableToolbarTab, setTableToolbarTab] = useState<"table" | "text">("table");
  const [showTableCellColorPicker, setShowTableCellColorPicker] = useState(false);
  // 툴바 파일첨부(사진/PDF) 관련 상태 - BagEditorScreen의 가방 이미지 기능과 동일한 패턴.
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadProgressMessage, setUploadProgressMessage] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [imageDeleteIndex, setImageDeleteIndex] = useState<number | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [showPdfPremiumModal, setShowPdfPremiumModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const COLLAB_COLORS = [
    "#f43f5e",
    "#8b5cf6",
    "#0ea5e9",
    "#10b981",
    "#f59e0b",
    "#ec4899",
    "#6366f1",
    "#14b8a6",
  ];

  function getCollaboratorColor(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
    }
    return COLLAB_COLORS[Math.abs(hash) % COLLAB_COLORS.length];
  }

  // 실시간 동시 수정(Yjs + WebRTC) 설정: 가방 안의 메모팩인 경우 브라우저 간 P2P로 직접 통신하여
  // Firestore 읽기/쓰기 없이($0) 실시간 동시 타이핑 및 커서를 지원한다.
  const [collab, setCollab] = useState<{
    ydoc: Y.Doc;
    provider: WebrtcProvider;
  } | null>(null);

  const [activePeers, setActivePeers] = useState<{ name: string; color: string }[]>([]);

  const myNickname = profile?.nickname || user?.displayName || "익명";
  const myColor = getCollaboratorColor(user?.uid || myNickname);

  useEffect(() => {
    if (!bagId || typeof window === "undefined") return;
    const ydoc = new Y.Doc();
    const roomName = `pib-bag-${bagId}-pack-${pack.id}`;
    const provider = new WebrtcProvider(roomName, ydoc, {
      signaling: [
        "wss://signaling.yjs.dev",
        "wss://y-webrtc-signaling-eu.herokuapp.com",
        "wss://y-webrtc-signaling-us.herokuapp.com",
      ],
    });

    provider.awareness.setLocalStateField("user", {
      name: myNickname,
      color: myColor,
    });

    const updatePeers = () => {
      const states = Array.from(provider.awareness.getStates().entries());
      const clientID = provider.awareness.clientID;
      const peers = states
        .filter(([id, state]) => id !== clientID && state.user?.name)
        .map(([, state]) => state.user as { name: string; color: string });
      setActivePeers(peers);
    };

    provider.awareness.on("change", updatePeers);
    updatePeers();

    setCollab({ ydoc, provider });

    return () => {
      provider.awareness.off("change", updatePeers);
      provider.destroy();
      ydoc.destroy();
      setCollab(null);
    };
  }, [bagId, pack.id, myNickname, myColor]);

  // 실시간 동시 수정을 지원하므로 다른 사람이 열어보고 있어도 읽기전용으로 잠그지 않는다.
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
  const ambientLayer = useOverlayLayer();
  const [tocOpen, setTocOpen] = useState(false);
  const [headings, setHeadings] = useState<{ pos: number; level: number; text: string }[]>([]);

  const packRef = useRef(pack);
  const nameRef = useRef(name);
  useEffect(() => {
    nameRef.current = name;
  }, [name]);

  // 링크(Link 마크)를 탭했을 때 띄우는 선택 시트의 대상 URL. "짧은 URL로 변경"이 가능한
  // 링크(프리미엄 + 토글 ON + 아직 축약 전)만 이 메뉴를 띄우고, 그러지 않으면 바로 연다.
  const [linkMenuUrl, setLinkMenuUrl] = useState<string | null>(null);
  // "커스텀 URL로 변경"을 누르면 이 값이 채워져 입력 시트(CustomUrlModal)가 열린다.
  const [customizeLinkUrl, setCustomizeLinkUrl] = useState<string | null>(null);
  // "짧은 URL로 변경"을 누르면 이 값이 채워져 표시 이름 입력 시트(ShortenUrlModal)가 열린다.
  const [shortenLinkUrl, setShortenLinkUrl] = useState<string | null>(null);
  // 이미 축약된 링크를 탭했을 때, 본인이 만든 링크로 확인되면(fetchLinkMeta의 canEdit) 이
  // 값이 채워져 "열기/수정" 선택 시트가 뜬다. 다른 사람이 만든 링크면 메뉴 없이 바로 열린다.
  const [manageLinkTarget, setManageLinkTarget] = useState<{ url: string; meta: LinkMeta } | null>(null);
  // "수정"을 누르면 이 값이 채워져 이름/주소 수정 시트(EditLinkModal)가 열린다.
  const [editLinkTarget, setEditLinkTarget] = useState<{ url: string; meta: LinkMeta } | null>(null);

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
      if (!premium) {
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
          const url = await uploadPackImage(uploadTargetId, packRef.current.id, file, !!bagId);
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
    [effectiveReadOnly, bagId, user, premium]
  );

  const editor = useEditor(
    {
      extensions: getNoteEditorExtensions({
        placeholder: "메모를 입력해보세요",
        collaboration: collab?.ydoc ? { document: collab.ydoc } : undefined,
        collaborationCursor: collab?.provider
          ? {
              provider: collab.provider,
              user: {
                name: myNickname,
                color: myColor,
              },
            }
          : undefined,
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
            if (src) {
              event.preventDefault();
              if (kind === "pdf") {
                setPdfPreviewUrl(src);
              } else {
                openExternalLink(src);
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
            handleUploadAndInsertFiles(files);
            return true;
          }

          return false;
        },
        handleDrop: (view, event, _slice, moved) => {
          if (!moved && event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
            event.preventDefault();
            const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });
            handleUploadAndInsertFiles(event.dataTransfer.files, coordinates?.pos);
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
    [collab, effectiveReadOnly, noteSpellcheckEnabled, handleUploadAndInsertFiles]
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

  // 기존 작성된 메모팩 내용이 마운트 시 즉시 정상 렌더링되도록 보장
  const initialContentSeededRef = useRef(false);
  useEffect(() => {
    if (!editor) return;
    const targetDoc = initialMigratedDoc || pack.editorDoc;
    if (targetDoc && (editor.isEmpty || !initialContentSeededRef.current)) {
      if (editor.isEmpty) {
        editor.commands.setContent(targetDoc, false);
      }
      initialContentSeededRef.current = true;
    }
  }, [editor, collab, pack.editorDoc, initialMigratedDoc]);

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

  const lastSyncedDocRef = useRef(pack.editorDoc);
  useEffect(() => {
    // 실시간 협업 모드일 때는 Yjs가 동기화를 직접 처리하므로 setContent 불필요
    if (!editor || collab?.ydoc) return;
    if (pack.editorDoc === lastSyncedDocRef.current) return;
    lastSyncedDocRef.current = pack.editorDoc;
    editor.commands.setContent(pack.editorDoc ?? "", false);
    refreshHeadings();
  }, [editor, collab, pack.editorDoc, refreshHeadings]);

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

  useEffect(() => {
    if (!editor) return;
    applyLinkLabels();
  }, [editor, pack.editorDoc, applyLinkLabels]);

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
    const depthError = checkEditorDocDepthForSave(doc);
    if (depthError) {
      setDepthBlocked(true);
      return;
    }
    setDepthBlocked(false);
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

  const toggleLink = () => {
    if (effectiveReadOnly || !editor) return;
    if (editor.isActive("link")) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      show("링크를 해제했어요");
      return;
    }
    const previousUrl = (editor.getAttributes("link").href as string | undefined) || "";
    const url = window.prompt("연결할 웹 주소(URL)를 입력해주세요", previousUrl || "https://");
    if (url === null) return;
    const trimmed = url.trim();
    if (!trimmed) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    const finalUrl = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    editor.chain().focus().extendMarkRange("link").setLink({ href: finalUrl }).run();
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

    // 메모팩 첨부파일은 프리미엄 전용 기능 (무료 회원은 첨부 불가)
    if (!premium) {
      setShowPdfPremiumModal(true);
      return;
    }

    const currentImages = packRef.current.images ?? [];
    const selected = Array.from(files).slice(0, MAX_PACK_IMAGES - currentImages.length);

    const isNonImageFile = (f: File) => !f.type.startsWith("image/");
    const toUpload = selected;
    if (toUpload.length === 0) return;

    const oversized = toUpload.find(
      (f) => isNonImageFile(f) && f.size > MAX_PACK_ATTACHMENT_FILE_BYTES
    );
    if (oversized) {
      show("이미지가 아닌 파일은 10MB 이하만 첨부할 수 있어요");
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
      onMouseDown={(e) => e.preventDefault()}
      aria-label={label}
      title={label}
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
        {!pack.isQuickPack && (
          <button
            onClick={() => setShowShareModal(true)}
            aria-label="팩 공유"
            className="-m-2.5 p-2.5 shrink-0 text-text-secondary hover:text-foreground transition-colors"
          >
            <IconShare size={19} stroke={1.75} />
          </button>
        )}
        {onDeletePack && !effectiveReadOnly && (
          <button onClick={() => setConfirmDelete(true)} aria-label="팩 삭제" className="-m-2.5 p-2.5 shrink-0">
            <IconTrash size={19} stroke={1.75} color="var(--danger)" />
          </button>
        )}
      </div>

      {(!effectiveReadOnly && (bagId || user)) && (
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

      {activePeers.length > 0 ? (
        <div
          className="mx-4 mb-2 flex items-center justify-between gap-2 rounded-xl px-3.5 py-2 text-[12.5px] shrink-0 border border-accent/20 bg-accent-soft text-foreground"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
            </span>
            <span className="font-medium text-accent truncate">
              {activePeers.map((p) => p.name).join(", ")}님과 실시간으로 함께 작성 중이에요
            </span>
          </div>
          <div className="flex items-center -space-x-1.5 overflow-hidden shrink-0">
            {activePeers.map((p, i) => (
              <span
                key={i}
                className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white shadow-xs ring-2 ring-surface"
                style={{ backgroundColor: p.color }}
                title={p.name}
              >
                {p.name.slice(0, 1)}
              </span>
            ))}
          </div>
        </div>
      ) : otherEditorNickname ? (
        <div
          className="mx-4 mb-2 flex items-center gap-2 rounded-xl px-3.5 py-2 text-[12.5px] shrink-0 border border-border bg-surface-2 text-text-secondary"
        >
          <IconUsers size={15} stroke={1.75} className="shrink-0 text-accent" />
          <span>{otherEditorNickname}님이 접속 중이에요 · 실시간으로 함께 작성할 수 있어요</span>
        </div>
      ) : null}

      {sizeBlocked && (
        <div
          className="mx-4 mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] shrink-0"
          style={{ background: "var(--danger-soft, #fee2e2)", color: "var(--danger)" }}
        >
          <IconAlertTriangle size={15} stroke={1.75} className="shrink-0" />
          메모 용량이 너무 커서 지금 상태는 저장되지 않고 있어요. 표나 텍스트를 좀 줄여주세요.
        </div>
      )}

      {depthBlocked && (
        <div
          className="mx-4 mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] shrink-0"
          style={{ background: "var(--danger-soft, #fee2e2)", color: "var(--danger)" }}
        >
          <IconAlertTriangle size={15} stroke={1.75} className="shrink-0" />
          토글(&gt; 접기)이나 리스트가 너무 깊게 겹쳐 있어서 지금 상태는 저장되지 않고 있어요.
          일부 항목을 리스트/토글 바깥으로 꺼내서 평평하게 정리해주세요.
        </div>
      )}

      {!effectiveReadOnly && (
        <div className="flex items-center gap-1 px-3 pb-2 shrink-0 overflow-x-auto no-scrollbar border-b border-border">
          {editor?.isActive("table") && tableToolbarTab === "table" ? (
            /* ===== 표 전용 인라인 툴바 ===== */
            <>
              <button
                onClick={() => setTableToolbarTab("text")}
                onMouseDown={(e) => e.preventDefault()}
                aria-label="글자 서식 툴바로 전환"
                title="글자 서식 툴바로 전환 (굵게, 글자크기, 색상 등)"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold bg-surface-2 border border-border text-foreground hover:bg-surface shrink-0"
              >
                <span className="text-[13px] font-bold text-accent">T</span>
                <span>글자서식</span>
              </button>
              <div className="w-px h-5 bg-border shrink-0 mx-0.5" />

              {/* 너비 조절 그룹 */}
              <div className="flex items-center gap-0.5 bg-surface-2/60 rounded-lg p-0.5 border border-border/50 shrink-0">
                <ToolbarButton
                  onClick={() => {
                    const ok = adjustColumnWidth(editor, -20);
                    if (ok) show("현재 열 너비 축소 (-20px)");
                  }}
                  label="W- : 현재 열 너비 20px 감소"
                >
                  <span className="text-[11.5px] font-bold px-0.5">W-</span>
                </ToolbarButton>
                <ToolbarButton
                  onClick={() => {
                    const ok = adjustColumnWidth(editor, 20);
                    if (ok) show("현재 열 너비 확대 (+20px)");
                  }}
                  label="W+ : 현재 열 너비 20px 증가"
                >
                  <span className="text-[11.5px] font-bold px-0.5">W+</span>
                </ToolbarButton>
                <ToolbarButton
                  onClick={() => {
                    const ok = distributeColumnWidths(editor);
                    if (ok) show("모든 열 너비 균등 분할");
                  }}
                  label="W= : 모든 열 너비 균등 분할"
                >
                  <span className="text-[11.5px] font-bold px-0.5">W=</span>
                </ToolbarButton>
                <ToolbarButton
                  onClick={() => {
                    const ok = resetColumnWidths(editor);
                    if (ok) show("열 너비 자동 맞춤으로 초기화");
                  }}
                  label="자동 : 내용에 맞게 열 너비 자동 맞춤"
                >
                  <span className="text-[11px] font-medium px-0.5">자동</span>
                </ToolbarButton>
              </div>
              <div className="w-px h-5 bg-border shrink-0 mx-0.5" />

              {/* 높이 / 밀도 조절 */}
              <ToolbarButton
                onClick={() => {
                  const next = cycleTableDensity(editor);
                  const label =
                    next === "compact" ? "좁게 (콤팩트)" : next === "spacious" ? "넓게 (여유있게)" : "보통";
                  show(`표 행 간격: ${label}`);
                }}
                label="H↕ : 행 높이(간격) 조절 (좁게 / 보통 / 넓게)"
              >
                <span className="text-[11.5px] font-bold px-0.5">H↕</span>
              </ToolbarButton>
              <div className="w-px h-5 bg-border shrink-0 mx-0.5" />

              {/* 셀 병합 & 분할 */}
              <ToolbarButton
                onClick={() => {
                  editor?.chain().focus().mergeCells().run();
                }}
                label="셀 병합 : 선택한 여러 셀 합치기"
              >
                <span className="text-[11.5px] font-medium px-0.5">병합</span>
              </ToolbarButton>
              <ToolbarButton
                onClick={() => {
                  editor?.chain().focus().splitCell().run();
                }}
                label="셀 분할 : 병합된 셀 원래대로 나누기"
              >
                <span className="text-[11.5px] font-medium px-0.5">분할</span>
              </ToolbarButton>
              <div className="w-px h-5 bg-border shrink-0 mx-0.5" />

              {/* 행 관리 */}
              <div className="flex items-center gap-0.5 bg-surface-2/60 rounded-lg p-0.5 border border-border/50 shrink-0">
                <ToolbarButton
                  onClick={() => editor?.chain().focus().addRowBefore().run()}
                  label="행+↑ : 현재 행 위에 새 행 추가"
                >
                  <span className="text-[11.5px] font-medium px-0.5">행+↑</span>
                </ToolbarButton>
                <ToolbarButton
                  onClick={() => editor?.chain().focus().addRowAfter().run()}
                  label="행+↓ : 현재 행 아래에 새 행 추가"
                >
                  <span className="text-[11.5px] font-medium px-0.5">행+↓</span>
                </ToolbarButton>
                <ToolbarButton
                  onClick={() => editor?.chain().focus().deleteRow().run()}
                  label="행- : 현재 행 삭제"
                >
                  <span className="text-[11.5px] font-medium px-0.5 text-danger">행-</span>
                </ToolbarButton>
              </div>
              <div className="w-px h-5 bg-border shrink-0 mx-0.5" />

              {/* 열 관리 */}
              <div className="flex items-center gap-0.5 bg-surface-2/60 rounded-lg p-0.5 border border-border/50 shrink-0">
                <ToolbarButton
                  onClick={() => editor?.chain().focus().addColumnBefore().run()}
                  label="열+← : 현재 열 왼쪽에 새 열 추가"
                >
                  <span className="text-[11.5px] font-medium px-0.5">열+←</span>
                </ToolbarButton>
                <ToolbarButton
                  onClick={() => editor?.chain().focus().addColumnAfter().run()}
                  label="열+→ : 현재 열 오른쪽에 새 열 추가"
                >
                  <span className="text-[11.5px] font-medium px-0.5">열+→</span>
                </ToolbarButton>
                <ToolbarButton
                  onClick={() => editor?.chain().focus().deleteColumn().run()}
                  label="열- : 현재 열 삭제"
                >
                  <span className="text-[11.5px] font-medium px-0.5 text-danger">열-</span>
                </ToolbarButton>
              </div>
              <div className="w-px h-5 bg-border shrink-0 mx-0.5" />

              {/* 정렬 & 배경색 */}
              <ToolbarButton onClick={() => setCellTextAlignment(editor, "left")} label="좌측 정렬 : 셀 내용 왼쪽 정렬">
                <span className="text-[11px] font-semibold px-0.5">좌</span>
              </ToolbarButton>
              <ToolbarButton onClick={() => setCellTextAlignment(editor, "center")} label="가운데 정렬 : 셀 내용 중앙 정렬">
                <span className="text-[11px] font-semibold px-0.5">중</span>
              </ToolbarButton>
              <ToolbarButton onClick={() => setCellTextAlignment(editor, "right")} label="우측 정렬 : 셀 내용 오른쪽 정렬 (금액/수량)">
                <span className="text-[11px] font-semibold px-0.5">우</span>
              </ToolbarButton>
              <div className="relative">
                <ToolbarButton
                  onClick={() => setShowTableCellColorPicker((v) => !v)}
                  active={showTableCellColorPicker}
                  label="셀 배경색 : 선택한 셀에 하이라이트 색상 채우기"
                >
                  <IconPalette size={17} stroke={1.75} />
                </ToolbarButton>
                {showTableCellColorPicker && (
                  <div
                    className="absolute left-0 top-full mt-1 bg-surface border border-border rounded-xl shadow-xl p-2 z-30 flex gap-1.5 shrink-0"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {[
                      { label: "기본 (투명)", color: null, bg: "transparent", border: true },
                      { label: "파스텔 노랑", color: "#fef9c3", bg: "#fef9c3" },
                      { label: "파스텔 초록", color: "#dcfce7", bg: "#dcfce7" },
                      { label: "파스텔 파랑", color: "#e0f2fe", bg: "#e0f2fe" },
                      { label: "파스텔 분홍", color: "#fce7f3", bg: "#fce7f3" },
                      { label: "파스텔 보라", color: "#f3e8ff", bg: "#f3e8ff" },
                      { label: "파스텔 주황", color: "#ffedd5", bg: "#ffedd5" },
                      { label: "파스텔 회색", color: "#f3f4f6", bg: "#f3f4f6" },
                    ].map((p, idx) => (
                      <button
                        key={idx}
                        title={p.label}
                        aria-label={p.label}
                        onClick={() => {
                          setCellBackgroundColor(editor, p.color);
                          setShowTableCellColorPicker(false);
                        }}
                        className="w-6 h-6 rounded-full border border-border hover:scale-110 transition-transform flex items-center justify-center text-[10px]"
                        style={{ backgroundColor: p.bg }}
                      >
                        {p.color === null && "✕"}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="w-px h-5 bg-border shrink-0 mx-0.5" />

              {/* 표 삭제 */}
              <ToolbarButton
                onClick={() => {
                  if (confirm("정말 이 표를 삭제할까요?")) {
                    editor?.chain().focus().deleteTable().run();
                  }
                }}
                label="표 삭제 : 표 전체를 삭제합니다"
              >
                <IconTrash size={16} stroke={1.75} className="text-danger" />
              </ToolbarButton>
            </>
          ) : (
            /* ===== 일반 서식 툴바 ===== */
            <>
              {editor?.isActive("table") && (
                <>
                  <button
                    onClick={() => setTableToolbarTab("table")}
                    onMouseDown={(e) => e.preventDefault()}
                    aria-label="표 편집 툴바로 전환"
                    title="표 편집 툴바로 전환 (너비, 높이, 행/열 조작 등)"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold bg-accent text-white shrink-0 shadow-sm"
                  >
                    <IconTable size={14} stroke={2} />
                    <span>표 편집</span>
                  </button>
                  <div className="w-px h-5 bg-border shrink-0 mx-0.5" />
                </>
              )}
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  onClick={() => changeFontSize(-1)}
                  onMouseDown={(e) => e.preventDefault()}
                  aria-label="글자 크기 줄이기"
                  title="글자 크기 줄이기"
                  disabled={getCurrentFontSize() <= 8}
                  className="rounded-lg p-1.5 disabled:opacity-30"
                >
                  <IconMinus size={14} stroke={1.75} />
                </button>
                <span className="text-[11px] w-6 text-center tabular-nums" style={{ color: "var(--text-secondary)" }}>
                  {getCurrentFontSize()}
                </span>
                <button
                  onClick={() => changeFontSize(1)}
                  onMouseDown={(e) => e.preventDefault()}
                  aria-label="글자 크기 키우기"
                  title="글자 크기 키우기"
                  disabled={getCurrentFontSize() >= 28}
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
                  label="글씨 색상 변경"
                >
                  <IconPalette size={17} stroke={1.75} />
                </ToolbarButton>
              </div>
              <ToolbarButton
                onClick={toggleLink}
                active={editor?.isActive("link")}
                label={editor?.isActive("link") ? "링크 해제 (일반 글자로 변경)" : "링크 삽입"}
              >
                <IconLink size={17} stroke={1.75} />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
                active={editor?.isActive("heading", { level: 1 })}
                label="제목 1 (H1)"
              >
                <IconH1 size={17} stroke={1.75} />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                active={editor?.isActive("heading", { level: 2 })}
                label="제목 2 (H2)"
              >
                <IconH2 size={17} stroke={1.75} />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
                active={editor?.isActive("heading", { level: 3 })}
                label="제목 3 (H3)"
              >
                <IconH3 size={17} stroke={1.75} />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor?.chain().focus().toggleTaskList().run()}
                active={editor?.isActive("taskList")}
                label="체크박스 목록"
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
                label="표 삽입 (2x2)"
              >
                <IconTable size={17} stroke={1.75} />
              </ToolbarButton>
              {(!effectiveReadOnly && (bagId || user)) && (
                <ToolbarButton
                  onClick={() => {
                    if (!premium) {
                      setShowPdfPremiumModal(true);
                      return;
                    }
                    fileInputRef.current?.click();
                  }}
                  disabled={uploadingImages}
                  label={premium ? "사진 및 파일 첨부" : "사진 및 파일 첨부 (프리미엄 전용)"}
                >
                  {uploadingImages ? (
                    <IconLoader2 size={17} stroke={1.75} className="animate-spin" />
                  ) : (
                    <div className="relative">
                      <IconPaperclip size={17} stroke={1.75} />
                      {!premium && (
                        <span
                          className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full flex items-center justify-center"
                          style={{ background: "rgba(0,0,0,0.6)" }}
                        >
                          <IconLock size={7} stroke={2} color="#fff" />
                        </span>
                      )}
                    </div>
                  )}
                </ToolbarButton>
              )}
              <ToolbarButton
                onClick={() => {
                  const next = !noteSpellcheckEnabled;
                  updatePackSettings({ noteSpellcheckEnabled: next });
                  show(next ? "맞춤법 검사를 켰어요 (빨간 밑줄 표시)" : "맞춤법 검사를 껐어요 (빨간 밑줄 숨김)");
                }}
                active={noteSpellcheckEnabled}
                label={noteSpellcheckEnabled ? "맞춤법 검사 끄기 (빨간 밑줄 숨김)" : "맞춤법 검사 켜기 (빨간 밑줄 표시)"}
              >
                <SpellcheckIcon size={17} stroke={1.75} />
              </ToolbarButton>
            </>
          )}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <div className="relative flex-1 overflow-hidden">
          {uploadingImages && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/90 text-white dark:bg-white/95 dark:text-slate-900 shadow-xl backdrop-blur-md text-[13px] font-medium pointer-events-none transition-all duration-200 border border-white/10 dark:border-black/10 animate-in fade-in slide-in-from-top-2">
              <IconLoader2 size={16} stroke={2.2} className="animate-spin text-accent" />
              <span>{uploadProgressMessage || "파일을 첨부하고 있어요..."}</span>
            </div>
          )}
          <div
            className="h-full overflow-y-auto px-4 py-4 md:px-10 md:py-8 scrollbar-thin"
            onClick={(e) => {
              const anchor = (e.target as HTMLElement).closest("a");
              if (!anchor) return;
              const href = anchor.getAttribute("href");
              if (!href) return;
              e.preventDefault();
              handleLinkClick(href);
            }}
          >
            <div className="max-w-4xl mx-auto pb-20">
              <EditorContent editor={editor} className="pib-note-editor" />
            </div>
          </div>
          {!isDesktop && headings.length > 0 && (
            <button
              onClick={() => setTocOpen(true)}
              aria-label="목차"
              className="absolute bottom-4 right-4 h-11 w-11 rounded-full flex items-center justify-center shadow-lg z-20"
              style={{ background: "var(--accent)" }}
            >
              <IconList size={20} stroke={1.75} color="#fff" />
            </button>
          )}
        </div>
        {isDesktop && headings.length > 0 && (
          <div className="w-52 shrink-0 border-l border-border overflow-y-auto py-3 px-2">
            <div
              className="text-[12px] font-medium px-2 mb-1"
              style={{ color: "var(--text-secondary)" }}
            >
              목차
            </div>
            {headings.map((h, i) => (
              <button
                key={i}
                onClick={() => scrollToHeading(h.pos)}
                className="w-full text-left rounded-lg px-2 py-1.5 truncate"
                style={{
                  paddingLeft: 8 + (h.level - 1) * 14,
                  fontSize: h.level === 1 ? 13.5 : h.level === 2 ? 13 : 12.5,
                  fontWeight: h.level === 1 ? 600 : 500,
                  color: h.level === 3 ? "var(--text-secondary)" : "var(--foreground)",
                }}
              >
                {h.text}
              </button>
            ))}
          </div>
        )}
      </div>

      {linkMenuUrl && (
        <LinkActionMenu
          url={linkMenuUrl}
          onOpen={() => openExternalLink(linkMenuUrl)}
          onUnlink={() => handleUnlink(null)}
          onShorten={() => setShortenLinkUrl(linkMenuUrl)}
          onCustomize={() => setCustomizeLinkUrl(linkMenuUrl)}
          onClose={() => setLinkMenuUrl(null)}
        />
      )}

      {manageLinkTarget && (
        <LinkActionMenu
          url={manageLinkTarget.url}
          onOpen={() => {
            openExternalLink(manageLinkTarget.url);
            setManageLinkTarget(null);
          }}
          onUnlink={() => {
            handleUnlink(null);
            setManageLinkTarget(null);
          }}
          onManage={() => {
            setEditLinkTarget(manageLinkTarget);
            setManageLinkTarget(null);
          }}
          onClose={() => setManageLinkTarget(null)}
        />
      )}

      {shortenLinkUrl && user && (
        <ShortenUrlModal
          url={shortenLinkUrl}
          user={user}
          onSuccess={({ shortUrl, label }) => {
            const parsed = parseShortLinkUrl(shortUrl);
            if (parsed) {
              setLinkMetaCache(parsed.kind, parsed.code, {
                kind: parsed.kind,
                code: parsed.code,
                longUrl: shortenLinkUrl,
                label,
                canEdit: true,
              });
            }
            replaceLinkTextInEditor(editor, shortenLinkUrl, shortUrl);
            show("링크를 짧게 줄였어요");
            setShortenLinkUrl(null);
          }}
          onClose={() => setShortenLinkUrl(null)}
        />
      )}

      {customizeLinkUrl && user && (
        <CustomUrlModal
          url={customizeLinkUrl}
          user={user}
          onSuccess={({ shortUrl, label }) => {
            const parsed = parseShortLinkUrl(shortUrl);
            if (parsed) {
              setLinkMetaCache(parsed.kind, parsed.code, {
                kind: parsed.kind,
                code: parsed.code,
                longUrl: customizeLinkUrl,
                label,
                canEdit: true,
              });
            }
            replaceLinkTextInEditor(editor, customizeLinkUrl, shortUrl);
            show("커스텀 URL로 바꾸었어요");
            setCustomizeLinkUrl(null);
          }}
          onClose={() => setCustomizeLinkUrl(null)}
        />
      )}

      {editLinkTarget && user && (
        <EditLinkModal
          kind={editLinkTarget.meta.kind}
          code={editLinkTarget.meta.code}
          initialLabel={editLinkTarget.meta.label}
          initialLongUrl={editLinkTarget.meta.longUrl}
          user={user}
          onSuccess={(result) => {
            setLinkMetaCache(editLinkTarget.meta.kind, editLinkTarget.meta.code, {
              ...editLinkTarget.meta,
              ...result,
            });
            applyLinkLabels();
            show("링크를 수정했어요");
            setEditLinkTarget(null);
          }}
          onClose={() => setEditLinkTarget(null)}
        />
      )}

      {showColorPicker && (
        <Portal>
          <div
            className="fixed inset-0 flex items-end justify-center"
            style={{ zIndex: ambientLayer + POPOVER_OFFSET, background: "rgba(0,0,0,0.35)" }}
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
                {TEXT_COLORS.map((c) => (
                  <button
                    key={c.id}
                    onMouseDown={(e) => e.preventDefault()}
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
          images={lightboxImages.length > 0 ? lightboxImages : packImages}
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
          message="메모팩에 사진 및 파일을 첨부하거나 여는 것은 프리미엄 전용 기능이에요. 이용권 코드를 등록하면 바로 쓸 수 있어요."
          onClose={() => setShowPdfPremiumModal(false)}
          onUnlocked={() => {
            setShowPdfPremiumModal(false);
            show("이용권 코드가 적용됐어요! 다시 시도해주세요");
          }}
        />
      )}

      <SlideUpSheet active={tocOpen} onBackdropClick={() => setTocOpen(false)}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <span className="text-[15px] font-medium">목차</span>
          <button onClick={() => setTocOpen(false)} aria-label="닫기">
            <IconX size={18} stroke={1.75} color="var(--text-secondary)" />
          </button>
        </div>
        <div
          className="overflow-y-auto px-3 py-2"
          style={{ paddingBottom: "max(12px, calc(env(safe-area-inset-bottom) + 12px))" }}
        >
          {headings.map((h, i) => (
            <button
              key={i}
              onClick={() => scrollToHeading(h.pos)}
              className="w-full text-left rounded-lg px-3 py-2.5 truncate"
              style={{
                paddingLeft: 12 + (h.level - 1) * 16,
                fontSize: h.level === 1 ? 15 : h.level === 2 ? 14 : 13,
                fontWeight: h.level === 1 ? 600 : 500,
                color: h.level === 3 ? "var(--text-secondary)" : "var(--foreground)",
              }}
            >
              {h.text}
            </button>
          ))}
        </div>
      </SlideUpSheet>

      {showShareModal && (
        <MemoPackShareModal
          pack={{
            ...pack,
            editorDoc: editor?.getJSON() || pack.editorDoc,
            editorPreviewText: editor ? extractPlainTextPreview(editor.getJSON()) : pack.editorPreviewText,
          }}
          bagId={bagId}
          onTokenGenerated={(token) => {
            if (pack.publicShareToken !== token) {
              onSave({
                ...pack,
                publicShareToken: token,
                editorDoc: editor?.getJSON() || pack.editorDoc,
                editorPreviewText: editor ? extractPlainTextPreview(editor.getJSON()) : pack.editorPreviewText,
              });
            }
          }}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
}
