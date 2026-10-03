"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IconArchive, IconCheck, IconChevronDown, IconChevronLeft, IconChevronRight, IconPin, IconPlus, IconSearch } from "@tabler/icons-react";
import type { Bag, BagFolder, Pack } from "@/lib/types";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/components/Toast";
import { isPremiumUser, getViewablePacks } from "@/lib/premiumLimits";
import { searchBags, type BagSearchResult } from "@/lib/librarySearch";
import NotificationBell from "@/components/NotificationBell";
import { JoinBagSheet } from "@/components/v2/sheets/JoinBagSheet";
import NoteImportModal, { type NoteImportResult } from "@/components/NoteImportModal";
import type { BagOpenFocus } from "@/components/screens/HomeScreen";
import {
  Badge,
  Button,
  Chip,
  HeaderScroller,
  IconButton,
  PageStack,
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
import { moveFolderInOrder, saveBagFolderOrder, sortBagFolders } from "@/lib/bagFolderOrder";
import { V2_MAX_PINNED_BAGS } from "@/lib/listSort";

// 구 HomeScreen과 같은 props. AppShell에서 UI_V2 플래그로 바꿔 끼운다.
// (onNewKanbanBag / onOpenQuickPack / onSelectModeChange는 v2에서 쓰지 않는다: 칸반·빠른팩·다중선택 제거)
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
  onNewKanbanBag: () => void;
  onImportNote: (result: NoteImportResult) => void;
  onJoinBag: (code: string) => Promise<void>;
  onOpenQuickPack: () => void;
  onBulkDeleteBags: (bagIds: string[]) => void;
  onSelectModeChange?: (active: boolean) => void;
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
  } = useAuth();
  const { show } = useToast();
  const premium = isOfflineMode || isPremiumUser(profile?.email, profile ?? null);
  const personal = !isOfflineMode;

  // --- 폴더 (1단계) ---------------------------------------------------------------
  const bagFolders = useMemo(() => profile?.bagFolders ?? {}, [profile?.bagFolders]);
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

  // 폴더 칩 순서 바꾸기(폴더 시트 ◀ ▶). 지금 보이는 순서 전체를 저장한다(쓰기 1회)
  const moveFolder = (id: string, delta: -1 | 1) => {
    const next = moveFolderInOrder(
      folders.map((f) => f.id),
      id,
      delta,
    );
    if (!next) return;
    saveBagFolderOrder(uid, next).catch(() => show("폴더 순서를 저장하지 못했어요"));
  };

  // --- 목록 계산 ------------------------------------------------------------------
  const archivedSet = useMemo(() => new Set(profile?.archivedBagIds ?? []), [profile?.archivedBagIds]);
  const pinnedIds = useMemo(() => (profile?.pinnedBagIds ?? []).slice(0, V2_MAX_PINNED_BAGS), [profile?.pinnedBagIds]);
  const summaries = useMemo(() => bags.map((b) => summarizeBag(b, premium)), [bags, premium]);
  const activeAll = summaries.filter((s) => !archivedSet.has(s.bag.id));
  const archived = summaries
    .filter((s) => archivedSet.has(s.bag.id))
    .sort((a, b) => (a.activityAt < b.activityAt ? 1 : -1));
  const active = activeFolderId ? activeAll.filter((s) => assignments[s.bag.id] === activeFolderId) : activeAll;
  // 아래 "가방" 목록 정렬(최근순 / 이름순 / 이름 역순). 계정에 저장(bagSortBy), 캐러셀에는 영향 없음
  const sort = homeSortOf(profile?.bagSortBy);
  const [sortOpen, setSortOpen] = useState(false);
  const sections = buildSections(active, pinnedIds, sort);
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
  const searchable = useMemo(
    () => (premium ? bags : bags.map((b) => ({ ...b, packs: getViewablePacks(b.packs, premium) }))),
    [bags, premium],
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
    moveBagsToFolder([bagId], target).catch(fail("폴더로 옮기지 못했어요"));
  };

  const rowHandlers = (s: BagSummary) => ({
    locked: lockedBagIds?.has(s.bag.id),
    onOpen: () => onOpenBag(s.bag),
    onMenu: () => setActionBagId(s.bag.id),
  });

  const hasAnyBag = bags.length > 0;
  const listEmpty = sections.highlights.length === 0 && sections.pinned.length === 0 && sections.list.length === 0;

  // --- 화면 -------------------------------------------------------------------------------
  // 헤더·본문 여백은 ScreenHeader/ScreenBody가 정한다(팩 탭과 똑같이). 여기서 따로 패딩을 주지 않는다.
  const showChips = !searching && personal && (hasAnyBag || folders.length > 0);

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
              <IconButton label="검색" onClick={() => setSearchOpen(true)}>
                <IconSearch size={22} stroke={1.75} />
              </IconButton>
            )}
            {!isOfflineMode && <NotificationBell uid={uid} v2 />}
            <IconButton label="새 가방" variant="solid" onClick={() => setNewBagOpen(true)}>
              <IconPlus size={20} stroke={2} />
            </IconButton>
          </>
        }
        title="가방"
      >
        {showChips && (
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
        )}
      </ScreenHeader>

      <ScreenBody className="gap-8">
        {isTop && searching ? (
          <SearchResults query={query} results={results} truncated={truncated} onOpen={openResult} />
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
                <p className="m-0 text-body">지난 여행 {suggestions.length}개를 보관함으로 옮길까요?</p>
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
              highlights={sections.highlights}
              lockedIds={lockedBagIds}
              onOpen={(s) => onOpenBag(s.bag)}
              onMenu={(s) => setActionBagId(s.bag.id)}
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
                  <BagRow key={s.bag.id} summary={s} last={i === sections.pinned.length - 1} {...rowHandlers(s)} />
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
                  renderRow={(s, last) => <BagRow key={s.bag.id} summary={s} last={last} {...rowHandlers(s)} />}
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
        <p className="m-0 pt-3 text-caption text-faint">최근순은 출발 7일 안의 가방이 먼저, 나머지는 최근에 체크한 순서예요. 위 카드는 정렬과 상관없이 곧 출발 → 싸는 중 순서, 고정한 가방은 항상 맨 위에 있어요.</p>
      </Sheet>

      {/* 시트 · 모달 */}
      <NewBagSheet
        open={newBagOpen}
        onClose={() => setNewBagOpen(false)}
        offline={isOfflineMode}
        onBlank={onNewBag}
        onFromNote={() => setNoteOpen(true)}
        onJoin={() => setJoinOpen(true)}
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
        onMove={personal ? moveFolder : undefined}
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
      {!isOfflineMode && noteOpen && (
        <NoteImportModal
          onClose={() => setNoteOpen(false)}
          onResult={(result) => {
            setNoteOpen(false);
            onImportNote(result);
          }}
        />
      )}
    </div>
  );
}

function SearchResults({
  query,
  results,
  truncated,
  onOpen,
}: {
  query: string;
  results: BagSearchResult[];
  truncated: boolean;
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
          </span>
          {r.subtitle && <span className="truncate text-caption text-sub">{r.subtitle}</span>}
          {r.snippet && <span className="line-clamp-2 text-caption text-faint">{r.snippet}</span>}
        </button>
      ))}
      {truncated && <p className="m-0 py-3 text-center text-micro text-faint">결과가 많아 30개까지만 보여드려요</p>}
    </section>
  );
}
