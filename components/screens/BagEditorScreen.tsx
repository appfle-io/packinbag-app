"use client";

import { useEffect, useRef, useState } from "react";
import {
  IconArrowLeft,
  IconPhoto,
  IconPlus,
  IconX,
  IconTrash,
  IconLogout,
  IconUsers,
  IconSparkles,
  IconLock,
  IconLoader2,
  IconChevronDown,
  IconChevronRight,
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconFileText,
  IconLayoutGrid,
  IconNotes,
  IconPackageImport,
  IconPackage,
  IconEye,
  IconEyeOff,
  IconSquareCheck,
  IconSquare,
  IconArrowBackUp,
  IconArrowForwardUp,
  IconRefresh,
  IconShare,
  IconChecklist,
  IconUser,
  IconCheck,
} from "@tabler/icons-react";
import { Bag, BagComment, BagReactionDoc, Item, Pack, ReactionEmoji, ReminderOffset, RichSpan } from "@/lib/types";
import { useAuth } from "@/contexts/AuthProvider";
import EditableText from "@/components/EditableText";
import BagNotice from "@/components/BagNotice";
import type { BagNoticeHandle } from "@/components/BagNotice";
import BagChatPreview from "@/components/BagChatPreview";
import BagQuickAddRow from "@/components/BagQuickAddRow";
import BagQuickAddBar from "@/components/BagQuickAddBar";
import TravelDateField from "@/components/TravelDateField";
import type { TravelDateFieldHandle } from "@/components/TravelDateField";
import PackGrid from "@/components/PackGrid";
import NotebookView from "@/components/NotebookView";
import PackChipBar from "@/components/PackChipBar";
import ItemEditModal from "@/components/ItemEditModal";
import PackImportModal from "@/components/PackImportModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import SaveAsDialog from "@/components/SaveAsDialog";
import PackUpdateDialog from "@/components/PackUpdateDialog";
import GroupMembersModal from "@/components/GroupMembersModal";
import AiOrganizeModal from "@/components/AiOrganizeModal";
import AiFeatureMenu from "@/components/AiFeatureMenu";
import AiClipboardModal, { AiClipboardResult } from "@/components/AiClipboardModal";
import ItemThreadSheet from "@/components/ItemThreadSheet";
import ReactionPickerPopover from "@/components/ReactionPickerPopover";
import PackNoteEditorScreen from "@/components/screens/PackNoteEditorScreen";
import Portal from "@/components/Portal";
import SlideScreen from "@/components/SlideScreen";
import { subscribeToComments } from "@/lib/commentsService";
import { subscribeToReactions, toggleReaction } from "@/lib/reactionsService";
import { buildMentionMembers } from "@/lib/mentions";
import { fetchDeletedAccountIds } from "@/lib/accountService";
import NotebookQuickAddModal, { QuickAddItemData } from "@/components/NotebookQuickAddModal";
import { useToast } from "@/components/Toast";
import { uploadBagImage, deleteBagImage } from "@/lib/storageService";
import { saveBagRemote, movePackBetweenBagsRemote } from "@/lib/bagsService";
import { deleteLibraryPackRemote, updateLibraryPackEditorContent } from "@/lib/packsService";
import { isInSyncWithLibrary, resolveEditorSyncDirection, buildEditorSyncPatch } from "@/lib/packSync";
import { checkBagSizeForSave } from "@/lib/editorDocLimits";
import { getDisplayOrderedItems } from "@/lib/itemDisplayOrder";
import { collectDescendantPackIds } from "@/lib/packsService";
import {
  resolveCityInfo,
  fetchWeatherForCity,
  fetchAiTravelPlaces,
  WeatherInfo,
  TravelRecommendation,
} from "@/lib/weatherService";
import { firebaseErrorCode } from "@/lib/errorMessage";
import PresenceBar from "@/components/PresenceBar";
import {
  joinPresence,
  subscribeToPresence,
  setEditingNotePack,
  PRESENCE_STALE_MS,
  RawPresence,
} from "@/lib/presenceService";
import ImageLightbox from "@/components/ImageLightbox";
import PdfPreviewModal from "@/components/PdfPreviewModal";
import PremiumLimitModal from "@/components/PremiumLimitModal";
import PackingModeModal from "@/components/PackingModeModal";
import AssigneeSelectModal from "@/components/AssigneeSelectModal";
import ShareCardModal from "@/components/ShareCardModal";
import AiBagAuditModal from "@/components/AiBagAuditModal";
import { MAX_BAG_IMAGES, FREE_MAX_USER_BAG_IMAGES, isPremiumUser, getViewablePacks } from "@/lib/premiumLimits";
import { getFileKind, getFileExtensionLabel } from "@/lib/fileUrlUtils";
import { openExternalLink } from "@/lib/openExternalLink";
import { useSwipeBack } from "@/lib/useSwipeBack";
import { isNativePlatform } from "@/lib/nativeAuth";
import { useIsDesktop } from "@/lib/useIsDesktop";
import { useOverlayLayer, SHEET_OFFSET } from "@/lib/overlayLayer";
import { useEscapeToClose } from "@/lib/useEscapeToClose";

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// AI 추천 카드에 붙이는 카테고리 배지 라벨.
const RECOMMENDATION_CATEGORY_LABEL: Record<string, string> = {
  attraction: "명소",
  food: "맛집",
  specialty: "특산물",
};

// 도시별 AI 추천 결과 클라이언트 캐시. 컴포넌트 state가 아니라 모듈 스코프에 둬서,
// 가방 화면을 나갔다 다시 들어와도(리마운트돼도) 캐시가 살아있어 재호출하지 않는다.
// 브라우저를 새로고침하면(모듈이 다시 초기화되므로) 자연스럽게 비워져서 다시 호출된다.
const aiPlacesClientCache = new Map<string, TravelRecommendation[]>();

// 이미지가 아닌 모든 파일(PDF 포함)은 이미지처럼 압축되지 않고 원본 크기 그대로 올라가므로,
// 큰 파일을 막기 위해 따로 크기 상한을 둔다(2026-08~ 10MB로 상향).
const MAX_BAG_ATTACHMENT_FILE_BYTES = 10 * 1024 * 1024;

