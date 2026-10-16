"use client";

import { useMemo, useState } from "react";
import {
  IconBolt,
  IconCheck,
  IconChecklist,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconEye,
  IconFolder,
  IconFolderPlus,
  IconLock,
  IconMenu2,
  IconNotes,
  IconPin,
  IconPlus,
  IconSearch,
} from "@tabler/icons-react";
import type { Bag, Pack } from "@/lib/types";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/components/Toast";
import { searchLibraryPacks, type PackSearchResult } from "@/lib/librarySearch";
import { collectDescendantPackIds } from "@/lib/packsService";
import { findLinkedBagPackRefs } from "@/lib/packSync";
import { PackShareSheet, type PackShareTarget } from "@/components/v2/sheets/PackShareSheet";
import { Badge, Button, IconButton, PageStack, ReorderSheet, ScreenBody, ScreenHeader, SectionHeader, Sheet, Toggle, cx, useLongPress, type ReorderGroup } from "@/components/v2/ui";
import { AddSheet } from "./sheets/AddSheet";
import { EntrySheet } from "./sheets/EntrySheet";
import { MoveSheet } from "./sheets/MoveSheet";
import { NameSheet, type NameRequest } from "./sheets/NameSheet";
import { PACK_SORT_LABEL, entriesIn, metaOf, moveTargets, packSortOf, packSortOption, pathLabel, pathTo, type PackSort } from "./packsModel";
import { normalizeFolderName } from "@/lib/bagFolderNames";
import { useShellCommands } from "@/lib/v2/shell";
import { useOpenDetail } from "@/lib/v2/openDetail";
import { getPendingPacks } from "@/lib/v2/pendingCreates";
import { useLockGuard } from "@/components/v2/lock/LockUI";

// AppShell이 넘기는 props.
// (onBack / onSelectModeChange는 v2에서 쓰지 않는다: 탭 화면이라 뒤로가기 없음, 다중선택 제거)
export interface PacksScreenProps {
  uid: string;
  packs: Pack[];
  bags: Bag[];
  quickPack?: Pack;
  // 무료 한도를 넘어 읽기 전용인 팩(AppShell computeLockedPackIds). 목록에 눈 아이콘으로 표시(2026-10-14)
  lockedPackIds?: Set<string>;
  onOpenPack: (pack: Pack, focusItemId?: string, searchQuery?: string) => void;
  onOpenBag: (bag: Bag, focus?: { packId?: string; itemId?: string; searchQuery?: string }) => void;
  onNewPack: (parentId?: string, kind?: "checklist" | "editor") => void;
  onNewFolder: (parentId?: string, name?: string) => void;
  onRenameEntry: (pack: Pack, name: string) => void;
  onMoveEntries: (packIds: string[], parentId: string | undefined) => void;
  onBack?: () => void;
  onBulkDeletePacks: (packIds: string[], alsoDeleteFromBags?: boolean) => void;
  onSelectModeChange?: (active: boolean) => void;
}

// 마지막으로 보던 폴더(이 기기에만 기억)
const FOLDER_STORAGE_KEY = "packinbag:v2PacksFolder";
// PageStack에서 맨 위(폴더 밖) 화면의 키
const ROOT_KEY = "__root__";

const RESULT_LABEL = { bag: "가방", pack: "팩", item: "아이템" } as const;

function EntryIcon({ entry }: { entry: Pack }) {
  if (entry.type === "folder") return <IconFolder size={24} stroke={1.6} className="shrink-0 text-brand" aria-hidden="true" />;
  if (entry.kind === "editor") return <IconNotes size={22} stroke={1.6} className="shrink-0 text-sub" aria-hidden="true" />;
  return <IconChecklist size={22} stroke={1.6} className="shrink-0 text-sub" aria-hidden="true" />;
}

