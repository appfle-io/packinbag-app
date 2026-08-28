"use client";

import Portal from "@/components/Portal";
import { useMemo, useState } from "react";
import { IconX, IconPlus, IconFolder, IconChevronRight, IconChevronDown } from "@tabler/icons-react";
import { Pack, ListSortOption } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/contexts/AuthProvider";
import { arrangeList } from "@/lib/listSort";
import { collectDescendantPackIds } from "@/lib/packsService";
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

  const allFolderIds = useMemo(() => {
    return libraryPacks.filter((p) => p.type === "folder").map((p) => p.id);
  }, [libraryPacks]);

  const areAllExpanded = allFolderIds.length > 0 && allFolderIds.every((id) => expandedFolderIds.has(id));

  const toggleExpandAll = () => {
    if (areAllExpanded) {
      setExpandedFolderIds(new Set());
    } else {
      setExpandedFolderIds(new Set(allFolderIds));
    }
  };

  const allSelectablePackIds = useMemo(() => {
    return libraryPacks.filter((p) => p.type !== "folder").map((p) => p.id);
  }, [libraryPacks]);

  const areAllSelected =
    allSelectablePackIds.length > 0 && allSelectablePackIds.every((id) => selected.has(id));

  const toggleSelectAll = () => {
    if (areAllSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allSelectablePackIds));
    }
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs transition-opacity"
        style={{ zIndex: ambientLayer + POPOVER_OFFSET }}
        onClick={onClose}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg rounded-2xl bg-surface border border-border flex flex-col gap-3.5 shadow-2xl max-h-[88vh] p-4 sm:p-5 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-[16px] font-bold text-foreground">팩 불러오기</h2>
              <p className="text-[11.5px] text-text-muted">보관함에서 가방에 담을 팩을 선택하세요</p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-text-muted hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer"
              aria-label="닫기"
            >
              <IconX size={18} />
            </button>
          </div>

          {/* 검색창 */}
          <div className="relative shrink-0">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="팩 또는 폴더 이름 검색"
              className="w-full rounded-xl border border-border bg-surface-2/60 hover:bg-surface-2 focus:bg-surface px-3.5 py-2.5 text-[13px] text-foreground outline-none transition-all placeholder:text-text-muted focus:border-accent"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-foreground cursor-pointer"
                aria-label="검색어 지우기"
              >
                <IconX size={14} />
              </button>
            )}
          </div>

          {/* 상단 컨트롤 툴바 (폴더 및 선택 일괄 조작) */}
          {!q && allFolderIds.length > 0 && (
            <div className="flex items-center justify-between px-1 text-[11.5px] text-text-muted shrink-0">
              <button
                type="button"
                onClick={toggleExpandAll}
                className="hover:text-foreground transition-colors cursor-pointer"
              >
                {areAllExpanded ? "폴더 모두 접기" : "폴더 모두 펼치기"}
              </button>

              <button
                type="button"
                onClick={toggleSelectAll}
                className="hover:text-foreground transition-colors cursor-pointer"
              >
                {areAllSelected ? "전체 선택 해제" : "전체 선택"}
              </button>
            </div>
          )}

          {/* 팩 & 폴더 리스트 목록 */}
          <div className="flex flex-col gap-1 overflow-y-auto scrollbar-thin flex-1 min-h-[240px] max-h-[440px] pr-1 divide-y divide-border/30">
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
                    className="flex items-center gap-2.5 rounded-xl py-2 px-2.5 transition-colors bg-surface-2/40 hover:bg-surface-2/70 my-0.5"
                    style={{
                      paddingLeft: 10 + depth * 18,
                    }}
                  >
                    {!q && (
                      <button
                        type="button"
                        onClick={() => toggleFolderExpanded(entry.id)}
                        className="shrink-0 p-1 -m-1 text-text-muted hover:text-foreground cursor-pointer transition-transform"
                        aria-label="폴더 접기/펼치기"
                      >
                        {isExpanded ? (
                          <IconChevronDown size={16} stroke={2.2} />
                        ) : (
                          <IconChevronRight size={16} stroke={2.2} />
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
                      className="h-4 w-4 rounded shrink-0 accent-accent cursor-pointer"
                    />

                    <div
                      onClick={() => toggleFolderExpanded(entry.id)}
                      className="flex-1 min-w-0 flex items-center gap-2 cursor-pointer select-none"
                    >
                      <IconFolder size={16} className="text-text-secondary shrink-0" />
                      <span className="text-[13px] font-semibold text-foreground truncate">
                        {entry.name}
                      </span>
                      <span className="text-[11.5px] text-text-muted font-normal shrink-0">
                        ({childPackIds.length})
                      </span>
                    </div>
                  </div>
                );
              }

              // 실제 팩 (체크리스트 or 메모팩)
              return (
                <label
                  key={entry.id}
                  className={`flex items-start gap-3 rounded-xl py-2 px-2.5 cursor-pointer transition-colors my-0.5 select-none ${
                    selected.has(entry.id)
                      ? "bg-accent-soft/30 hover:bg-accent-soft/50"
                      : "hover:bg-surface-2/50"
                  }`}
                  style={{
                    paddingLeft: 12 + depth * 18,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(entry.id)}
                    onChange={() => togglePack(entry.id)}
                    className="h-4 w-4 rounded shrink-0 accent-accent mt-0.5 cursor-pointer"
                  />

                  <div className="flex-1 min-w-0 flex flex-col gap-0.5 overflow-hidden">
                    {/* 윗줄: 팩 제목 */}
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[13px] font-medium truncate ${
                          selected.has(entry.id) ? "text-accent font-semibold" : "text-foreground"
                        }`}
                      >
                        {entry.name}
                      </span>
                    </div>

                    {/* 아랫줄: 짐 요약 or 메모 미리보기 */}
                    <span className="text-[11px] text-text-muted truncate leading-tight">
                      {entry.kind === "editor"
                        ? entry.editorPreviewText || "메모"
                        : entry.items.length > 0
                        ? entry.items.map((i) => i.text).join(", ")
                        : "담긴 짐 없음"}
                    </span>
                  </div>
                </label>
              );
            })}

            {displayRows.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center text-text-muted gap-1">
                <p className="text-[13px] font-medium text-foreground">불러올 팩이 없어요</p>
                <p className="text-[11.5px]">검색어를 바꾸거나 아래에서 새 팩을 만들어보세요.</p>
              </div>
            )}
          </div>

          {/* 모달 하단 액션 바 */}
          <div className="flex items-center justify-between pt-3 border-t border-border shrink-0">
            <button
              type="button"
              onClick={() => {
                onCreateNew();
                onClose();
              }}
              className="flex items-center gap-1.5 text-[12.5px] font-medium text-text-secondary hover:text-foreground px-2 py-1.5 rounded-lg hover:bg-surface-2 transition-colors cursor-pointer"
            >
              <IconPlus size={15} stroke={2} />
              <span>새 팩 만들기</span>
            </button>

            <button
              type="button"
              onClick={handleImport}
              disabled={selected.size === 0}
              className={`rounded-xl px-5 py-2.5 text-[13px] font-semibold transition-all cursor-pointer shadow-xs ${
                selected.size > 0
                  ? "bg-accent text-white hover:bg-accent-hover"
                  : "bg-surface-2 text-text-muted cursor-not-allowed opacity-60"
              }`}
            >
              불러오기{selected.size > 0 ? ` (${selected.size}개)` : ""}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
