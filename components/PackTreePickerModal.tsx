"use client";

import { useMemo, useState } from "react";
import {
  IconX,
  IconFolder,
  IconChevronRight,
  IconChevronDown,
  IconCheck,
  IconSearch,
} from "@tabler/icons-react";
import { Pack, ListSortOption } from "@/lib/types";
import { useAuth } from "@/contexts/AuthProvider";
import { arrangeList } from "@/lib/listSort";
import { collectDescendantPackIds } from "@/lib/packsService";
import { useOverlayLayer, POPOVER_OFFSET } from "@/lib/overlayLayer";
import { useEscapeToClose } from "@/lib/useEscapeToClose";
import Portal from "./Portal";

type TreeRow = { entry: Pack; depth: number };

function buildPackRows(
  allPacks: Pack[],
  parentId: string | undefined,
  depth: number,
  expandedIds: Set<string>,
  sortBy: ListSortOption | undefined,
  pinnedIds: string[],
  orderByParent: Record<string, string[]> | undefined
): TreeRow[] {
  const siblings = allPacks.filter((p) => (p.parentId ?? undefined) === parentId);
  const parentKey = parentId ?? "root";
  const order = orderByParent?.[parentKey] ?? [];
  const arranged = arrangeList(siblings, { sortBy, pinnedIds, order, maxPinned: Infinity });
  const rows: TreeRow[] = [];
  for (const entry of arranged) {
    rows.push({ entry, depth });
    if (entry.type === "folder" && expandedIds.has(entry.id)) {
      rows.push(
        ...buildPackRows(
          allPacks,
          entry.id,
          depth + 1,
          expandedIds,
          sortBy,
          pinnedIds,
          orderByParent
        )
      );
    }
  }
  return rows;
}