function EntryRow({
  entry,
  meta,
  pinned,
  pending,
  privateLocked,
  readOnly,
  last,
  onOpen,
  onMenu,
}: {
  entry: Pack;
  meta: string;
  pinned: boolean;
  pending?: boolean;
  // 개인 잠금으로 잠근 팩(내용 요약 대신 "잠긴 팩")
  privateLocked?: boolean;
  // 무료 한도를 넘어 읽기 전용(가방 목록과 같은 눈 아이콘)
  readOnly?: boolean;
  last: boolean;
  onOpen: () => void;
  onMenu: () => void;
}) {
  const press = useLongPress(onMenu, onOpen);
  const isFolder = entry.type === "folder";
  // 넓은 화면에서 상세 칸에 열려 있는 팩은 줄 바탕을 칠해 표시한다(가방 목록과 같은 모양)
  const detail = useOpenDetail();
  const open = !isFolder && detail.packId === entry.id;
  return (
    <button
      type="button"
      {...press}
      aria-current={open ? "true" : undefined}
      className={cx(
        "flex min-h-15 select-none items-center gap-3 py-2 text-left",
        "transition-colors duration-160 ease-snappy active:bg-fill",
        open ? "-mx-2 rounded-field bg-fill px-2" : "w-full bg-transparent",
        !last && !open && "border-b border-line",
      )}
    >
      <span className="flex size-6 shrink-0 items-center justify-center">
        <EntryIcon entry={entry} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex min-w-0 items-center gap-1">
          <span className="truncate text-body font-semibold text-ink">{entry.name || (isFolder ? "이름 없는 폴더" : "이름 없는 팩")}</span>
          {pinned && <IconPin size={14} stroke={2} className="shrink-0 text-faint" aria-label="고정됨" />}
          {privateLocked && <IconLock size={14} stroke={2} className="shrink-0 text-faint" aria-label="잠금" />}
          {readOnly && <IconEye size={14} stroke={1.9} className="shrink-0 text-faint" aria-label="읽기 전용 팩" />}
          {pending && <Badge>올리기 대기</Badge>}
        </span>
        <span className="truncate text-caption text-sub">{privateLocked ? (entry.kind === "editor" ? "잠긴 메모" : "잠긴 팩") : meta}</span>
      </span>
      {isFolder && <IconChevronRight size={16} stroke={1.75} className="shrink-0 text-faint" aria-hidden="true" />}
    </button>
  );
}

