"use client";

import { useEffect, useMemo, useState } from "react";
import {
  IconChevronRight,
  IconChevronDown,
  IconBackpack,
  IconFolder,
  IconFolderPlus,
  IconPlus,
  IconSearch,
  IconX,
  IconSettings,
  IconDotsVertical,
  IconEdit,
  IconTrash,
  IconArrowRight,
  IconNotes,
} from "@tabler/icons-react";
import { Bag, BagFolder, Pack, ListSortOption } from "@/lib/types";
import { useAuth } from "@/contexts/AuthProvider";
import { arrangeList } from "@/lib/listSort";
import { collectDescendantPackIds } from "@/lib/packsService";
import PackColorDot from "@/components/PackColorDot";
import Portal from "@/components/Portal";
import ConfirmDialog from "@/components/ConfirmDialog";
import NotificationBell from "@/components/NotificationBell";

// 팩 보관함 트리 한 줄. PacksScreen(모바일 풀스크린 트리)의 buildRows와 동일한 규칙으로
// 재귀 펼치되, 여기서는 "추가하기" 자리를 별도 행으로 만들지 않고 각 레벨/폴더 옆에
// 작은 + 버튼으로 대신한다(사이드바 폭이 좁아서 전용 행을 넣으면 답답해 보임).
type PackTreeRow = { entry: Pack; depth: number };

function buildPackRows(
  allPacks: Pack[],
  parentId: string | undefined,
  depth: number,
  expandedIds: Set<string>,
  sortBy: ListSortOption | undefined,
  pinnedIds: string[],
  orderByParent: Record<string, string[]> | undefined
): PackTreeRow[] {
  const siblings = allPacks.filter((p) => (p.parentId ?? undefined) === parentId);
  const parentKey = parentId ?? "root";
  const order = orderByParent?.[parentKey] ?? [];
  const arranged = arrangeList(siblings, { sortBy, pinnedIds, order, maxPinned: Infinity });
  const rows: PackTreeRow[] = [];
  for (const entry of arranged) {
    rows.push({ entry, depth });
    if (entry.type === "folder" && expandedIds.has(entry.id)) {
      rows.push(...buildPackRows(allPacks, entry.id, depth + 1, expandedIds, sortBy, pinnedIds, orderByParent));
    }
  }
  return rows;
}

// 가방보관함 트리 한 줄 - 가방 폴더(개인 메타데이터)와 가방(공유 문서)이 섞인다.
type BagTreeRow =
  | { kind: "folder"; folder: BagFolder; depth: number }
  | { kind: "bag"; bag: Bag; depth: number };

function buildBagRows(
  bags: Bag[],
  folders: Record<string, BagFolder>,
  assignments: Record<string, string>,
  parentId: string | undefined,
  depth: number,
  expandedIds: Set<string>,
  sortBy: ListSortOption | undefined,
  pinnedIds: string[],
  orderByParent: Record<string, string[]> | undefined
): BagTreeRow[] {
  const childFolders = Object.values(folders).filter((f) => (f.parentId ?? undefined) === parentId);
  const childBags = bags.filter((b) => (assignments[b.id] ?? undefined) === parentId);
  const combined = [
    ...childFolders.map((f) => ({
      id: f.id,
      name: f.name,
      createdAt: f.createdAt,
      node: { kind: "folder" as const, folder: f, depth },
    })),
    ...childBags.map((b) => ({
      id: b.id,
      name: b.name,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
      node: { kind: "bag" as const, bag: b, depth },
    })),
  ];
  const parentKey = parentId ?? "root";
  const order = orderByParent?.[parentKey] ?? [];
  const arranged = arrangeList(combined, { sortBy, pinnedIds, order, maxPinned: 3 });
  const rows: BagTreeRow[] = [];
  for (const entry of arranged) {
    rows.push(entry.node);
    if (entry.node.kind === "folder" && expandedIds.has(entry.node.folder.id)) {
      rows.push(
        ...buildBagRows(bags, folders, assignments, entry.node.folder.id, depth + 1, expandedIds, sortBy, pinnedIds, orderByParent)
      );
    }
  }
  return rows;
}

