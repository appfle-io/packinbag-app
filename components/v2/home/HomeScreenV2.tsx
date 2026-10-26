"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IconArchive, IconCheck, IconChevronDown, IconChevronLeft, IconChevronRight, IconMenu2, IconPin, IconPlus, IconSearch } from "@tabler/icons-react";
import type { Bag, BagFolder, Pack } from "@/lib/types";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/components/Toast";
import { isPremiumUser, getViewablePacks } from "@/lib/premiumLimits";
import { searchBags, type BagSearchResult } from "@/lib/librarySearch";
import NotificationBell from "@/components/NotificationBell";
import { CoachTour } from "@/components/v2/guide/CoachTour";
import { HOME_GUIDE_KEY, HOME_GUIDE_STEPS, canStartTour, hasSeenGuide, markGuideSeen } from "@/lib/v2/guide";
import { JoinBagSheet } from "@/components/v2/sheets/JoinBagSheet";
import { NoteImportSheet } from "@/components/v2/sheets/AiPasteSheets";
import type { ImportedBagResult } from "@/lib/types";

// 검색 결과로 가방을 열 때 스크롤·강조할 대상
type BagOpenFocus = { packId?: string; itemId?: string; searchQuery?: string };
import {
  Badge,
  Button,
  Chip,
  HeaderScroller,
  IconButton,
  PageStack,
  ReorderSheet,
  ScreenBody,
  ScreenHeader,
  SectionHeader,
  Sheet,
  cx,
  useLongPress,
} from "@/components/v2/ui";
import { ConfirmSheet } from "@/components/v2/bag/sheets/ConfirmSheet";
import { BagRow } from "./BagRows";
import { BagCarousel } from "./BagCarousel";
import { BagListPager } from "./BagListPager";
import { BagActionSheet } from "./sheets/BagActionSheet";
import { FolderSheet } from "./sheets/FolderSheet";
import { NewBagSheet } from "./sheets/NewBagSheet";
import {
  archiveSuggestionsOf,
  buildSections,
  HOME_SORT_LABEL,
  homeSortOf,
  summarizeBag,
  type BagSummary,
  type HomeSort,
} from "./homeModel";
import { hasFolderNameClash } from "@/lib/bagFolderNames";
import { saveBagFolderOrder, sortBagFolders, validBagFolders } from "@/lib/bagFolderOrder";
import { V2_MAX_PINNED_BAGS } from "@/lib/listSort";
import { useShellCommands } from "@/lib/v2/shell";
import { useOnlineGuard } from "@/components/v2/shell/useOnlineGuard";
import { getPendingBags } from "@/lib/v2/pendingCreates";
import { usePrivateLock } from "@/components/v2/lock/usePrivateLock";
import SlideScreen from "@/components/SlideScreen";
import { EventDetailScreen } from "@/components/v2/events/EventScreens";
import { useEvents } from "@/lib/eventsService";
import { EVENT_CAROUSEL_MAX, splitEvents, type AppEvent } from "@/lib/events";

// AppShell이 넘기는 props. (onOpenQuickPack / onSelectModeChange는 쓰지 않는다: 빠른팩·다중선택은 다른 곳에서)
export interface HomeScreenProps {
  uid: string;
  bags: Bag[];
  packs?: Pack[];
  initialInviteCode?: string;
  lockedBagIds?: Set<string>;
  quickPack?: Pack;
  currentUid: string;
  onOpenBag: (bag: Bag, focus?: BagOpenFocus) => void;
  onOpenPack?: (pack: Pack, focusItemId?: string, searchQuery?: string) => void;
  onNewBag: () => void;
  onImportNote: (result: ImportedBagResult) => void;
  onJoinBag: (code: string) => Promise<void>;
  onOpenQuickPack: () => void;
  onBulkDeleteBags: (bagIds: string[]) => void;
  onSelectModeChange?: (active: boolean) => void;
  // 이 탭이 지금 화면에 보이는지(좁은 화면은 세 탭이 옆으로 늘어서 늘 그려져 있다). 가방 탭 사용 가이드를 띄울 때만 본다
  guideActive?: boolean;
}

// 마지막으로 본 폴더 칩(이 기기에만 기억). 구 홈의 키와 겹치지 않게 따로 둔다.
const FOLDER_STORAGE_KEY = "packinbag:v2HomeFolder";
// PageStack 화면 키
const HOME_KEY = "home";
const ARCHIVE_KEY = "archive";