export default function PackTreePickerModal({
  allPacks,
  selectablePacks,
  selectedPackIds,
  onSelectPack,
  onClose,
}: {
  allPacks: Pack[];
  selectablePacks: Pack[];
  selectedPackIds: string[];
  selectionMode?: "single" | "multi";
  onSelectPack: (packIds: string[]) => void;
  onClose: () => void;
}) {
  const { profile } = useAuth();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedPackIds));
  const ambientLayer = useOverlayLayer();
  useEscapeToClose(onClose);

  const packMap = useMemo(() => {
    const map = new Map<string, Pack>();
    allPacks.forEach((p) => map.set(p.id, p));
    selectablePacks.forEach((p) => map.set(p.id, p));
    return map;
  }, [allPacks, selectablePacks]);

  const allFolderIds = useMemo(
    () => allPacks.filter((p) => p.type === "folder").map((p) => p.id),
    [allPacks]
  );

  // 기본적으로 모든 폴더를 펼친 상태로 시작하여 한눈에 모든 팩을 탐색 가능
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(
    () => new Set(allFolderIds)
  );

  const getPackPath = (packId: string): string => {
    const p = packMap.get(packId);
    if (!p) return "팩";
    const parts: string[] = [];
    let cur = p.parentId ? packMap.get(p.parentId) : undefined;
    const visited = new Set<string>();
    while (cur && !visited.has(cur.id)) {
      visited.add(cur.id);
      parts.unshift(cur.name || "폴더");
      cur = cur.parentId ? packMap.get(cur.parentId) : undefined;
    }
    return parts.length > 0 ? `${parts.join(" > ")} > ${p.name || "팩"}` : p.name || "팩";
  };

  const toggleFolderExpanded = (folderId: string) => {
    setExpandedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const getDescendantPackIds = (folderId: string): string[] => {
    const descendantIds = collectDescendantPackIds(allPacks, folderId);
    const selectableSet = new Set(selectablePacks.map((p) => p.id));
    return allPacks
      .filter((p) => p.type !== "folder" && descendantIds.includes(p.id) && selectableSet.has(p.id))
      .map((p) => p.id);
  };

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

  const handlePackClick = (packId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(packId)) next.delete(packId);
      else next.add(packId);
      return next;
    });
  };

  const removeSelectedPack = (packId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(packId);
      return next;
    });
  };

  const q = query.trim().toLowerCase();

  const treeRows = useMemo(() => {
    return buildPackRows(
      allPacks,
      undefined,
      0,
      expandedFolderIds,
      profile?.packSortBy ?? "createdAt",
      profile?.pinnedPackIds ?? [],
      profile?.packOrderByParent
    );
  }, [allPacks, expandedFolderIds, profile]);

  const displayRows = useMemo(() => {
    if (!q) return treeRows;
    const matching = allPacks.filter((p) => p.name.toLowerCase().includes(q));
    return matching.map((entry) => ({ entry, depth: 0 }));
  }, [treeRows, q, allPacks]);

  const areAllExpanded = allFolderIds.length > 0 && allFolderIds.every((id) => expandedFolderIds.has(id));

  const toggleExpandAll = () => {
    if (areAllExpanded) {
      setExpandedFolderIds(new Set());
    } else {
      setExpandedFolderIds(new Set(allFolderIds));
    }
  };

  const handleConfirm = () => {
    onSelectPack(Array.from(selected));
    onClose();
  };

  const selectedArray = Array.from(selected);

  return (
    <Portal>
      <div
        className="fixed inset-0 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs transition-opacity"
        style={{ zIndex: ambientLayer + POPOVER_OFFSET + 10 }}
        onClick={onClose}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-2xl bg-surface border border-border flex flex-col gap-3 shadow-2xl max-h-[85vh] p-4 sm:p-5 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-[16px] font-bold text-foreground">
                담을 팩 선택
              </h2>
              <p className="text-[11.5px] text-text-muted">
                아래 트리에서 담고 싶은 팩들을 체크하세요
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-text-muted hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer"
              aria-label="닫기"
            >
              <IconX size={18} />
            </button>
          </div>

          {/* 선택된 팩 실시간 칩 영역 (어떤 게 추가되었는지 한눈에 직관적으로 확인) */}
          {selectedArray.length > 0 ? (
            <div className="flex flex-col gap-1.5 p-2 rounded-xl bg-surface-2/50 border border-border/80 shrink-0">
              <div className="flex items-center justify-between text-[11.5px]">
                <span className="font-semibold text-accent">
                  선택된 팩 ({selectedArray.length}개)
                </span>
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className="text-text-muted hover:text-danger transition-colors cursor-pointer"
                >
                  모두 해제
                </button>
              </div>
              <div className="flex flex-wrap gap-1 max-h-[76px] overflow-y-auto scrollbar-thin pr-0.5">
                {selectedArray.map((id) => (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-surface border border-accent/30 text-[11.5px] font-medium text-foreground shadow-2xs"
                  >
                    <span className="truncate max-w-[170px]" title={getPackPath(id)}>
                      {getPackPath(id)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeSelectedPack(id)}
                      className="p-0.5 -mr-0.5 rounded text-text-muted hover:text-danger cursor-pointer"
                      aria-label="선택 해제"
                    >
                      <IconX size={11} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="px-3 py-2 rounded-xl bg-surface-2/30 border border-dashed border-border text-[12px] text-text-muted text-center shrink-0">
              선택된 팩이 없어요. 아래 목록에서 체크해 주세요.
            </div>
          )}

          {/* 검색창 */}
          <div className="relative shrink-0">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="팩 또는 폴더 이름 검색"
              className="w-full rounded-xl border border-border bg-surface-2/60 hover:bg-surface-2 focus:bg-surface px-3.5 py-2 text-[13px] text-foreground outline-none transition-all placeholder:text-text-muted focus:border-accent"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-foreground cursor-pointer"
                aria-label="검색어 지우기"
              >
                <IconX size={14} />
              </button>
            ) : (
              <IconSearch
                size={15}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
              />
            )}
          </div>

          {/* 상단 컨트롤 툴바 */}
          {!q && allFolderIds.length > 0 && (
            <div className="flex items-center justify-between px-1 text-[11.5px] text-text-muted shrink-0">
              <button
                type="button"
                onClick={toggleExpandAll}
                className="hover:text-foreground transition-colors cursor-pointer"
              >
                {areAllExpanded ? "폴더 모두 접기" : "폴더 모두 펼치기"}
              </button>
            </div>
          )}

          {/* 팩 & 폴더 트리 목록 (세로 스크롤 영역) */}
          <div className="flex flex-col gap-0.5 overflow-y-auto scrollbar-thin flex-1 min-h-[220px] max-h-[360px] pr-1 divide-y divide-border/20 border-y border-border/40 py-1">
            {displayRows.length === 0 && (
              <div className="py-12 text-center text-[13px] text-text-muted">
                표시할 팩이나 폴더가 없어요
              </div>
            )}
            {displayRows.map(({ entry, depth }) => {
              const isFolder = entry.type === "folder";

              if (isFolder) {
                const childPackIds = getDescendantPackIds(entry.id);
                const isExpanded = expandedFolderIds.has(entry.id);
                const isChecked =
                  childPackIds.length > 0 &&
                  childPackIds.every((id) => selected.has(id));
                const isPartiallyChecked =
                  !isChecked && childPackIds.some((id) => selected.has(id));

                return (
                  <div
                    key={entry.id}
                    className="flex items-center gap-2 rounded-xl py-1.5 px-2 transition-colors bg-surface-2/30 hover:bg-surface-2/60 my-0.5"
                    style={{ paddingLeft: 8 + depth * 16 }}
                  >
                    {!q && (
                      <button
                        type="button"
                        onClick={() => toggleFolderExpanded(entry.id)}
                        className="shrink-0 p-1 -m-1 text-text-muted hover:text-foreground cursor-pointer"
                        aria-label="폴더 접기/펼치기"
                      >
                        {isExpanded ? (
                          <IconChevronDown size={15} />
                        ) : (
                          <IconChevronRight size={15} />
                        )}
                      </button>
                    )}
                    <IconFolder size={16} className="shrink-0 text-accent/80" />
                    <button
                      type="button"
                      onClick={() => toggleFolderExpanded(entry.id)}
                      className="flex-1 text-left min-w-0 font-medium text-[13px] text-foreground truncate cursor-pointer"
                    >
                      {entry.name || "폴더"}
                    </button>
                    {childPackIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleFolderSelect(entry.id)}
                        className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                          isChecked
                            ? "bg-accent border-accent text-white"
                            : isPartiallyChecked
                            ? "bg-accent/20 border-accent text-accent"
                            : "border-border hover:border-text-secondary bg-surface"
                        }`}
                        aria-label="폴더 내 팩 전체 선택"
                        title="폴더 내 팩 전체 선택"
                      >
                        {isChecked && <IconCheck size={12} stroke={3} />}
                        {isPartiallyChecked && (
                          <div className="w-1.5 h-1.5 rounded-xs bg-accent" />
                        )}
                      </button>
                    )}
                  </div>
                );
              }

              // 실제 팩 항목
              const isSelected = selected.has(entry.id);

              return (
                <div
                  key={entry.id}
                  onClick={() => handlePackClick(entry.id)}
                  className={`flex items-center gap-2.5 rounded-xl py-2 px-2.5 transition-colors cursor-pointer my-0.5 ${
                    isSelected
                      ? "bg-accent/10 text-foreground font-semibold"
                      : "hover:bg-surface-2 text-foreground"
                  }`}
                  style={{ paddingLeft: 12 + depth * 16 }}
                >
                  <div
                    className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                      isSelected
                        ? "bg-accent border-accent text-white"
                        : "border-border hover:border-text-secondary bg-surface"
                    }`}
                  >
                    {isSelected && <IconCheck size={12} stroke={3} />}
                  </div>
                  <span className="flex-1 text-[13.5px] truncate">
                    {entry.name || "팩"}
                  </span>
                </div>
              );
            })}
          </div>

          {/* 푸터 */}
          <div className="pt-2 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-[13px] text-text-secondary hover:text-foreground transition-colors cursor-pointer"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-4 py-2 rounded-xl text-[13px] font-medium bg-accent text-white hover:opacity-90 transition-opacity cursor-pointer"
            >
              선택 완료 ({selected.size}개)
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