// folderId(및 그 하위 폴더 전체)의 id 집합 - 순환 방지(자기 자신 하위로 옮기는 것 방지)용.
function collectDescendantBagFolderIds(folders: Record<string, BagFolder>, rootId: string): string[] {
  const children = Object.values(folders).filter((f) => f.parentId === rootId);
  return children.flatMap((c) => [c.id, ...collectDescendantBagFolderIds(folders, c.id)]);
}

export type DesktopSelection =
  | { kind: "bag"; bagId: string; focusPackId?: string }
  | { kind: "pack"; packId: string }
  | { kind: "settings" };

export default function DesktopSidebar({
  uid,
  bags,
  libraryPacks,
  selection,
  onSelect,
  onNewBag,
  onNewPack,
  onNewFolder,
  onChangeColor,
  onRenamePackEntry,
  onMovePackEntries,
  onDeletePackEntry,
  settingsActive,
}: {
  uid: string;
  bags: Bag[];
  libraryPacks: Pack[];
  selection: DesktopSelection | null;
  onSelect: (selection: DesktopSelection) => void;
  onNewBag: () => void;
  onNewPack: (parentId?: string, kind?: "checklist" | "editor") => void;
  onNewFolder: (parentId?: string) => void;
  onChangeColor: (pack: Pack, colorId: string | undefined) => void;
  onRenamePackEntry: (pack: Pack, name: string) => void;
  onMovePackEntries: (packIds: string[], parentId: string | undefined) => void;
  onDeletePackEntry: (packId: string) => void;
  // 설정은 모달로 띄우니 selection과 별개로 관리되는 상태 - 하이라이트만 이걸로 판단한다.
  settingsActive?: boolean;
}) {
  const {
    profile,
    updateExpandedPackFolderIds,
    createBagFolder,
    renameBagFolder,
    deleteBagFolder,
    moveBagFolder,
    moveBagToFolder,
    updateExpandedBagFolderIds,
  } = useAuth();
  const [expandedBagIds, setExpandedBagIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  // 팩 폴더 펼침 상태는 모바일 팩 트리 화면(PacksScreen)과 같은 계정 필드를 공유한다 -
  // 어느 화면에서 펼쳐두든 다른 화면/기기에서도 그대로 이어진다.
  const [expandedPackIds, setExpandedPackIds] = useState<Set<string>>(
    () => new Set(profile?.expandedPackFolderIds ?? [])
  );
  useEffect(() => {
    setExpandedPackIds(new Set(profile?.expandedPackFolderIds ?? []));
  }, [profile?.expandedPackFolderIds]);

  // 가방보관함 폴더 펼침 상태 - 팩 폴더와 동일한 패턴(계정 필드 미러링).
  const [expandedBagFolderIds, setExpandedBagFolderIds] = useState<Set<string>>(
    () => new Set(profile?.expandedBagFolderIds ?? [])
  );
  useEffect(() => {
    setExpandedBagFolderIds(new Set(profile?.expandedBagFolderIds ?? []));
  }, [profile?.expandedBagFolderIds]);

  const toggleBagExpanded = (id: string) => {
    setExpandedBagIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePackExpanded = (id: string) => {
    setExpandedPackIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      updateExpandedPackFolderIds(Array.from(next)).catch(() => {});
      return next;
    });
  };

  const toggleBagFolderExpanded = (id: string) => {
    setExpandedBagFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      updateExpandedBagFolderIds(Array.from(next)).catch(() => {});
      return next;
    });
  };

  const treePacks = useMemo(() => libraryPacks.filter((p) => !p.isQuickPack), [libraryPacks]);
  const bagFolders = profile?.bagFolders ?? {};
  const bagFolderAssignments = profile?.bagFolderAssignments ?? {};

  const q = query.trim().toLowerCase();
  const filteredBags = q ? bags.filter((b) => b.name.toLowerCase().includes(q)) : bags;
  const filteredPacks = q ? treePacks.filter((p) => p.name.toLowerCase().includes(q)) : treePacks;

  const bagRows = useMemo(
    () =>
      buildBagRows(
        bags,
        bagFolders,
        bagFolderAssignments,
        undefined,
        0,
        expandedBagFolderIds,
        profile?.bagSortBy ?? "createdAt",
        profile?.pinnedBagIds ?? [],
        profile?.bagOrderByParent
      ),
    [bags, bagFolders, bagFolderAssignments, expandedBagFolderIds, profile?.bagSortBy, profile?.pinnedBagIds, profile?.bagOrderByParent]
  );

  const packRows = useMemo(
    () =>
      buildPackRows(
        filteredPacks,
        undefined,
        0,
        // 검색 중일 때는 매칭된 항목이 폴더 안에 있어도 보이도록 전부 펼친 것처럼 취급한다.
        q ? new Set(filteredPacks.map((p) => p.id)) : expandedPackIds,
        profile?.packSortBy ?? "createdAt",
        profile?.pinnedPackIds ?? [],
        profile?.packOrderByParent
      ),
    [filteredPacks, expandedPackIds, q, profile?.packSortBy, profile?.pinnedPackIds, profile?.packOrderByParent]
  );

  // --- 가방/폴더 "..." 메뉴(이동/이름바꾸기/삭제) --------------------------------
  const [menuFor, setMenuFor] = useState<{ kind: "bag" | "folder"; id: string } | null>(null);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [confirmDeleteFolderId, setConfirmDeleteFolderId] = useState<string | null>(null);

  // 이동 목적지 후보: 전체 폴더를 depth와 함께 평평하게 나열(최상위 "가방보관함" 포함은
  // 호출부에서 별도로 그린다). 폴더를 옮기는 중이면 자기 자신 + 하위 폴더는 순환 방지로 제외.
  const buildFolderPickerRows = (excludeIds: Set<string>): { folder: BagFolder; depth: number }[] => {
    const rows: { folder: BagFolder; depth: number }[] = [];
    const walk = (parentId: string | undefined, depth: number) => {
      Object.values(bagFolders)
        .filter((f) => (f.parentId ?? undefined) === parentId)
        .filter((f) => !excludeIds.has(f.id))
        .sort((a, b) => a.name.localeCompare(b.name, "ko"))
        .forEach((f) => {
          rows.push({ folder: f, depth });
          walk(f.id, depth + 1);
        });
    };
    walk(undefined, 0);
    return rows;
  };

  const handleMoveBagTo = (bagId: string, folderId: string | undefined) => {
    moveBagToFolder(bagId, folderId).catch(() => {});
    setMenuFor(null);
  };

  const handleMoveFolderTo = (folderId: string, parentId: string | undefined) => {
    moveBagFolder(folderId, parentId).catch(() => {});
    setMenuFor(null);
  };

  const startRenameFolder = (folder: BagFolder) => {
    setRenamingFolderId(folder.id);
    setRenameDraft(folder.name);
    setMenuFor(null);
  };

  const commitRenameFolder = () => {
    if (renamingFolderId && renameDraft.trim()) {
      renameBagFolder(renamingFolderId, renameDraft.trim()).catch(() => {});
    }
    setRenamingFolderId(null);
  };

  // --- 팩 보관함(팩/폴더) "..." 메뉴 -------------------------------------------
  const [packMenuFor, setPackMenuFor] = useState<{ id: string; isFolder: boolean } | null>(null);
  const [renamingPackId, setRenamingPackId] = useState<string | null>(null);
  const [packRenameDraft, setPackRenameDraft] = useState("");
  const [confirmDeletePackId, setConfirmDeletePackId] = useState<string | null>(null);

  const buildPackFolderPickerRows = (excludeIds: Set<string>): { folder: Pack; depth: number }[] => {
    const allFolders = treePacks.filter((p) => p.type === "folder");
    const rows: { folder: Pack; depth: number }[] = [];
    const walk = (parentId: string | undefined, depth: number) => {
      allFolders
        .filter((f) => (f.parentId ?? undefined) === parentId)
        .filter((f) => !excludeIds.has(f.id))
        .sort((a, b) => a.name.localeCompare(b.name, "ko"))
        .forEach((f) => {
          rows.push({ folder: f, depth });
          walk(f.id, depth + 1);
        });
    };
    walk(undefined, 0);
    return rows;
  };

  const startRenamePack = (entry: Pack) => {
    setRenamingPackId(entry.id);
    setPackRenameDraft(entry.name);
    setPackMenuFor(null);
  };

  const commitRenamePack = () => {
    if (renamingPackId && packRenameDraft.trim()) {
      const entry = treePacks.find((p) => p.id === renamingPackId);
      if (entry) onRenamePackEntry(entry, packRenameDraft.trim());
    }
    setRenamingPackId(null);
  };

  const handleMovePackTo = (packId: string, parentId: string | undefined) => {
    onMovePackEntries([packId], parentId);
    setPackMenuFor(null);
  };

  return (
    <div className="flex h-full w-72 shrink-0 flex-col border-r border-border">
      <div className="shrink-0 p-3 pb-2 flex items-center gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-2.5 py-1.5">
          <IconSearch size={15} stroke={1.75} color="var(--text-muted)" className="shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="가방/팩 이름 검색"
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
          />
          {query && (
            <button onClick={() => setQuery("")} aria-label="검색어 지우기" className="shrink-0">
              <IconX size={14} stroke={1.75} color="var(--text-muted)" />
            </button>
          )}
        </div>
        <NotificationBell uid={uid} />
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {/* 내 가방 -------------------------------------------------------- */}
        <div className="flex items-center justify-between px-2 pt-2 pb-1">
          <span className="text-[11px] font-semibold text-text-muted">내 가방</span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => createBagFolder("새 폴더", undefined).catch(() => {})}
              aria-label="새 폴더"
              className="-m-1.5 p-1.5 rounded-md hover:bg-black/5"
            >
              <IconFolderPlus size={14} stroke={1.75} color="var(--text-muted)" />
            </button>
            <button
              onClick={onNewBag}
              aria-label="새 가방"
              className="-m-1.5 p-1.5 rounded-md hover:bg-black/5"
            >
              <IconPlus size={14} stroke={1.75} color="var(--text-muted)" />
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-0.5 mb-3">
          {q ? (
            // 검색 중에는 폴더 구조를 무시하고 이름이 맞는 가방만 평평하게 보여준다.
            filteredBags.length === 0 ? (
              <p className="px-2 py-2 text-[12px] text-text-muted">검색 결과가 없어요.</p>
            ) : (
              filteredBags.map((bag) => {
                const isSelected = selection?.kind === "bag" && selection.bagId === bag.id && !selection.focusPackId;
                return (
                  <div
                    key={bag.id}
                    onClick={() => onSelect({ kind: "bag", bagId: bag.id })}
                    className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 cursor-pointer"
                    style={{ background: isSelected ? "var(--accent-soft)" : undefined }}
                  >
                    <span className="w-[14px] shrink-0" />
                    <IconBackpack size={16} stroke={1.75} color="var(--text-secondary)" className="shrink-0" />
                    <span className="text-[13px] font-medium truncate min-w-0 flex-1">{bag.name}</span>
                  </div>
                );
              })
            )
          ) : bagRows.length === 0 ? (
            <p className="px-2 py-2 text-[12px] text-text-muted">가방이 없어요.</p>
          ) : (
            bagRows.map((row) => {
              if (row.kind === "folder") {
                const folder = row.folder;
                const isExpanded = expandedBagFolderIds.has(folder.id);
                const isRenaming = renamingFolderId === folder.id;
                return (
                  <div
                    key={folder.id}
                    className="group flex items-center gap-1.5 rounded-lg px-2 py-1.5 cursor-pointer"
                    style={{ paddingLeft: 8 + row.depth * 18 }}
                    onClick={() => !isRenaming && toggleBagFolderExpanded(folder.id)}
                  >
                    <IconChevronRight
                      size={13}
                      stroke={2}
                      color="var(--text-muted)"
                      className="shrink-0 transition-transform"
                      style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}
                    />
                    <IconFolder size={15} stroke={1.75} color="var(--text-secondary)" className="shrink-0" />
                    {isRenaming ? (
                      <input
                        autoFocus
                        value={renameDraft}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRenameFolder();
                          if (e.key === "Escape") setRenamingFolderId(null);
                        }}
                        onBlur={commitRenameFolder}
                        className="min-w-0 flex-1 rounded border border-border bg-surface px-1 py-0.5 text-[13px] outline-none"
                      />
                    ) : (
                      <span className="text-[13px] font-medium truncate min-w-0 flex-1">{folder.name}</span>
                    )}
                    {!isRenaming && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuFor({ kind: "folder", id: folder.id });
                        }}
                        aria-label="폴더 메뉴"
                        className="shrink-0 -m-1 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-black/5"
                      >
                        <IconDotsVertical size={13} stroke={1.75} color="var(--text-muted)" />
                      </button>
                    )}
                  </div>
                );
              }

              const bag = row.bag;
              const isSelected = selection?.kind === "bag" && selection.bagId === bag.id && !selection.focusPackId;
              const isExpanded = expandedBagIds.has(bag.id);
              return (
                <div key={bag.id}>
                  <div
                    className="group flex items-center gap-1.5 rounded-lg px-2 py-1.5 cursor-pointer"
                    style={{
                      paddingLeft: 8 + row.depth * 18,
                      background: isSelected ? "var(--accent-soft)" : undefined,
                    }}
                    onClick={() => onSelect({ kind: "bag", bagId: bag.id })}
                  >
                    {bag.packs.length > 0 ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleBagExpanded(bag.id);
                        }}
                        className="shrink-0 -m-1 p-1"
                        aria-label="펼치기/접기"
                      >
                        {isExpanded ? (
                          <IconChevronDown size={14} stroke={2} color="var(--text-muted)" />
                        ) : (
                          <IconChevronRight size={14} stroke={2} color="var(--text-muted)" />
                        )}
                      </button>
                    ) : (
                      <span className="w-[14px] shrink-0" />
                    )}
                    <IconBackpack size={16} stroke={1.75} color="var(--text-secondary)" className="shrink-0" />
                    <span className="text-[13px] font-medium truncate min-w-0 flex-1">{bag.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuFor({ kind: "bag", id: bag.id });
                      }}
                      aria-label="가방 메뉴"
                      className="shrink-0 -m-1 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-black/5"
                    >
                      <IconDotsVertical size={13} stroke={1.75} color="var(--text-muted)" />
                    </button>
                  </div>
                  {isExpanded &&
                    bag.packs.map((pack) => {
                      const packSelected =
                        selection?.kind === "bag" && selection.bagId === bag.id && selection.focusPackId === pack.id;
                      return (
                        <div
                          key={pack.id}
                          onClick={() => onSelect({ kind: "bag", bagId: bag.id, focusPackId: pack.id })}
                          className="flex items-center gap-1.5 rounded-lg py-1.5 cursor-pointer"
                          style={{
                            paddingLeft: 34 + row.depth * 18,
                            background: packSelected ? "var(--accent-soft)" : undefined,
                          }}
                        >
                          <PackColorDot colorId={pack.color} onChange={() => {}} />
                          <span className="text-[12.5px] truncate min-w-0 flex-1 text-text-secondary">
                            {pack.name}
                          </span>
                        </div>
                      );
                    })}
                </div>
              );
            })
          )}
        </div>

        {/* 팩 보관함 -------------------------------------------------------- */}
        <div className="flex items-center justify-between px-2 pt-2 pb-1">
          <span className="text-[11px] font-semibold text-text-muted">팩 보관함</span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => onNewFolder(undefined)}
              aria-label="새 폴더"
              className="-m-1.5 p-1.5 rounded-md hover:bg-black/5"
            >
              <IconFolderPlus size={14} stroke={1.75} color="var(--text-muted)" />
            </button>
            <button
              onClick={() => onNewPack(undefined)}
              aria-label="새 팩"
              className="-m-1.5 p-1.5 rounded-md hover:bg-black/5"
            >
              <IconPlus size={14} stroke={1.75} color="var(--text-muted)" />
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-0.5">
          {packRows.length === 0 ? (
            <p className="px-2 py-2 text-[12px] text-text-muted">아직 만든 팩이 없어요.</p>
          ) : (
            packRows.map(({ entry, depth }) => {
              const isFolder = entry.type === "folder";
              const isSelected = selection?.kind === "pack" && selection.packId === entry.id;
              const isRenaming = renamingPackId === entry.id;
              return (
                <div
                  key={entry.id}
                  onClick={() =>
                    isRenaming ? undefined : isFolder ? togglePackExpanded(entry.id) : onSelect({ kind: "pack", packId: entry.id })
                  }
                  className="group flex items-center gap-1.5 rounded-lg py-1.5 cursor-pointer"
                  style={{
                    paddingLeft: 8 + depth * 18,
                    paddingRight: 8,
                    background: isSelected ? "var(--accent-soft)" : undefined,
                  }}
                >
                  {isFolder ? (
                    <IconChevronRight
                      size={13}
                      stroke={2}
                      color="var(--text-muted)"
                      className="shrink-0 transition-transform"
                      style={{
                        transform: expandedPackIds.has(entry.id) || q ? "rotate(90deg)" : "rotate(0deg)",
                      }}
                    />
                  ) : (
                    <span className="w-[13px] shrink-0" />
                  )}
                  {isFolder ? (
                    <IconFolder size={15} stroke={1.75} color="var(--text-secondary)" className="shrink-0" />
                  ) : (
                    <PackColorDot colorId={entry.color} onChange={(colorId) => onChangeColor(entry, colorId)} />
                  )}
                  {isRenaming ? (
                    <input
                      autoFocus
                      value={packRenameDraft}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setPackRenameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRenamePack();
                        if (e.key === "Escape") setRenamingPackId(null);
                      }}
                      onBlur={commitRenamePack}
                      className="min-w-0 flex-1 rounded border border-border bg-surface px-1 py-0.5 text-[13px] outline-none"
                    />
                  ) : (
                    <span className="text-[13px] truncate min-w-0 flex-1">{entry.name}</span>
                  )}
                  {!isFolder && entry.kind === "editor" && (
                    <IconNotes size={12} stroke={1.75} color="var(--text-muted)" className="shrink-0" />
                  )}
                  {isFolder && !isRenaming && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onNewPack(entry.id);
                      }}
                      aria-label="이 폴더에 팩 추가"
                      className="shrink-0 -m-1 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-black/5"
                    >
                      <IconPlus size={12} stroke={1.75} color="var(--text-muted)" />
                    </button>
                  )}
                  {!isRenaming && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPackMenuFor({ id: entry.id, isFolder });
                      }}
                      aria-label="메뉴"
                      className="shrink-0 -m-1 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-black/5"
                    >
                      <IconDotsVertical size={12} stroke={1.75} color="var(--text-muted)" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-border p-2 flex flex-col gap-0.5">
        <div
          onClick={() => onSelect({ kind: "settings" })}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer"
          style={{ background: settingsActive ? "var(--accent-soft)" : undefined }}
        >
          <IconSettings size={16} stroke={1.75} color="var(--text-secondary)" />
          <span className="text-[13px]">설정 · 휴지통</span>
        </div>
      </div>

      {/* 가방/폴더 "..." 메뉴 - 이동(폴더 목록) + 폴더면 이름바꾸기/삭제 */}
      {menuFor && (
        <Portal>
          <div
            className="fixed inset-0 z-[120]"
            onClick={() => setMenuFor(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute rounded-xl border border-border shadow-lg overflow-hidden"
              style={{
                background: "var(--surface)",
                minWidth: 200,
                maxHeight: "70vh",
                overflowY: "auto",
                // 사이드바 폭(288px) 근처에 뜨도록 대략 고정 - 트리거 위치를 정확히 추적하진
                // 않지만(간단한 v1), 사이드바 영역 안이라 항상 보기 좋은 위치에 뜬다.
                left: 16,
                top: 220,
              }}
            >
              {menuFor.kind === "folder" &&
                (() => {
                  const folder = bagFolders[menuFor.id];
                  if (!folder) return null;
                  return (
                    <>
                      <button
                        onClick={() => startRenameFolder(folder)}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-[13px] text-left hover:bg-black/5"
                      >
                        <IconEdit size={15} stroke={1.75} />
                        이름 바꾸기
                      </button>
                      <div className="border-t border-border" />
                    </>
                  );
                })()}

              <div className="px-3 pt-2 pb-1 text-[11px] text-text-muted">이동할 곳</div>
              <button
                onClick={() =>
                  menuFor.kind === "bag"
                    ? handleMoveBagTo(menuFor.id, undefined)
                    : handleMoveFolderTo(menuFor.id, undefined)
                }
                className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left hover:bg-black/5"
              >
                <IconArrowRight size={14} stroke={1.75} color="var(--text-muted)" />
                가방보관함 (최상위)
              </button>
              {buildFolderPickerRows(
                menuFor.kind === "folder"
                  ? new Set([menuFor.id, ...collectDescendantBagFolderIds(bagFolders, menuFor.id)])
                  : new Set()
              ).map(({ folder, depth }) => (
                <button
                  key={folder.id}
                  onClick={() =>
                    menuFor.kind === "bag"
                      ? handleMoveBagTo(menuFor.id, folder.id)
                      : handleMoveFolderTo(menuFor.id, folder.id)
                  }
                  className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left hover:bg-black/5"
                  style={{ paddingLeft: 12 + depth * 16 }}
                >
                  <IconFolder size={14} stroke={1.75} color="var(--text-secondary)" />
                  <span className="truncate">{folder.name}</span>
                </button>
              ))}

              {menuFor.kind === "folder" && (
                <>
                  <div className="border-t border-border" />
                  <button
                    onClick={() => {
                      setConfirmDeleteFolderId(menuFor.id);
                      setMenuFor(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-[13px] text-left hover:bg-black/5"
                    style={{ color: "var(--danger)" }}
                  >
                    <IconTrash size={15} stroke={1.75} />
                    폴더 삭제
                  </button>
                </>
              )}
            </div>
          </div>
        </Portal>
      )}

      {confirmDeleteFolderId && (
        <ConfirmDialog
          title="이 폴더를 삭제할까요?"
          message="폴더 안 가방/하위폴더는 삭제되지 않고 한 단계 위로 이동해요."
          confirmLabel="삭제"
          tone="danger"
          onCancel={() => setConfirmDeleteFolderId(null)}
          onConfirm={() => {
            deleteBagFolder(confirmDeleteFolderId).catch(() => {});
            setConfirmDeleteFolderId(null);
          }}
        />
      )}

      {/* 팩/폴더 "..." 메뉴 - 이름바꾸기 + 이동(폴더 목록) + 삭제 */}
      {packMenuFor && (
        <Portal>
          <div className="fixed inset-0 z-[120]" onClick={() => setPackMenuFor(null)}>
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute rounded-xl border border-border shadow-lg overflow-hidden"
              style={{
                background: "var(--surface)",
                minWidth: 200,
                maxHeight: "70vh",
                overflowY: "auto",
                left: 16,
                top: 420,
              }}
            >
              {(() => {
                const entry = treePacks.find((p) => p.id === packMenuFor.id);
                if (!entry) return null;
                return (
                  <button
                    onClick={() => startRenamePack(entry)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-[13px] text-left hover:bg-black/5"
                  >
                    <IconEdit size={15} stroke={1.75} />
                    이름 바꾸기
                  </button>
                );
              })()}
              <div className="border-t border-border" />
              <div className="px-3 pt-2 pb-1 text-[11px] text-text-muted">이동할 곳</div>
              <button
                onClick={() => handleMovePackTo(packMenuFor.id, undefined)}
                className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left hover:bg-black/5"
              >
                <IconArrowRight size={14} stroke={1.75} color="var(--text-muted)" />
                팩 보관함 (최상위)
              </button>
              {buildPackFolderPickerRows(
                packMenuFor.isFolder
                  ? new Set([packMenuFor.id, ...collectDescendantPackIds(treePacks, packMenuFor.id)])
                  : new Set()
              ).map(({ folder, depth }) => (
                <button
                  key={folder.id}
                  onClick={() => handleMovePackTo(packMenuFor.id, folder.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left hover:bg-black/5"
                  style={{ paddingLeft: 12 + depth * 16 }}
                >
                  <IconFolder size={14} stroke={1.75} color="var(--text-secondary)" />
                  <span className="truncate">{folder.name}</span>
                </button>
              ))}
              <div className="border-t border-border" />
              <button
                onClick={() => {
                  setConfirmDeletePackId(packMenuFor.id);
                  setPackMenuFor(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-[13px] text-left hover:bg-black/5"
                style={{ color: "var(--danger)" }}
              >
                <IconTrash size={15} stroke={1.75} />
                {packMenuFor.isFolder ? "폴더 삭제" : "팩 삭제"}
              </button>
            </div>
          </div>
        </Portal>
      )}

      {confirmDeletePackId && (
        <ConfirmDialog
          title="삭제할까요?"
          message="휴지통으로 옮겨져서 설정 > 휴지통에서 복구할 수 있어요. 폴더면 안의 팩/폴더도 함께 옮겨져요."
          confirmLabel="삭제"
          tone="danger"
          onCancel={() => setConfirmDeletePackId(null)}
          onConfirm={() => {
            onDeletePackEntry(confirmDeletePackId);
            setConfirmDeletePackId(null);
          }}
        />
      )}
    </div>
  );
}
