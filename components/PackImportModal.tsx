"use client";

import Portal from "@/components/Portal";
import { useMemo, useState } from "react";
import { IconX, IconPlus, IconFolder, IconChevronRight, IconChevronDown } from "@tabler/icons-react";
import { Pack, ListSortOption } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/contexts/AuthProvider";
import { arrangeList } from "@/lib/listSort";
import { collectDescendantPackIds } from "@/lib/packsService";
import PackColorDot from "@/components/PackColorDot";
import { useOverlayLayer, POPOVER_OFFSET } from "@/lib/overlayLayer";
import { useEscapeToClose } from "@/lib/useEscapeToClose";

function cloneAsNewPack(pack: Pack): Pack {
  return {
    ...pack,
    id: `pack-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    savedAsLibraryPack: true,
    linkedLibraryPackId: pack.id,
    linkedLibraryUpdatedAt: pack.updatedAt,
    items: pack.items.map((item) => ({
      ...item,
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      dueDate: undefined,
    })),
  };
}

type ImportTreeRow = { entry: Pack; depth: number };

function buildPackRows(
  allPacks: Pack[],
  parentId: string | undefined,
  depth: number,
  expandedIds: Set<string>,
  sortBy: ListSortOption | undefined,
  pinnedIds: string[],
  orderByParent: Record<string, string[]> | undefined
): ImportTreeRow[] {
  const siblings = allPacks.filter((p) => (p.parentId ?? undefined) === parentId);
  const parentKey = parentId ?? "root";
  const order = orderByParent?.[parentKey] ?? [];
  const arranged = arrangeList(siblings, { sortBy, pinnedIds, order, maxPinned: Infinity });
  const rows: ImportTreeRow[] = [];
  for (const entry of arranged) {
    rows.push({ entry, depth });
    if (entry.type === "folder" && expandedIds.has(entry.id)) {
      rows.push(...buildPackRows(allPacks, entry.id, depth + 1, expandedIds, sortBy, pinnedIds, orderByParent));
    }
  }
  return rows;
}

export default function PackImportModal({
  libraryPacks,
  onClose,
  onImport,
  onCreateNew,
}: {
  libraryPacks: Pack[];
  onClose: () => void;
  onImport: (packs: Pack[]) => void;
  onCreateNew: () => void;
}) {
  const { profile } = useAuth();
  const { show } = useToast();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const ambientLayer = useOverlayLayer();
  useEscapeToClose(onClose);

  // 폴더 펼침 상태 (기본값: 모두 접힘)
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());

  const toggleFolderExpanded = (folderId: string) => {
    setExpandedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  // 특정 폴더 하위의 모든 비-폴더(실제 팩) ID 수집
  const getDescendantPackIds = (folderId: string): string[] => {
    const descendantIds = collectDescendantPackIds(libraryPacks, folderId);
    return libraryPacks
      .filter((p) => p.type !== "folder" && descendantIds.includes(p.id))
      .map((p) => p.id);
  };

  // 폴더 토글: 하위 팩들이 모두 선택되어 있으면 전체 해제, 아니면 전체 선택
  const toggleFolderSelect = (folderId: string) => {
    const childPackIds = getDescendantPackIds(folderId);
    if (childPackIds.length === 0) return;
    const allSelected = childPackIds.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        childPackIds.forEach((id) => next.delete(id));
      } else {
        childPackIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  // 개별 팩 토글
  const togglePack = (packId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(packId)) next.delete(packId);
      else next.add(packId);
      return next;
    });
  };

  const q = query.trim().toLowerCase();

  // 팩 보관함 트리 순서대로 평평한 행 생성
  const treeRows = useMemo(() => {
    return buildPackRows(
      libraryPacks,
      undefined,
      0,
      expandedFolderIds,
      profile?.packSortBy ?? "createdAt",
      profile?.pinnedPackIds ?? [],
      profile?.packOrderByParent
    );
  }, [libraryPacks, expandedFolderIds, profile]);

  // 검색어 적용 필터
  const displayRows = useMemo(() => {
    if (!q) return treeRows;
    const matching = libraryPacks.filter((p) => p.name.toLowerCase().includes(q));
    return matching.map((entry) => ({ entry, depth: 0 }));
  }, [treeRows, q, libraryPacks]);

  const handleImport = () => {
    // 팩 보관함 트리 순서 기준으로 선택된 팩만 정밀 정렬
    const allFolderSet = new Set(libraryPacks.filter((p) => p.type === "folder").map((p) => p.id));
    const fullTreeRows = buildPackRows(
      libraryPacks,
      undefined,
      0,
      allFolderSet,
      profile?.packSortBy ?? "createdAt",
      profile?.pinnedPackIds ?? [],
      profile?.packOrderByParent
    );
    const orderedSelectedPackIds = fullTreeRows
      .map((r) => r.entry)
      .filter((p) => p.type !== "folder" && selected.has(p.id))
      .map((p) => p.id);

    // 혹시 트리에 안 나타났던 팩이 있다면 추가
    const remainingSelectedIds = Array.from(selected).filter((id) => !orderedSelectedPackIds.includes(id));
    const finalPackIds = [...orderedSelectedPackIds, ...remainingSelectedIds];

    const packsToImport = finalPackIds
      .map((id) => libraryPacks.find((p) => p.id === id))
      .filter((p): p is Pack => !!p && p.type !== "folder")
      .map(cloneAsNewPack);

    onImport(packsToImport);
    onClose();
    show(
      packsToImport.length > 1
        ? `팩 ${packsToImport.length}개를 가방에 추가했어요`
        : "팩을 가방에 추가했어요"
    );
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 flex items-center justify-center p-4"
        style={{ zIndex: ambientLayer + POPOVER_OFFSET, background: "rgba(0,0,0,0.45)" }}
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-2xl bg-surface p-4 flex flex-col gap-3 shadow-xl max-h-[85vh]"
        >
          <div className="flex items-center justify-between shrink-0">
            <span className="text-[16px] font-bold">팩 불러오기</span>
            <button onClick={onClose} aria-label="닫기">
              <IconX size={18} stroke={1.75} color="var(--text-secondary)" />
            </button>
          </div>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="팩 또는 폴더 이름 검색"
            className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none shrink-0"
          />

          <div className="flex flex-col gap-1 overflow-y-auto scrollbar-thin flex-1 min-h-[220px] max-h-[420px] pr-1">
            {displayRows.map(({ entry, depth }) => {
              const isFolder = entry.type === "folder";
              if (isFolder) {
                const childPackIds = getDescendantPackIds(entry.id);
                const isExpanded = expandedFolderIds.has(entry.id);
                const isChecked = childPackIds.length > 0 && childPackIds.every((id) => selected.has(id));
                const isPartiallyChecked =
                  !isChecked && childPackIds.some((id) => selected.has(id));

                return (
                  <div
                    key={entry.id}
                    className="flex items-center gap-2 rounded-lg p-2 transition-colors"
                    style={{
                      paddingLeft: 10 + depth * 14,
                      background: depth === 0 ? "var(--surface-2)" : "transparent",
                      borderLeft: depth > 0 ? "2px solid var(--border)" : undefined,
                      marginLeft: depth > 0 ? 6 : 0,
                    }}
                  >
                    {!q && (
                      <button
                        onClick={() => toggleFolderExpanded(entry.id)}
                        className="shrink-0 -m-1 p-1 text-text-muted hover:text-text-primary"
                        aria-label="폴더 접기/펼치기"
                      >
                        {isExpanded ? (
                          <IconChevronDown size={15} stroke={2} />
                        ) : (
                          <IconChevronRight size={15} stroke={2} />
                        )}
                      </button>
                    )}
                    <input
                      type="checkbox"
                      checked={isChecked}
                      ref={(el) => {
                        if (el) el.indeterminate = isPartiallyChecked;
                      }}
                      onChange={() => toggleFolderSelect(entry.id)}
                      className="h-4 w-4 shrink-0 accent-[var(--accent)] cursor-pointer"
                    />
                    <div
                      onClick={() => toggleFolderSelect(entry.id)}
                      className="flex-1 min-w-0 flex items-center gap-2 cursor-pointer"
                    >
                      <IconFolder size={16} stroke={1.75} color="var(--text-secondary)" className="shrink-0" />
                      <div className="min-w-0 flex-1 flex items-baseline gap-1.5 overflow-hidden">
                        <span className="text-[13px] font-semibold text-text-primary shrink-0">
                          {entry.name}
                        </span>
                        <span className="text-[11px] text-text-muted truncate">
                          하위 팩 {childPackIds.length}개 전체 선택
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <label
                  key={entry.id}
                  className="flex items-center gap-2 rounded-lg p-2 cursor-pointer hover:bg-black/5"
                  style={{
                    paddingLeft: 10 + depth * 14,
                    background: depth === 0 ? "var(--surface-2)" : "transparent",
                    borderLeft: depth > 0 ? "2px solid var(--border)" : undefined,
                    marginLeft: depth > 0 ? 6 : 0,
                  }}
                >
                  {!q && <span className="shrink-0" style={{ width: 15 }} />}
                  <input
                    type="checkbox"
                    checked={selected.has(entry.id)}
                    onChange={() => togglePack(entry.id)}
                    className="h-4 w-4 shrink-0 accent-[var(--accent)]"
                  />
                  <PackColorDot colorId={entry.color} onChange={() => {}} />
                  <div className="flex-1 min-w-0 flex items-baseline gap-1.5 overflow-hidden">
                    <span className="text-[12.5px] font-medium shrink-0">
                      {entry.name}
                    </span>
                    <span className="text-[11px] text-text-secondary truncate">
                      {entry.kind === "editor"
                        ? entry.editorPreviewText || "메모 팩"
                        : entry.items.length > 0
                        ? entry.items.map((i) => i.text).join(", ")
                        : "항목 없음"}
                    </span>
                  </div>
                </label>
              );
            })}
            {displayRows.length === 0 && (
              <p className="text-[12px] text-text-muted py-8 text-center">
                보관함에 불러올 팩이 없거나 검색 결과가 없어요.
              </p>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border shrink-0">
            <button
              onClick={() => {
                onCreateNew();
                onClose();
              }}
              className="flex items-center gap-1.5 text-[13px] font-medium text-text-secondary hover:text-text-primary px-1 py-1"
            >
              <IconPlus size={15} stroke={1.75} />
              새 팩 만들기
            </button>

            <button
              onClick={handleImport}
              disabled={selected.size === 0}
              className="rounded-xl px-5 py-2 text-[13.5px] font-semibold transition-all"
              style={{
                background: selected.size > 0 ? "var(--accent)" : "var(--surface-2)",
                color: selected.size > 0 ? "#fff" : "var(--text-muted)",
              }}
            >
              불러오기{selected.size > 0 ? ` (${selected.size})` : ""}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
