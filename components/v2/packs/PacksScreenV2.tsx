"use client";

import { useMemo, useState } from "react";
import {
  IconBolt,
  IconChecklist,
  IconChevronLeft,
  IconChevronRight,
  IconFolder,
  IconFolderPlus,
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
import { Badge, Button, IconButton, PageStack, ReorderSheet, ScreenBody, ScreenHeader, cx, useLongPress, type ReorderGroup } from "@/components/v2/ui";
import { ConfirmSheet } from "@/components/v2/bag/sheets/ConfirmSheet";
import { AddSheet } from "./sheets/AddSheet";
import { EntrySheet } from "./sheets/EntrySheet";
import { MoveSheet } from "./sheets/MoveSheet";
import { NameSheet, type NameRequest } from "./sheets/NameSheet";
import { entriesIn, metaOf, moveTargets, pathLabel, pathTo } from "./packsModel";
import { useShellCommands } from "@/lib/v2/shell";

// AppShell이 넘기는 props.
// (onBack / onSelectModeChange는 v2에서 쓰지 않는다: 탭 화면이라 뒤로가기 없음, 다중선택 제거)
export interface PacksScreenProps {
  uid: string;
  packs: Pack[];
  bags: Bag[];
  quickPack?: Pack;
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
  last,
  onOpen,
  onMenu,
}: {
  entry: Pack;
  meta: string;
  pinned: boolean;
  last: boolean;
  onOpen: () => void;
  onMenu: () => void;
}) {
  const press = useLongPress(onMenu, onOpen);
  const isFolder = entry.type === "folder";
  return (
    <button
      type="button"
      {...press}
      className={cx(
        "flex min-h-15 w-full select-none items-center gap-3 bg-transparent py-2 text-left",
        "transition-colors duration-160 ease-snappy active:bg-fill",
        !last && "border-b border-line",
      )}
    >
      <span className="flex size-6 shrink-0 items-center justify-center">
        <EntryIcon entry={entry} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex min-w-0 items-center gap-1">
          <span className="truncate text-body font-semibold text-ink">{entry.name || (isFolder ? "이름 없는 폴더" : "이름 없는 팩")}</span>
          {pinned && <IconPin size={14} stroke={2} className="shrink-0 text-faint" aria-label="고정됨" />}
        </span>
        <span className="truncate text-caption text-sub">{meta}</span>
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
  const { packs, bags, quickPack, onOpenPack, onNewPack, onNewFolder, onRenameEntry, onMoveEntries, onBulkDeletePacks } = props;
  const { profile, isOfflineMode, togglePackPinned, updatePackOrderByParent } = useAuth();
  const { show } = useToast();

  // 빠른팩은 트리에 넣지 않는다(하단 한 줄로 따로)
  const treePacks = useMemo(() => packs.filter((p) => !p.isQuickPack), [packs]);
  const pinnedIds = useMemo(() => profile?.pinnedPackIds ?? [], [profile?.pinnedPackIds]);
  const pinnedSet = useMemo(() => new Set(pinnedIds), [pinnedIds]);

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
    const real = treePacks.filter((p) => p.type !== "folder");
    return quickPack ? [...real, quickPack] : real;
  }, [treePacks, quickPack]);
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

  // 삭제 확인 문구는 닫히는 동안에도 유지
  const [deleteCached, setDeleteCached] = useState<Pack | null>(null);
  const deleteTarget = find(deleteId);
  if (deleteTarget && deleteTarget !== deleteCached) setDeleteCached(deleteTarget);
  const deleteShown = deleteTarget ?? deleteCached;

  const descendantsOf = (id: string) => collectDescendantPackIds(treePacks, id);
  const targets = moveTarget ? moveTargets(treePacks, new Set([moveTarget.id]), descendantsOf) : [];

  const deleteMessage = (() => {
    if (!deleteShown) return "";
    const ids = new Set([deleteShown.id, ...descendantsOf(deleteShown.id)]);
    const linked = findLinkedBagPackRefs(bags, ids).length;
    const base =
      deleteShown.type === "folder"
        ? "안에 있는 팩과 폴더도 함께 휴지통으로 가요. 30일 안에 되살릴 수 있어요."
        : "휴지통에서 30일 안에 되살릴 수 있어요.";
    return linked > 0 ? `${base} 가방에 불러온 사본 ${linked}개는 가방에 그대로 남아요.` : base;
  })();

  const newFolder = () =>
    setNameReq({
      title: "새 폴더",
      initial: "",
      placeholder: "예: 여행, 아기, 캠핑",
      confirmLabel: "만들기",
      onSubmit: (name) => onNewFolder(currentId, name),
    });

  const rename = (entry: Pack) =>
    setNameReq({
      title: entry.type === "folder" ? "폴더 이름" : entry.kind === "editor" ? "메모 이름" : "팩 이름",
      initial: entry.name,
      confirmLabel: "저장",
      onSubmit: (name) => onRenameEntry(entry, name),
    });

  const togglePin = (entry: Pack) =>
    togglePackPinned(entry.id).catch(() => show("고정 상태를 저장하지 못했어요"));

  const openEntry = (entry: Pack) => (entry.type === "folder" ? goTo(entry.id) : onOpenPack(entry));

  // --- 순서 바꾸기(길게 누르기 시트 > 순서 바꾸기) -------------------------------------------
  // 지금 폴더(또는 맨 위)의 항목만. 폴더는 폴더끼리, 팩·메모는 팩·메모끼리(화면도 폴더가 항상 위).
  // 고정한 항목은 항상 맨 위라 뺀다. 저장은 구 UI와 같은 packOrderByParent[폴더 id | "root"] + 정렬 "custom"(쓰기 1회)
  const [reorderOpen, setReorderOpen] = useState(false);
  const currentEntries = entriesIn(treePacks, currentId, {
    sortBy: profile?.packSortBy ?? "createdAt",
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
      sortBy: profile?.packSortBy ?? "createdAt",
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
                {entries.map((entry, i) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    meta={metaOf(treePacks, entry)}
                    pinned={pinnedSet.has(entry.id)}
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
        onDelete={() => entryTarget && setDeleteId(entryTarget.id)}
        onReorder={isOfflineMode || currentEntries.length < 2 ? undefined : () => setReorderOpen(true)}
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
        onMove={(parentId) => {
          if (!moveTarget) return;
          onMoveEntries([moveTarget.id], parentId);
          show(parentId ? `'${placeName(parentId)}'(으)로 옮겼어요` : "맨 위로 옮겼어요");
        }}
      />
      <ConfirmSheet
        open={!!deleteTarget}
        onClose={() => setDeleteId(null)}
        title={
          deleteShown?.type === "folder"
            ? `'${deleteShown.name}' 폴더를 삭제할까요?`
            : `'${deleteShown?.name ?? ""}' ${deleteShown?.kind === "editor" ? "메모를" : "팩을"} 삭제할까요?`
        }
        message={deleteMessage}
        confirmLabel="삭제"
        danger
        onConfirm={() => deleteTarget && onBulkDeletePacks([deleteTarget.id])}
      />
      {!isOfflineMode && (
        <PackShareSheet open={!!shareSheetTarget} target={shareSheetTarget} onClose={() => setShareId(null)} />
      )}
    </div>
  );
}