export default function BagEditorScreen({
  initialBag,
  libraryPacks,
  bags,
  uid: currentUid,
  nickname,
  avatarId,
  isNew,
  readOnly,
  onRequestUnlock,
  onBack,
  onSave,
  onDeleteBag,
  onSaveAsLibraryPack,
  onTrashPackFromBag,
  onLeaveBag,
  onRemoveMember,
  onRegenerateInviteCode,
  onTransferOwnership,
  focusTarget,
  onFocusHandled,
}: {
  initialBag: Bag;
  libraryPacks: Pack[];
  // 내가 속한 모든 가방(이 가방 자체 포함). 모바일에서 "다른 가방으로 이동" 시트에
  // 필요하다(데스크톱은 DesktopSidebar.tsx의 드래그앤드롭을 따로 쓴다).
  bags: Bag[];
  uid: string;
  nickname: string;
  avatarId: string;
  isNew: boolean;
  // true면 무료 전환으로 잠긴(내 소유) 가방. 보기만 가능하고 모든 수정/삭제/공유 동작이 막힌다.
  readOnly: boolean;
  // 잠긴 상태에서 수정을 시도하면 이용권 등록을 유도하는 모달을 띄우기 위해 AppShell에 알린다.
  onRequestUnlock: () => void;
  onBack: (currentBag: Bag) => void;
  onSave: (bag: Bag) => void;
  onDeleteBag: (bag: Bag) => void;
  onSaveAsLibraryPack: (pack: Pack) => void;
  // 가방 안에서 팩을 삭제했을 때, 완전히 없애는 대신 팩 보관함 휴지통에 사본을
  // 남겨서(설정 > 휴지통) 복구할 수 있게 한다. AppShell이 트래시 라우트 호출까지 처리한다.
  onTrashPackFromBag: (pack: Pack, sourceBagId: string, sourceBagName: string) => void;
  onLeaveBag: (bagId: string) => Promise<void>;
  onRemoveMember: (bagId: string, memberUid: string) => Promise<void>;
  onRegenerateInviteCode: (bag: Bag) => Promise<string>;
  onTransferOwnership: (bagId: string, targetUid: string) => Promise<void>;
  // 검색 결과를 눌러서 들어왔을 때만 넘어온다. 있으면 그 팩(+짐)까지 자동 스크롤하고
  // 잠깐 하이라이트한다 (AppShell이 HomeScreen 검색 결과 클릭을 중계).
  focusTarget?: { packId?: string; itemId?: string } | null;
  onFocusHandled?: () => void;
}) {
  const isDesktop = useIsDesktop();
  // 이 화면(BagEditorScreen) 자체가 지금 몇 층에 떠있는지(SlideScreen 중첩 깊이)를 물려받아서,
  // 안에서 띄우는 드래그 표시/선택 액션바/팝종류 선택 시트 같은 자체 오버레이를 그 위에만 띄우면
  // 된다(하드코딩된 z-[93]/[94]/[95]/[85]를 쓰면 데스크톱 등 중첩 깊이가 달라지는 화면에서
  // 어긍나는 문제가 있었다).
  const ambientLayer = useOverlayLayer();
  const { user } = useAuth();
  const [bag, setBag] = useState<Bag>(initialBag);
  // 이 가방을 내가 만들었는지(소유자)인지 여부. 소유자가 아니면(그룹원으로 참여한
  // 공유 가방) 트래시 버튼의 동작이 "삭제"가 아니라 "나가기"로 바뀐다 - 공유 문서를
  // 통째로 지워버리면 다른 그룹원들에게서도 사라지기 때문에, 소유자가 아닌 사람에게는
  // 그런 파괴적인 동작을 허용하지 않는다.
  const isOwner = bag.ownerId === currentUid;
  const [showImport, setShowImport] = useState(false);
  const [showAiOrganize, setShowAiOrganize] = useState(false);
  const [showNotebookQuickAdd, setShowNotebookQuickAdd] = useState(false);
  const [confirmDeleteBag, setConfirmDeleteBag] = useState(false);
  const [confirmLeaveUnsaved, setConfirmLeaveUnsaved] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [imageDeleteIndex, setImageDeleteIndex] = useState<number | null>(null);
  // PDF 미리보기/업로드는 프리미엄 전용 기능(2026-07 추가). 실제 차단은
  // storage.rules가 해주지만(프리미엄이 아닌 요청자에게는 읽기/쓰기 자체가 거부됨),
  // 여기서는 실패하기 전에 미리 안내해서 사용자가 왜 막혔는지 바로 알게 한다.
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [premiumModalMessage, setPremiumModalMessage] = useState<string | null>(null);
  const [refreshConfirmTarget, setRefreshConfirmTarget] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { show } = useToast();
  const { profile, updatePackDisplayState, updateAllPackDisplayStates, updateBagViewMode } = useAuth();
  const premium = isPremiumUser(profile?.email, profile ?? null);
  // AI 기능(정리/추천) 통합 메뉴 - 상단 "AI" 버튼을 누르면 이 메뉴가 뜨고, 여기서 어떤 기능을
  // 쓸지 고른다(2026-07). AI 추천은 프리미엄 전용이라 무료회원이 고르면 showAiPremiumModal로
  // 이용권 구매를 유도한다.
  const [showAiFeatureMenu, setShowAiFeatureMenu] = useState(false);
  const [showAiPremiumModal, setShowAiPremiumModal] = useState(false);
  const [showAiClipboard, setShowAiClipboard] = useState(false);

  // 설정 > 팩 설정 > "가방 열 때 팩 접어서 보기"가 켜져 있으면, 이 화면에 처음 들어온
  // 순간에만 모든 팩을 접힌 상태로 보여준다. 저장된 Pack.displayState는 전혀 건드리지
  // 않고(=자동저장 대상이 아님) 화면에 그리는 값만 아래 effectivePacks에서 덮어쓴다.
  // 사용자가 개별/전체 펼치기·접기 컨트롤을 한 번이라도 쓰면 그 순간 꺼지고, 이후부터는
  // 평소처럼 저장된 displayState 그대로를 보여준다(다음에 다시 들어오면 또 접힌 채로 시작).
  const [collapseOverrideActive, setCollapseOverrideActive] = useState(
    !!profile?.packSettings?.alwaysCollapseOnEntry
  );

  // 팩뷰/심플뷰 상관없이 상단 토글로 켜고 끄는 "완료(체크된) 항목 숨기기". 데이터는 그대로 두고
  // 화면에 그릴 때만 걸러낸다(PackCard/NotebookPackSection의 displayItems 필터링) - 저장되지 않는
  // 화면별 임시 상태라 화면을 다시 들어오면 항상 꺼진 채로 시작한다.
  const [hideChecked, setHideChecked] = useState(false);
  const [showViewMenu, setShowViewMenu] = useState(false);

  // 짐/팩 댓글 + 리액션. 이 가방의 comments/reactions 서브컴렉션 전체를 통째로
  // 구독하고(presence와 동일한 이유 - 복합 인덱스 없이 가벼운 구현), 화면에서는
  // targetId별로 개수/유무만 계산해 ItemRow/PackCard에 배지로 보여준다.
  const [comments, setComments] = useState<BagComment[]>([]);
  const [reactions, setReactions] = useState<BagReactionDoc[]>([]);
  useEffect(() => subscribeToComments(bag.id, setComments), [bag.id]);
  useEffect(() => subscribeToReactions(bag.id, setReactions), [bag.id]);

  // 댓글 작성자 중 진짜로 회원탈퇴(계정 삭제)한 사람이 누구인지 추적해서, 댓글 표시에서
  // 그만 익명화하는 데 쓴다(BagChatPreview/ItemThreadSheet/ItemEditModal에 그대로 전달되어 쓰임).
  // 단순히 가방을 나가거나 강퇴된 것만으로는 익명화하지 않아서, 지금 memberIds만으로는 판단할
  // 수 없다 - 실제로 계정을 삭제한 사람만 모은 lib/accountService.ts의 deletedAccounts 컬렉션에서
  // 확인해야 한다. 이미 확인한 uid는 다시 조회하지 않게 ref로 캐시해둔다.
  const [deletedAuthorIds, setDeletedAuthorIds] = useState<Set<string>>(new Set());
  const checkedAuthorUidsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const uidsToCheck = Array.from(new Set(comments.map((c) => c.authorUid))).filter(
      (uid) => !checkedAuthorUidsRef.current.has(uid)
    );
    if (uidsToCheck.length === 0) return;
    uidsToCheck.forEach((uid) => checkedAuthorUidsRef.current.add(uid));
    fetchDeletedAccountIds(uidsToCheck)
      .then((deletedSet) => {
        if (deletedSet.size === 0) return;
        setDeletedAuthorIds((prev) => new Set([...prev, ...deletedSet]));
      })
      .catch((err) => {
        console.error("[팩인백] 탈퇴 계정 확인 실패:", err);
      });
  }, [comments]);

  const getItemThreadInfo = (itemId: string) => ({
    commentCount: comments.filter((c) => c.targetType === "item" && c.targetId === itemId).length,
  });
  // 팀즈 스타일 즉시 리액션용 - 짐별 리액션 문서 조회.
  /*
  const getItemReactionDoc = (itemId: string) => reactions.find((r) => r.id === `item_${itemId}`);
  const handleToggleItemReaction = (
    itemId: string,
    emoji: ReactionEmoji,
    currentlyReacted: boolean
  ) => {
    toggleReaction(bag.id, "item", itemId, currentUid, emoji, currentlyReacted).catch((err) => {
      console.error("[팩인백] 리액션 실패:", err);
    });
  };
  // 팀즈처럼 "+" 누르면 열리는 전체 프리셋 피커 대상.
  const [reactionPickerTarget, setReactionPickerTarget] = useState<{
    itemId: string;
    itemText: string;
  } | null>(null);
  */
  const [reactionPickerCommentTarget, setReactionPickerCommentTarget] = useState<{
    commentId: string;
    authorNickname: string;
  } | null>(null);
  // 가방 전체(bag) 대상 댓글만 모은 것 - BagChatPreview/BagQuickAddRow 에서 공통으로 쓴다.
  const bagLevelComments = comments.filter((c) => c.targetType === "bag");

  // 가방 전체 대화(공지성) 스레드 표시 여부. 짐별 댓글은 이제 별도 스레드 모달 없이
  // 수정 모달(ItemEditModal) 안에 함께 떠서 따로 열기 상태가 필요 없다.
  const [showBagThread, setShowBagThread] = useState(false);
  // @멘션 자동완성/스캔용 멤버 목록(본인 제외).
  const mentionMembers = buildMentionMembers(bag.memberIds, bag.memberProfiles, currentUid);
  // BagQuickAddRow에서 "디데이 추가"/"메모 추가"를 누르면 각 컴포넌트의 편집을 외부에서 열기 위한 ref.
  const travelDateRef = useRef<TravelDateFieldHandle>(null);
  const bagNoticeRef = useRef<BagNoticeHandle>(null);

  // 가방 제목에 포함된 도시 날씨 감지 및 추천 명소 상태. bag.aiRecommendCache가 있으면(=이전에
  // "AI 추천"을 실행해서 얻은 결과가 가방 문서에 저장돼있으면) 그 값으로 초기화해서, 가방을
  // 나갔다가 다시 들어와도 AI/날씨 API를 다시 부르지 않고 곧바로 보여준다. 화면 노출 자체는
  // 아래 JSX의 premium && 조건이 그대로 막아주므로 여기서는 premium 여부와 무관하게 채운다.
  const [weatherInfo, setWeatherInfo] = useState<WeatherInfo | null>(
    bag.aiRecommendCache?.weatherInfo ?? null
  );
  const [aiPlaces, setAiPlaces] = useState<TravelRecommendation[] | null>(
    bag.aiRecommendCache?.places ?? null
  );
  const [loadingAiPlaces, setLoadingAiPlaces] = useState(false);
  const [aiPlacesCollapsed, setAiPlacesCollapsed] = useState(true);
  // 지역 인식(지오코딩+날씨) 자체가 진행 중인지 - AI 추천을 누른 직후, 명소/맛집 목록이 뜨기 전
  // 단계에서 로딩임을 보여주기 위함(loadingAiPlaces는 그 다음 단계인 명소 목록 로딩용).
  const [resolvingWeather, setResolvingWeather] = useState(false);
  // 응답이 뒤섞이는(레이스) 것을 막기 위해, 요청마다 순번을 매기고 가장 최신 요청의 응답만 반영한다.
  const weatherRequestSeqRef = useRef(0);
  const aiRequestSeqRef = useRef(0);

  // AI 추천은 가방 제목 전체가 아니라 인식된 도시명(weatherInfo.city)에만 의존한다 - 제목을 조금 고쳤을
  // 뿐(도시는 그대로)이면 재요청하지 않아 불필요한 Gemini 호출을 줄인다(서버의 도시명 캐시와 함께 이중으로 비용 방어).
  const weatherCity = weatherInfo?.city ?? null;

  // "AI 추천" 결과(날씨+명소/맛집/특산물)가 확정되면 가방 문서에 그대로 캐싱해둔다 - 가방을
  // 나갔다가 다시 들어와도(=이 화면이 리마운트되어도) 위 weatherInfo/aiPlaces 초기값이 이 캐시를
  // 그대로 읽어서 AI/날씨 API를 다시 부르지 않게 된다. 사용자가 직접 고친 변경이 아니라
  // AI 응답을 그대로 저장해두는 것뿐이라 pushUndoSnapshot은 부르지 않고(setBag만, updatePacks와 다름)
  // undo/redo에는 영향을 주지 않는다. 실패(지명 미인식/날씨 조회 실패)했을 때는 호출하지
  // 않는다 - 일시적인 장애로 기존 캐시가 지워지면 안 되기 때문이다(lib/types.ts Bag.aiRecommendCache 참고).
  const persistAiRecommendCache = (
    city: string,
    info: WeatherInfo,
    places: TravelRecommendation[]
  ) => {
    setBag((prev) => ({
      ...prev,
      aiRecommendCache: { city, weatherInfo: info, places, cachedAt: new Date().toISOString() },
    }));
  };

  // 2026-07: 예전엔 가방 제목이 바뀔 때마다 자동으로(디바운스 후) 지오코딩을 시도했는데, "2026.07"
  // 같은 날짜/버전 숫자가 실제 지명으로 우연히 매칭되어(예: 프랑스) 엉뚱한 추천이 뜨는 오탐이 있었다.
  // 그래서 지금은 상단 "AI 기능" 메뉴에서 "AI 추천"을 직접 골랐을 때만 이 함수가 실행된다(자동 실행 없음).
  const runAiRecommend = () => {
    if (!user) return;
    setResolvingWeather(true);
    setAiPlacesCollapsed(false);
    const weatherSeq = ++weatherRequestSeqRef.current;
    resolveCityInfo(bag.name).then((cityMatch) => {
      if (weatherRequestSeqRef.current !== weatherSeq) return;
      if (!cityMatch) {
        setResolvingWeather(false);
        setWeatherInfo(null);
        setAiPlaces(null);
        show("가방 제목에서 여행지를 찾지 못했어요. 도시나 국가 이름을 넣어보세요");
        return;
      }
      fetchWeatherForCity(cityMatch.lat, cityMatch.lon, cityMatch.name).then((info) => {
        if (weatherRequestSeqRef.current !== weatherSeq) return;
        setResolvingWeather(false);
        setWeatherInfo(info);
        if (!info) {
          setAiPlaces(null);
          return;
        }

        const cached = aiPlacesClientCache.get(info.city);
        if (cached) {
          setAiPlaces(cached);
          persistAiRecommendCache(info.city, info, cached);
          return;
        }
        const aiSeq = ++aiRequestSeqRef.current;
        setLoadingAiPlaces(true);
        user.getIdToken().then((idToken) => {
          if (!idToken) {
            if (aiRequestSeqRef.current === aiSeq) setLoadingAiPlaces(false);
            return;
          }
          fetchAiTravelPlaces(info.city, idToken)
            .then((places) => {
              if (aiRequestSeqRef.current !== aiSeq) return;
              setAiPlaces(places);
              if (places.length > 0) {
                aiPlacesClientCache.set(info.city, places);
                persistAiRecommendCache(info.city, info, places);
              }
            })
            .finally(() => {
              if (aiRequestSeqRef.current === aiSeq) setLoadingAiPlaces(false);
            });
        });
      });
    });
  };

  // 새로고침 버튼 전용 - 클라이언트 캐시뿐만 아니라 서버 쪽 도시 캐시도 force 플래그로 건너뛰고
  // Gemini를 새로 불러서(app/api/ai-travel-places의 force 처리 + temperature 상향) 매번 다른 추천이 나오게 한다.
  const handleRefreshAiPlaces = () => {
    if (!weatherCity || !user || loadingAiPlaces) return;
    const seq = ++aiRequestSeqRef.current;
    setLoadingAiPlaces(true);
    // 이미 'AI추천' 팩에 담아둔 항목은 새로고침해도 다시 나오지 않도록, 아이콘
    // 접두사를 뗀 텍스트만 뽑아서 제외 목록으로 서버에 넘긴다.
    const existingRecommendPack = bag.packs.find(
      (p) => p.kind !== "editor" && p.aiRecommendSource
    );
    const excludeTexts = (existingRecommendPack?.items ?? []).map((i) =>
      i.text.replace(/^\S+\s+/, "").trim()
    );
    user.getIdToken().then((idToken) => {
      if (!idToken) {
        if (aiRequestSeqRef.current === seq) setLoadingAiPlaces(false);
        return;
      }
      fetchAiTravelPlaces(weatherCity, idToken, { force: true, excludeTexts })
        .then((places) => {
          if (aiRequestSeqRef.current !== seq) return;
          setAiPlaces(places);
          if (places.length > 0) {
            aiPlacesClientCache.set(weatherCity, places);
            // 새로고침은 날씨를 다시 조회하지 않으므로(명소/맛집/특산물만 갱신), 지금 가지고
            // 있는 weatherInfo를 그대로 함께 캐싱해둔다.
            if (weatherInfo) persistAiRecommendCache(weatherCity, weatherInfo, places);
          }
        })
        .finally(() => {
          if (aiRequestSeqRef.current === seq) setLoadingAiPlaces(false);
        });
    });
  };

  // AI 추천 명소/맛집/특산물을 "+ 추가"하면 항상 이 이름의 전용 팩에 모은다 - 사용자가
  // 임의의 첫 번째 팩에 섞여 들어가서 어디 담겼는지 헷갈리는 문제를 없애기 위함(2026-07).
  // 이미 있으면 그 팩에 이어서 담고, 없으면 팩 목록 맨 위에 새로 만든다.
  const AI_RECOMMEND_PACK_NAME = "AI추천";

  const handleAddRecommendedItem = (itemText: string) => {
    if (guardReadOnly()) return;
    const newItem: Item = { id: uid(), type: "check", text: itemText, checked: false };
    // 이름이 아니라 aiRecommendSource 플래그로만 찾는다 - 사용자가 직접 "AI추천"이라는
    // 이름의 팩을 만들어둔 경우와 헷갈리지 않기 위함(lib/types.ts Pack.aiRecommendSource 참고).
    const existing = bag.packs.find((p) => p.kind !== "editor" && p.aiRecommendSource);
    if (existing) {
      updatePacks((packs) =>
        packs.map((p) => (p.id === existing.id ? { ...p, items: [...p.items, newItem] } : p))
      );
    } else {
      if (bag.packs.length >= 10) {
        show("가방 하나에는 팩을 최대 10개까지 넣을 수 있어요");
        return;
      }
      updatePacks((packs) => [
        { id: uid(), name: AI_RECOMMEND_PACK_NAME, items: [newItem], aiRecommendSource: true },
        ...packs,
      ]);
    }
    show(`'${itemText}'를 'AI추천' 팩에 담았어요!`);
  };

  // AI 클립보드 결과 적용 - 통째로 교체하는 AiOrganizeModal과 달리, 지금 있는 팩(체크리스트 팩)과
  // 이름이 같으면 그 팩에 이어서 담고, 없으면 새로 만든다(서버가 이미 중복 항목을 거른 뒤라
  // 여기서는 단순 병합만 한다). 팩 10개 캡은 새 팩을 만들 때만 적용되고,
  // 캡에 걸린 항목은 조용히 버려지지 않고 토스트로 알려준다.
  const handleApplyClipboardAdd = (result: AiClipboardResult) => {
    if (guardReadOnly()) return;
    let addedCount = 0;
    let cappedOut = false;
    updatePacks((packs) => {
      let next = [...packs];
      for (const g of result.packs) {
        if (g.items.length === 0) continue;
        const newItems: Item[] = g.items.map((item) => ({
          id: uid(),
          type: "check",
          text: item.text,
          checked: item.checked,
        }));
        const existingIdx = next.findIndex(
          (p) => p.kind !== "editor" && p.name.trim() === g.name.trim()
        );
        if (existingIdx >= 0) {
          next = next.map((p, i) =>
            i === existingIdx ? { ...p, items: [...p.items, ...newItems] } : p
          );
          addedCount += newItems.length;
        } else if (next.length < 10) {
          next = [{ id: uid(), name: g.name, items: newItems }, ...next];
          addedCount += newItems.length;
        } else {
          cappedOut = true;
        }
      }
      return next;
    });
    setShowAiClipboard(false);
    if (addedCount === 0) {
      show(
        result.skippedDuplicateCount > 0
          ? "클립보드 내용이 이미 모두 이 가방에 있어요"
          : "추가할 만한 내용을 찾지 못했어요"
      );
    } else if (cappedOut) {
      show(`팩이 가득 차서 일부는 추가하지 못했어요 (${addedCount}개 추가함)`);
    } else if (result.skippedDuplicateCount > 0) {
      show(`${addedCount}개 추가했어요 (이미 있는 항목 ${result.skippedDuplicateCount}개는 제외)`);
    } else {
      show(`${addedCount}개 추가했어요`);
    }
  };

  // 잠긴 가방에서 수정을 시도하는 모든 진입점의 공용 방어선. true를 반환하면(=막혔으면)
  // 호출한 쪽에서 그대로 return해서 실제 상태 변경으로 이어지지 않게 한다. 모달이 열려있는
  // 상태(onRequestUnlock)로 이용권 등록을 바로 유도한다.
  const guardReadOnly = (): boolean => {
    if (!readOnly) return false;
    onRequestUnlock();
    return true;
  };

  // 새로 만드는 중(isNew)에 "저장" 버튼을 아직 누르지 않았는데 로컬 변경이 하나라도
  // 생겼는지 추적한다. true인 상태로 뒤로가기/스와이프 하면 그대로 나가도 되는지 확인
  // 다이얼로그를 띄운다 - 실제 삭제(handleBackFromEditor의 임시 가방 정리)는 그대로 두고,
  // 그 직전에 한 번 더 물어보는 역할만 한다.
  const hasUnsavedChangesRef = useRef(false);
  const handleBackAttempt = () => {
    if (isNew && hasUnsavedChangesRef.current) {
      setConfirmLeaveUnsaved(true);
      return;
    }
    onBack(bag);
  };
  const swipeBackRef = useSwipeBack<HTMLDivElement>(handleBackAttempt);

  const handleRemoveMember = async (memberUid: string) => {
    if (guardReadOnly()) return;
    await onRemoveMember(bag.id, memberUid);
    setBag((prev) => {
      const memberProfiles = { ...prev.memberProfiles };
      delete memberProfiles[memberUid];
      return {
        ...prev,
        memberIds: prev.memberIds.filter((id) => id !== memberUid),
        memberProfiles,
      };
    });
  };

  const handleRegenerateCode = async () => {
    if (guardReadOnly()) return;
    const newCode = await onRegenerateInviteCode(bag);
    setBag((prev) => ({ ...prev, inviteCode: newCode }));
  };

  const handleTransferOwnership = async (targetUid: string) => {
    if (guardReadOnly()) return;
    await onTransferOwnership(bag.id, targetUid);
    setBag((prev) => ({ ...prev, ownerId: targetUid }));
  };

  const handleChangeTravelDate = (
    travelDate: string | undefined,
    reminderOffsets: ReminderOffset[] | undefined,
    ddayCountTodayAsDayOne: boolean | undefined
  ) => {
    if (guardReadOnly()) return;
    pushUndoSnapshot();
    setBag((prev) => ({ ...prev, travelDate, reminderOffsets, ddayCountTodayAsDayOne }));
  };

  const updatePacks = (updater: (packs: Pack[]) => Pack[]) => {
    pushUndoSnapshot();
    setBag((prev) => ({ ...prev, packs: updater(prev.packs) }));
  };

  // Undo/redo 스택 (파일/이미지 업로드 제외 전부 커버). 변경이 생길 때마다 그 직전
  // bag 상태를 undo 스택에 쌓아둔다. undo를 누르면 그 스냅샷으로 되돌리면서 방금까지의
  // bag 상태를 redo 스택에 옮겨두고, redo를 누르면 반대로 되돌린다. undo 이후에 새로운
  // 변경이 생기면(pushUndoSnapshot 호출) redo 스택은 더 이상 유효하지 않으므로 비운다.
  const historyRef = useRef<Bag[]>([]);
  const [historyLen, setHistoryLen] = useState(0);
  const redoRef = useRef<Bag[]>([]);
  const [redoLen, setRedoLen] = useState(0);

  const pushUndoSnapshot = () => {
    historyRef.current = [...historyRef.current, bag];
    setHistoryLen(historyRef.current.length);
    if (redoRef.current.length > 0) {
      redoRef.current = [];
      setRedoLen(0);
    }
  };

  const handleUndo = () => {
    if (guardReadOnly()) return;
    const prevHistory = historyRef.current;
    if (prevHistory.length === 0) return;
    const last = prevHistory[prevHistory.length - 1];
    historyRef.current = prevHistory.slice(0, -1);
    setHistoryLen(historyRef.current.length);
    redoRef.current = [...redoRef.current, bag];
    setRedoLen(redoRef.current.length);
    setBag(last);
  };

  const handleRedo = () => {
    if (guardReadOnly()) return;
    const prevRedo = redoRef.current;
    if (prevRedo.length === 0) return;
    const next = prevRedo[prevRedo.length - 1];
    redoRef.current = prevRedo.slice(0, -1);
    setRedoLen(redoRef.current.length);
    historyRef.current = [...historyRef.current, bag];
    setHistoryLen(historyRef.current.length);
    setBag(next);
  };

  // isNew는 "새 가방 -> 최초 저장 완료" 시점에 false로 바뀌는데, 이 화면은 그때
  // 리마운트되지 않고 그대로 유지된다. 아래 자동저장/언마운트 effect들은 클로저가
  // 실행 시점 값을 그대로 들고 있을 수 있으므로, 최신 값을 보려면 ref로 따로 추적한다.
  const isNewRef = useRef(isNew);
  useEffect(() => {
    isNewRef.current = isNew;
  }, [isNew]);

  // --- 실시간 동기화 -------------------------------------------------------
  // 이름/메모/체크박스/짐 추가삭제 등 가방 안의 "모든" 변경은 아래 자동저장 effect가
  // 감지해서 서버에 반영한다. 클릭/타이핑마다 바로 쏘지 않고 마지막 변경 후 잠깐
  // 기다렸다가 한 번만 저장하는데(디바운스), 이게 체크박스 광클 방지 역할도 겸한다 -
  // 연속으로 눌러도 화면은 즉시 반응하고, 서버 저장은 마지막 상태로 한 번만 나간다.
  const AUTOSAVE_DEBOUNCE_MS = 500;
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDirtyRef = useRef(false); // 로컬 변경이 아직 서버에 반영 안 됐거나 반영 중인 상태
  const isApplyingRemoteRef = useRef(false); // 방금 setBag이 원격 변경 수신 때문인지 표시
  const skipFirstAutosaveRef = useRef(true); // 화면 진입 시 최초 렌더는 저장 스킵
  // 새로 만드는 중(isNew)인 가방의 "첫 실제 변경"이 서버에 반영되는 순간 딱 한 번만
  // onSave(=AppShell의 handleSaveBag)를 호출해서 isNewBag을 꺼준다. 더 이상 별도
  // "저장" 버튼이 없으므로, 이 첫 자동저장 성공이 곧 예전의 "저장 버튼 클릭"과 같은
  // 역할을 한다 - 그 이후 뒤로가기는 임시 가방 삭제 대상에서 제외된다.
  const hasConfirmedNewRef = useRef(false);

  useEffect(() => {
    if (skipFirstAutosaveRef.current) {
      skipFirstAutosaveRef.current = false;
      return;
    }
    if (isApplyingRemoteRef.current) {
      // 원격에서 받아온 변경을 반영한 것뿐이라 다시 저장할 필요 없음
      isApplyingRemoteRef.current = false;
      return;
    }
    isDirtyRef.current = true;
    hasUnsavedChangesRef.current = true;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    // 새 가방의 첫 변경은 디바운스 없이 즉시 저장한다 - "확정"까지 걸리는 시간을
    // 최소화해서, 저장 직후 바로 나가도 임시 가방으로 오인되어 삭제되는 경합을 줄인다.
    const delay = isNewRef.current && !hasConfirmedNewRef.current ? 0 : AUTOSAVE_DEBOUNCE_MS;
    autosaveTimerRef.current = setTimeout(() => {
      saveBagRemote(bag)
        .then(() => {
          if (isNewRef.current && !hasConfirmedNewRef.current) {
            hasConfirmedNewRef.current = true;
            onSave(bag);
          }
        })
        .catch((err) => {
          console.error("[팩인백] 실시간 저장 실패:", err);
          show(`실시간 저장에 실패했어요 (${firebaseErrorCode(err)})`);
        })
        .finally(() => {
          isDirtyRef.current = false;
        });
    }, delay);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bag]);

  // 화면을 나갈 때(뒤로가기/스와이프/탭 전환 등 어떤 경로로든 이 화면이 사라질 때)
  // 아직 디바운스 대기 중이라 서버에 반영되지 않은 변경이 있으면 그 즉시 저장한다.
  // PackLibraryEditorScreen에는 이미 있는 안전장치인데 이 화면엔 빠져 있었다 -
  // 그 사이(최대 500ms) 수정하고 바로 나가면 그 변경이 조용히 사라지는 문제가 있었음.
  const bagRef = useRef(bag);
  useEffect(() => {
    bagRef.current = bag;
  }, [bag]);
  useEffect(() => {
    return () => {
      // 디바운스 대기 중(아직 서버에 반영 안 된 변경)이면 나가기 전에 그 즉시 저장한다.
      // 새 가방(isNew)이고 아직 한 번도 확정 안 됐으면, 이 저장이 곧 "확정" 역할도
      // 겸한다(onSave 호출) - 확정된 뒤에는 AppShell이 더 이상 임시 가방으로 취급하지
      // 않으므로 뒤로가기로 지워지지 않는다.
      if (!autosaveTimerRef.current || !isDirtyRef.current) return;
      window.clearTimeout(autosaveTimerRef.current);
      saveBagRemote(bagRef.current)
        .then(() => {
          if (isNewRef.current && !hasConfirmedNewRef.current) {
            hasConfirmedNewRef.current = true;
            onSave(bagRef.current);
          } else {
            show("나가기 전 변경사항을 저장했어요");
          }
        })
        .catch((err) => {
          console.error("[팩인백] 나가기 전 자동저장 실패:", err);
          show(`나가기 전 변경사항 저장에 실패했어요 (${firebaseErrorCode(err)})`);
        });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 다른 멤버가 이 가방을 동시에 보고 있을 때 그들의 변경(체크/이름/짐/팩 등 전부)을
  // 실시간으로 반영한다. 단, 내가 방금 만든 로컬 변경이 아직 서버로 안 나갔거나(디바운스
  // 대기 중) 저장 중이면(isDirtyRef) 그 사이에 들어온 원격 변경은 건너뛴다 - 곧 내가
  // 보낼 저장이 그 시점 기준 최신 상태를 다시 반영하기 때문에, 여기서 섞어 넣으면
  // 오히려 화면이 잠깐 깜빡이거나 아직 저장 안 한 내 편집을 잃을 수 있다.
  // 이 구독은 locked 필드도 그대로 실어오므로, 다른 곳(app/api/sync-lock-status)에서
  // 잠금 상태가 바뀌면 이 화면도 곧바로 반영된다(=readOnly prop이 AppShell에서 다시 계산됨).
  // AppShell이 이미 subscribeToUserBags로 전체 가방을 실시간 구독하고 있으므로,
  // 여기서 Firestore에 subscribeToBag를 또 걸어 중복 Read를 발생시키지 않고
  // props로 넘어온 bags에서 해당 가방의 최신 변경을 전달받아 반영한다.
  const remoteBag = bags.find((b) => b.id === initialBag.id);
  useEffect(() => {
    if (!remoteBag) return;
    if (isDirtyRef.current) return;
    if (remoteBag.updatedAt && bag.updatedAt && remoteBag.updatedAt <= bag.updatedAt) return;
    isApplyingRemoteRef.current = true;
    historyRef.current = [];
    setHistoryLen(0);
    redoRef.current = [];
    setRedoLen(0);
    setBag(remoteBag);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteBag]);

  // --- 메모팩(에디터팩) 보관함 연동 실시간 동기화 (토글) ---------------------------------
  // pack.autoSyncEnabled를 켜두면, 이 화면(가방)이 열려있는 동안에는 linkedLibraryPackId로
  // 연동된 보관함 원본과 내용이 다를 때마다(bag.packs 또는 libraryPacks가 바뀔 때마다)
  // 계속 재검사해서 더 최신인 쪽으로 맞춘다(lib/packSync.ts resolveEditorSyncDirection).
  // 노션처럼 "닫힌 가방까지 계속" 동기화하는 서버 트리거는 없어서 이 화면이 열려있는
  // 동안만 실제로 일어나고, 끄면 그 순간부터 더 이상 비교하지 않는다. resolveEditorSyncDirection이
  // 내용이 같으면 "none"을 돌려주므로(핑퐁 방지), 한번 맞춰지고 나면 이 effect가 다시
  // 돌아와도 쓰기가 더 이상 나가지 않는다.
  const handleToggleAutoSync = (packId: string) => {
    if (guardReadOnly()) return;
    updatePacks((packs) =>
      packs.map((p) => (p.id === packId ? { ...p, autoSyncEnabled: !p.autoSyncEnabled } : p))
    );
  };

  useEffect(() => {
    let bagChanged = false;
    const nextPacks = bag.packs.map((p) => {
      if (p.kind !== "editor" || !p.autoSyncEnabled || !p.linkedLibraryPackId) return p;
      const libPack = libraryPacks.find((lp) => lp.id === p.linkedLibraryPackId);
      if (!libPack) return p;
      const direction = resolveEditorSyncDirection(p, libPack);
      if (direction === "none") return p;
      if (direction === "library-wins") {
        bagChanged = true;
        return { ...p, ...buildEditorSyncPatch(libPack) };
      }
      // bag-wins: 이 팩은 그대로 두고, 보관함 원본만 따로 업데이트한다.
      updateLibraryPackEditorContent(currentUid, p.linkedLibraryPackId, buildEditorSyncPatch(p)).catch(
        (err) => {
          console.error("[팩인백] 메모팩 보관함 동기화 실패:", err);
        }
      );
      return p;
    });
    if (bagChanged) {
      // 사용자가 직접 고친 게 아니라 연동된 보관함 내용이 들어온 것이라 undo 스택에는
      // 쌓지 않는다(pushUndoSnapshot 없이 setBag만). 다만 이 가방 자체에는 그대로
      // 저장되어야 하므로(그룹원도 봐야 함) 아래 자동저장 effect는 정상적으로 돈다.
      setBag((prev) => ({ ...prev, packs: nextPacks }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bag.packs, libraryPacks]);

  // --- 다른 가방으로 팩 이동 (모바일 "다른 가방으로 이동" 시트) ------------------------------
  // 데스크톱은 DesktopSidebar.tsx에서 가방을 펼친 뒤 팩을 드래그해서 다른 가방에 놓는
  // 방식으로 이미 동일한 일을 하고 있어서, 이 화면에는 대신 "다른 가방으로 이동" 버튼을 더한다.
  // 서버층(movePackBetweenBagsRemote)은 runTransaction으로 두 가방 문서를 안전하게 바꾸기 때문에
  // 데스크톱과 동일한 기반을 공유한다.
  const [moveTargetPackId, setMoveTargetPackId] = useState<string | null>(null);
  const [movingPackId, setMovingPackId] = useState<string | null>(null);

  const handleOpenMovePackSheet = (packId: string) => {
    if (guardReadOnly()) return;
    setMoveTargetPackId(packId);
  };

  // 실제 이동 로직 - 버튼 시트에서 고른 경우(handleMovePackToBag)와 사이드바로 드래그해서 놓은
  // 경우(아래 packDrag 포인터업) 둘 다 이 함수로 수렴된다.
  const performMovePackToBag = async (packId: string, targetBagId: string) => {
    setMovingPackId(packId);
    try {
      const result = await movePackBetweenBagsRemote(bag.id, targetBagId, packId);
      if (!result.ok) {
        show(
          result.reason === "target-full"
            ? "그 가방은 이미 팩이 10개라 더 넣을 수 없어요"
            : "팩을 이동하지 못했어요"
        );
        return;
      }
      // 서버 트랜잭션이 이미 이 가방 문서에서 통째로 지웠으니, 로컬 상태도 그대로 따라가게
      // 지운다(pushUndoSnapshot 없이). isApplyingRemoteRef를 켜서 자동저장 effect가 이미
      // 서버에 반영된 내용을 다시 덮어쓰지 않게 막는다.
      isApplyingRemoteRef.current = true;
      setBag((prev) => ({ ...prev, packs: prev.packs.filter((p) => p.id !== packId) }));
      const targetBagName = bags.find((b) => b.id === targetBagId)?.name ?? "다른 가방";
      show(`'${targetBagName}' 가방으로 옮겨요`);
    } catch (err) {
      console.error("[팩인백] 가방 간 팩 이동 실패:", err);
      show("팩을 이동하지 못했어요");
    } finally {
      setMovingPackId(null);
    }
  };

  const handleMovePackToBag = (targetBagId: string) => {
    const packId = moveTargetPackId;
    if (!packId) return;
    setMoveTargetPackId(null);
    performMovePackToBag(packId, targetBagId);
  };

  // 검색 결과를 눌러서 들어온 경우(focusTarget) 해당 팩이 접혀있으면 펼치고, 그 팩(또는 짐)으로
  // 스크롤한 뒤 잠깐 하이라이트(pib-search-highlight, globals.css)를 붙였다 뗀다. 펼치는
  // 애니메이션/리렌더링이 끝난 뒤에만 요소를 찾을 수 있어서 약간의 지연(setTimeout) 뒤에 찾는다.
  useEffect(() => {
    if (!focusTarget?.packId) return;
    const { packId, itemId } = focusTarget;

    const key = `${bag.id}:${packId}`;
    const currentState = collapseOverrideActive
      ? "collapsed"
      : profile?.packDisplayStates?.[key] ?? "normal";
    if (collapseOverrideActive) setCollapseOverrideActive(false);
    if (currentState === "collapsed") {
      updatePackDisplayState(bag.id, packId, "normal").catch(() => {});
    }

    const timer = window.setTimeout(() => {
      const selector = itemId ? `[data-item-id="${itemId}"]` : `[data-pack-drop-id="${packId}"]`;
      const el = document.querySelector(selector) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("pib-search-highlight");
        window.setTimeout(() => el.classList.remove("pib-search-highlight"), 1850);
      }
      onFocusHandled?.();
    }, 350);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTarget]);

  const handleToggleItem = (packId: string, itemId: string) => {
    if (guardReadOnly()) return;
    updatePacks((packs) =>
      packs.map((p) =>
        p.id !== packId
          ? p
          : {
              ...p,
              items: p.items.map((i) =>
                i.id === itemId ? { ...i, checked: !i.checked } : i
              ),
            }
      )
    );
  };

  const handleChangeItemText = (
    packId: string,
    itemId: string,
    text: string,
    style?: { bold?: boolean; strike?: boolean; color?: string; spans?: RichSpan[] }
  ) => {
    if (guardReadOnly()) return;
    updatePacks((packs) =>
      packs.map((p) => {
        if (p.id !== packId) return p;
        const items = p.items.map((i) =>
          i.id === itemId
            ? {
                ...i,
                text,
                ...(style
                  ? {
                      bold: style.bold,
                      strike: style.strike,
                      color: style.color,
                      spans: style.spans,
                    }
                  : { spans: undefined }),
              }
            : i
        );
        const updated = { ...p, items };
        return { ...updated, savedAsLibraryPack: isInSyncWithLibrary(updated, libraryPacks) };
      })
    );
  };

  const handleDeleteItem = (packId: string, itemId: string) => {
    if (guardReadOnly()) return;
    // removedItem/removedIndex는 setBag의 업데이터 함수 안에서 계산하지 않는다 - 같은
    // 이벤트 핸들러 안에서 그 앞에 다른 state 업데이트(pushUndoSnapshot의 setHistoryLen)가
    // 먼저 일어나면 React가 이 setBag 업데이터를 동기적으로(eager) 실행해주지 않을 수
    // 있어서, 바로 다음 줄에서 읽으면 값이 비어있는 경우가 생긴다. 그래서 현재 bag.packs
    // 에서 직접 미리 계산해둔다.
    const targetPack = bag.packs.find((p) => p.id === packId);
    const removedIndex = targetPack?.items.findIndex((i) => i.id === itemId) ?? -1;
    const removedItem = removedIndex >= 0 ? targetPack!.items[removedIndex] : undefined;
    updatePacks((packs) =>
      packs.map((p) => {
        if (p.id !== packId) return p;
        const items = p.items.filter((i) => i.id !== itemId);
        const updated = { ...p, items };
        return { ...updated, savedAsLibraryPack: isInSyncWithLibrary(updated, libraryPacks) };
      })
    );
    if (removedItem) {
      const restored = removedItem;
      const restoreIndex = removedIndex;
      show("짐을 삭제했어요", {
        actionLabel: "되돌리기",
        onAction: () => {
          updatePacks((packs) =>
            packs.map((p) => {
              if (p.id !== packId) return p;
              const items = [...p.items];
              items.splice(Math.min(restoreIndex, items.length), 0, restored);
              const updated = { ...p, items };
              return { ...updated, savedAsLibraryPack: isInSyncWithLibrary(updated, libraryPacks) };
            })
          );
        },
      });
    }
  };

  // 짐 수정은 중앙 모달(ItemFormModal)을 열어서 처리한다. 새 짐 추가는 상단 "+" 버튼으로 여는
  // 통합 모달(NotebookQuickAddModal)을 통해서만 이뤄진다(아래 handleCreateItem 참고).
  const [itemModal, setItemModal] = useState<{ sourcePackId: string; item: Item } | null>(null);

  const handleOpenEditItem = (packId: string, itemId: string) => {
    if (guardReadOnly()) return;
    const pack = bag.packs.find((p) => p.id === packId);
    const item = pack?.items.find((i) => i.id === itemId);
    if (!item) return;
    setItemModal({ sourcePackId: packId, item });
  };

  const handleCreateItem = (
    targetPackId: string,
    data: { type: "check" | "text"; text: string; bold?: boolean; strike?: boolean; color?: string; dueDate?: string; spans?: RichSpan[] }
  ) => {
    if (guardReadOnly()) return;
    updatePacks((packs) =>
      packs.map((p) => {
        if (p.id !== targetPackId) return p;
        const newItem: Item = {
          id: uid(),
          type: data.type,
          text: data.text,
          dueDate: data.dueDate,
          ...(data.type === "check"
            ? { checked: false }
            : { bold: data.bold, strike: data.strike, color: data.color, spans: data.spans }),
        };
        const items = [...p.items, newItem];
        const updated = { ...p, items };
        return { ...updated, savedAsLibraryPack: isInSyncWithLibrary(updated, libraryPacks) };
      })
    );
  };

  // 짐 수정 모달의 저장 처리. 같은 팩을 유지하면 원래 위치 그대로 내용만 갱신하고,
  // 모달에서 다른 팩으로 바꿔서 저장하면 기존 드래그 이동(handleMoveItem)처럼 원래
  // 팩에서 제거하고 대상 팩 맨 끝에 추가한다.
  const handleUpdateItem = (
    sourcePackId: string,
    itemId: string,
    targetPackId: string,
    data: { type: "check" | "text"; text: string; bold?: boolean; strike?: boolean; color?: string; dueDate?: string; assigneeUid?: string; spans?: RichSpan[] }
  ) => {
    if (guardReadOnly()) return;
    updatePacks((packs) => {
      const sourcePack = packs.find((p) => p.id === sourcePackId);
      const original = sourcePack?.items.find((i) => i.id === itemId);
      if (!original) return packs;

      const updatedItem: Item = {
        id: original.id,
        type: data.type,
        text: data.text,
        dueDate: data.dueDate,
        assigneeUid: data.assigneeUid,
        ...(data.type === "check"
          ? { checked: original.type === "check" ? original.checked : false }
          : { bold: data.bold, strike: data.strike, color: data.color, spans: data.spans }),
      };

      if (sourcePackId === targetPackId) {
        return packs.map((p) => {
          if (p.id !== sourcePackId) return p;
          const items = p.items.map((i) => (i.id === itemId ? updatedItem : i));
          const updated = { ...p, items };
          return { ...updated, savedAsLibraryPack: isInSyncWithLibrary(updated, libraryPacks) };
        });
      }

      return packs.map((p) => {
        if (p.id === sourcePackId) {
          const updated = { ...p, items: p.items.filter((i) => i.id !== itemId) };
          return { ...updated, savedAsLibraryPack: isInSyncWithLibrary(updated, libraryPacks) };
        }
        if (p.id === targetPackId) {
          const updated = { ...p, items: [...p.items, updatedItem] };
          return { ...updated, savedAsLibraryPack: isInSyncWithLibrary(updated, libraryPacks) };
        }
        return p;
      });
    });
    if (sourcePackId !== targetPackId) show("짐을 옮겼어요");
  };

  const handleRenamePack = (packId: string, name: string) => {
    if (guardReadOnly()) return;
    updatePacks((packs) =>
      packs.map((p) => {
        if (p.id !== packId) return p;
        const updated = { ...p, name };
        return { ...updated, savedAsLibraryPack: isInSyncWithLibrary(updated, libraryPacks) };
      })
    );
  };

  // 10개 캡을 "+팩" 버튼의 disabled 속성뿐 아니라 함수 자체에도 걸어둔다 - 그래야
  // PackImportModal의 "새 팩 만들기"처럼 disabled 체크가 없는 다른 진입점에서
  // 호출해도 안전하다. 캡에 걸리면 조용히 무시하지 않고 이유를 알려준다.
  // 새로 만든 팩의 id를 동기적으로 돌려준다 - 하단 빠른입력바(BagQuickAddBar)의 "+ 새 팩"
  // 칩이 만들자마자 그 팩을 바로 선택 상태로 넘겨받기 위해 필요하다(캡에 걸리면 null).
  const handleAddPack = (kind: "checklist" | "editor" = "checklist"): string | null => {
    if (guardReadOnly()) return null;
    if (bag.packs.length >= 10) {
      show("가방 하나에는 팩을 최대 10개까지 넣을 수 있어요");
      return null;
    }
    const newPackId = uid();
    // 2026-07: 새 팩은 맨 아래가 아니라 맨 위에 추가한다 - 방금 만든 팩을 아래로 스크롤해서
    // 찾아야 하는 불편을 없애기 위함(팩뷰/심플뷰 모두 이 packs 배열 순서를 그대로 따른다).
    if (kind === "editor") {
      updatePacks((packs) => [
        { id: newPackId, name: "새 메모", items: [], kind: "editor" },
        ...packs,
      ]);
      return newPackId;
    }
    updatePacks((packs) => [{ id: newPackId, name: "새 팩", items: [] }, ...packs]);
    return newPackId;
  };

  // 상단 "+팩" 버튼을 누르면 바로 만들지 않고 체크리스트/메모 중 고르는 작은 시트를 띄운다.
  const [showAddPackKindSheet, setShowAddPackKindSheet] = useState(false);
  useEscapeToClose(() => setShowAddPackKindSheet(false), showAddPackKindSheet);

  // 가방 속 에디터팩(자유문서형 메모 팩)을 전체화면 편집기(PackNoteEditorScreen)로 여는 상태.
  // 라이브러리 쪽(AppShell/PacksScreen)과 달리, 가방 안에서는 별도 화면 전환 없이 이 화면
  // 위에 풀스크린 오버레이로 띄우고 바로 이 가방의 자동저장 파이프라인(updatePacks)으로 반영한다.
  const [editingNotePackId, setEditingNotePackId] = useState<string | null>(null);
  // editingNotePackId는 닫을 때 바로 null이 되므로, 슬라이드 아웃 애니메이션이 끝날 때까지
  // 어느 팩을 보여주고 있었는지 기억해두기 위한 캐시.
  const [displayedNotePackId, setDisplayedNotePackId] = useState<string | null>(null);
  useEffect(() => {
    if (!editingNotePackId) return;
    // 외부(사용자 조작) 상태를 그대로 미러링하는 의도된 동기화다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDisplayedNotePackId(editingNotePackId);
  }, [editingNotePackId]);

  const handleSaveNotePack = (updated: Pack) => {
    // 메모 하나는 300KB 이하라도, 가방 하나에 큰 메모팩이 여러 개 누적되면 가방 문서 전체가
    // Firestore 1MB 한도에 가까워질 수 있다. 저장 직전에 예상 가방 크기를 확인해서 너무 크면 막는다.
    const projectedBag = {
      ...bag,
      packs: bag.packs.map((p) => (p.id === updated.id ? updated : p)),
    };
    const sizeError = checkBagSizeForSave(projectedBag);
    if (sizeError) {
      show(sizeError);
      return;
    }
    updatePacks((packs) => packs.map((p) => (p.id === updated.id ? updated : p)));
  };

  // 공유 가방(멤버 2명 이상)일 때만 접속자 presence를 구독하고 하트비트를 전송한다.
  // 혼자 쓰는 1인 가방이거나 아직 생성 중(isNew)인 가방은 불필요한 쓰기/읽기를 건너뛴다.
  const isSharedBag = bag.memberIds.length > 1;
  const [presenceEntries, setPresenceEntries] = useState<RawPresence[]>([]);

  useEffect(() => {
    if (!isSharedBag || isNew) {
      setPresenceEntries([]);
      return;
    }
    const leave = joinPresence(bag.id, currentUid, nickname, avatarId, isSharedBag);
    const unsub = subscribeToPresence(bag.id, setPresenceEntries);
    return () => {
      unsub();
      leave();
    };
  }, [bag.id, currentUid, nickname, avatarId, isSharedBag, isNew]);

  // 지금 내가 열고 있는 메모팩 id를 presence에 알린다(닫거나 다른 팩으로 바꿀 때 자동으로 지우고
  // 새로 알림). 공유 가방에서만 동작하며, 다른 사람이 같은 팩을 편집 중이면(otherNoteEditor 아래) 배지로 보여준다.
  useEffect(() => {
    if (!isSharedBag || !editingNotePackId) return;
    setEditingNotePack(bag.id, currentUid, editingNotePackId);
    return () => {
      setEditingNotePack(bag.id, currentUid, null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingNotePackId, bag.id, currentUid, isSharedBag]);

  const otherNoteEditor = editingNotePackId
    ? presenceEntries.find(
        (e) =>
          e.uid !== currentUid &&
          e.editingPackId === editingNotePackId &&
          Date.now() - e.updatedAtMs < PRESENCE_STALE_MS
      )
    : undefined;

  // 팩뷰/심플뷰에서 각 메모팩 카드에 "지금 이 팩을 편집 중인 사람들"을 아바타로 보여주기 위한
  // 조회 함수. 카드 목록 화면에서는 내 편집 화면(전체화면 오버레이)이 그 위를 덮고 있으므로
  // 내 자신은 자연스럽게 제외된다(동시에 볼 수 없는 화면이기 때문). 최대 3명까지만 보여준다.
  const getNoteEditorsForPack = (packId: string) =>
    presenceEntries
      .filter(
        (e) =>
          e.uid !== currentUid &&
          e.editingPackId === packId &&
          Date.now() - e.updatedAtMs < PRESENCE_STALE_MS
      )
      .slice(0, 3);

  const [showPackingMode, setShowPackingMode] = useState(false);
  const [showShareCard, setShowShareCard] = useState(false);
  const [showAiAudit, setShowAiAudit] = useState(false);
  const [assigneeTargetItem, setAssigneeTargetItem] = useState<{ packId: string; item: Item } | null>(null);
  const [filterOnlyMyItems, setFilterOnlyMyItems] = useState(false);

  const handleAssignItem = (packId: string, itemId: string, assigneeUid: string | undefined) => {
    if (guardReadOnly()) return;
    updatePacks((packs) =>
      packs.map((p) => {
        if (p.id !== packId) return p;
        return {
          ...p,
          items: p.items.map((i) => (i.id === itemId ? { ...i, assigneeUid } : i)),
        };
      })
    );
  };

  const handleAddItemFromAudit = (packName: string, itemText: string) => {
    if (guardReadOnly()) return;
    updatePacks((packs) => {
      const existingPack = packs.find((p) => p.name === packName && p.kind !== "editor" && p.type !== "folder");
      const newItem: Item = { id: uid(), type: "check", text: itemText, checked: false };
      if (existingPack) {
        return packs.map((p) => (p.id === existingPack.id ? { ...p, items: [...p.items, newItem] } : p));
      }
      const newPack: Pack = {
        id: uid(),
        name: packName,
        items: [newItem],
      };
      return [...packs, newPack];
    });
    show(`'${packName}' 팩에 '${itemText}'을(를) 담았어요`);
  };

  const handleImport = (imported: Pack[]) => {
    if (guardReadOnly()) return;
    // 2026-07: 새 팩을 만들 때(handleAddPack/handleQuickAddNewPack)와 동일하게, 보관함에서
    // 불러온 팩도 맨 위에 넣는다. 10개 캡에 걸리면 기존 팩(뒤쪽, 오래된 것)부터 잘린다.
    updatePacks((packs) => [...imported, ...packs].slice(0, 10));
  };

  // 심플뷰 상단 "+" 통합 추가 모달 전용. 이름까지 바로 지어 새 팩을 만들고 첫 항목까지
  // 넣은 다음, 그 팩 id를 그대로 돌려줌으로써 모달이 연속입력을 이어갈 때 새로 만든
  // 그 팩으로 계속 추가할 수 있게 한다. handleAddPack과 동일한 10개 캡 검사를 적용하고,
  // 실패하면 null을 돌려서 모달 쓰는 쪽에서 그대로 안내하게 한다.
  const handleQuickAddNewPack = (name: string, data: QuickAddItemData): string | null => {
    if (guardReadOnly()) return null;
    if (bag.packs.length >= 10) {
      show("가방 하나에는 팩을 최대 10개까지 넣을 수 있어요");
      return null;
    }
    const newPackId = uid();
    const newItem: Item = {
      id: uid(),
      type: data.type,
      text: data.text,
      ...(data.type === "check"
        ? { checked: false }
        : { bold: data.bold, strike: data.strike, color: data.color }),
    };
    // 2026-07: handleAddPack과 동일하게 새 팩을 맨 위에 추가한다.
    updatePacks((packs) => [
      { id: newPackId, name: name.trim() || "새 팩", items: [newItem] },
      ...packs,
    ]);
    return newPackId;
  };

  const handleDeletePack = (packId: string, alsoDeleteLibrary: boolean) => {
    if (guardReadOnly()) return;
    const pack = bag.packs.find((p) => p.id === packId);
    updatePacks((packs) => packs.filter((p) => p.id !== packId));
    if (alsoDeleteLibrary && pack?.linkedLibraryPackId) {
      deleteLibraryPackRemote(currentUid, pack.linkedLibraryPackId).catch((err) => {
        console.error("[팩인백] 보관함 팩 삭제 실패:", err);
        show("보관함에서는 삭제하지 못했어요");
      });
    }
    // 가방에서 지운 팩은 완전히 사라지는 게 아니라 팩 보관함 휴지통으로 사본이
    // 옮겨간다(어느 가방에서 지웠는지도 함께 기록돼서 휴지통에서 바로 보인다).
    // "보관함에서도 삭제" 옵션은 이미 연동돼있던 별도의 보관함 팩(위에서 처리)만
    // 대상으로 하고, 이 휴지통 사본과는 무관하다.
    if (pack) {
      onTrashPackFromBag(pack, bag.id, bag.name);
    }
    show(alsoDeleteLibrary ? "팩을 가방과 보관함에서 모두 삭제했어요" : "팩을 휴지통으로 옮겼어요");
  };

  // 팩 카드 개별 토글(넓히기/접기)에서 호출되는 경우와, 상단 전체 컨트롤(접기/기본/펼치기)에서
  // 모든 팩을 한번에 바꿀 때 둘 다 이 함수만 쓸 수 있다. "가방 열 때 팩 접어서 보기" 설정으로
  // 화면에 임시로 접힌 것처럼 보여주고 있던 상태(collapseOverrideActive)라면, 사용자가 실제로
  // 펼치기/접기를 조작하는 순간이므로 그 임시 오버라이드는 끄고 저장된 값을 그대로 따르게 한다.
  // 실제 저장은 가방 문서(그룹 공유)가 아니라 계정(사용자별)에 하므로, 그룹원과는 동기화되지
  // 않고 나만의 화면 상태로 남는다(다른 기기에서 로그인해도 그대로 유지됨).
  const handleChangeDisplayState = (
    packId: string,
    nextState: "normal" | "wide" | "collapsed"
  ) => {
    if (guardReadOnly()) return;
    if (collapseOverrideActive) {
      const otherPackIds = bag.packs.map((p) => p.id).filter((id) => id !== packId);
      if (otherPackIds.length > 0) {
        updateAllPackDisplayStates(bag.id, otherPackIds, "collapsed").catch(() => {});
      }
    }
    setCollapseOverrideActive(false);
    updatePackDisplayState(bag.id, packId, nextState).catch((err) => {
      console.error("[팩인백] 팩 표시 상태 저장 실패:", err);
    });
  };

  const handleSetAllDisplayState = (nextState: "normal" | "wide" | "collapsed") => {
    if (guardReadOnly()) return;
    setCollapseOverrideActive(false);
    updateAllPackDisplayStates(
      bag.id,
      bag.packs.map((p) => p.id),
      nextState
    ).catch((err) => {
      console.error("[팩인백] 팩 전체 표시 상태 저장 실패:", err);
    });
  };

  // fromPackId === toPackId면 같은 팩 안에서 overItemId 위치로 순서를 바꾸고,
  // 다르면 기존처럼 다른 팩으로 옮긴다. insertAfter가 true면 overItemId "다음"에,
  // 아니면(기본) "앞"에 끼워넣는다(드래그 중 커서가 대상 항목의 위쪽 절반/아래쪽 절반
  // 중 어디 있는지로 판정되어 더 직관적이다). 화면에 보이는 순서(getDisplayOrderedItems)
  // 기준으로 계산해야 "완료된 항목 맨 아래로 이동" 설정이 켜져있어도 드래그 위치와
  // 실제 결과가 어긋나지 않는다 - 예전엔 원본(pack.items) 순서 기준으로 계산해서 화면과
  // 다르게 반영되는 버그가 있었다.
  const handleMoveItem = (
    fromPackId: string,
    toPackId: string,
    itemId: string,
    overItemId?: string | null,
    insertAfter?: boolean
  ) => {
    if (guardReadOnly()) return;
    const moveCompletedToBottom = profile?.packSettings?.moveCompletedToBottom ?? true;
    // 메모팩(kind==='editor')은 items가 항상 빈 배열이어야 하는데(실제 내용은 editorDoc에 있음),
    // 드래그로 짐을 그 카드 위에 놓으면 데이터상으로는 들어가면서 화면에는 안 보이는(잃어버린
    // 것처럼 보이는) 버그가 생긴다. 대상 팩이 메모팩이면 이동을 막고 안내한다.
    if (fromPackId !== toPackId && bag.packs.find((p) => p.id === toPackId)?.kind === "editor") {
      show("메모 팩에는 짐을 넣을 수 없어요");
      return;
    }
    if (fromPackId === toPackId) {
      if (!overItemId || overItemId === itemId) return;
      updatePacks((packs) =>
        packs.map((p) => {
          if (p.id !== fromPackId) return p;
          const ordered = getDisplayOrderedItems(p.items, moveCompletedToBottom);
          const item = ordered.find((i) => i.id === itemId);
          if (!item) return p;
          const withoutItem = ordered.filter((i) => i.id !== itemId);
          let targetIndex = withoutItem.findIndex((i) => i.id === overItemId);
          if (targetIndex === -1) return p;
          if (insertAfter) targetIndex += 1;
          return {
            ...p,
            items: [
              ...withoutItem.slice(0, targetIndex),
              item,
              ...withoutItem.slice(targetIndex),
            ],
          };
        })
      );
      return;
    }
    updatePacks((packs) => {
      const fromPack = packs.find((p) => p.id === fromPackId);
      const item = fromPack?.items.find((i) => i.id === itemId);
      if (!item) return packs;
      return packs.map((p) => {
        if (p.id === fromPackId) {
          const updated = { ...p, items: p.items.filter((i) => i.id !== itemId) };
          return { ...updated, savedAsLibraryPack: isInSyncWithLibrary(updated, libraryPacks) };
        }
        if (p.id === toPackId) {
          const ordered = getDisplayOrderedItems(p.items, moveCompletedToBottom);
          let targetIndex = overItemId ? ordered.findIndex((i) => i.id === overItemId) : -1;
          if (targetIndex !== -1 && insertAfter) targetIndex += 1;
          const items =
            targetIndex === -1
              ? [...ordered, item]
              : [...ordered.slice(0, targetIndex), item, ...ordered.slice(targetIndex)];
          const updated = { ...p, items };
          return { ...updated, savedAsLibraryPack: isInSyncWithLibrary(updated, libraryPacks) };
        }
        return p;
      });
    });
    show("짐을 옮겼어요");
  };

  const [drag, setDrag] = useState<{
    itemId: string;
    fromPackId: string;
    text: string;
    x: number;
    y: number;
    overPackId: string | null;
    overItemId: string | null;
    overItemPosition: "before" | "after" | null;
  } | null>(null);

  const dragRef = useRef<typeof drag>(null);

  // 짐을 처음(아직 선택 안 된 상태에서) 롱프레스하면 곧바로 선택모드로 들어가는 대신,
  // 일단 "집어든" 상태로만 기록해두고 다음 움직임을 지켜본다 - 그대로 움직이면(아래
  // pendingSingleItemDrag 이펙트에서 판정) 다중선택 없이 이 짐 하나만 바로 드래그로
  // 옮기고, 움직임 없이 손을 떼면 기존처럼 다중선택 모드로 들어간다. 이미 선택된 짐을
  // 다시 롱프레스한 경우(아래 if문)는 그대로 곧바로 그룹 드래그를 시작한다.
  const pendingSingleItemDragRef = useRef<{
    packId: string;
    itemId: string;
    x: number;
    y: number;
  } | null>(null);

  const handleStartItemDrag = (
    packId: string,
    itemId: string,
    text: string,
    clientX: number,
    clientY: number
  ) => {
    if (guardReadOnly()) return;
    if (selection && selection[packId]?.has(itemId)) {
      const next = {
        itemsByPack: selection,
        x: clientX,
        y: clientY,
        overPackId: null,
        overItemId: null,
        overItemPosition: null,
      };
      groupDragRef.current = next;
      setGroupDrag(next);
      return;
    }
    pendingSingleItemDragRef.current = { packId, itemId, x: clientX, y: clientY };
  };

  // 짐 다중선택 상태: 한 번에 한 팩만 대상으로 한다(다른 팩을 롱프레스하면 그 팩으로
  // 선택이 넘어간다). null이면 선택 모드가 아님.
  const [selection, setSelection] = useState<Record<string, Set<string>> | null>(null);

  const totalSelectedCount = (sel: Record<string, Set<string>> | null) =>
    sel ? Object.values(sel).reduce((sum, ids) => sum + ids.size, 0) : 0;

  const toggleSelectItem = (packId: string, itemId: string) => {
    setSelection((prev) => {
      const next: Record<string, Set<string>> = {};
      if (prev) {
        for (const [pid, ids] of Object.entries(prev)) next[pid] = new Set(ids);
      }
      const set = next[packId] ? new Set(next[packId]) : new Set<string>();
      if (set.has(itemId)) set.delete(itemId);
      else set.add(itemId);
      if (set.size === 0) delete next[packId];
      else next[packId] = set;
      return totalSelectedCount(next) === 0 ? null : next;
    });
  };

  const cancelSelection = () => setSelection(null);

  // 팀뷰에서 "이미 선택된 짐을 다시 길게 누름" 시 시작되는 그룹 이동 드래그 상태.
  // 다른 패 위에 놓으면 선택된 짐 전체가 그 패으로 옮겨간다.
  const [groupDrag, setGroupDrag] = useState<{
    itemsByPack: Record<string, Set<string>>;
    x: number;
    y: number;
    overPackId: string | null;
    overItemId: string | null;
    overItemPosition: "before" | "after" | null;
  } | null>(null);
  const groupDragRef = useRef<typeof groupDrag>(null);

  // 선택된 짐들을 다른 패으로 통채 옮긴다(순서는 맨 뒤에 추가). 남은 자리에서 손을
  // 떼면(같은 패 위에 놓거나 대상 패가 없으면) 아무것도 하지 않고 그대로 선택 상태를 유지한다.
  const handleMoveSelectedItems = (itemsByPack: Record<string, Set<string>>, toPackId: string) => {
    if (guardReadOnly()) return;
    // 메모팩(kind==='editor')에는 짐을 놓을 수 없다 - handleMoveItem과 동일한 방어.
    if (bag.packs.find((p) => p.id === toPackId)?.kind === "editor") {
      show("메모 팩에는 짐을 넣을 수 없어요");
      return;
    }
    let movedCount = 0;
    updatePacks((packs) => {
      const movingItems: Item[] = [];
      for (const [packId, ids] of Object.entries(itemsByPack)) {
        if (packId === toPackId || ids.size === 0) continue;
        const fromPack = packs.find((p) => p.id === packId);
        if (fromPack) movingItems.push(...fromPack.items.filter((i) => ids.has(i.id)));
      }
      if (movingItems.length === 0) return packs;
      movedCount = movingItems.length;
      return packs.map((p) => {
        const ids = itemsByPack[p.id];
        if (p.id !== toPackId && ids && ids.size > 0) {
          const updated = { ...p, items: p.items.filter((i) => !ids.has(i.id)) };
          return { ...updated, savedAsLibraryPack: isInSyncWithLibrary(updated, libraryPacks) };
        }
        if (p.id === toPackId) {
          const updated = { ...p, items: [...p.items, ...movingItems] };
          return { ...updated, savedAsLibraryPack: isInSyncWithLibrary(updated, libraryPacks) };
        }
        return p;
      });
    });
    if (movedCount > 0) show(`${movedCount}개를 옮겼어요`);
    setSelection(null);
  };

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (!groupDragRef.current) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const packEl = el?.closest("[data-pack-drop-id]") as HTMLElement | null;
      const overPackId = packEl?.getAttribute("data-pack-drop-id") ?? null;
      const itemEl = el?.closest("[data-item-id]") as HTMLElement | null;
      const overItemId = itemEl?.getAttribute("data-item-id") ?? null;
      let overItemPosition: "before" | "after" | null = null;
      if (itemEl) {
        const rect = itemEl.getBoundingClientRect();
        const itemType = itemEl.getAttribute("data-item-type");
        overItemPosition =
          itemType === "text"
            ? e.clientY - rect.top < rect.height / 2
              ? "before"
              : "after"
            : e.clientX - rect.left < rect.width / 2
            ? "before"
            : "after";
      }
      setGroupDrag((d) => {
        if (!d) return d;
        const next = { ...d, x: e.clientX, y: e.clientY, overPackId, overItemId, overItemPosition };
        groupDragRef.current = next;
        return next;
      });
    };

    const handleUp = () => {
      const d = groupDragRef.current;
      if (!d) return;
      groupDragRef.current = null;
      setGroupDrag(null);
      if (!d.overPackId) return;
      const entries = Object.entries(d.itemsByPack).filter(([, ids]) => ids.size > 0);
      const totalSelected = entries.reduce((sum, [, ids]) => sum + ids.size, 0);
      // 선택된 짐이 딱 한 개이고, 그 짐의 원래 패 위에 그대로 놓았다면 같은 패 안에서의 순서변경으로 처리한다.
      if (totalSelected === 1 && entries.length === 1 && entries[0][0] === d.overPackId && d.overItemId) {
        const [packId, ids] = entries[0];
        const itemId = [...ids][0];
        if (d.overItemId !== itemId) {
          handleMoveItem(packId, packId, itemId, d.overItemId, d.overItemPosition === "after");
          setSelection(null);
        }
        return;
      }
      handleMoveSelectedItems(d.itemsByPack, d.overPackId);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // pendingSingleItemDragRef(위 handleStartItemDrag)의 판정을 담당한다 - 이 정도
  // (PICK_MOVE_PX) 이상 움직이면 다중선택 없이 이 짐 하나만 즉시 드래그(groupDrag,
  // 항목 1개)로 전환하고, 움직임 없이 손을 떼면 그제서야 다중선택 모드로 들어간다.
  useEffect(() => {
    const PICK_MOVE_PX = 8;
    const handleMove = (e: PointerEvent) => {
      const pending = pendingSingleItemDragRef.current;
      if (!pending) return;
      const dx = e.clientX - pending.x;
      const dy = e.clientY - pending.y;
      if (Math.hypot(dx, dy) <= PICK_MOVE_PX) return;
      pendingSingleItemDragRef.current = null;
      const next = {
        itemsByPack: { [pending.packId]: new Set([pending.itemId]) },
        x: e.clientX,
        y: e.clientY,
        overPackId: null,
        overItemId: null,
        overItemPosition: null,
      };
      groupDragRef.current = next;
      setGroupDrag(next);
    };
    const handleUp = () => {
      const pending = pendingSingleItemDragRef.current;
      if (!pending) return;
      pendingSingleItemDragRef.current = null;
      toggleSelectItem(pending.packId, pending.itemId);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 선택된 짐들을 그 팩에서 삭제한다. 다른 짐 삭제(handleDeleteItem)와 동일하게
  // 확인창 없이 바로 삭제하고 "되돌리기" 토스트로 복구 기회를 준다.
  const commitDeleteSelected = () => {
    if (guardReadOnly()) return;
    if (!selection) return;
    const entries = Object.entries(selection).filter(([, ids]) => ids.size > 0);
    if (entries.length === 0) return;
    // removedItems는 setBag 업데이터 안에서 계산하지 않는다 - handleDeleteItem과 같은
    // 이유로, 그 앞의 pushUndoSnapshot(setHistoryLen)이 React의 동기(eager) 실행을
    // 막아버리면 바로 다음 줄에서 읽을 때 빈 배열(초기값)만 보이는 경우가 있었다
    // ("0개 삭제했어요" 버그). 그래서 현재 bag.packs에서 직접 미리 계산해둔다.
    const removedByPack: Record<string, Item[]> = {};
    for (const [packId, ids] of entries) {
      const targetPack = bag.packs.find((p) => p.id === packId);
      removedByPack[packId] = targetPack?.items.filter((i) => ids.has(i.id)) ?? [];
    }
    updatePacks((packs) =>
      packs.map((p) => {
        const ids = selection[p.id];
        if (!ids || ids.size === 0) return p;
        const items = p.items.filter((i) => !ids.has(i.id));
        const updated = { ...p, items };
        return { ...updated, savedAsLibraryPack: isInSyncWithLibrary(updated, libraryPacks) };
      })
    );
    setSelection(null);
    const totalRemoved = Object.values(removedByPack).reduce((sum, arr) => sum + arr.length, 0);
    show(`${totalRemoved}개를 삭제했어요`, {
      actionLabel: "되돌리기",
      onAction: () => {
        updatePacks((packs) =>
          packs.map((p) => {
            const removed = removedByPack[p.id];
            if (!removed || removed.length === 0) return p;
            const items = [...p.items, ...removed];
            const updated = { ...p, items };
            return { ...updated, savedAsLibraryPack: isInSyncWithLibrary(updated, libraryPacks) };
          })
        );
      },
    });
  };

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const packEl = el?.closest("[data-pack-drop-id]") as HTMLElement | null;
      const overPackId = packEl?.getAttribute("data-pack-drop-id") ?? null;
      const itemEl = el?.closest("[data-item-id]") as HTMLElement | null;
      const overItemId = itemEl?.getAttribute("data-item-id") ?? null;
      // 드래그 중인 항목을 대상 항목의 어디에 놓을지를 판단한다. 체크형 짐은 2열 그리드로
      // 나란히 놀여있어서 좌/우(가로) 기준으로 판단해야 직관적이고(예: 2번을 1번 왜쪽으로
      // 옮기면 1번 왜쪽에 놓여야 함), 텍스트형 짐은 전체 폭을 차지하는 한 줄이라 위/아래
      // (세로) 기준이 맞다.
      let overItemPosition: "before" | "after" | null = null;
      if (itemEl) {
        const rect = itemEl.getBoundingClientRect();
        const itemType = itemEl.getAttribute("data-item-type");
        overItemPosition =
          itemType === "text"
            ? e.clientY - rect.top < rect.height / 2
              ? "before"
              : "after"
            : e.clientX - rect.left < rect.width / 2
            ? "before"
            : "after";
      }
      setDrag((d) => {
        if (!d) return d;
        const next = { ...d, x: e.clientX, y: e.clientY, overPackId, overItemId, overItemPosition };
        dragRef.current = next;
        return next;
      });
    };

    const handleUp = () => {
      const d = dragRef.current;
      if (!d) return;
      dragRef.current = null;
      setDrag(null);
      const movedToDifferentPack = !!d.overPackId && d.overPackId !== d.fromPackId;
      const movedWithinPack =
        d.overPackId === d.fromPackId && !!d.overItemId && d.overItemId !== d.itemId;
      if (movedToDifferentPack || movedWithinPack) {
        handleMoveItem(
          d.fromPackId,
          d.overPackId!,
          d.itemId,
          d.overItemId,
          d.overItemPosition === "after"
        );
      } else {
        toggleSelectItem(d.fromPackId, d.itemId);
      }
    };
            // 실제로 옮기지 않고(같은 자리에서) 손을 뗐다는 건 이동이 아니라
            // 다중선택을 시작하겠다는 뜻으로 본다(팩 보관함과 동일한 제스처).
            window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- 팩 순서 드래그 -------------------------------------------------------------
  // 짐 드래그(팩→팩 이동)와 별개로, 팩 카드 자체를 드래그해서 가방 안 팩들의
  // 순서를 바꾸는 기능. 같은 [data-pack-drop-id] 드롭존을 재사용한다. 데스크톱에서는
  // 사이드바(DesktopSidebar.tsx)의 가방 행에 붙은 [data-bag-drop-id]도 같이 감지해서, 놓으면
  // 이 가방에서 다른 가방으로 통째 이동시킨다(performMovePackToBag).
  const [packDrag, setPackDrag] = useState<{
    packId: string;
    name: string;
    x: number;
    y: number;
    overPackId: string | null;
    overPackPosition: "before" | "after" | null;
    overBagId: string | null;
  } | null>(null);

  const handleStartPackDrag = (
    packId: string,
    name: string,
    clientX: number,
    clientY: number
  ) => {
    if (guardReadOnly()) return;
    const next = {
      packId,
      name,
      x: clientX,
      y: clientY,
      overPackId: null,
      overPackPosition: null,
      overBagId: null,
    };
    packDragRef.current = next;
    setPackDrag(next);
  };

  // insertAfter가 true면 toPackId "다음"에, 아니면 "앞"에 삽입한다(짐 순서변경과 같은
  // 이유로 커서 위치 기준으로 before/after를 판단해야 어디로 옥겨질지 직관적이다).
  const handleReorderPack = (fromPackId: string, toPackId: string, insertAfter?: boolean) => {
    if (guardReadOnly()) return;
    updatePacks((packs) => {
      const fromIndex = packs.findIndex((p) => p.id === fromPackId);
      if (fromIndex === -1) return packs;
      const withoutItem = packs.filter((p) => p.id !== fromPackId);
      let targetIndex = withoutItem.findIndex((p) => p.id === toPackId);
      if (targetIndex === -1) return packs;
      if (insertAfter) targetIndex += 1;
      const moved = packs[fromIndex];
      return [...withoutItem.slice(0, targetIndex), moved, ...withoutItem.slice(targetIndex)];
    });
    show("팩 순서를 바됀어요");
  };

  const packDragRef = useRef<typeof packDrag>(null);
  // 사이드바 가방 행을 통과하는 동안 하이라이트를 직접 DOM에 그려주기 위한 ref -
  // 그 element는 이 컴포넌트가 만든 것이 아니라 사이드바 컴포넌트가 그린 것이라,
  // React state가 아니라 직접 DOM 스타일을 건드려야한다.
  const bagDropHighlightElRef = useRef<HTMLElement | null>(null);

  const clearBagDropHighlight = () => {
    const el = bagDropHighlightElRef.current;
    if (el) {
      el.style.outline = "";
      el.style.outlineOffset = "";
      el.style.background = "";
    }
    bagDropHighlightElRef.current = null;
  };

  useEffect(() => {
    if (!packDrag) return;

    const handleMove = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      // 데스크톱에서만 사이드바가 존재하므로, 모바일에서는 이 요소 자체가 발견되지 않는다.
      const bagEl = el?.closest("[data-bag-drop-id]") as HTMLElement | null;
      const overBagId = bagEl?.getAttribute("data-bag-drop-id") ?? null;
      // 사이드바에 올라타있으면 같은 팩막(reorder) 드롭존은 보지 않기로 한다(우선순위 분리).
      const packEl = overBagId ? null : (el?.closest("[data-pack-drop-id]") as HTMLElement | null);
      const overPackId = packEl?.getAttribute("data-pack-drop-id") ?? null;
      let overPackPosition: "before" | "after" | null = null;
      if (packEl) {
        const rect = packEl.getBoundingClientRect();
        overPackPosition = e.clientY - rect.top < rect.height / 2 ? "before" : "after";
      }

      // 사이드바 하이라이트 - 다른 가방 위에 올라타있을 때만 표시하고, 지금 열어본 가방
      // 자체에 올라타 있으면(이동이 의미없으니) 표시하지 않는다.
      const validOverBagId = overBagId && overBagId !== bag.id ? overBagId : null;
      if (bagEl !== bagDropHighlightElRef.current) {
        clearBagDropHighlight();
        if (validOverBagId && bagEl) {
          bagEl.style.outline = "2px solid var(--accent)";
          bagEl.style.outlineOffset = "-2px";
          bagEl.style.background = "var(--accent-soft)";
          bagDropHighlightElRef.current = bagEl;
        }
      }

      setPackDrag((d) => {
        if (!d) return d;
        const next = {
          ...d,
          x: e.clientX,
          y: e.clientY,
          overPackId,
          overPackPosition,
          overBagId: validOverBagId,
        };
        packDragRef.current = next;
        return next;
      });
    };

    // 예전에는 손을 덴 순간(handleUp) 안에서 setPackDrag의 함수형 업데이트(d => {...})
    // 안에서 바로 handleReorderPack(setBag + 토스트 show)을 호출해서, "BagEditorScreen을
    // 렌더링하는 도중에 ToastProvider 상태를 바꾸다"는 React 경고가 났다(setState
    // 업데이터 함수 안에서 다른 컴포넌트의 setState를 호출하는 건 안전하지 않다).
    // 짐/그룹 드래그와 동일하게 packDragRef로 최신 값을 따로 보관해두는 방식으로 수정해서,
    // handleUp에선 setPackDrag(null)을 그대로 호출하고 handleReorderPack은 업데이트와
    // 무관한 별도 문장으로 따로 호출한다.
    const handleUp = () => {
      const d = packDragRef.current;
      packDragRef.current = null;
      setPackDrag(null);
      clearBagDropHighlight();
      if (d && d.overBagId) {
        performMovePackToBag(d.packId, d.overBagId);
        return;
      }
      if (d && d.overPackId && d.overPackId !== d.packId) {
        handleReorderPack(d.packId, d.overPackId, d.overPackPosition === "after");
      }
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
      clearBagDropHighlight();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packDrag !== null]);

  const [duplicateTarget, setDuplicateTarget] = useState<{
    packId: string;
    suggestedName: string;
  } | null>(null);
  const [saveConfirmTarget, setSaveConfirmTarget] = useState<string | null>(null);
  const [updateChoiceTarget, setUpdateChoiceTarget] = useState<{
    packId: string;
    conflict: boolean;
  } | null>(null);

  const commitSaveToLibrary = (packId: string, nameOverride?: string) => {
    if (guardReadOnly()) return;
    const pack = bag.packs.find((p) => p.id === packId);
    if (!pack) return;
    const name = (nameOverride ?? pack.name).trim();
    const newLibraryId = uid();
    const now = new Date().toISOString();
    onSaveAsLibraryPack({
      ...pack,
      id: newLibraryId,
      name,
      updatedAt: now,
      savedAsLibraryPack: undefined,
      linkedLibraryPackId: undefined,
      linkedLibraryUpdatedAt: undefined,
      items: pack.items.map((i) => ({ ...i, id: uid(), dueDate: undefined })),
    });
    updatePacks((packs) =>
      packs.map((p) =>
        p.id === packId
          ? {
              ...p,
              name,
              savedAsLibraryPack: true,
              linkedLibraryPackId: newLibraryId,
              linkedLibraryUpdatedAt: now,
            }
          : p
      )
    );
    show("팩으로 저장했어요");
  };

  const handleSaveToLibrary = (packId: string) => {
    if (guardReadOnly()) return;
    const pack = bag.packs.find((p) => p.id === packId);
    if (!pack) return;
    if (!pack.linkedLibraryPackId) {
      // 아직 한 번도 저장한 적 없는 팩 -> 저장 여부 확인
      setSaveConfirmTarget(packId);
      return;
    }
    // 캐시된 값(savedAsLibraryPack)이 아니라 지금 이 순간의 보관함 기준으로 다시 비교한다.
    // 다른 가방/기기에서 같은 보관함 팩을 먼저 바꿔놨을 수도 있기 때문에, 화면에 남아있는
    // 예전 상태만 믿으면 "변경사항 없음"을 잘못 판단할 수 있다.
    if (isInSyncWithLibrary(pack, libraryPacks)) {
      show("변경사항이 없어요");
      return;
    }
    // 저장된 적 있는데 지금 보니 보관함이랑 다름 -> 그게 "내가 방금 고쳐서"인지
    // "다른 가방이 먼저 보관함을 바꿔놔서"인지 구분해서, 후자면 덮어쓰기를 막는다.
    const source = libraryPacks.find((p) => p.id === pack.linkedLibraryPackId);
    const conflict =
      !!source &&
      !!pack.linkedLibraryUpdatedAt &&
      !!source.updatedAt &&
      source.updatedAt > pack.linkedLibraryUpdatedAt;
    setUpdateChoiceTarget({ packId, conflict });
  };

  const confirmInitialSave = (packId: string) => {
    if (guardReadOnly()) return;
    setSaveConfirmTarget(null);
    const pack = bag.packs.find((p) => p.id === packId);
    if (!pack) return;
    const nameTaken = libraryPacks.some(
      (p) => p.name.trim() === pack.name.trim()
    );
    if (nameTaken) {
      setDuplicateTarget({ packId, suggestedName: `${pack.name} (2)` });
      return;
    }
    commitSaveToLibrary(packId);
  };

  const handleChooseSaveAsNew = (packId: string) => {
    if (guardReadOnly()) return;
    setUpdateChoiceTarget(null);
    const pack = bag.packs.find((p) => p.id === packId);
    if (!pack) return;
    const nameTaken = libraryPacks.some(
      (p) => p.id !== pack.linkedLibraryPackId && p.name.trim() === pack.name.trim()
    );
    if (nameTaken) {
      setDuplicateTarget({ packId, suggestedName: `${pack.name} (2)` });
      return;
    }
    commitSaveToLibrary(packId);
  };

  const commitOverwriteToLibrary = (packId: string) => {
    if (guardReadOnly()) return;
    setUpdateChoiceTarget(null);
    const pack = bag.packs.find((p) => p.id === packId);
    if (!pack?.linkedLibraryPackId) return;
    const name = pack.name.trim();
    const now = new Date().toISOString();
    onSaveAsLibraryPack({
      ...pack,
      id: pack.linkedLibraryPackId,
      name,
      updatedAt: now,
      savedAsLibraryPack: undefined,
      linkedLibraryPackId: undefined,
      linkedLibraryUpdatedAt: undefined,
      items: pack.items.map((i) => ({ ...i, dueDate: undefined })),
    });
    updatePacks((packs) =>
      packs.map((p) =>
        p.id === packId
          ? { ...p, name, savedAsLibraryPack: true, linkedLibraryUpdatedAt: now }
          : p
      )
    );
    show("팩을 덮어썼어요");
  };

  const handleRefreshFromLibrary = (packId: string) => {
    if (guardReadOnly()) return;
    const pack = bag.packs.find((p) => p.id === packId);
    if (!pack?.linkedLibraryPackId) return;
    const source = libraryPacks.find((p) => p.id === pack.linkedLibraryPackId);
    if (!source) {
      show("원본 팩을 찾을 수 없어요");
      return;
    }
    updatePacks((packs) =>
      packs.map((p) =>
        p.id === packId
          ? {
              ...p,
              name: source.name,
              savedAsLibraryPack: true,
              linkedLibraryUpdatedAt: source.updatedAt,
              items: source.items.map((i) => ({ ...i, id: uid(), dueDate: undefined })),
              // 에디터팩(자유문서형)은 실제 내용이 items가 아니라 editorDoc에 있으므로
              // 이것도 함께 다시 불러와야 다시 불러오기가 실제로 동작한다(checklist 팩은 undefined가 되도 무해).
              editorDoc: source.editorDoc,
              editorPreviewText: source.editorPreviewText,
            }
          : p
      )
    );
    show("팩을 다시 불러왔어요");
  };

  const handleToggleAllInPack = (packId: string, checked: boolean) => {
    if (guardReadOnly()) return;
    updatePacks((packs) =>
      packs.map((p) =>
        p.id !== packId
          ? p
          : {
              ...p,
              items: p.items.map((i) => (i.type === "check" ? { ...i, checked } : i)),
            }
      )
    );
  };

  // 상단 툴바 체크박스 전체선택/해제 버튼용 - 패/심플뷰 구분 없이 이 가방 안 모든 패(메모패 제외)의
  // 체크형 짐을 한번에 다 켜거나 끄는다. 현재 모든 체크형 짐이 다 켜져있으면(allBagChecked)
  // 다음 클릭에는 전체해제, 아니면 전체선택한다.
  const handleToggleAllInBag = (checked: boolean) => {
    if (guardReadOnly()) return;
    updatePacks((packs) =>
      packs.map((p) => ({
        ...p,
        items: p.items.map((i) => (i.type === "check" ? { ...i, checked } : i)),
      }))
    );
  };

  const handleAddImages = async (files: FileList | null) => {
    if (guardReadOnly()) return;
    if (!files || files.length === 0) return;

    // 무료 회원은 가방 대표 사진을 본인 업로드 기준 1장까지 가능 (초과 시 이용권 등록 안내)
    if (!premium && bag.images.length >= FREE_MAX_USER_BAG_IMAGES) {
      setPremiumModalMessage(
        `무료 회원은 가방 사진을 최대 ${FREE_MAX_USER_BAG_IMAGES}장까지 첨부할 수 있어요. 사진을 더 추가하려면 이용권 코드를 등록해주세요.`
      );
      return;
    }

    const maxAllowed = premium ? MAX_BAG_IMAGES : FREE_MAX_USER_BAG_IMAGES;
    const selected = Array.from(files).slice(0, maxAllowed - bag.images.length);

    // PDF는 프리미엄 전용 기능 - storage.rules가 실제로도 프리미엄 요청자에게만 읽기/쓰기를
    // 허용한다. 무료 회원이 PDF를 골랐다면 그 파일들만 업로드 목록에서 빼고 업그레이드
    // 안내 모달을 띄우며, 같이 고른 이미지는 그대로 정상 업로드된다.
    const isNonImageFile = (f: File) => !f.type.startsWith("image/");
    const nonImageFiles = selected.filter(isNonImageFile);
    const toUpload = premium ? selected : selected.filter((f) => !isNonImageFile(f));
    if (nonImageFiles.length > 0 && !premium) {
      setPremiumModalMessage(
        "이미지가 아닌 파일(PDF 포함) 첨부/열기는 프리미엄 전용 기능이에요. 이용권 코드를 등록하면 바로 쓸 수 있어요."
      );
    }
    if (toUpload.length === 0) return;

    // PDF is not compressed on upload, so reject oversized PDFs here before spending
    // an upload attempt (images are still compressed down automatically as before).
    const oversized = toUpload.find(
      (f) => isNonImageFile(f) && f.size > MAX_BAG_ATTACHMENT_FILE_BYTES
    );
    if (oversized) {
      show("이미지가 아닌 파일은 10MB 이하만 첨부할 수 있어요");
      return;
    }
    setUploadingImages(true);
    try {
      const urls = await Promise.all(
        toUpload.map((f) => uploadBagImage(bag.id, f))
      );
      setBag((prev) => ({ ...prev, images: [...prev.images, ...urls] }));
    } catch {
      show("이미지 업로드에 실패했어요");
    } finally {
      setUploadingImages(false);
    }
  };

  const removeImage = (idx: number) => {
    if (guardReadOnly()) return;
    const url = bag.images[idx];
    setBag((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== idx),
    }));
    deleteBagImage(url);
  };

  const handleLeave = async () => {
    if (guardReadOnly()) return;
    await onLeaveBag(bag.id);
    setShowMembers(false);
    onBack(bag);
    show("가방에서 나갔어요");
  };

  // 화면에 실제로 그릴 팩 목록. collapseOverrideActive면 저장된 displayState를
  // 무시하고 전부 "collapsed"로 덮어써서 보여준다(데이터 자체는 그대로 둠).
  const packDisplayStates = profile?.packDisplayStates ?? {};
  // 무료회원에게는 다른 멤버(프리미엄)이 만든 AI추천 팩(aiRecommendSource)을 화면에서 숨긴다 -
  // 저장/수정 로직(updatePacks 등)은 여전히 원본 bag.packs를 그대로 쓴다(lib/premiumLimits.ts getViewablePacks 참고).
  const viewablePacks = getViewablePacks(bag.packs, premium);
  const filteredViewablePacks = filterOnlyMyItems
    ? viewablePacks.map((p) => ({
        ...p,
        items: p.items.filter((item) => item.assigneeUid === currentUid),
      }))
    : viewablePacks;
  const effectivePacks = filteredViewablePacks.map((p) => ({
    ...p,
    displayState: collapseOverrideActive
      ? ("collapsed" as const)
      : packDisplayStates[`${bag.id}:${p.id}`] ?? "normal",
  }));

  // 상단 전체 컨트롤(접기/넓게보기) 아이콘이 지금 어떤 상태를 보여줘야 하는지 판단하기 위해,
  // 모든 팩이 같은 displayState인지 확인한다. 팩들이 섞여있으면(일부만 접힘 등) 기본 아이콘으로 보인다.
  const allPacksCollapsed =
    effectivePacks.length > 0 &&
    effectivePacks.every((p) => (p.displayState ?? "normal") === "collapsed");
  const allPacksWide =
    effectivePacks.length > 0 &&
    effectivePacks.every((p) => (p.displayState ?? "normal") === "wide");

  // 상단 체크박스 전체선택/해제 버튼의 현재 상태 판단용 - 이 가방 안 모든 패의 체크형 짐을 모아서,
  // 하나라도 있고 다 켜져있으면만 true(체크할 것이 아예 없으면 false).
  const allBagCheckItems = viewablePacks.flatMap((p) => p.items).filter((i) => i.type === "check");
  const allBagChecked = allBagCheckItems.length > 0 && allBagCheckItems.every((i) => i.checked);
  const checkedBagCount = allBagCheckItems.filter((i) => i.checked).length;
  const totalBagCount = allBagCheckItems.length;
  const bagProgressPct = totalBagCount > 0 ? (checkedBagCount / totalBagCount) * 100 : 0;

  // 이 가방을 카드(팩뷰)로 볼지 내용이 이어지는 문서형(심플뷰)으로 볼지. 이 가방만의
  // 개별 오버라이드(profile.bagViewMode[bag.id])가 있으면 그것을, 없으면 설정 > 가방설정의
  // 전역 기본값(defaultBagViewMode)을 따른다. 그룹원과는 동기화되지 않는 사용자별 설정이라,
  // 같은 가방을 보는 다른 그룹원은 각자 원하는 보기 방식으로 볼 수 있다.
  const viewMode: "pack" | "notebook" =
    profile?.bagViewMode?.[bag.id] ?? profile?.defaultBagViewMode ?? "pack";
  const handleToggleViewMode = () => {
    updateBagViewMode(bag.id, viewMode === "pack" ? "notebook" : "pack").catch((err) => {
      console.error("[팩인백] 보기 방식 저장 실패:", err);
    });
  };

  // groupDrag now tracks selections across multiple packs (itemsByPack). Precompute the
  // total selected count (used by the floating badge) and, when exactly one item across
  // all packs is being dragged, that item's id (used to highlight it) so render doesn't
  // redo this work in multiple places below.
  const groupDragTotalCount = groupDrag
    ? Object.values(groupDrag.itemsByPack).reduce((sum, ids) => sum + ids.size, 0)
    : 0;
  const groupDragSingleItemId = groupDrag
    ? (() => {
        const nonEmpty = Object.values(groupDrag.itemsByPack).filter((s) => s.size > 0);
        return nonEmpty.length === 1 && nonEmpty[0].size === 1 ? [...nonEmpty[0]][0] : null;
      })()
    : null;

  // 하단 빠른입력바(BagQuickAddBar)는 데스크톱 웹(PC 화면 폭, 1024px 이상)에서만 보여준다 -
  // 모바일 웹 및 네이티브 앱(Capacitor)은 이미 모바일 화면이라 여백이 좁거나 키보드가 그 위를 덮을 수 있어 제외한다.
  // 읽기전용(readOnly) 가방이나 다중선택 모드(selection) 중에도 잠시 숨긴다 - 특히
  // 다중선택은 화면 맨 아래에 같은 자리에 선택개수/취소/삭제 액션바가 대신 띄우므로 겹치면 안 된다.
  // 메모패(editingNotePackId)이 열린 동안에도 바가 그대로 남아있던 버그 - 메모패 에디터가
  // 이 화면 위에 풀스크린 오버레이로 띄는데, 바는 이 화면의 자식이라 따로 가려지지 않았다.
  const showQuickAddBar = !readOnly && !selection && !isNativePlatform() && isDesktop && !editingNotePackId;
  const quickAddPacks = viewablePacks.filter((p) => p.kind !== "editor");

  return (
    <div ref={swipeBackRef} className="relative flex-1 flex flex-col overflow-hidden bg-background">
      <div className="relative flex items-center justify-between px-4 py-2.5 shrink-0 border-b border-border/60 bg-surface/30">
        <div className="flex items-center gap-3">
          <button onClick={handleBackAttempt} className="-m-1.5 p-1.5 rounded-lg hover:bg-surface-2 text-text-secondary hover:text-foreground transition-colors" aria-label="뒤로가기">
            <IconArrowLeft size={18} stroke={1.75} />
          </button>
          {!readOnly && (historyLen > 0 || redoLen > 0) && (
            <div className="flex items-center gap-1">
              <button
                onClick={handleUndo}
                disabled={historyLen === 0}
                className="p-1 rounded-md text-text-muted hover:text-foreground disabled:opacity-30 transition-colors"
                aria-label="undo"
              >
                <IconArrowBackUp size={16} stroke={1.75} />
              </button>
              <button
                onClick={handleRedo}
                disabled={redoLen === 0}
                className="p-1 rounded-md text-text-muted hover:text-foreground disabled:opacity-30 transition-colors"
                aria-label="redo"
              >
                <IconArrowForwardUp size={16} stroke={1.75} />
              </button>
            </div>
          )}
          {totalBagCount > 0 && (
            <span className="text-[12px] font-medium text-text-muted">
              완료 {checkedBagCount} / {totalBagCount} ({Math.round(bagProgressPct)}%)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isNew && <PresenceBar entries={presenceEntries} uid={currentUid} />}
          {!readOnly && (
            <button
              onClick={() => setConfirmDeleteBag(true)}
              aria-label={isOwner ? "가방 삭제" : "가방 나가기"}
              className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
            >
              {isOwner ? (
                <IconTrash size={17} stroke={1.75} />
              ) : (
                <IconLogout size={17} stroke={1.75} />
              )}
            </button>
          )}
          {!readOnly && (
            <button
              onClick={() => setShowAiFeatureMenu(true)}
              aria-label="AI 기능"
              className="flex items-center gap-1 rounded-lg border border-border/80 bg-surface px-2 py-1 hover:border-accent transition-colors"
            >
              <span className="text-[12px] font-semibold leading-none" style={{ color: "var(--accent)" }}>
                AI
              </span>
              <IconSparkles size={14} stroke={1.75} color="var(--accent)" />
            </button>
          )}
          <button
            onClick={() => setShowShareCard(true)}
            aria-label="가방 공유 및 멤버"
            className="p-1.5 rounded-lg text-text-secondary hover:text-foreground hover:bg-surface-2 transition-colors"
          >
            <IconShare size={18} stroke={1.75} />
          </button>
        </div>

        {/* 2px 상단 미니멀 진행률 바 */}
        {totalBagCount > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-border/40 overflow-hidden">
            <div
              className="h-full transition-all duration-300 ease-out"
              style={{
                width: `${bagProgressPct}%`,
                background: "var(--accent)",
              }}
            />
          </div>
        )}
      </div>

      <div
        className="flex-1 overflow-y-auto px-4 pb-6"
        style={showQuickAddBar ? { paddingBottom: 140 } : undefined}
      >
        {/* AI 추천은 상단 "AI" 버튼 > "AI 추천"을 직접 선택했을 때만 뜬다(2026-07부터 제목 변경 시
            자동 실행은 하지 않음 - 숫자만으로 된 제목이 엉뚱한 나라로 오탐되는 문제 때문). */}
        {premium && resolvingWeather && (
          <div className="mb-3 p-3 rounded-xl border border-accent/30 bg-accent/5 flex items-center gap-2 shrink-0">
            <IconSparkles size={15} stroke={1.75} color="var(--accent)" className="animate-pulse" />
            <span className="text-[12.5px] text-text-secondary">가방 제목에서 여행지를 찾고 있어요...</span>
          </div>
        )}
        {premium && !resolvingWeather && weatherInfo && (
          <div className="mb-3 p-3 rounded-xl border border-accent/30 bg-accent/5 flex flex-col gap-2 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-text-primary min-w-0">
                <span className="truncate">{weatherInfo.city} 예보: {weatherInfo.weatherText}</span>
                <span className="text-[12px] text-text-muted shrink-0">
                  ({weatherInfo.tempMin}°C ~ {weatherInfo.tempMax}°C)
                </span>
              </div>
              <button
                onClick={() => {
                  setWeatherInfo(null);
                  setAiPlaces(null);
                }}
                aria-label="AI 추천 닫기"
                className="-m-1 p-1 shrink-0"
              >
                <IconX size={14} stroke={1.75} color="var(--text-muted)" />
              </button>
            </div>

            <div className="flex flex-col gap-1.5 pt-1 border-t border-accent/15">
              <div
                onClick={() => setAiPlacesCollapsed((v) => !v)}
                className="w-full flex items-center justify-between gap-2 -mx-1 px-1 py-1.5 rounded-lg cursor-pointer select-none"
              >
                <span className="text-[11.5px] font-medium text-text-muted">
                  AI 추천 · 명소 / 맛집 / 특산물
                </span>
                <span className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRefreshAiPlaces();
                    }}
                    disabled={loadingAiPlaces}
                    aria-label="AI 추천 새로고침"
                    className="-m-1.5 p-1.5 disabled:opacity-30"
                  >
                    <IconRefresh size={14} stroke={1.75} className={loadingAiPlaces ? "animate-spin" : undefined} color="var(--text-secondary)" />
                  </button>
                  <span
                    className="flex items-center gap-0.5 rounded-full pl-2.5 pr-1.5 py-1 text-[11px] font-medium"
                    style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
                  >
                    {aiPlacesCollapsed ? "펼치기" : "접기"}
                    {aiPlacesCollapsed ? (
                      <IconChevronDown size={13} stroke={2.25} />
                    ) : (
                      <IconChevronRight size={13} stroke={2.25} />
                    )}
                  </span>
                </span>
              </div>
              {aiPlacesCollapsed ? null : loadingAiPlaces ? (
                <span className="text-[11.5px] text-text-muted animate-pulse">
                  AI가 {weatherInfo.city}의 명소·맛집·특산물을 찾고 있어요...
                </span>
              ) : (aiPlaces || []).length === 0 ? (
                <span className="text-[11.5px] text-text-muted">아직 추천을 불러오지 못했어요</span>
              ) : (
                <div className="flex flex-col gap-1">
                  {(aiPlaces || []).map((place, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleAddRecommendedItem(`${place.icon} ${place.text}`)}
                      className="flex items-start gap-2 px-2.5 py-1.5 rounded-lg bg-surface border border-border text-left hover:border-accent transition-all"
                    >
                      <span className="text-[15px] shrink-0 leading-5">{place.icon}</span>
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-1.5">
                          <span className="text-[12.5px] font-medium truncate">{place.text}</span>
                          <span className="text-[9.5px] font-semibold px-1 py-0.5 rounded shrink-0" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
                            {RECOMMENDATION_CATEGORY_LABEL[place.category] ?? place.category}
                          </span>
                        </span>
                        <span className="block text-[11px] text-text-muted truncate">{place.desc}</span>
                      </span>
                      <span className="text-[10px] text-accent font-bold shrink-0 pt-0.5">+ 추가</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        {readOnly && (
          <button
            onClick={onRequestUnlock}
            className="w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 mb-3 text-left"
            style={{ background: "var(--surface-2)" }}
          >
            <span className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--text-secondary)" }}>
              <IconLock size={13} stroke={1.75} />
              읽기 전용이에요 · 이용권을 등록하면 다시 수정할 수 있어요
            </span>
            <span className="text-[12px] font-medium shrink-0" style={{ color: "var(--accent)" }}>
              등록
            </span>
          </button>
        )}

        <EditableText
          value={bag.name}
          onChange={(name) => {
            pushUndoSnapshot();
            setBag((prev) => ({ ...prev, name }));
          }}
          readOnly={readOnly}
          className="text-[18px] font-medium mb-2 block text-left"
          inputClassName="text-[18px] font-medium mb-2 block w-full"
          placeholder="새 가방"
        />

        <BagQuickAddRow
          showFile={!readOnly && bag.images.length === 0}
          showTravelDate={!readOnly && !bag.travelDate}
          showNotice={!readOnly && !(bag.notice && bag.notice.trim())}
          showComment={!readOnly && bagLevelComments.length === 0}
          onAddFile={() => fileInputRef.current?.click()}
          onAddTravelDate={() => travelDateRef.current?.open()}
          onAddNotice={() => bagNoticeRef.current?.open()}
          onAddComment={() => setShowBagThread(true)}
        />

        {bag.images.length > 0 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4">
            {bag.images.map((src, idx) => {
              const kind = getFileKind(src);
              return (
                <div
                  key={idx}
                  className="relative shrink-0 h-14 w-14 rounded-lg overflow-hidden bg-surface-2"
                >
                  {kind === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={src}
                      alt=""
                      onClick={() => setLightboxIndex(idx)}
                      className="h-full w-full object-cover"
                    />
                  ) : kind === "pdf" ? (
                    <button
                      onClick={() =>
                        premium
                          ? setPdfPreviewUrl(src)
                          : setPremiumModalMessage(
                              "이미지가 아닌 파일(PDF 포함) 첨부/열기는 프리미엄 전용 기능이에요. 이용권 코드를 등록하면 바로 쓸 수 있어요."
                            )
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
                    <button
                      onClick={() =>
                        premium
                          ? openExternalLink(src)
                          : setPremiumModalMessage(
                              "이미지가 아닌 파일(PDF 포함) 첨부/열기는 프리미엄 전용 기능이에요. 이용권 코드를 등록하면 바로 쓸 수 있어요."
                            )
                      }
                      className="relative h-full w-full flex flex-col items-center justify-center gap-0.5 text-text-secondary px-1"
                      aria-label={premium ? "파일 열기" : "파일 열기 (프리미엄 전용)"}
                    >
                      <IconFileText size={20} stroke={1.75} />
                      <span className="text-[8px] truncate max-w-full">
                        {getFileExtensionLabel(src) || "FILE"}
                      </span>
                      {!premium && (
                        <span
                          className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full flex items-center justify-center"
                          style={{ background: "rgba(0,0,0,0.55)" }}
                        >
                          <IconLock size={9} stroke={2} color="#fff" />
                        </span>
                      )}
                    </button>
                  )}
                  {!readOnly && (
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
            {!readOnly && bag.images.length < MAX_BAG_IMAGES && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImages}
                className="shrink-0 h-14 w-14 rounded-lg border border-dashed border-border-strong flex items-center justify-center text-text-muted disabled:opacity-50"
                aria-label="파일 첨부"
              >
                {uploadingImages ? (
                  <IconLoader2 size={18} stroke={1.75} className="animate-spin" />
                ) : (
                  <IconPhoto size={18} stroke={1.75} />
                )}
              </button>
            )}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => handleAddImages(e.target.files)}
        />

        <div
          className={
            bag.travelDate || (bag.notice && bag.notice.trim()) ? "flex flex-col gap-1.5 mb-3" : ""
          }
        >
          <TravelDateField
            ref={travelDateRef}
            travelDate={bag.travelDate}
            reminderOffsets={bag.reminderOffsets}
            ddayCountTodayAsDayOne={bag.ddayCountTodayAsDayOne}
            onChange={handleChangeTravelDate}
            readOnly={readOnly}
            hideEmptyPrompt
          />

          <BagNotice
            ref={bagNoticeRef}
            value={bag.notice ?? ""}
            onChange={(notice) => {
              pushUndoSnapshot();
              setBag((prev) => ({ ...prev, notice }));
            }}
            readOnly={readOnly}
            hideEmptyPrompt
          />
        </div>

        <BagChatPreview
          comments={bagLevelComments}
          onOpen={() => setShowBagThread(true)}
          hideEmptyPrompt
          currentUid={currentUid}
          deletedAccountIds={deletedAuthorIds}
          allReactions={reactions}
          onToggleCommentReaction={(commentId, emoji, currentlyReacted) => {
            toggleReaction(bag.id, "comment", commentId, currentUid, emoji, currentlyReacted).catch((err) => {
              console.error("[팩인백] 댓글 리액션 실패:", err);
            });
          }}
          onOpenCommentReactionPicker={(commentId, authorNickname) => {
            setReactionPickerCommentTarget({ commentId, authorNickname });
          }}
        />

        {!readOnly && (
          <div
            className="flex gap-2 mb-4 flex-wrap sticky top-0 z-10 py-2"
            style={{ background: "var(--background)" }}
          >
            <button
              onClick={() => setShowImport(true)}
              aria-label="팩 불러오기"
              className="rounded-lg border border-border p-2"
            >
              <IconPackageImport size={17} stroke={1.75} />
            </button>
            <button
              onClick={() => setShowAddPackKindSheet(true)}
              disabled={bag.packs.length >= 10}
              aria-label="새 팩 추가"
              className="relative rounded-lg border border-border p-2 disabled:opacity-40"
            >
              <IconPackage size={17} stroke={1.75} />
              <span
                className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full flex items-center justify-center"
                style={{ background: "var(--accent)" }}
              >
                <IconPlus size={9} stroke={3} color="#fff" />
              </span>
            </button>
            {/* 보기 모드 통합 셀렉트 박스 */}
            <div className="relative">
              <button
                onClick={() => setShowViewMenu((v) => !v)}
                className={`rounded-lg border px-2.5 py-1.5 text-[12px] font-medium flex items-center gap-1.5 transition-all shadow-2xs ${
                  filterOnlyMyItems
                    ? "border-accent bg-accent/10 text-accent font-bold"
                    : "border-border bg-surface hover:bg-surface-2 text-foreground"
                }`}
                aria-label="보기 모드 선택"
              >
                {filterOnlyMyItems ? (
                  <>
                    <IconUser size={13} stroke={2} className="text-accent" />
                    <span>내 짐만</span>
                  </>
                ) : viewMode === "pack" ? (
                  <>
                    <IconLayoutGrid size={13} stroke={1.75} className="text-accent" />
                    <span>팩뷰</span>
                  </>
                ) : (
                  <>
                    <IconNotes size={13} stroke={1.75} className="text-accent" />
                    <span>심플뷰</span>
                  </>
                )}
                <IconChevronDown size={13} stroke={2} className="text-text-muted opacity-70" />
              </button>

              {/* 드롭다운 메뉴 */}
              {showViewMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowViewMenu(false)}
                  />
                  <div
                    className="absolute top-full left-0 mt-1.5 z-50 w-48 rounded-2xl border border-border bg-surface p-1.5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-0.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="px-2.5 py-1 text-[10.5px] font-bold text-text-muted uppercase tracking-wider">
                      보기 방식
                    </div>

                    <button
                      onClick={() => {
                        if (viewMode !== "pack") handleToggleViewMode();
                        setShowViewMenu(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-[12.5px] font-medium transition-colors ${
                        viewMode === "pack" && !filterOnlyMyItems
                          ? "bg-accent/10 text-accent font-bold"
                          : "text-foreground hover:bg-surface-2"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <IconLayoutGrid size={15} stroke={1.75} />
                        <span>팩 뷰 (카드형)</span>
                      </div>
                      {viewMode === "pack" && !filterOnlyMyItems && (
                        <IconCheck size={14} stroke={2.5} />
                      )}
                    </button>

                    <button
                      onClick={() => {
                        if (viewMode !== "notebook") handleToggleViewMode();
                        setShowViewMenu(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-[12.5px] font-medium transition-colors ${
                        viewMode === "notebook" && !filterOnlyMyItems
                          ? "bg-accent/10 text-accent font-bold"
                          : "text-foreground hover:bg-surface-2"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <IconNotes size={15} stroke={1.75} />
                        <span>심플 뷰 (문서형)</span>
                      </div>
                      {viewMode === "notebook" && !filterOnlyMyItems && (
                        <IconCheck size={14} stroke={2.5} />
                      )}
                    </button>

                    <div className="my-1 border-t border-border" />

                    <div className="px-2.5 py-1 text-[10.5px] font-bold text-text-muted uppercase tracking-wider">
                      특별 뷰 & 필터
                    </div>

                    <button
                      onClick={() => {
                        setShowPackingMode(true);
                        setShowViewMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-[12.5px] font-medium text-foreground hover:bg-surface-2 transition-colors"
                    >
                      <IconChecklist size={15} stroke={1.75} className="text-accent" />
                      <span>집중 패킹 모드</span>
                    </button>

                    {bag.memberIds.length > 1 && (
                      <button
                        onClick={() => {
                          setFilterOnlyMyItems((v) => !v);
                          setShowViewMenu(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-[12.5px] font-medium transition-colors ${
                          filterOnlyMyItems
                            ? "bg-accent/10 text-accent font-bold"
                            : "text-foreground hover:bg-surface-2"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <IconUser size={15} stroke={1.75} />
                          <span>내 짐만 보기 (나만보기)</span>
                        </div>
                        {filterOnlyMyItems && <IconCheck size={14} stroke={2.5} />}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
            {bag.packs.length > 0 && (
              <div className="flex items-center gap-2.5 ml-auto rounded-lg border border-border px-2 py-1">
                <button
                  onClick={() => handleToggleAllInBag(!allBagChecked)}
                  aria-label={allBagChecked ? "가방 전체 체크 해제" : "가방 전체 체크"}
                >
                  {allBagChecked ? (
                    <IconSquareCheck size={17} stroke={1.75} color="var(--accent)" />
                  ) : (
                    <IconSquare size={17} stroke={1.75} color="var(--text-secondary)" />
                  )}
                </button>
                <button
                  onClick={() => setHideChecked((v) => !v)}
                  aria-label={hideChecked ? "완료 항목 다시 보이기" : "완료 항목 숨기기"}
                >
                  {hideChecked ? (
                    <IconEyeOff size={17} stroke={1.75} color="var(--accent)" />
                  ) : (
                    <IconEye size={17} stroke={1.75} color="var(--text-secondary)" />
                  )}
                </button>
                {viewMode === "pack" && (
                  <button
                    onClick={() => setShowNotebookQuickAdd(true)}
                    aria-label="항목 추가"
                  >
                    <IconPlus size={17} stroke={1.75} color="var(--text-secondary)" />
                  </button>
                )}
                {viewMode === "pack" && (
                  <button
                    onClick={() => handleSetAllDisplayState(allPacksWide ? "normal" : "wide")}
                    aria-label={allPacksWide ? "팩 전체 기본 크기로" : "팩 전체 넓게 보기"}
                  >
                    {allPacksWide ? (
                      <IconArrowsMinimize size={17} stroke={1.75} color="var(--accent)" />
                    ) : (
                      <IconArrowsMaximize size={17} stroke={1.75} color="var(--text-secondary)" />
                    )}
                  </button>
                )}
                {viewMode === "notebook" && (
                  <button
                    onClick={() => setShowNotebookQuickAdd(true)}
                    aria-label="항목 추가"
                  >
                    <IconPlus size={17} stroke={1.75} color="var(--text-secondary)" />
                  </button>
                )}
                <button
                  onClick={() =>
                    handleSetAllDisplayState(allPacksCollapsed ? "normal" : "collapsed")
                  }
                  aria-label={allPacksCollapsed ? "팩 전체 펼치기" : "팩 전체 접기"}
                >
                  {allPacksCollapsed ? (
                    <IconChevronDown size={17} stroke={1.75} color="var(--text-secondary)" />
                  ) : (
                    <IconChevronRight size={17} stroke={1.75} color="var(--text-secondary)" />
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {bag.packs.length === 0 ? (
          <p className="text-[13px] text-text-muted py-10 text-center">
            팩을 불러오거나 새로 만들어서 짐을 채워보세요.
          </p>
        ) : viewMode === "notebook" ? (
          <NotebookView
            packs={effectivePacks}
            libraryPacks={libraryPacks}
            onToggleItem={handleToggleItem}
            onChangeItemText={handleChangeItemText}
            onDeleteItem={handleDeleteItem}
            onEditItem={handleOpenEditItem}
            onRenamePack={handleRenamePack}
            onToggleAll={handleToggleAllInPack}
            onSaveToLibrary={handleSaveToLibrary}
            onDeletePack={handleDeletePack}
            onChangeDisplayState={handleChangeDisplayState}
            onRefreshFromLibrary={(packId: string) => {
              if (guardReadOnly()) return;
              setRefreshConfirmTarget(packId);
            }}
            onSyncEditorPack={handleToggleAutoSync}
            onMoveToBag={bags.some((b) => b.id !== bag.id) ? handleOpenMovePackSheet : undefined}
            onStartItemDrag={handleStartItemDrag}
            dragSourceItemId={groupDragSingleItemId ?? drag?.itemId ?? null}
            dragOverItemId={groupDragSingleItemId ? groupDrag?.overItemId ?? null : drag?.overItemId ?? null}
            dragOverItemPosition={groupDragSingleItemId ? groupDrag?.overItemPosition ?? null : drag?.overItemPosition ?? null}
            dragOverPackId={drag?.overPackId ?? groupDrag?.overPackId ?? packDrag?.overPackId ?? null}
            dragOverPackPosition={drag?.overItemId ? null : packDrag?.overPackPosition ?? null}
            onStartPackDrag={handleStartPackDrag}
            dragSourcePackId={packDrag?.packId ?? null}
            hideChecked={hideChecked}
            onAddItem={(packId, data) => handleCreateItem(packId, data)}
            selectedItemsByPack={selection}
            onToggleSelectItem={toggleSelectItem}
            getItemThreadInfo={getItemThreadInfo}
            onOpenNotePackEditor={(packId) => setEditingNotePackId(packId)}
            getNoteEditors={getNoteEditorsForPack}
            premium={premium}
            ddayCountTodayAsDayOne={bag.ddayCountTodayAsDayOne}
            /*
            getItemReactionDoc={getItemReactionDoc}
            currentUid={currentUid}
            onToggleItemReaction={handleToggleItemReaction}
            onOpenReactionPicker={(itemId, itemText) =>
              setReactionPickerTarget({ itemId, itemText: itemText || "짐" })
            }
            */
          />
        ) : (
          <PackGrid
            packs={effectivePacks}
            libraryPacks={libraryPacks}
            onToggleItem={handleToggleItem}
            onChangeItemText={handleChangeItemText}
            onDeleteItem={handleDeleteItem}
            onEditItem={handleOpenEditItem}
            onRenamePack={handleRenamePack}
            onToggleAll={handleToggleAllInPack}
            onSaveToLibrary={handleSaveToLibrary}
            onDeletePack={handleDeletePack}
            onChangeDisplayState={handleChangeDisplayState}
            onRefreshFromLibrary={(packId: string) => {
              if (guardReadOnly()) return;
              setRefreshConfirmTarget(packId);
            }}
            onSyncEditorPack={handleToggleAutoSync}
            onMoveToBag={bags.some((b) => b.id !== bag.id) ? handleOpenMovePackSheet : undefined}
            onStartItemDrag={handleStartItemDrag}
            dragSourceItemId={groupDragSingleItemId ?? drag?.itemId ?? null}
            dragOverItemId={groupDragSingleItemId ? groupDrag?.overItemId ?? null : drag?.overItemId ?? null}
            dragOverItemPosition={groupDragSingleItemId ? groupDrag?.overItemPosition ?? null : drag?.overItemPosition ?? null}
            dragOverPackId={drag?.overPackId ?? groupDrag?.overPackId ?? packDrag?.overPackId ?? null}
            dragOverPackPosition={drag?.overItemId ? null : packDrag?.overPackPosition ?? null}
            onStartPackDrag={handleStartPackDrag}
            dragSourcePackId={packDrag?.packId ?? null}
            hideChecked={hideChecked}
            onAddItem={(packId, data) => handleCreateItem(packId, data)}
            selectedItemsByPack={selection}
            onToggleSelectItem={toggleSelectItem}
            getItemThreadInfo={getItemThreadInfo}
            onOpenNotePackEditor={(packId) => setEditingNotePackId(packId)}
            getNoteEditors={getNoteEditorsForPack}
            premium={premium}
            ddayCountTodayAsDayOne={bag.ddayCountTodayAsDayOne}
            memberProfiles={bag.memberProfiles}
            isShared={isSharedBag}
            onClickAssignee={(packId, itemId) => {
              const pack = bag.packs.find((p) => p.id === packId);
              const item = pack?.items.find((i) => i.id === itemId);
              if (item) setAssigneeTargetItem({ packId, item });
            }}
            /*
            getItemReactionDoc={getItemReactionDoc}
            currentUid={currentUid}
            onToggleItemReaction={handleToggleItemReaction}
            onOpenReactionPicker={(itemId, itemText) =>
              setReactionPickerTarget({ itemId, itemText: itemText || "짐" })
            }
            */
          />
        )}
      </div>

      {/* 짐을 롱프레스로 들어올린 동안, 화면 상단에 모든 팩 이름을 칩으로 띄워둔다.
          화면 밖(스크롤해야 보이는) 팩으로도 스크롤 없이 바로 옮길 수 있게 하기 위함 -
          기존 [data-pack-drop-id] 드롭존 판정 로직(위 handleMove)을 그대로 재사용한다. */}
      {showQuickAddBar && (
        <BagQuickAddBar
          packs={quickAddPacks}
          onAddItem={(packId, data) => handleCreateItem(packId, data)}
          onCreatePack={() => handleAddPack("checklist")}
        />
      )}

      {(drag || groupDrag) && (
        <div
          className="fixed inset-x-0 top-0 px-3"
          style={{
            zIndex: ambientLayer + 4,
            paddingTop: "max(10px, env(safe-area-inset-top))",
            paddingBottom: 12,
            background: "var(--surface)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            maxHeight: "45vh",
            overflowY: "auto",
          }}
        >
          <PackChipBar
            packs={viewablePacks.filter((p) => p.kind !== "editor")}
            label="팩으로 옮기기"
            dropIds
            getState={(packId) => {
              if (drag) {
                return packId === drag.fromPackId
                  ? "source"
                  : packId === drag.overPackId
                  ? "selected"
                  : "normal";
              }
              if (groupDrag) {
                return groupDrag.itemsByPack[packId] && groupDrag.itemsByPack[packId].size > 0
                  ? "source"
                  : packId === groupDrag.overPackId
                  ? "selected"
                  : "normal";
              }
              return "normal";
            }}
          />
        </div>
      )}

      {drag && (
        <div
          className="fixed pointer-events-none rounded-lg px-3 py-2 text-[13px] shadow-lg"
          style={{
            zIndex: ambientLayer + 5,
            left: drag.x,
            top: drag.y,
            transform: "translate(-50%, -120%)",
            background: "var(--accent)",
            color: "#fff",
            maxWidth: 160,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {drag.text || "짐"}
        </div>
      )}

      {groupDrag && (
        <div
          className="fixed pointer-events-none rounded-lg px-3 py-2 text-[13px] font-medium shadow-lg"
          style={{
            zIndex: ambientLayer + 5,
            left: groupDrag.x,
            top: groupDrag.y,
            transform: "translate(-50%, -120%)",
            background: "var(--accent)",
            color: "#fff",
            whiteSpace: "nowrap",
          }}
        >
          {groupDragTotalCount}개 이동 중
        </div>
      )}

      {packDrag && (
        <div
          className="fixed pointer-events-none rounded-lg px-3 py-2 text-[13px] shadow-lg"
          style={{
            zIndex: ambientLayer + 5,
            left: packDrag.x,
            top: packDrag.y,
            transform: "translate(-50%, -120%)",
            background: "var(--accent)",
            color: "#fff",
            maxWidth: 160,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {packDrag.name || "팩"}
        </div>
      )}

      {/* 누른 채로 그대로 손을 떼면(이동 없이) 다중선택 모드가 시작된다.
          하단에 선택 개수 + 취소/삭제 액션바를 띄운다. */}
      {selection && (
        <div
          className="fixed inset-x-0 bottom-0 border-t border-border p-3 flex items-center gap-2"
          style={{
            zIndex: ambientLayer + 3,
            background: "var(--surface)",
            paddingBottom: "max(26px, calc(env(safe-area-inset-bottom) + 14px))",
          }}
        >
          <span className="text-[13px] font-medium mr-auto">
            {totalSelectedCount(selection)}개 선택됨
          </span>
          <button
            onClick={cancelSelection}
            className="rounded-lg px-4 py-2.5 text-[14px]"
            style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
          >
            취소
          </button>
          <button
            onClick={commitDeleteSelected}
            className="rounded-lg px-4 py-2.5 text-[14px] font-medium"
            style={{ background: "var(--danger)", color: "#fff" }}
          >
            삭제
          </button>
        </div>
      )}

      {showImport && (
        <PackImportModal
          libraryPacks={libraryPacks}
          onClose={() => setShowImport(false)}
          onImport={handleImport}
          onCreateNew={() => setShowAddPackKindSheet(true)}
        />
      )}

      {showAddPackKindSheet && (
        <Portal>
          <div
            className="fixed inset-0 flex items-end justify-center sm:items-center"
            style={{ zIndex: ambientLayer + SHEET_OFFSET, background: "rgba(0,0,0,0.45)" }}
            onClick={() => setShowAddPackKindSheet(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-t-2xl sm:rounded-2xl bg-surface p-4 flex flex-col gap-2"
              style={{ paddingBottom: "max(16px, calc(env(safe-area-inset-bottom) + 12px))" }}
            >
              <span className="text-[15px] font-medium mb-1">어떤 팩을 만들까요?</span>
              <button
                onClick={() => {
                  setShowAddPackKindSheet(false);
                  handleAddPack("checklist");
                }}
                className="flex flex-col items-start gap-0.5 rounded-lg px-3 py-2.5 text-left"
                style={{ background: "var(--surface-2)" }}
              >
                <span className="text-[13px] font-medium">체크리스트 팩</span>
                <span className="text-[11px] text-text-muted">체크박스/텍스트 짐을 2열로 넣는 지금까지의 팩</span>
              </button>
              <button
                onClick={() => {
                  setShowAddPackKindSheet(false);
                  handleAddPack("editor");
                }}
                className="flex flex-col items-start gap-0.5 rounded-lg px-3 py-2.5 text-left"
                style={{ background: "var(--surface-2)" }}
              >
                <span className="text-[13px] font-medium">메모 팩</span>
                <span className="text-[11px] text-text-muted">아이폰 메모처럼 자유롭게 쓰는 패(제목/체크박스/표)</span>
              </button>
            </div>
          </div>
        </Portal>
      )}

      {/* 모바일 "다른 가방으로 이동" 시트 - PackCard/EditorPackCard(패뷰)와 NotebookPackSection/
          NotebookEditorPackSection(심플뷰)의 "이동" 버튼/메뉴를 누르면 열린다. 데스크톱은 DesktopSidebar.tsx의
          드래그앤드롭을 따로 쓰므로 이 시트는 보여줄 필요가 없지만, 이 버튼 자체는 데스크톱에서도
          같이 동작한다(단순 모바일 전용 UI로 제한하지 않음). */}
      {moveTargetPackId && (
        <Portal>
          <div
            className="fixed inset-0 flex items-end justify-center sm:items-center"
            style={{ zIndex: ambientLayer + SHEET_OFFSET, background: "rgba(0,0,0,0.45)" }}
            onClick={() => setMoveTargetPackId(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-t-2xl sm:rounded-2xl bg-surface p-4 flex flex-col gap-2"
              style={{
                paddingBottom: "max(16px, calc(env(safe-area-inset-bottom) + 12px))",
                maxHeight: "70vh",
                overflowY: "auto",
              }}
            >
              <span className="text-[15px] font-medium mb-1">어느 가방으로 이동할까요?</span>
              {bags
                .filter((b) => b.id !== bag.id)
                .map((b) => (
                  <button
                    key={b.id}
                    onClick={() => handleMovePackToBag(b.id)}
                    className="flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left"
                    style={{ background: "var(--surface-2)" }}
                  >
                    <span className="text-[13px] font-medium truncate">{b.name}</span>
                    <span className="text-[11px] text-text-muted shrink-0">팩 {b.packs.length}개</span>
                  </button>
                ))}
            </div>
          </div>
        </Portal>
      )}

      <SlideScreen
        active={!!editingNotePackId}
        zIndex={80}
        onBackdropClick={() => setEditingNotePackId(null)}
        desktopTransition="fade"
        innerClassName="flex flex-col h-full md:h-[calc(100%-3.5rem)] w-full mx-auto max-w-3xl md:max-w-5xl md:my-7 md:rounded-2xl md:border md:border-border md:shadow-2xl bg-background pib-safe-top overflow-hidden"
      >
        {(() => {
          const notePack = bag.packs.find((p) => p.id === displayedNotePackId);
          if (!notePack) return null;
          return (
            <PackNoteEditorScreen
              pack={notePack}
              readOnly={readOnly}
              otherEditorNickname={otherNoteEditor?.nickname ?? null}
              onBack={() => setEditingNotePackId(null)}
              onSave={handleSaveNotePack}
              onDeletePack={() => {
                setEditingNotePackId(null);
                handleDeletePack(notePack.id, false);
              }}
              bagId={bag.id}
              premium={premium}
            />
          );
        })()}
      </SlideScreen>

      {showAiFeatureMenu && (
        <AiFeatureMenu
          premium={premium}
          onClose={() => setShowAiFeatureMenu(false)}
          onSelectOrganize={() => {
            if (!premium) {
              setShowAiPremiumModal(true);
              return;
            }
            setShowAiOrganize(true);
          }}
          onSelectRecommend={() => {
            if (!premium) {
              setShowAiPremiumModal(true);
              return;
            }
            runAiRecommend();
          }}
          onSelectClipboard={() => {
            if (!premium) {
              setShowAiPremiumModal(true);
              return;
            }
            setShowAiClipboard(true);
          }}
          onSelectAudit={() => {
            setShowAiAudit(true);
          }}
        />
      )}

      {showAiPremiumModal && (
        <PremiumLimitModal
          message="AI 정리·AI 추천·AI 클립보드는 프리미엄 전용 기능이에요. 이용권 코드를 등록하면 바로 쓸 수 있어요."
          onClose={() => setShowAiPremiumModal(false)}
          onUnlocked={() => {
            setShowAiPremiumModal(false);
            show("이용권 코드가 적용됐어요! 'AI' 버튼을 다시 눌러보세요");
          }}
          email={profile?.email}
          profile={profile ?? null}
        />
      )}

      {showAiOrganize && (
        <AiOrganizeModal
          bag={bag}
          onClose={() => setShowAiOrganize(false)}
          onApply={(newPacks) => {
            if (guardReadOnly()) return;
            setShowAiOrganize(false);
            updatePacks(() => newPacks);
            show("AI가 정리했어요");
          }}
        />
      )}

      {showAiClipboard && (
        <AiClipboardModal
          bag={bag}
          onClose={() => setShowAiClipboard(false)}
          onApply={handleApplyClipboardAdd}
        />
      )}

      {showNotebookQuickAdd && (
        <NotebookQuickAddModal
          packs={viewablePacks.filter((p) => p.kind !== "editor")}
          onClose={() => setShowNotebookQuickAdd(false)}
          onAddToPack={(packId, data) => handleCreateItem(packId, data)}
          onCreatePack={(name, data) => handleQuickAddNewPack(name, data)}
        />
      )}

      {duplicateTarget && (
        <SaveAsDialog
          suggestedName={duplicateTarget.suggestedName}
          libraryPacks={libraryPacks}
          onCancel={() => setDuplicateTarget(null)}
          onConfirm={(name) => {
            commitSaveToLibrary(duplicateTarget.packId, name);
            setDuplicateTarget(null);
          }}
        />
      )}

      {saveConfirmTarget && (
        <ConfirmDialog
          title="팩을 저장하시겠습니까?"
          message="다음에 다시 꺼내 쓸 수 있어요"
          confirmLabel="저장"
          tone="accent"
          onCancel={() => setSaveConfirmTarget(null)}
          onConfirm={() => confirmInitialSave(saveConfirmTarget)}
        />
      )}

      {imageDeleteIndex !== null && (
        <ConfirmDialog
          title="이 사진을 삭제할까요?"
          message="삭제하면 되돌릴 수 없어요."
          onCancel={() => setImageDeleteIndex(null)}
          onConfirm={() => {
            const idx = imageDeleteIndex;
            setImageDeleteIndex(null);
            removeImage(idx);
          }}
        />
      )}

      {refreshConfirmTarget && (
        <ConfirmDialog
          title="팩을 보관함 최신본으로 불러올까요?"
          message="지금 이 팩에 있는 내용은 보관함 버전으로 덮어써지고 사라져요."
          confirmLabel="불러오기"
          tone="accent"
          onCancel={() => setRefreshConfirmTarget(null)}
          onConfirm={() => {
            const packId = refreshConfirmTarget;
            setRefreshConfirmTarget(null);
            handleRefreshFromLibrary(packId);
          }}
        />
      )}

      {itemModal && (
        <ItemEditModal
          packs={viewablePacks.filter((p) => p.kind !== "editor")}
          selectionMode="single"
          initialSelectedPackIds={[itemModal.sourcePackId]}
          mode="edit"
          initialType={itemModal.item.type}
          initialText={itemModal.item.text}
          initialBold={!!itemModal.item.bold}
          initialStrike={!!itemModal.item.strike}
          initialColor={itemModal.item.color || ""}
          initialSpans={itemModal.item.spans}
          initialDueDate={itemModal.item.dueDate}
          initialAssigneeUid={itemModal.item.assigneeUid}
          members={bag.memberIds.map((uid) => ({
            uid,
            nickname: bag.memberProfiles?.[uid]?.nickname,
            avatarId: bag.memberProfiles?.[uid]?.avatarId,
          }))}
          onClose={() => setItemModal(null)}
          onSave={(targetPackIds, data) => {
            const targetPackId = targetPackIds[0];
            handleUpdateItem(itemModal.sourcePackId, itemModal.item.id, targetPackId, data);
            setItemModal(null);
          }}
          thread={{
            bagId: bag.id,
            targetId: itemModal.item.id,
            packId: itemModal.sourcePackId,
            currentUid,
            currentNickname: nickname,
            currentAvatarId: avatarId,
            members: mentionMembers,
            deletedAccountIds: deletedAuthorIds,
          }}
          allComments={comments}
          allReactions={reactions}
        />
      )}

      {updateChoiceTarget && (
        <PackUpdateDialog
          conflict={updateChoiceTarget.conflict}
          onCancel={() => setUpdateChoiceTarget(null)}
          onSaveAsNew={() => handleChooseSaveAsNew(updateChoiceTarget.packId)}
          onOverwrite={() => commitOverwriteToLibrary(updateChoiceTarget.packId)}
        />
      )}

      {(showShareCard || showMembers) && (
        <ShareCardModal
          bag={bag}
          currentUid={currentUid}
          initialTab={showMembers ? "members" : "card"}
          onClose={() => {
            setShowShareCard(false);
            setShowMembers(false);
          }}
          onLeave={handleLeave}
          onRemoveMember={handleRemoveMember}
          onRegenerateCode={handleRegenerateCode}
          onTransferOwnership={handleTransferOwnership}
        />
      )}

      {showPackingMode && (
        <PackingModeModal
          bag={bag}
          currentUid={currentUid}
          onClose={() => setShowPackingMode(false)}
          onToggleItem={handleToggleItem}
        />
      )}

      {showAiAudit && (
        <AiBagAuditModal
          bag={bag}
          user={user}
          onClose={() => setShowAiAudit(false)}
          onAddItemToPack={handleAddItemFromAudit}
          onShowPremiumLimit={(msg) => setShowAiPremiumModal(true)}
        />
      )}

      {assigneeTargetItem && (
        <AssigneeSelectModal
          bag={bag}
          item={assigneeTargetItem.item}
          currentUid={currentUid}
          onSelect={(uid) => {
            handleAssignItem(assigneeTargetItem.packId, assigneeTargetItem.item.id, uid);
            setAssigneeTargetItem(null);
          }}
          onClose={() => setAssigneeTargetItem(null)}
        />
      )}

      {confirmDeleteBag && (
        <ConfirmDialog
          title={isOwner ? "이 가방을 휴지통으로 보낼까요?" : "이 가방에서 나갈까요?"}
          message={
            isOwner
              ? "설정 > 휴지통에서 30일간 보관되며, 그 안에 복구할 수 있어요. 다른 그룹원들은 그대로 볼 수 있어요."
              : "그룹 가방에서 나가면 더 이상 이 가방을 볼 수 없어요. 가방 자체와 다른 그룹원들의 내용은 그대로 유지돼요."
          }
          confirmLabel={isOwner ? "휴지통으로" : "나가기"}
          tone="accent"
          onCancel={() => setConfirmDeleteBag(false)}
          onConfirm={() => {
            setConfirmDeleteBag(false);
            if (isOwner) {
              onDeleteBag(bag);
            } else {
              handleLeave();
            }
          }}
        />
      )}

      {confirmLeaveUnsaved && (
        <ConfirmDialog
          title="저장하지 않은 내용이 있어요"
          message="지금 나가면 만든 내용이 사라져요. 그대로 나가시겠어요?"
          confirmLabel="나가기"
          tone="danger"
          onCancel={() => setConfirmLeaveUnsaved(false)}
          onConfirm={() => {
            setConfirmLeaveUnsaved(false);
            onBack(bag);
          }}
        />
      )}

      {lightboxIndex !== null && (
        <ImageLightbox
          images={bag.images}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}

      {pdfPreviewUrl && (
        <PdfPreviewModal url={pdfPreviewUrl} onClose={() => setPdfPreviewUrl(null)} />
      )}

      {premiumModalMessage && (
        <PremiumLimitModal
          message={premiumModalMessage}
          onClose={() => setPremiumModalMessage(null)}
          onUnlocked={() => {
            setPremiumModalMessage(null);
            show("이용권 코드가 적용됐어요! 다시 시도해주세요");
          }}
          email={profile?.email}
          profile={profile ?? null}
        />
      )}

      {showBagThread && (
        <ItemThreadSheet
          bagId={bag.id}
          targetType="bag"
          targetId={bag.id}
          title="댓글"
          currentUid={currentUid}
          currentNickname={nickname}
          currentAvatarId={avatarId}
          members={mentionMembers}
          deletedAccountIds={deletedAuthorIds}
          onClose={() => setShowBagThread(false)}
          allComments={comments}
          allReactions={reactions}
        />
      )}

      {/*
      {reactionPickerTarget && (
        <ReactionPickerPopover
          title={reactionPickerTarget.itemText}
          reactionDoc={getItemReactionDoc(reactionPickerTarget.itemId)}
          currentUid={currentUid}
          onToggle={(emoji, currentlyReacted) => {
            handleToggleItemReaction(reactionPickerTarget.itemId, emoji, currentlyReacted);
          }}
          onClose={() => setReactionPickerTarget(null)}
        />
      )}
      */}

      {reactionPickerCommentTarget && (
        <ReactionPickerPopover
          title={`${reactionPickerCommentTarget.authorNickname}님의 댓글에 반응`}
          reactionDoc={reactions.find((r) => r.id === `comment_${reactionPickerCommentTarget.commentId}`)}
          currentUid={currentUid}
          onToggle={(emoji, currentlyReacted) => {
            toggleReaction(bag.id, "comment", reactionPickerCommentTarget.commentId, currentUid, emoji, currentlyReacted).catch((err) => {
              console.error("[팩인백] 상단 댓글 리액션 실패:", err);
            });
          }}
          onClose={() => setReactionPickerCommentTarget(null)}
        />
      )}
    </div>
  );
}