const RESULT_LABEL = { bag: "가방", pack: "팩", item: "아이템" } as const;

function FolderChip({ folder, selected, onPick, onEdit }: { folder: BagFolder; selected: boolean; onPick: () => void; onEdit: () => void }) {
  const press = useLongPress(onEdit, onPick);
  return <Chip label={folder.name} selected={selected} {...press} />;
}

// 리디자인 v2 홈(가방 목록). 기준 목업: 팩인백 미니멀 리디자인 캔버스 "홈 · 가방 목록".
// - 폴더 칩(1단계, 길게 눌러 이름·순서·삭제) · 캐러셀 · 고정 · 가방(5개씩 옆으로 넘김) · 보관함
// - 보관함은 PageStack으로 겹쳐 연다: 오른쪽으로 밀면 손가락을 따라 가방 목록으로 돌아온다
// - 가방을 길게 누르면(PC는 우클릭) 폴더 이동·고정·보관·삭제 시트
export default function HomeScreenV2(props: HomeScreenProps) {
  const {
    uid,
    bags,
    initialInviteCode,
    lockedBagIds,
    currentUid,
    onOpenBag,
    onOpenPack,
    onNewBag,
    onImportNote,
    onJoinBag,
    onBulkDeleteBags,
    guideActive = true,
  } = props;

  const {
    profile,
    isOfflineMode,
    toggleBagPinned,
    toggleBagArchived,
    archiveBags,
    dismissArchiveSuggestions,
    createBagFolder,
    renameBagFolder,
    deleteBagFolder,
    moveBagsToFolder,
    flattenBagFolders,
    updateBagSortBy,
    updateBagOrderByParent,
  } = useAuth();
  const { show } = useToast();
  // 가방 참여·메모로 가방 만들기(AI)는 인터넷이 필요하다
  const { guard } = useOnlineGuard();
  const premium = isOfflineMode || isPremiumUser(profile?.email, profile ?? null);
  const personal = !isOfflineMode;
  // 개인 잠금(2026-10-12): 잠근 가방은 목록에서 이름만, 캐러셀에서는 빠지고, 검색은 이름만(잠긴 팩도 이름만)
  const privacy = usePrivateLock();

  // --- 폴더 (1단계) ---------------------------------------------------------------
  const bagFolders = useMemo(() => validBagFolders(profile?.bagFolders), [profile?.bagFolders]);
  const assignments = profile?.bagFolderAssignments ?? {};
  const folders = useMemo(() => sortBagFolders(bagFolders, profile?.bagFolderOrder), [bagFolders, profile?.bagFolderOrder]);

  // 예전 하위 폴더는 처음 한 번 최상위로 올린다(원래 부모는 legacyParentId에 남김).
  // 올리면서(또는 이미 올린 뒤에) 같은 이름 폴더가 생기면 이름도 같이 정리한다(lib/bagFolderNames.ts).
  const flattenedRef = useRef(false);
  useEffect(() => {
    if (flattenedRef.current || isOfflineMode) return;
    if (!Object.values(bagFolders).some((f) => f.parentId) && !hasFolderNameClash(bagFolders)) return;
    flattenedRef.current = true;
    flattenBagFolders().catch((err) => {
      console.error("[팩인백] 가방 폴더 정리 실패:", err);
      flattenedRef.current = false;
    });
  }, [bagFolders, isOfflineMode, flattenBagFolders]);

  const [folderId, setFolderId] = useState<string | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    return window.localStorage.getItem(FOLDER_STORAGE_KEY) || undefined;
  });
  const activeFolderId = folderId && bagFolders[folderId] ? folderId : undefined;
  const pickFolder = (id: string | undefined) => {
    setFolderId(id);
    try {
      if (id) window.localStorage.setItem(FOLDER_STORAGE_KEY, id);
      else window.localStorage.removeItem(FOLDER_STORAGE_KEY);
    } catch {
      // 저장 실패는 무시(다음 실행 때 "전체"로 시작할 뿐)
    }
  };

  // 폴더 칩 순서 바꾸기(폴더 시트 > 폴더 순서 바꾸기 → 끌어서 옮기는 시트). 완료 누르면 전체 순서를 저장(쓰기 1회)
  const [folderReorderOpen, setFolderReorderOpen] = useState(false);
  const saveFolderOrder = (ids: string[]) =>
    saveBagFolderOrder(uid, ids).catch(() => show("폴더 순서를 저장하지 못했어요"));

  // --- 목록 계산 ------------------------------------------------------------------
  const archivedSet = useMemo(() => new Set(profile?.archivedBagIds ?? []), [profile?.archivedBagIds]);
  // 보관한 가방은 고정에서 뺀다(보관하면 고정을 푸는데, 그 전에 남은 것도 칸을 차지하지 않게 - 2026-10-14)
  const pinnedIds = useMemo(
    () => (profile?.pinnedBagIds ?? []).filter((id) => !archivedSet.has(id)).slice(0, V2_MAX_PINNED_BAGS),
    [profile?.pinnedBagIds, archivedSet],
  );
  // 끊긴 동안 만든 가방("올리기 대기" 표시). 대기 목록이 바뀌면 AppShell이 bags를 새로 넘기므로 bags를 기준으로 다시 읽는다
  const summaries = useMemo(() => {
    const pendingIds = isOfflineMode ? new Set<string>() : new Set(getPendingBags(uid).map((b) => b.id));
    return bags.map((b) => summarizeBag(b, premium, pendingIds.has(b.id)));
  }, [bags, premium, uid, isOfflineMode]);
  const activeAll = summaries.filter((s) => !archivedSet.has(s.bag.id));
  const archived = summaries
    .filter((s) => archivedSet.has(s.bag.id))
    .sort((a, b) => (a.activityAt < b.activityAt ? 1 : -1));
  const active = activeFolderId ? activeAll.filter((s) => assignments[s.bag.id] === activeFolderId) : activeAll;
  // 아래 "가방" 목록 정렬(최근순 / 이름순 / 이름 역순). 계정에 저장(bagSortBy), 캐러셀에는 영향 없음
  const sort = homeSortOf(profile?.bagSortBy);
  const [sortOpen, setSortOpen] = useState(false);
  // 직접 정한 순서는 폴더마다 따로(전체 = "root"). 구 UI에서 전체를 드래그했던 bagOrder도 이어받는다
  const orderKey = activeFolderId ?? "root";
  const customOrder = profile?.bagOrderByParent?.[orderKey] ?? (orderKey === "root" ? profile?.bagOrder : undefined);
  const [bagReorderOpen, setBagReorderOpen] = useState(false);
  const sections = buildSections(active, pinnedIds, sort, customOrder);
  const highlights = sections.highlights.filter((h) => !privacy.bagLocked(h.summary.bag.id));
  const suggestions = activeFolderId || !personal ? [] : archiveSuggestionsOf(activeAll, profile?.archiveSuggestionDismissedIds ?? []);

  // --- 보기: 홈 / 보관함 / 검색 ------------------------------------------------------
  const [view, setView] = useState<"home" | "archive">("home");
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searching = view === "home" && searchOpen;
  const closeSearch = () => {
    setSearchOpen(false);
    setQuery("");
  };
  // 넓은 화면 단축키(⌘K 검색 · ⌘N 새 가방). 셸이 이 탭으로 보낸 명령만 받는다
  useShellCommands("home", {
    search: () => {
      setView("home");
      setSearchOpen(true);
    },
    new: () => setNewBagOpen(true),
  });
  const searchable = useMemo(
    () =>
      bags.map((b) => {
        if (privacy.bagHidden(b.id)) return { ...b, packs: [] };
        const packs = (premium ? b.packs : getViewablePacks(b.packs, premium)).map((p) =>
          privacy.packHidden(b.id, p) ? { ...p, items: [], editorDoc: undefined, editorPreviewText: undefined, searchText: undefined } : p,
        );
        return { ...b, packs };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 잠금 설정 · 풀림 상태가 바뀌면 다시
    [bags, premium, privacy.lock, privacy.unlocked],
  );
  const { results, truncated } = useMemo(() => searchBags(searchable, query), [searchable, query]);

  const openResult = (r: BagSearchResult) => {
    const q = query.trim();
    closeSearch();
    const original = r.bag ? bags.find((b) => b.id === r.bag!.id) ?? r.bag : undefined;
    if (original) {
      if (r.type === "bag") onOpenBag(original);
      else onOpenBag(original, { packId: r.packId, itemId: r.itemId, searchQuery: r.isEditorPack ? q : undefined });
      return;
    }
    if (r.pack) onOpenPack?.(r.pack, r.itemId, r.isEditorPack ? q : undefined);
  };

  // --- 시트 ---------------------------------------------------------------------------
  const [newBagOpen, setNewBagOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(!!initialInviteCode);
  const [noteOpen, setNoteOpen] = useState(false);
  const [actionBagId, setActionBagId] = useState<string | null>(null);
  const [folderTarget, setFolderTarget] = useState<"new" | BagFolder | null>(null);
  const [confirmBag, setConfirmBag] = useState<Bag | null>(null);
  const [confirmCached, setConfirmCached] = useState<Bag | null>(null);
  if (confirmBag && confirmBag !== confirmCached) setConfirmCached(confirmBag);
  const confirmShown = confirmBag ?? confirmCached;

  const actionBag = actionBagId ? bags.find((b) => b.id === actionBagId) ?? null : null;
  const fail = (msg: string) => () => show(msg);

  const togglePin = (bagId: string) => {
    const pinned = pinnedIds.includes(bagId);
    if (!pinned && pinnedIds.length >= V2_MAX_PINNED_BAGS) {
      show(`고정은 ${V2_MAX_PINNED_BAGS}개까지 할 수 있어요`);
      return;
    }
    toggleBagPinned(bagId).catch(fail("고정 상태를 저장하지 못했어요"));
  };

  const toggleArchive = (bag: Bag) => {
    const wasArchived = archivedSet.has(bag.id);
    toggleBagArchived(bag.id)
      .then(() =>
        show(wasArchived ? "보관함에서 꺼냈어요" : "보관함으로 옮겼어요", {
          actionLabel: "되돌리기",
          onAction: () => toggleBagArchived(bag.id).catch(() => {}),
        }),
      )
      .catch(fail("보관 상태를 저장하지 못했어요"));
  };

  const moveToFolder = (bagId: string, target: string | undefined) => {
    if ((assignments[bagId] ?? undefined) === target) return;
    moveBagsToFolder([bagId], target)
      .then(() => show(target ? `'${bagFolders[target]?.name ?? "폴더"}'(으)로 옮겼어요` : "폴더에서 뺐어요"))
      .catch(fail("폴더로 옮기지 못했어요"));
  };

  const rowHandlers = (s: BagSummary) => ({
    locked: lockedBagIds?.has(s.bag.id),
    privateLocked: privacy.bagLocked(s.bag.id),
    onOpen: () => onOpenBag(s.bag),
    onMenu: () => setActionBagId(s.bag.id),
  });

  const hasAnyBag = bags.length > 0;
  const listEmpty = highlights.length === 0 && sections.pinned.length === 0 && sections.list.length === 0;

  // 이벤트(2026-10-19, EVT-HOME): 게시 기간 안의 것만 캐러셀 뒤에. "전체"에서만(폴더를 고르면 그 폴더 가방만). 오프라인 모드 · 체험은 읽지 않음
  const allEvents = useEvents(!isOfflineMode);
  const carouselEvents = activeFolderId ? [] : splitEvents(allEvents).active.slice(0, EVENT_CAROUSEL_MAX);
  const [openEvent, setOpenEvent] = useState<AppEvent | null>(null);
  const [shownEvent, setShownEvent] = useState<AppEvent | null>(null);
  if (openEvent && openEvent !== shownEvent) setShownEvent(openEvent);

  // --- 화면 -------------------------------------------------------------------------------
  // 헤더·본문 여백은 ScreenHeader/ScreenBody가 정한다(팩 탭과 똑같이). 여기서 따로 패딩을 주지 않는다.
  const showChips = !searching && personal && (hasAnyBag || folders.length > 0);

  // --- 사용 가이드(가방 탭, 2026-10-25) ------------------------------------------------------
  // 이 기기에서 처음 가방 탭을 볼 때 한 번. 가방이 없으면(빈 화면 안내가 있음) · 보관함 · 검색 중 · 탭이 안 보이면 기다린다.
  // 다른 투어나 시트가 떠 있으면 이번엔 건너뛴다(본 것으로 치지 않음). 설정 > 사용 가이드 다시 보기로 다시
  const [tourOpen, setTourOpen] = useState(false);
  const tourReady = guideActive && hasAnyBag && view === "home" && !searchOpen;
  useEffect(() => {
    if (!tourReady || hasSeenGuide(HOME_GUIDE_KEY)) return;
    const t = window.setTimeout(() => {
      if (canStartTour()) setTourOpen(true);
    }, 900);
    return () => window.clearTimeout(t);
  }, [tourReady]);
  const closeTour = () => {
    setTourOpen(false);
    markGuideSeen(HOME_GUIDE_KEY);
  };

  const renderArchive = () => (
    <>
      <ScreenHeader
        leading={
          <IconButton label="가방 목록으로" onClick={() => setView("home")}>
            <IconChevronLeft size={22} stroke={1.9} />
          </IconButton>
        }
        title="보관함"
      />
      <ScreenBody className="gap-8">
        {archived.length === 0 ? (
          <p className="m-0 py-16 text-center text-body text-sub">보관한 가방이 없어요</p>
        ) : (
          <section className="flex flex-col">
            <p className="m-0 pb-2 text-caption text-faint">다녀온 가방은 여기 모여 있어요. 길게 누르면 다시 꺼낼 수 있어요.</p>
            {archived.map((s, i) => (
              <BagRow key={s.bag.id} summary={s} archived last={i === archived.length - 1} {...rowHandlers(s)} />
            ))}
          </section>
        )}
      </ScreenBody>
    </>
  );

  const renderHome = (isTop: boolean) => (
    <>
      <ScreenHeader
        search={
          isTop ? { open: searchOpen, value: query, onChange: setQuery, onClose: closeSearch, placeholder: "가방, 팩, 아이템 검색" } : undefined
        }
        actions={
          <>
            {hasAnyBag && (
              <IconButton label="검색" data-guide="home-search" onClick={() => setSearchOpen(true)}>
                <IconSearch size={22} stroke={1.75} />
              </IconButton>
            )}
            {!isOfflineMode && <NotificationBell uid={uid} v2 />}
            <IconButton label="새 가방" variant="solid" data-guide="home-new" onClick={() => setNewBagOpen(true)}>
              <IconPlus size={20} stroke={2} />
            </IconButton>
          </>
        }
        title="가방"
      >
        {showChips && (
          <div data-guide="home-folders">
          <HeaderScroller label="가방 폴더">
            <Chip label="전체" selected={!activeFolderId} onClick={() => pickFolder(undefined)} />
            {folders.map((f) => (
              <FolderChip
                key={f.id}
                folder={f}
                selected={activeFolderId === f.id}
                onPick={() => pickFolder(activeFolderId === f.id ? undefined : f.id)}
                onEdit={() => setFolderTarget(f)}
              />
            ))}
            <button
              type="button"
              aria-label="폴더 추가"
              title="폴더 추가"
              onClick={() => setFolderTarget("new")}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-dashed border-line-strong text-sub active:bg-fill"
            >
              <IconPlus size={16} stroke={2} />
            </button>
          </HeaderScroller>
          </div>
        )}
      </ScreenHeader>

      <ScreenBody className="gap-8">
        {isTop && searching ? (
          <SearchResults query={query} results={results} truncated={truncated} archivedIds={archivedSet} onOpen={openResult} />
        ) : !hasAnyBag ? (
          <div className="flex flex-col items-center gap-3 py-24 text-center">
            <p className="m-0 text-body-lg font-semibold">첫 가방을 만들어 볼까요?</p>
            <p className="m-0 text-caption text-sub">여행, 어린이집, 출장처럼 챙길 일마다 가방 하나씩.</p>
            <Button className="mt-2" onClick={() => setNewBagOpen(true)} leading={<IconPlus size={18} stroke={2} />}>
              새 가방 만들기
            </Button>
          </div>
        ) : (
          <>
            {suggestions.length > 0 && (
              <div className="flex flex-col gap-3 rounded-card bg-fill p-4">
                <p className="m-0 text-body">D-Day가 지난 가방 {suggestions.length}개를 보관함으로 옮길까요?</p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => archiveBags(suggestions.map((b) => b.id)).catch(fail("보관하지 못했어요"))}>
                    보관하기
                  </Button>
                  <button
                    type="button"
                    onClick={() => dismissArchiveSuggestions(suggestions.map((b) => b.id)).catch(() => {})}
                    className="h-11 bg-transparent px-4 text-body font-semibold text-sub active:opacity-60"
                  >
                    괜찮아요
                  </button>
                </div>
              </div>
            )}

            <BagCarousel
              highlights={highlights}
              lockedIds={lockedBagIds}
              events={carouselEvents}
              onOpen={(s) => onOpenBag(s.bag)}
              onMenu={(s) => setActionBagId(s.bag.id)}
              onOpenEvent={setOpenEvent}
            />

            {sections.pinned.length > 0 && (
              <section className="flex flex-col">
                <SectionHeader>
                  <span className="inline-flex items-center gap-1">
                    <IconPin size={14} stroke={2} aria-hidden="true" />
                    고정
                  </span>
                </SectionHeader>
                {sections.pinned.map((s, i) => (
                  <BagRow key={s.bag.id} summary={s} last={i === sections.pinned.length - 1} guide={i === 0 ? "home-row" : undefined} {...rowHandlers(s)} />
                ))}
              </section>
            )}

            {sections.list.length > 0 && (
              <section className="flex flex-col">
                <SectionHeader
                  action={
                    // 정렬은 계정에 저장하는 개인 설정이라 오프라인에서는 숨긴다(폴더·고정과 같은 규칙)
                    personal ? (
                      <button
                        type="button"
                        onClick={() => setSortOpen(true)}
                        aria-label={`정렬: ${HOME_SORT_LABEL[sort]}`}
                        className="-my-2 -mr-2 inline-flex h-11 items-center gap-1 bg-transparent px-2 text-caption font-semibold text-sub active:opacity-60"
                      >
                        {HOME_SORT_LABEL[sort]}
                        <IconChevronDown size={14} stroke={2} aria-hidden="true" />
                      </button>
                    ) : undefined
                  }
                >
                  가방 {sections.list.length}
                </SectionHeader>
                {/* 폴더·정렬이 바뀌면 첫 장부터 다시 */}
                <BagListPager
                  key={`${activeFolderId ?? "all"}:${sort}`}
                  items={sections.list}
                  renderRow={(s, last) => (
                    <BagRow
                      key={s.bag.id}
                      summary={s}
                      last={last}
                      guide={sections.pinned.length === 0 && s.bag.id === sections.list[0]?.bag.id ? "home-row" : undefined}
                      {...rowHandlers(s)}
                    />
                  )}
                />
              </section>
            )}

            {listEmpty && (
              <div className="flex flex-col items-center gap-2 py-16 text-center">
                <p className="m-0 text-body text-sub">{activeFolderId ? "이 폴더는 비어 있어요" : "진행 중인 가방이 없어요"}</p>
                <p className="m-0 text-caption text-faint">
                  {activeFolderId ? "가방을 길게 누르면 폴더로 옮길 수 있어요." : "보관함에서 꺼내거나 새로 만들어 보세요."}
                </p>
              </div>
            )}

            {!activeFolderId && archived.length > 0 && (
              <button
                type="button"
                onClick={() => setView("archive")}
                data-guide="home-archive"
                className="flex min-h-13 w-full items-center justify-between bg-transparent text-left active:bg-fill"
              >
                <span className="flex items-center gap-3 text-body font-semibold">
                  <IconArchive size={20} stroke={1.75} className="text-sub" aria-hidden="true" />
                  보관함
                </span>
                <span className="flex items-center gap-2 text-caption text-faint">
                  {archived.length}
                  <IconChevronRight size={16} stroke={1.75} aria-hidden="true" />
                </span>
              </button>
            )}

            {!listEmpty && personal && <p className="m-0 text-center text-micro text-faint">가방을 길게 누르면 고정 · 폴더 · 보관</p>}
          </>
        )}
      </ScreenBody>
    </>
  );

  return (
    <div className="pib-v2 relative flex h-full min-h-0 w-full flex-1 flex-col bg-canvas">
      <PageStack
        stack={view === "archive" ? [HOME_KEY, ARCHIVE_KEY] : [HOME_KEY]}
        renderPage={(key, isTop) => (key === ARCHIVE_KEY ? renderArchive() : renderHome(isTop))}
        onBack={() => setView("home")}
        swipeEnabled={!searching}
      />

      <CoachTour open={tourOpen} steps={HOME_GUIDE_STEPS} onClose={closeTour} />

      {/* 홈 캐러셀에서 연 이벤트(EVT-HOME) */}
      <SlideScreen active={!!openEvent} onBackdropClick={() => setOpenEvent(null)} swipeBack>
        {shownEvent && <EventDetailScreen event={shownEvent} onBack={() => setOpenEvent(null)} />}
      </SlideScreen>

      {/* 가방 목록 정렬 */}
      <Sheet open={sortOpen} onClose={() => setSortOpen(false)} title="정렬">
        <div className="flex flex-col">
          {(Object.keys(HOME_SORT_LABEL) as HomeSort[]).map((key, i, arr) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setSortOpen(false);
                if (key !== sort) updateBagSortBy(key === "recent" ? "updatedAt" : key).catch(fail("정렬을 저장하지 못했어요"));
              }}
              className={cx(
                "flex min-h-13 items-center justify-between gap-3 bg-transparent text-left text-body active:bg-fill",
                i < arr.length - 1 && "border-b border-line",
              )}
            >
              <span className={key === sort ? "font-semibold text-ink" : "text-ink"}>{HOME_SORT_LABEL[key]}</span>
              {key === sort && <IconCheck size={18} stroke={2.2} className="text-brand" aria-label="선택됨" />}
            </button>
          ))}
        </div>
        <p className="m-0 pt-3 text-caption text-faint">최근순은 D-Day 7일 안의 가방이 먼저, 나머지는 최근에 체크한 순서예요. 위 카드는 정렬과 상관없이 곧 출발 → 싸는 중 순서, 고정한 가방은 항상 맨 위에 있어요.</p>
        {personal && sections.list.length > 1 && (
          <Button
            variant="secondary"
            block
            className="mt-4"
            leading={<IconMenu2 size={18} stroke={1.9} />}
            onClick={() => {
              setSortOpen(false);
              setBagReorderOpen(true);
            }}
          >
            {activeFolderId ? `'${bagFolders[activeFolderId]?.name ?? "폴더"}' 가방 순서 바꾸기` : "가방 순서 바꾸기"}
          </Button>
        )}
      </Sheet>

      {/* 끌어서 순서 바꾸기: 가방(지금 폴더 안, 고정 제외) · 폴더 칩 */}
      <ReorderSheet
        open={bagReorderOpen}
        title="가방 순서"
        hint={`오른쪽 ≡를 끌어서 옮겨요. 완료하면 정렬이 '직접 정한 순서'로 바뀌어요.${sections.pinned.length > 0 ? " 고정한 가방은 항상 위라 여기서 빠져요." : ""}`}
        groups={[{ key: "bags", items: sections.list.map((s) => ({ id: s.bag.id, label: s.bag.name || "이름 없는 가방", sub: s.status })) }]}
        onClose={() => setBagReorderOpen(false)}
        onSave={(orders) => updateBagOrderByParent(orderKey, orders.bags ?? []).catch(fail("가방 순서를 저장하지 못했어요"))}
      />
      <ReorderSheet
        open={folderReorderOpen}
        title="폴더 순서"
        hint="오른쪽 ≡를 끌어서 옮겨요. 위쪽 칩 순서가 이대로 바뀌어요."
        groups={[{ key: "folders", items: folders.map((f) => ({ id: f.id, label: f.name })) }]}
        onClose={() => setFolderReorderOpen(false)}
        onSave={(orders) => saveFolderOrder(orders.folders ?? [])}
      />

      {/* 시트 · 모달 */}
      <NewBagSheet
        open={newBagOpen}
        onClose={() => setNewBagOpen(false)}
        offline={isOfflineMode}
        onBlank={onNewBag}
        onFromNote={() => guard(() => setNoteOpen(true))}
        onJoin={() => guard(() => setJoinOpen(true))}
      />
      <BagActionSheet
        bag={actionBag}
        onClose={() => setActionBagId(null)}
        isOwner={!!actionBag && actionBag.ownerId === currentUid}
        pinned={!!actionBag && pinnedIds.includes(actionBag.id)}
        archived={!!actionBag && archivedSet.has(actionBag.id)}
        folders={folders}
        folderId={actionBag ? assignments[actionBag.id] : undefined}
        personal={personal}
        onTogglePin={() => actionBag && togglePin(actionBag.id)}
        onMoveToFolder={(target) => actionBag && moveToFolder(actionBag.id, target)}
        onToggleArchive={() => actionBag && toggleArchive(actionBag)}
        onDeleteOrLeave={() => actionBag && setConfirmBag(actionBag)}
      />
      <FolderSheet
        target={folderTarget}
        folders={folders}
        onClose={() => setFolderTarget(null)}
        onCreate={(name) =>
          createBagFolder(name)
            .then((id) => id && pickFolder(id))
            .catch(fail("폴더를 만들지 못했어요"))
        }
        onRename={(id, name) => renameBagFolder(id, name).catch(fail("이름을 바꾸지 못했어요"))}
        onDelete={(id) => {
          if (activeFolderId === id) pickFolder(undefined);
          deleteBagFolder(id).catch(fail("폴더를 삭제하지 못했어요"));
        }}
        onReorder={
          personal
            ? () => {
                setFolderTarget(null);
                setFolderReorderOpen(true);
              }
            : undefined
        }
      />
      <ConfirmSheet
        open={!!confirmBag}
        onClose={() => setConfirmBag(null)}
        title={confirmShown && confirmShown.ownerId !== currentUid ? "이 가방에서 나갈까요?" : "이 가방을 삭제할까요?"}
        message={
          confirmShown && confirmShown.ownerId !== currentUid
            ? "다시 참여하려면 초대 코드가 필요해요. 가방과 다른 멤버의 내용은 그대로 남아요."
            : confirmShown && confirmShown.memberIds.length > 1
              ? "함께 쓰는 멤버에게서도 사라져요. 휴지통에서 30일 안에 되살릴 수 있어요."
              : "휴지통에서 30일 안에 되살릴 수 있어요."
        }
        confirmLabel={confirmShown && confirmShown.ownerId !== currentUid ? "나가기" : "삭제"}
        danger
        onConfirm={() => confirmBag && onBulkDeleteBags([confirmBag.id])}
      />

      <JoinBagSheet
        open={!isOfflineMode && joinOpen}
        initialCode={initialInviteCode}
        onClose={() => setJoinOpen(false)}
        onConfirm={async (code) => {
          await onJoinBag(code);
          setJoinOpen(false);
        }}
      />
      <NoteImportSheet
        open={!isOfflineMode && noteOpen}
        onClose={() => setNoteOpen(false)}
        onResult={(result) => {
          setNoteOpen(false);
          onImportNote(result);
        }}
      />
    </div>
  );
}