// 리디자인 v2 팩 탭(팩 보관함). 기준 목업: 팩인백 미니멀 리디자인 캔버스 "팩 보관함 · 폴더".
// - 폴더는 한 단계씩 들어가는 방식(드릴다운) + 위쪽 경로. 폴더 → 팩·메모 순
// - 폴더 화면은 PageStack으로 겹쳐 쌓는다: 들어가면 오른쪽에서 밀려 들어오고, 오른쪽으로 밀면 손가락을 따라 상위 폴더로
// - 검색은 모든 폴더 대상, 결과에 폴더 경로 표시
// - 길게 누르기(PC 우클릭)로 이름 바꾸기 · 고정 · 옮기기 · 폴더 공유 · 삭제
// - 빠른팩은 맨 위 화면 하단에 고정(엄지로 누르기 쉬운 자리)
export default function PacksScreenV2(props: PacksScreenProps) {
  const { packs, bags, quickPack, lockedPackIds, onOpenPack, onNewPack, onNewFolder, onRenameEntry, onMoveEntries, onBulkDeletePacks } = props;
  const { profile, isOfflineMode, togglePackPinned, updatePackOrderByParent, updatePackSortBy } = useAuth();
  const { show } = useToast();
  // 개인 잠금(2026-10-12): 잠근 팩은 "잠긴 팩"으로 보이고, 검색에서는 이름만 찾힌다. 여는 화면이 PIN을 묻는다(PackEditorV2 · 메모 편집기)
  const privacy = useLockGuard();
  // 빠른팩은 트리에 넣지 않는다(하단 한 줄로 따로)
  const treePacks = useMemo(() => packs.filter((p) => !p.isQuickPack), [packs]);
  const pinnedIds = useMemo(() => profile?.pinnedPackIds ?? [], [profile?.pinnedPackIds]);
  const pinnedSet = useMemo(() => new Set(pinnedIds), [pinnedIds]);
  // 정렬(가방 홈과 같은 4가지, 2026-10-14). 폴더는 항상 팩보다 위, 고정은 그 안에서 맨 위
  const sort = packSortOf(profile?.packSortBy);
  const sortOpt = packSortOption(sort);
  const [sortOpen, setSortOpen] = useState(false);
  // 끊긴 동안 만든 팩("올리기 대기" 표시). 대기 목록이 바뀌면 AppShell이 packs를 새로 넘긴다
  const pendingIds = useMemo(
    () => (isOfflineMode ? new Set<string>() : new Set(getPendingPacks(props.uid).map((p) => p.id))),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- packs가 바뀔 때 다시 읽는다(대기 목록은 localStorage)
    [packs, props.uid, isOfflineMode],
  );

  // --- 지금 보는 폴더 · 검색어 ------------------------------------------------------------
  const [query, setQuery] = useState("");
  const [folderId, setFolderId] = useState<string | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    return window.localStorage.getItem(FOLDER_STORAGE_KEY) || undefined;
  });
  // 다른 기기에서 지워졌거나 폴더가 아니면 맨 위로
  const current = folderId ? treePacks.find((p) => p.id === folderId && p.type === "folder") : undefined;
  const currentId = current?.id;
  const goTo = (id: string | undefined) => {
    setFolderId(id);
    setQuery("");
    try {
      if (id) window.localStorage.setItem(FOLDER_STORAGE_KEY, id);
      else window.localStorage.removeItem(FOLDER_STORAGE_KEY);
    } catch {
      // 저장 실패는 무시
    }
  };

  const chain = pathTo(treePacks, currentId);
  // 화면 묶음: 맨 위(폴더 밖) → 상위 폴더들 → 지금 폴더
  const stack = [ROOT_KEY, ...chain.map((f) => f.id)];
  // 만들기·옮기기 안내에 쓰는 위치 이름. 맨 위는 "맨 위"
  const placeName = (id: string | undefined) => (id ? pathLabel(treePacks, id) : "맨 위");
  const where = placeName(currentId);

  // --- 검색 ------------------------------------------------------------------------
  const searchable = useMemo(() => {
    const real = treePacks
      .filter((p) => p.type !== "folder")
      .map((p) => (privacy.libraryHidden(p.id) ? { ...p, items: [], editorDoc: undefined, editorPreviewText: undefined } : p));
    return quickPack ? [...real, quickPack] : real;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 잠금 설정 · 풀림 상태가 바뀌면 다시
  }, [treePacks, quickPack, privacy.lock, privacy.unlocked]);
  const { results, truncated } = useMemo(() => searchLibraryPacks(searchable, query), [searchable, query]);
  const [searchOpen, setSearchOpen] = useState(false);
  const searching = searchOpen;
  const closeSearch = () => {
    setSearchOpen(false);
    setQuery("");
  };
  // 넓은 화면 단축키(⌘K 검색 · ⌘N 새로 만들기)
  useShellCommands("packs", {
    search: () => setSearchOpen(true),
    new: () => setAddOpen(true),
  });

  const resultSubtitle = (r: PackSearchResult) => {
    if (!r.pack) return r.subtitle;
    const place = r.pack.isQuickPack ? "빠른팩" : pathLabel(treePacks, r.pack.parentId);
    return r.type === "item" ? `${place} › ${r.pack.name}` : place;
  };
  const openResult = (r: PackSearchResult) => {
    const q = query.trim();
    closeSearch();
    if (r.pack) onOpenPack(r.pack, r.itemId, r.isEditorPack ? q : undefined);
  };

  // --- 시트 ---------------------------------------------------------------------------
  const [addOpen, setAddOpen] = useState(false);
  const [nameReq, setNameReq] = useState<NameRequest | null>(null);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [moveId, setMoveId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [shareId, setShareId] = useState<string | null>(null);

  const find = (id: string | null) => (id ? treePacks.find((p) => p.id === id) ?? null : null);
  const entryTarget = find(entryId);
  const moveTarget = find(moveId);
  const shareTarget = find(shareId);
  // 공유 시트 대상(폴더면 안의 팩들까지). 시트가 참조로 비교하므로 메모한다
  const shareSheetTarget = useMemo<PackShareTarget | null>(() => {
    if (!shareTarget) return null;
    if (shareTarget.type !== "folder") return { pack: shareTarget };
    const ids = new Set(collectDescendantPackIds(treePacks, shareTarget.id));
    return { folder: shareTarget, folderPacks: treePacks.filter((p) => ids.has(p.id) && p.type !== "folder") };
  }, [shareTarget, treePacks]);

  // 삭제 확인 문구는 닫히는 동안에도 유지. 가방 속 사본도 같이 지울지는 팩 화면 휴지통과 같게 고른다(2026-10-14)
  const [deleteCached, setDeleteCached] = useState<Pack | null>(null);
  const [alsoDeleteFromBags, setAlsoDeleteFromBags] = useState(false);
  const deleteTarget = find(deleteId);
  if (deleteTarget && deleteTarget !== deleteCached) setDeleteCached(deleteTarget);
  const deleteShown = deleteTarget ?? deleteCached;

  const descendantsOf = (id: string) => collectDescendantPackIds(treePacks, id);
  const targets = moveTarget ? moveTargets(treePacks, new Set([moveTarget.id]), descendantsOf) : [];

  const deleteLinked = (() => {
    if (!deleteShown) return 0;
    const ids = new Set([deleteShown.id, ...descendantsOf(deleteShown.id)]);
    return findLinkedBagPackRefs(bags, ids).length;
  })();
  const deleteMessage = (() => {
    if (!deleteShown) return "";
    const base =
      deleteShown.type === "folder"
        ? "안에 있는 팩과 폴더도 함께 휴지통으로 가요. 설정 > 휴지통에서 30일 안에 되살릴 수 있어요."
        : "설정 > 휴지통에서 30일 안에 되살릴 수 있어요.";
    return deleteLinked > 0
      ? `${base} 가방에 불러온 사본이 ${deleteLinked}개 있어요. 같이 지우지 않으면 사본은 남고 연결만 끊어져요.`
      : `${base} 이미 가방에 불러온 팩에는 영향이 없어요.`;
  })();

  // 같은 이름 검사(2026-10-14): 같은 폴더 안에서 폴더는 폴더끼리, 팩 · 메모는 팩 · 메모끼리(가방 폴더와 같은 normalizeFolderName 기준)
  const nameTakenIn = (parentId: string | undefined, folder: boolean, exceptId?: string) => (name: string) => {
    const key = normalizeFolderName(name);
    return treePacks.some(
      (p) =>
        p.id !== exceptId &&
        (p.parentId ?? undefined) === parentId &&
        (p.type === "folder") === folder &&
        normalizeFolderName(p.name) === key,
    );
  };

  const newFolder = () =>
    setNameReq({
      title: "새 폴더",
      initial: "",
      placeholder: "예: 여행, 아기, 캠핑",
      confirmLabel: "만들기",
      onSubmit: (name) => onNewFolder(currentId, name),
      isTaken: nameTakenIn(currentId, true),
      takenMessage: "이 위치에 같은 이름의 폴더가 있어요",
    });

  const rename = (entry: Pack) =>
    setNameReq({
      title: entry.type === "folder" ? "폴더 이름" : entry.kind === "editor" ? "메모 이름" : "팩 이름",
      initial: entry.name,
      confirmLabel: "저장",
      onSubmit: (name) => onRenameEntry(entry, name),
      isTaken: nameTakenIn(entry.parentId ?? undefined, entry.type === "folder", entry.id),
      takenMessage: entry.type === "folder" ? "이 위치에 같은 이름의 폴더가 있어요" : "같은 폴더에 같은 이름의 팩이 있어요",
    });

  const togglePin = (entry: Pack) =>
    togglePackPinned(entry.id).catch(() => show("고정 상태를 저장하지 못했어요"));

  const openEntry = (entry: Pack) => (entry.type === "folder" ? goTo(entry.id) : onOpenPack(entry));

  // --- 순서 바꾸기(길게 누르기 시트 > 순서 바꾸기) -------------------------------------------
  // 지금 폴더(또는 맨 위)의 항목만. 폴더는 폴더끼리, 팩·메모는 팩·메모끼리(화면도 폴더가 항상 위).
  // 고정한 항목은 항상 맨 위라 뺀다. 저장은 구 UI와 같은 packOrderByParent[폴더 id | "root"] + 정렬 "custom"(쓰기 1회)
  const [reorderOpen, setReorderOpen] = useState(false);
  const currentEntries = entriesIn(treePacks, currentId, {
    sortBy: sortOpt,
    pinnedIds,
    orderByParent: profile?.packOrderByParent,
  }).filter((e) => !pinnedSet.has(e.id));
  const reorderItem = (e: Pack) => ({ id: e.id, label: e.name || (e.type === "folder" ? "이름 없는 폴더" : "이름 없는 팩"), icon: <EntryIcon entry={e} /> });
  const reorderGroups: ReorderGroup[] = [
    { key: "folders", title: "폴더", items: currentEntries.filter((e) => e.type === "folder").map(reorderItem) },
    { key: "packs", title: "팩 · 메모", items: currentEntries.filter((e) => e.type !== "folder").map(reorderItem) },
  ];
  const pinnedHere = entriesIn(treePacks, currentId, { pinnedIds, orderByParent: profile?.packOrderByParent }).some((e) =>
    pinnedSet.has(e.id),
  );

  // --- 폴더 한 화면(헤더 + 목록). 맨 위 화면만 검색·버튼이 실제로 쓰인다 -----------------------------
  const renderPage = (key: string, isTop: boolean) => {
    const pageId = key === ROOT_KEY ? undefined : key;
    const folder = pageId ? treePacks.find((p) => p.id === pageId) : undefined;
    const pageAncestors = pathTo(treePacks, pageId).slice(0, -1);
    // 한 폴더 안 항목만 다루는 가벼운 계산이라 useMemo 없이 둔다(React Compiler가 최적화)
    const entries = entriesIn(treePacks, pageId, {
      sortBy: sortOpt,
      pinnedIds,
      orderByParent: profile?.packOrderByParent,
    });
    const pageSearching = isTop && searching;
    const showQuickPack = !pageId && !pageSearching && !!quickPack && quickPack.items.length > 0;
    const isEmpty = entries.length === 0 && !showQuickPack;

    return (
      <>
        {/* 헤더·본문 여백은 ScreenHeader/ScreenBody가 정한다(가방 탭과 똑같이) */}
        <ScreenHeader
          search={
            isTop
              ? { open: searchOpen, value: query, onChange: setQuery, onClose: closeSearch, placeholder: "모든 폴더에서 검색" }
              : undefined
          }
          leading={
            pageId ? (
              <IconButton label="상위 폴더로" onClick={() => goTo(folder?.parentId)}>
                <IconChevronLeft size={22} stroke={1.9} />
              </IconButton>
            ) : undefined
          }
          actions={
            <>
              <IconButton label="검색" onClick={() => setSearchOpen(true)}>
                <IconSearch size={22} stroke={1.75} />
              </IconButton>
              <IconButton label="새 폴더" onClick={newFolder}>
                <IconFolderPlus size={22} stroke={1.75} />
              </IconButton>
              <IconButton label="새로 만들기" variant="solid" onClick={() => setAddOpen(true)}>
                <IconPlus size={20} stroke={2} />
              </IconButton>
            </>
          }
          above={
            pageId ? (
              <nav aria-label="경로" className="pib-v2-no-scrollbar flex min-h-5 items-center gap-1 overflow-x-auto text-caption text-sub">
                {[{ id: undefined as string | undefined, name: "팩" }, ...pageAncestors.map((f) => ({ id: f.id as string | undefined, name: f.name }))].map(
                  (c, i) => (
                    <span key={c.id ?? "root"} className="flex shrink-0 items-center gap-1">
                      {i > 0 && <IconChevronRight size={12} stroke={2} className="text-faint" aria-hidden="true" />}
                      <button type="button" onClick={() => goTo(c.id)} className="min-h-8 bg-transparent font-medium text-sub active:text-ink">
                        {c.name}
                      </button>
                    </span>
                  ),
                )}
              </nav>
            ) : undefined
          }
          title={folder?.name || "팩"}
        />

        <ScreenBody dockless={showQuickPack}>
          {pageSearching ? (
            !query.trim() ? (
              <p className="m-0 py-16 text-center text-caption text-faint">모든 폴더의 팩 이름, 아이템, 메모를 찾아요</p>
            ) : results.length === 0 ? (
              <p className="m-0 py-16 text-center text-body text-sub">찾는 결과가 없어요</p>
            ) : (
              <section className="flex flex-col">
                {results.map((r, i) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => openResult(r)}
                    className={cx(
                      "flex min-h-13 w-full flex-col gap-1 bg-transparent py-3 text-left active:bg-fill",
                      i < results.length - 1 && "border-b border-line",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Badge tone={r.type === "item" ? "neutral" : "brand"}>{r.type === "pack" && r.isEditorPack ? "메모" : RESULT_LABEL[r.type]}</Badge>
                      <span className="truncate text-body font-semibold text-ink">{r.label}</span>
                    </span>
                    <span className="truncate text-caption text-sub">{resultSubtitle(r)}</span>
                    {r.snippet && <span className="line-clamp-2 text-caption text-faint">{r.snippet}</span>}
                  </button>
                ))}
                {truncated && <p className="m-0 py-3 text-center text-micro text-faint">결과가 많아 30개까지만 보여드려요</p>}
              </section>
            )
          ) : isEmpty ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <p className="m-0 text-body-lg font-semibold">{pageId ? "이 폴더는 비어 있어요" : "아직 팩이 없어요"}</p>
              <p className="m-0 text-caption text-sub">
                {pageId ? "팩이나 메모를 만들거나, 다른 팩을 길게 눌러 옮겨 오세요." : "자주 챙기는 것을 팩으로 만들어 두면 가방에 바로 불러올 수 있어요."}
              </p>
              <Button className="mt-2" onClick={() => setAddOpen(true)} leading={<IconPlus size={18} stroke={2} />}>
                {pageId ? "여기에 만들기" : "새 팩 만들기"}
              </Button>
            </div>
          ) : (
            <>
              <section className="flex flex-col">
                {!isOfflineMode && entries.length > 1 && (
                  <SectionHeader
                    action={
                      <button
                        type="button"
                        onClick={() => setSortOpen(true)}
                        aria-label={`정렬: ${PACK_SORT_LABEL[sort]}`}
                        className="-my-2 -mr-2 inline-flex h-11 items-center gap-1 bg-transparent px-2 text-caption font-semibold text-sub active:opacity-60"
                      >
                        {PACK_SORT_LABEL[sort]}
                        <IconChevronDown size={14} stroke={2} aria-hidden="true" />
                      </button>
                    }
                  >
                    {pageId ? `이 폴더 ${entries.length}` : `팩 ${entries.length}`}
                  </SectionHeader>
                )}
                {entries.map((entry, i) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    meta={metaOf(treePacks, entry)}
                    pinned={pinnedSet.has(entry.id)}
                    pending={pendingIds.has(entry.id)}
                    privateLocked={entry.type !== "folder" && privacy.libraryLocked(entry.id)}
                    readOnly={entry.type !== "folder" && !!lockedPackIds?.has(entry.id)}
                    last={i === entries.length - 1}
                    onOpen={() => openEntry(entry)}
                    onMenu={() => setEntryId(entry.id)}
                  />
                ))}
              </section>
              {entries.length > 0 && (
                <p className="m-0 pt-6 text-center text-micro text-faint">
                  {pageId ? "길게 누르면 이름 · 고정 · 옮기기 · 삭제 · 오른쪽으로 밀면 상위 폴더" : "길게 누르면 이름 · 고정 · 옮기기 · 삭제"}
                </p>
              )}
            </>
          )}
        </ScreenBody>

        {/* 빠른팩: 엄지가 닿기 쉬운 하단에 고정. 떠 있는 탭바 바로 위(dock-mb = 탭바 높이)에 붙고, 본문은 이 줄 위에서 끝난다(dockless) */}
        {showQuickPack && quickPack && (
          <div className="dock-mb shrink-0 border-t border-line bg-canvas px-5 py-2">
            <button
              type="button"
              onClick={() => onOpenPack(quickPack)}
              className="mx-auto flex min-h-13 w-full max-w-2xl items-center gap-3 rounded-card bg-fill px-4 py-2 text-left active:bg-line"
            >
              <IconBolt size={22} stroke={1.6} className="shrink-0 text-sub" aria-hidden="true" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-body font-semibold text-ink">빠른팩</span>
                <span className="truncate text-caption text-sub">{metaOf(treePacks, quickPack)}</span>
              </span>
              <IconChevronRight size={16} stroke={1.75} className="shrink-0 text-faint" aria-hidden="true" />
            </button>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="pib-v2 relative flex h-full min-h-0 w-full flex-1 flex-col bg-canvas">
      <PageStack stack={stack} renderPage={renderPage} onBack={() => goTo(current?.parentId)} swipeEnabled={!searching} />

      {/* 정렬(가방 홈과 같은 모양, 2026-10-14) */}
      <Sheet open={sortOpen} onClose={() => setSortOpen(false)} title="정렬">
        <div className="flex flex-col">
          {(Object.keys(PACK_SORT_LABEL) as PackSort[]).map((key, i, arr) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setSortOpen(false);
                if (key !== sort) updatePackSortBy(packSortOption(key)).catch(() => show("정렬을 저장하지 못했어요"));
              }}
              className={cx(
                "flex min-h-13 items-center justify-between gap-3 bg-transparent text-left text-body active:bg-fill",
                i < arr.length - 1 && "border-b border-line",
              )}
            >
              <span className={key === sort ? "font-semibold text-ink" : "text-ink"}>{PACK_SORT_LABEL[key]}</span>
              {key === sort && <IconCheck size={18} stroke={2.2} className="text-brand" aria-label="선택됨" />}
            </button>
          ))}
        </div>
        <p className="m-0 pt-3 text-caption text-faint">
          최근순은 최근에 고친 순서예요. 폴더는 항상 팩보다 위에, 고정한 항목은 항상 맨 위에 있어요. 폴더마다 같은 정렬을 써요.
        </p>
        {currentEntries.length > 1 && (
          <Button
            variant="secondary"
            block
            className="mt-4"
            leading={<IconMenu2 size={18} stroke={1.9} />}
            onClick={() => {
              setSortOpen(false);
              setReorderOpen(true);
            }}
          >
            {current ? `'${current.name}' 순서 바꾸기` : "순서 바꾸기"}
          </Button>
        )}
      </Sheet>

      {/* 시트 */}
      <AddSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        where={where}
        onPack={() => onNewPack(currentId)}
        onMemo={() => onNewPack(currentId, "editor")}
        onFolder={newFolder}
      />
      <NameSheet request={nameReq} onClose={() => setNameReq(null)} />
      <EntrySheet
        entry={entryTarget}
        onClose={() => setEntryId(null)}
        pinned={!!entryTarget && pinnedSet.has(entryTarget.id)}
        canPin={!isOfflineMode}
        canShare={!isOfflineMode}
        onRename={() => entryTarget && rename(entryTarget)}
        onTogglePin={() => entryTarget && togglePin(entryTarget)}
        onMove={() => entryTarget && setMoveId(entryTarget.id)}
        onShare={() => entryTarget && setShareId(entryTarget.id)}
        onDelete={() => {
          if (!entryTarget) return;
          setAlsoDeleteFromBags(false);
          setDeleteId(entryTarget.id);
        }}
        onReorder={isOfflineMode || currentEntries.length < 2 ? undefined : () => setReorderOpen(true)}
        privacyLock={
          entryTarget && entryTarget.type !== "folder" && privacy.available
            ? {
                locked: privacy.libraryLocked(entryTarget.id),
                onToggle: () =>
                  privacy.toggleLock("library", entryTarget.id, !privacy.libraryLocked(entryTarget.id), {
                    name: entryTarget.name,
                    memo: entryTarget.kind === "editor",
                  }),
              }
            : undefined
        }
      />
      <ReorderSheet
        open={reorderOpen}
        title={current ? `'${current.name}' 순서` : "팩 순서"}
        hint={`오른쪽 ≡를 끌어서 옮겨요. 폴더는 항상 팩보다 위에 있어요.${pinnedHere ? " 고정한 항목은 항상 맨 위라 여기서 빠져요." : ""}`}
        groups={reorderGroups}
        onClose={() => setReorderOpen(false)}
        onSave={(orders) =>
          updatePackOrderByParent(currentId ?? "root", [...(orders.folders ?? []), ...(orders.packs ?? [])]).catch(() =>
            show("순서를 저장하지 못했어요"),
          )
        }
      />
      <MoveSheet
        entry={moveTarget}
        onClose={() => setMoveId(null)}
        targets={targets}
        isTakenAt={
          moveTarget
            ? (parentId) => nameTakenIn(parentId, moveTarget.type === "folder", moveTarget.id)(moveTarget.name)
            : undefined
        }
        onMove={(parentId) => {
          if (!moveTarget) return;
          onMoveEntries([moveTarget.id], parentId);
          show(parentId ? `'${placeName(parentId)}'(으)로 옮겼어요` : "맨 위로 옮겼어요");
        }}
      />
      {/* 삭제 확인: 가방에 불러온 사본이 있으면 같이 지울지 고른다(팩 화면 휴지통과 같은 모양) */}
      <Sheet
        open={!!deleteTarget}
        onClose={() => setDeleteId(null)}
        title={
          deleteShown?.type === "folder"
            ? `'${deleteShown.name}' 폴더를 휴지통으로 보낼까요?`
            : `'${deleteShown?.name ?? ""}' ${deleteShown?.kind === "editor" ? "메모를" : "팩을"} 휴지통으로 보낼까요?`
        }
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setDeleteId(null)}>
              취소
            </Button>
            <Button
              className="flex-1 bg-alert text-on-brand"
              onClick={() => {
                if (deleteTarget) onBulkDeletePacks([deleteTarget.id], deleteLinked > 0 ? alsoDeleteFromBags : undefined);
                setDeleteId(null);
              }}
            >
              휴지통으로
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="m-0 text-body text-sub">{deleteMessage}</p>
          {deleteLinked > 0 && (
            <div className="rounded-card border border-line bg-card px-4">
              <Toggle
                checked={alsoDeleteFromBags}
                onChange={setAlsoDeleteFromBags}
                label={`가방 속 사본도 같이 지우기 (${deleteLinked}개)`}
                description="함께 쓰는 가방이면 다른 멤버의 화면에서도 사라져요"
              />
            </div>
          )}
        </div>
      </Sheet>
      {!isOfflineMode && (
        <PackShareSheet open={!!shareSheetTarget} target={shareSheetTarget} onClose={() => setShareId(null)} />
      )}
      {privacy.element}
    </div>
  );
}