function SearchResults({
  query,
  results,
  truncated,
  archivedIds,
  onOpen,
}: {
  query: string;
  results: BagSearchResult[];
  truncated: boolean;
  // 보관한 가방(결과에 "보관함" 표시, 2026-10-14)
  archivedIds: Set<string>;
  onOpen: (r: BagSearchResult) => void;
}) {
  if (!query.trim()) return <p className="m-0 py-16 text-center text-caption text-faint">가방 이름, 팩 이름, 아이템을 찾아요</p>;
  if (results.length === 0) return <p className="m-0 py-16 text-center text-body text-sub">찾는 결과가 없어요</p>;
  return (
    <section className="flex flex-col">
      {results.map((r, i) => (
        <button
          key={r.id}
          type="button"
          onClick={() => onOpen(r)}
          className={cx(
            "flex min-h-13 w-full flex-col gap-1 bg-transparent py-3 text-left active:bg-fill",
            i < results.length - 1 && "border-b border-line",
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <Badge tone={r.type === "bag" ? "brand" : "neutral"}>{r.type === "pack" && r.isEditorPack ? "메모" : RESULT_LABEL[r.type]}</Badge>
            <span className="truncate text-body font-semibold text-ink">{r.label}</span>
            {r.bag && archivedIds.has(r.bag.id) && <Badge className="shrink-0">보관함</Badge>}
          </span>
          {r.subtitle && <span className="truncate text-caption text-sub">{r.subtitle}</span>}
          {r.snippet && <span className="line-clamp-2 text-caption text-faint">{r.snippet}</span>}
        </button>
      ))}
      {truncated && <p className="m-0 py-3 text-center text-micro text-faint">결과가 많아 30개까지만 보여드려요</p>}
    </section>
  );
}
