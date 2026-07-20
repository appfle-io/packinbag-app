"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  IconPlus,
  IconFolderPlus,
  IconFolder,
  IconTrash,
  IconCheck,
  IconSearch,
  IconX,
  IconChevronRight,
  IconChevronDown,
  IconPin,
  IconPinFilled,
  IconEdit,
  IconArrowRight,
  IconNotes,
} from "@tabler/icons-react";
import { Pack, ListSortOption, Bag } from "@/lib/types";
import { useAuth } from "@/contexts/AuthProvider";
import { arrangeList } from "@/lib/listSort";
import { searchLibraryPacks, PackSearchResult } from "@/lib/librarySearch";
import { collectDescendantPackIds } from "@/lib/packsService";
import { findLinkedBagPackRefs } from "@/lib/packSync";
import PackColorDot from "@/components/PackColorDot";
import SortSelect from "@/components/SortSelect";
import QuickPackBar from "@/components/QuickPackBar";
import NotificationBell from "@/components/NotificationBell";
import ConfirmDialog from "@/components/ConfirmDialog";
import Portal from "@/components/Portal";
import { useToast } from "@/components/Toast";

const LONG_PRESS_MS = 400;
const MOVE_CANCEL_PX = 10;
const DRAG_START_PX = 6; // 롱프레스로 "집어든" 뒤 이만큼 더 움직여야 진짜 드래그로 전환

// v68: 팩 보관함이 그리드(PackTile)에서 아이폰 메모 스타일의 폴더 트리로 바뀌었다.
// 폴더도 그냥 Pack 문서다(type: "folder", items: []) - parentId로 트리를 표현한다.
// 화면에 실제로 그릴 한 줄(행)을 "팩/폴더 항목" 또는 "이 레벨에 새로 추가하기" 두 종류로
// 나눈 뒤, 트리를 재귀로 펼쳐서 평평한 배열로 만들어 렌더링한다(가상 스크롤 없이도
// 개인 라이브러리 규모에서는 충분히 가볍다).
type TreeRow =
  | { kind: "entry"; entry: Pack; depth: number }
  | { kind: "add"; parentId: string | undefined; depth: number };

function buildRows(
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
  // 팩은 v69부터 고정핀 개수 제한이 없어서(무제한) maxPinned로 Infinity를 넘긴다.
  const arranged = arrangeList(siblings, { sortBy, pinnedIds, order, maxPinned: Infinity });
  const rows: TreeRow[] = [];
  for (const entry of arranged) {
    rows.push({ kind: "entry", entry, depth });
    if (entry.type === "folder" && expandedIds.has(entry.id)) {
      rows.push(...buildRows(allPacks, entry.id, depth + 1, expandedIds, sortBy, pinnedIds, orderByParent));
    }
  }
  return rows;
}

export default function PacksScreen({
  uid,
  packs,
  bags,
  quickPack,
  onOpenPack,
  onOpenBag,
  onNewPack,
  onNewFolder,
  onRenameEntry,
  onChangeColor,
  onMoveEntries,
  onBack,
  onBulkDeletePacks,
}: {
  // 빠른팩(quickPack)은 이 배열에 이미 섞여있을 수 있어서, 트리를 그리기 전에 걸러낸다 -
  // 빠른팩은 트리가 아니라 하단 QuickPackBar 전용 자리에서만 보여준다.
  uid: string;
  packs: Pack[];
  // 가방 보관함과 동일한 범위로 검색하기 위해 넘겨받는다(가방 이름/속 팩/짐까지 검색 대상).
  bags: Bag[];
  quickPack?: Pack;
  // focusItemId가 있으면 팩을 연 뒤 그 짐까지 자동 스크롤 + 하이라이트한다.
  onOpenPack: (pack: Pack, focusItemId?: string) => void;
  // 검색 결과가 가방(속 팩/짐)일 때 그 가방을 열면서 해당 팩/짐까지 이동한다.
  onOpenBag: (bag: Bag, focus?: { packId?: string; itemId?: string }) => void;
  // parentId를 넘기면 그 폴더 바로 안에 새 팩/폴더를 만든다(없으면 최상위). kind를 "editor"로
  // 넘기면 체크리스트 팩이 아니라 아이폰 메모처럼 자유문서형인 에디터팩을 만든다(없으면 "checklist").
  onNewPack: (parentId?: string, kind?: "checklist" | "editor") => void;
  onNewFolder: (parentId?: string) => void;
  // 트리 행에서 이름을 바꿀 때(폴더는 편집 화면이 없어서 이 경로가 유일한 이름 변경 수단).
  onRenameEntry: (pack: Pack, name: string) => void;
  onChangeColor: (pack: Pack, colorId: string | undefined) => void;
  // 다중선택 후 "이동" 액션, 그리고 드래그로 다른 폴더에 떨어뜨렸을 때도 이 콜백을 쓴다.
  // 선택된 id들을 parentId(없으면 최상위)로 옮긴다.
  onMoveEntries: (packIds: string[], parentId: string | undefined) => void;
  // v68: 이 화면은 탭이 아니라 가방보관함에서 스와이프로 열리는 풀스크린 화면이라 뒤로가기 버튼이 필요하다.
  onBack: () => void;
  // 길게 눌러 다중선택한 팩/폴더를 한꺼번에 삭제(폴더는 재귀적으로). alsoDeleteFromBags가
  // true면 가방 속에 연결된 사본도 함께 삭제해달라는 뜻(아래 확인창의 체크박스).
  onBulkDeletePacks: (packIds: string[], alsoDeleteFromBags?: boolean) => void;
}) {
  const {
    profile,
    updatePackSortBy,
    togglePackPinned,
    updatePackOrderByParent,
    updateExpandedPackFolderIds,
  } = useAuth();
  const { show } = useToast();
  // 패 보관함은 가방보관함에서 왼→우 스와이프로 열리므로(AppShell의 handleSwipeGestureEnd),
  // 닫을 때는 반대로 우→왼로 쓰는 것이 즐기는 방향과 자연스럽게 이어진다. useSwipeBack(왼엣지리
  // 오른쪽 스와이프 전용)을 그대로 쓰지 않고, 전체 화면 어디서든(드래그/버튼 제외) 왼쪽으로
  // 밀면 뒤로가기를 직접 구현한다.
  const swipeStartRef = useRef<{ x: number; y: number; ignore: boolean } | null>(null);
  const isSwipeIgnoredTarget = (target: EventTarget | null) =>
    !!(target as HTMLElement)?.closest?.('button, a, input, textarea, [role="button"], [data-row-id], .fixed');
  const handleRootPointerDown = (e: React.PointerEvent) => {
    swipeStartRef.current = { x: e.clientX, y: e.clientY, ignore: isSwipeIgnoredTarget(e.target) };
  };
  const handleRootPointerUp = (e: React.PointerEvent) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start || start.ignore) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0) onBack();
  };
  const sortBy = profile?.packSortBy ?? "createdAt";
  const pinnedIds = profile?.pinnedPackIds ?? [];
  const treePacks = packs.filter((p) => !p.isQuickPack);
  const pinnedSet = new Set(pinnedIds);

  // 폴더 펼침/접힘 상태. 계정(profile.expandedPackFolderIds)에 저장되어 기기 간에도 동일하게
  // 유지된다. profile 값을 로컬로 미러링해서 즉시 반응(낙관적 UI)하고, 다른 기기/화면에서
  // 값이 바뀌면 따라간다(QuickPackBar의 quickPackCollapsed와 동일한 패턴).
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(profile?.expandedPackFolderIds ?? [])
  );
  useEffect(() => {
    setExpandedIds(new Set(profile?.expandedPackFolderIds ?? []));
  }, [profile?.expandedPackFolderIds]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      updateExpandedPackFolderIds(Array.from(next)).catch(() => {
        show("펼침 상태를 저장하지 못했어요");
      });
      return next;
    });
  };

  // 상단 전체펼치기/전체접기 - 가방 속(BagEditorScreen)에서 이미 쓰는 패턴을 그대로 가져온다: 버튼 하나가
  // 상태에 따라 아이콘만 바뀜다(IconChevronDown/IconChevronRight, 단일 토글). 폴더가
  // 하나도 없으면 의미가 없으니 그때는 버튼 자체를 숨긴다.
  const allFolderIds = useMemo(
    () => treePacks.filter((p) => p.type === "folder").map((p) => p.id),
    [treePacks]
  );
  const allFoldersCollapsed =
    allFolderIds.length > 0 && allFolderIds.every((id) => !expandedIds.has(id));
  const expandAllFolders = () => {
    const next = new Set(allFolderIds);
    setExpandedIds(next);
    updateExpandedPackFolderIds(Array.from(next)).catch(() => {
      show("펼침 상태를 저장하지 못했어요");
    });
  };
  const collapseAllFolders = () => {
    setExpandedIds(new Set());
    updateExpandedPackFolderIds([]).catch(() => {
      show("펼침 상태를 저장하지 못했어요");
    });
  };

  // --- 검색 --------------------------------------------------------------
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 폴더는 items가 없어서(내용물이 아니라 껍데기) 검색 대상에서 제외한다 - 이름/짐 검색
  // 모두 실제 팩만 대상으로 한다.
  const searchablePacks = useMemo(() => {
    const realPacks = treePacks.filter((p) => p.type !== "folder");
    return quickPack ? [...realPacks, quickPack] : realPacks;
  }, [treePacks, quickPack]);

  const { results: searchResults, truncated: searchTruncated } = useMemo(
    () => searchLibraryPacks(searchablePacks, searchQuery, bags),
    [searchablePacks, searchQuery, bags]
  );

  const openSearch = () => {
    setSearchOpen(true);
    requestAnimationFrame(() => searchInputRef.current?.focus());
  };
  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");
  };
  const handleResultClick = (result: PackSearchResult) => {
    closeSearch();
    if (result.type === "bag" && result.bag) {
      onOpenBag(result.bag, { packId: result.packId, itemId: result.itemId });
      return;
    }
    if (result.pack) {
      onOpenPack(result.pack, result.itemId);
    }
  };

  // --- 길게 눌러 다중선택 / 드래그로 순서변경·폴더 이동 ------------------------
  // 롱프레스로 "집어든" 뒤(pickedIdRef) 그대로 놓으면 다중선택 진입(기존과 동일),
  // 그 상태에서 더 움직이면 실제 드래그로 전환되어(dragId) 순서변경/폴더 이동이 된다.
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStartRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const justLongPressedRef = useRef(false);
  const pickedIdRef = useRef<string | null>(null);
  const dragIdRef = useRef<string | null>(null);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showMoveSheet, setShowMoveSheet] = useState(false);
  const [renamingEntry, setRenamingEntry] = useState<Pack | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<{ id: string; zone: "before" | "after" | "into" } | null>(
    null
  );

  useEffect(() => {
    if (selectMode && selectedIds.size === 0) setSelectMode(false);
  }, [selectMode, selectedIds]);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const enterSelectMode = (id: string) => {
    setSelectMode(true);
    setSelectedIds(new Set([id]));
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const cancelSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  // 현재 좌표 아래 어떤 행이 있는지 찾아서 드롭 타겟/영역(위/아래/안쪽)을 계산한다.
  // 폴더 행의 세로 28~72% 구간에 놓으면 "그 폴더 안으로", 그 외(위/아래 절반)는 "그 옆에
  // 형제로 삽입"으로 판정한다.
  const updateDragOver = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y);
    const rowEl = (el as HTMLElement | null)?.closest?.("[data-row-id]") as HTMLElement | null;
    if (!rowEl) {
      setDragOver(null);
      return;
    }
    const overId = rowEl.getAttribute("data-row-id")!;
    if (overId === dragIdRef.current) {
      setDragOver(null);
      return;
    }
    // 자기 자신의 하위 폴더 위로는 드롭할 수 없다(순환 방지).
    if (dragIdRef.current && collectDescendantPackIds(treePacks, dragIdRef.current).includes(overId)) {
      setDragOver(null);
      return;
    }
    const rect = rowEl.getBoundingClientRect();
    const relY = (y - rect.top) / rect.height;
    const overEntry = treePacks.find((p) => p.id === overId);
    const isFolder = overEntry?.type === "folder";
    const zone: "before" | "after" | "into" =
      isFolder && relY > 0.28 && relY < 0.72 ? "into" : relY < 0.5 ? "before" : "after";
    setDragOver({ id: overId, zone });
  };

  // 드래그를 놓은 위치를 실제 이동/순서변경으로 반영한다.
  const commitDrop = (draggedId: string, over: { id: string; zone: "before" | "after" | "into" }) => {
    const dragged = treePacks.find((p) => p.id === draggedId);
    const overEntry = treePacks.find((p) => p.id === over.id);
    if (!dragged || !overEntry) return;

    const newParentId: string | undefined =
      over.zone === "into" && overEntry.type === "folder" ? overEntry.id : overEntry.parentId;

    const siblings = treePacks.filter(
      (p) => (p.parentId ?? undefined) === newParentId && p.id !== draggedId
    );
    let insertAt = over.zone === "into" ? siblings.length : siblings.findIndex((s) => s.id === over.id);
    if (over.zone === "after") insertAt += 1;
    if (insertAt < 0) insertAt = siblings.length;

    const newSiblingIds = siblings.map((s) => s.id);
    newSiblingIds.splice(insertAt, 0, draggedId);

    if ((dragged.parentId ?? undefined) !== newParentId) {
      onMoveEntries([draggedId], newParentId);
    }
    updatePackOrderByParent(newParentId ?? "root", newSiblingIds).catch(() => {
      show("순서를 저장하지 못했어요");
    });
  };

  const handleRowPointerDown = (id: string, e: React.PointerEvent) => {
    if (selectMode) return;
    // 핀/이름변경 등 행 안의 버튼에서 시작된 손가락은 롱프레스/드래그 대상이 아니다 -
    // 여기서 pointerCapture를 가져가면 그 버튼의 네이티브 click이 안 뜨서(핀이 변경되지 않는) 버그가 있었다.
    if ((e.target as HTMLElement).closest("button")) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const x = e.clientX;
    const y = e.clientY;
    longPressStartRef.current = { id, x, y };
    clearLongPressTimer();
    longPressTimerRef.current = setTimeout(() => {
      pickedIdRef.current = id; // 집어든 상태 - 다음 움직임에 따라 선택/드래그가 갈린다
    }, LONG_PRESS_MS);
  };

  const handleRowPointerMove = (e: React.PointerEvent) => {
    const start = longPressStartRef.current;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (!pickedIdRef.current) {
      // 아직 롱프레스가 확정되기 전 - 너무 많이 움직이면 아예 취소(스크롤 등으로 판단)
      if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) clearLongPressTimer();
      return;
    }
    if (!dragIdRef.current) {
      if (Math.hypot(dx, dy) > DRAG_START_PX) {
        dragIdRef.current = pickedIdRef.current;
        setDragId(pickedIdRef.current);
      } else {
        return;
      }
    }
    updateDragOver(e.clientX, e.clientY);
  };

  const handleRowPointerUp = () => {
    clearLongPressTimer();
    if (dragIdRef.current) {
      if (dragOver) commitDrop(dragIdRef.current, dragOver);
      dragIdRef.current = null;
      pickedIdRef.current = null;
      setDragId(null);
      setDragOver(null);
      justLongPressedRef.current = true; // 드래그 후 따라오는 클릭으로 화면이 안 열리게 함
      return;
    }
    if (pickedIdRef.current) {
      enterSelectMode(pickedIdRef.current);
      pickedIdRef.current = null;
      justLongPressedRef.current = true;
    }
  };

  const handleRowClick = (entry: Pack) => {
    // 롱프레스로 막 선택 모드에 들어가거나 드래그를 마친 직후, 손을 뗄 때 뒤따라오는 클릭
    // 이벤트를 무시한다 - 안 그러면 방금 선택된 항목이 바로 다시 해제되거나, 드래그로
    // 옮긴 항목이 열려버리는 오작동이 생긴다.
    if (justLongPressedRef.current) {
      justLongPressedRef.current = false;
      return;
    }
    if (selectMode) {
      toggleSelected(entry.id);
      return;
    }
    if (entry.type === "folder") {
      toggleExpanded(entry.id);
    } else {
      onOpenPack(entry);
    }
  };

  // 선택된 항목들(폴더면 하위 팩까지 포함)이 가방 속 어느 팩과라도 연결되어 있는지 확인해서,
  // 삭제 확인창에 "가방 속 사본도 함께 삭제" 체크박스를 보여줄지 결정한다.
  const linkedBagPackCount = useMemo(() => {
    const ids = new Set<string>();
    selectedIds.forEach((id) => {
      ids.add(id);
      collectDescendantPackIds(treePacks, id).forEach((d) => ids.add(d));
    });
    return findLinkedBagPackRefs(bags, ids).length;
  }, [selectedIds, treePacks, bags]);

  // --- 이동(다중선택 폴더 피커) -----------------------------------------------
  // 선택된 항목 본인 + 그 하위(자손) 폴더로는 이동할 수 없다(순환 방지).
  const moveBlockedIds = useMemo(() => {
    const blocked = new Set(selectedIds);
    selectedIds.forEach((id) => {
      collectDescendantPackIds(treePacks, id).forEach((d) => blocked.add(d));
    });
    return blocked;
  }, [selectedIds, treePacks]);

  const folderPickerRows = useMemo(() => {
    const allFolders = treePacks.filter((p) => p.type === "folder");
    const rows: { folder: Pack; depth: number }[] = [];
    const walk = (parentId: string | undefined, depth: number) => {
      allFolders
        .filter((f) => (f.parentId ?? undefined) === parentId)
        .filter((f) => !moveBlockedIds.has(f.id))
        .sort((a, b) => a.name.localeCompare(b.name, "ko"))
        .forEach((f) => {
          rows.push({ folder: f, depth });
          walk(f.id, depth + 1);
        });
    };
    walk(undefined, 0);
    return rows;
  }, [treePacks, moveBlockedIds]);

  const handleMoveTo = (parentId: string | undefined) => {
    onMoveEntries(Array.from(selectedIds), parentId);
    setShowMoveSheet(false);
    cancelSelectMode();
  };

  // --- 추가 선택 시트(팩/메모/폴더) --------------------------------------------
  // v70: 레벨마다 흩어져 있던 팩/메모/폴더 3개 버튼을 없애고, 최상단은 접기/펼치기
  // 아이콘 옆 + 아이콘, 폴더는 각 행의 + 아이콘 하나로 통일해서 이 시트를 띄운다.
  const [addChooserOpen, setAddChooserOpen] = useState(false);
  const [addChooserParentId, setAddChooserParentId] = useState<string | undefined>(undefined);
  const openAddChooser = (parentId: string | undefined) => {
    setAddChooserParentId(parentId);
    setAddChooserOpen(true);
  };
  const closeAddChooser = () => setAddChooserOpen(false);

  // --- 트리 구성 -------------------------------------------------------------
  const rows = useMemo(
    () => buildRows(treePacks, undefined, 0, expandedIds, sortBy, pinnedIds, profile?.packOrderByParent),
    [treePacks, expandedIds, sortBy, pinnedIds, profile?.packOrderByParent]
  );
  // 다중선택 모드 중엔 "여기에 추가" 버튼 행을 숨긴다(선택에 방해되지 않도록).
  const visibleRows = selectMode ? rows.filter((r) => r.kind === "entry") : rows;
  const isEmpty = treePacks.length === 0;

  return (
    <div
      onPointerDown={handleRootPointerDown}
      onPointerUp={handleRootPointerUp}
      className="relative flex-1 flex flex-col overflow-hidden"
    >
      <div className="shrink-0 p-4 pb-0">
        <div className="flex items-center justify-between mb-4 gap-2">
          {searchOpen ? (
            <>
              <div className="flex items-center gap-2 flex-1 min-w-0 rounded-lg border border-border bg-surface-2 px-2.5 py-1.5">
                <IconSearch size={16} stroke={1.75} color="var(--text-muted)" className="shrink-0" />
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="팩, 짐, 가방 검색"
                  className="min-w-0 flex-1 bg-transparent text-[14px] outline-none"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} aria-label="검색어 지우기" className="shrink-0">
                    <IconX size={15} stroke={1.75} color="var(--text-muted)" />
                  </button>
                )}
              </div>
              <button onClick={closeSearch} className="shrink-0 text-[13px] text-text-secondary px-1">
                취소
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 min-w-0">
                <h1 className="text-[22px] font-bold shrink-0">팩</h1>
                <span className="text-[12px] text-text-muted truncate">
                  폴더로 정리해서 두고두고 써요
                </span>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <button onClick={openSearch} aria-label="검색" className="-m-2 p-2">
                  <IconSearch size={20} stroke={1.75} color="var(--text-secondary)" />
                </button>
                <NotificationBell uid={uid} />
              </div>
            </>
          )}
        </div>

        {!searchOpen &&
          (selectMode ? (
            <div className="flex items-center justify-between mb-3 gap-2">
              <button onClick={cancelSelectMode} className="text-[13px] text-text-secondary px-1 py-1.5">
                취소
              </button>
              <span className="text-[13px] font-medium">{selectedIds.size}개 선택됨</span>
            </div>
          ) : (
            !isEmpty && (
              <div className="flex items-center justify-between mb-3 gap-2">
                <div className="flex items-center gap-2">
                  {allFolderIds.length > 0 && (
                    <button
                      onClick={() =>
                        allFoldersCollapsed ? expandAllFolders() : collapseAllFolders()
                      }
                      aria-label={allFoldersCollapsed ? "폴더 전체 펼치기" : "폴더 전체 접기"}
                      className="flex items-center justify-center rounded-md border border-border-strong p-1"
                    >
                      {allFoldersCollapsed ? (
                        <IconChevronDown size={17} stroke={1.75} color="var(--text-secondary)" />
                      ) : (
                        <IconChevronRight size={17} stroke={1.75} color="var(--text-secondary)" />
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => openAddChooser(undefined)}
                    aria-label="최상위에 추가"
                    className="flex items-center justify-center rounded-md border border-dashed border-border-strong p-1"
                  >
                    <IconPlus size={17} stroke={1.75} color="var(--text-secondary)" />
                  </button>
                </div>
                <SortSelect
                  value={sortBy}
                  onChange={(v) => updatePackSortBy(v).catch(() => show("변경사항을 저장하지 못했어요"))}
                />
              </div>
            )
          ))}
      </div>

      {searchOpen ? (
        <div className="flex-1 overflow-y-auto px-4 pb-3">
          {searchQuery.trim() === "" ? (
            <p className="text-[13px] text-text-muted py-16 text-center">
              팩 이름, 짐, 가방을 검색해보세요.
            </p>
          ) : searchResults.length === 0 ? (
            <p className="text-[13px] text-text-muted py-16 text-center">
              검색 결과가 없어요.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {searchResults.map((result) => (
                <button
                  key={result.id}
                  onClick={() => handleResultClick(result)}
                  className="flex flex-col items-start rounded-lg bg-surface-2 px-3 py-2.5 text-left"
                >
                  <span className="text-[13px] font-medium truncate w-full">{result.label}</span>
                  {result.subtitle && (
                    <span className="text-[11px] text-text-muted truncate w-full">
                      {result.subtitle}
                    </span>
                  )}
                </button>
              ))}
              {searchTruncated && (
                <p className="text-[11px] text-text-muted text-center py-2">
                  결과가 많아 상위 30개만 보여드려요
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 pb-3">
          {isEmpty ? (
            <div className="flex flex-col items-center gap-3 py-16">
              <p className="text-[13px] text-text-muted text-center">
                아직 만든 팩이 없어요. 아래에서 팩이나 폴더를 만들어보세요.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onNewPack(undefined)}
                  className="flex items-center gap-1 rounded-lg px-3 py-2 text-[13px] text-text-muted border border-dashed border-border-strong"
                >
                  <IconPlus size={14} stroke={1.75} />팩
                </button>
                <button
                  onClick={() => onNewPack(undefined, "editor")}
                  className="flex items-center gap-1 rounded-lg px-3 py-2 text-[13px] text-text-muted border border-dashed border-border-strong"
                >
                  <IconNotes size={14} stroke={1.75} />메모
                </button>
                <button
                  onClick={() => onNewFolder(undefined)}
                  className="flex items-center gap-1 rounded-lg px-3 py-2 text-[13px] text-text-muted border border-dashed border-border-strong"
                >
                  <IconFolderPlus size={14} stroke={1.75} />폴더
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-0">
              {visibleRows.map((row) => {
                if (row.kind === "add") return null;

                const entry = row.entry;
                const isFolder = entry.type === "folder";
                const isSelected = selectedIds.has(entry.id);
                const isDragSource = dragId === entry.id;
                const isDragOver = dragOver?.id === entry.id;
                const childCount = isFolder
                  ? treePacks.filter((p) => p.parentId === entry.id).length
                  : entry.items.length;
                const isEditorPack = !isFolder && entry.kind === "editor";

                return (
                  <div
                    key={entry.id}
                    data-row-id={entry.id}
                    onPointerDown={(e) => handleRowPointerDown(entry.id, e)}
                    onPointerMove={handleRowPointerMove}
                    onPointerUp={handleRowPointerUp}
                    onPointerCancel={handleRowPointerUp}
                    onClick={() => handleRowClick(entry)}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 active:bg-black/5"
                    style={{
                      paddingLeft: 8 + row.depth * 20,
                      background:
                        isDragOver && dragOver?.zone === "into"
                          ? "var(--accent-soft)"
                          : isSelected
                            ? "var(--accent-soft)"
                            : undefined,
                      borderTop:
                        isDragOver && dragOver?.zone === "before" ? "2px solid var(--accent)" : "2px solid transparent",
                      borderBottom:
                        isDragOver && dragOver?.zone === "after" ? "2px solid var(--accent)" : "2px solid transparent",
                      opacity: isDragSource ? 0.35 : 1,
                      WebkitTouchCallout: "none",
                      WebkitUserSelect: "none",
                      userSelect: "none",
                    }}
                  >
                    {selectMode && (
                      <div
                        className="h-5 w-5 rounded-full flex items-center justify-center shrink-0"
                        style={{
                          background: isSelected ? "var(--accent)" : "transparent",
                          border: isSelected ? "none" : "1.5px solid var(--border-strong)",
                        }}
                      >
                        {isSelected && <IconCheck size={13} stroke={3} color="#fff" />}
                      </div>
                    )}
                    {isFolder ? (
                      <IconChevronRight
                        size={15}
                        stroke={2}
                        color="var(--text-muted)"
                        className="shrink-0 transition-transform"
                        style={{
                          transform: expandedIds.has(entry.id) ? "rotate(90deg)" : "rotate(0deg)",
                        }}
                      />
                    ) : (
                      <PackColorDot
                        colorId={entry.color}
                        onChange={(colorId) => onChangeColor(entry, colorId)}
                      />
                    )}
                    {isFolder && (
                      <IconFolder size={17} stroke={1.75} color="var(--text-secondary)" className="shrink-0" />
                    )}
                    <span className="text-[14px] font-medium truncate min-w-0 flex-1">{entry.name}</span>
                    {isEditorPack && (
                      <IconNotes size={13} stroke={1.75} color="var(--text-muted)" className="shrink-0" />
                    )}
                    {!isEditorPack && (
                      <span className="text-[11px] text-text-muted shrink-0">{childCount}개</span>
                    )}
                    {!selectMode && isFolder && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openAddChooser(entry.id);
                        }}
                        aria-label="이 폴더에 추가"
                        className="shrink-0 -m-2 p-2 mx-1.5 flex items-center justify-center rounded-full active:bg-black/5"
                      >
                        <IconPlus size={14} stroke={1.75} color="var(--text-muted)" />
                      </button>
                    )}
                    {!selectMode && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePackPinned(entry.id).catch(() => show("고정 상태를 저장하지 못했어요"));
                        }}
                        aria-label={pinnedSet.has(entry.id) ? "고정 해제" : "고정하기"}
                        className="shrink-0 -m-2 p-2 flex items-center justify-center rounded-full active:bg-black/5"
                      >
                        {pinnedSet.has(entry.id) ? (
                          <IconPinFilled size={13} stroke={1.75} color="var(--accent)" />
                        ) : (
                          <IconPin size={13} stroke={1.75} color="var(--text-muted)" />
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <QuickPackBar pack={quickPack} onClick={() => quickPack && onOpenPack(quickPack)} />

      {/* 다중선택 모드 하단 액션바: 이름변경(1개 선택일 때만)/이동/삭제.
          bottom-24만큼 띄운 이유는 예전 그리드와 동일 - 하단탭바 중앙 "+" FAB와 겹치지 않게. */}
      {selectMode && !showMoveSheet && !showBulkDeleteConfirm && !renamingEntry && (
        <div className="absolute inset-x-0 bottom-24 z-[96] flex justify-center gap-3 pointer-events-none">
          {selectedIds.size === 1 && (
            <button
              onClick={() => {
                const only = treePacks.find((p) => selectedIds.has(p.id));
                if (only) setRenamingEntry(only);
              }}
              aria-label="이름 변경"
              className="pointer-events-auto h-14 w-14 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-90"
              style={{ background: "var(--surface-2)" }}
            >
              <IconEdit size={22} stroke={1.75} color="var(--text-secondary)" />
            </button>
          )}
          <button
            onClick={() => setShowMoveSheet(true)}
            aria-label="이동"
            className="pointer-events-auto h-14 w-14 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-90"
            style={{ background: "var(--accent)" }}
          >
            <IconArrowRight size={22} stroke={1.75} color="#fff" />
          </button>
          <button
            onClick={() => selectedIds.size > 0 && setShowBulkDeleteConfirm(true)}
            aria-label="선택한 항목 삭제"
            className="pointer-events-auto h-14 w-14 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-90"
            style={{ background: "var(--danger)" }}
          >
            <IconTrash size={22} stroke={1.75} color="#fff" />
          </button>
        </div>
      )}

      {showBulkDeleteConfirm && (
        <ConfirmDialog
          title={`${selectedIds.size}개를 삭제할까요?`}
          message={
            linkedBagPackCount > 0
              ? `폴더를 삭제하면 그 안의 팩/폴더도 함께 휴지통으로 이동해요. 삭제된 항목은 되돌릴 수 없어요(휴지통에서 복구 가능). 가방 속에 연결된 사본이 ${linkedBagPackCount}개 있어요 - 함께 삭제하지 않으면 그 사본은 그대로 남고 연결만 끊어져요.`
              : "폴더를 삭제하면 그 안의 팩/폴더도 함께 휴지통으로 이동해요. 삭제된 항목은 되돌릴 수 없어요(휴지통에서 복구 가능). 이미 가방에 불러와진 사본에는 영향이 없어요."
          }
          checkboxLabel={
            linkedBagPackCount > 0 ? `가방 속 연결된 팩도 함께 삭제 (${linkedBagPackCount}개)` : undefined
          }
          onCancel={() => setShowBulkDeleteConfirm(false)}
          onConfirm={(alsoDeleteFromBags) => {
            const ids = Array.from(selectedIds);
            setShowBulkDeleteConfirm(false);
            cancelSelectMode();
            onBulkDeletePacks(ids, alsoDeleteFromBags);
          }}
        />
      )}

      {showMoveSheet && (
        <Portal>
          <div
            className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center"
            style={{ background: "rgba(0,0,0,0.45)" }}
            onClick={() => setShowMoveSheet(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-t-2xl sm:rounded-2xl bg-surface p-4 flex flex-col gap-2"
              style={{ paddingBottom: "max(16px, calc(env(safe-area-inset-bottom) + 12px))" }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[15px] font-medium">이동할 곳 선택</span>
                <button onClick={() => setShowMoveSheet(false)} aria-label="닫기">
                  <IconX size={18} stroke={1.75} color="var(--text-secondary)" />
                </button>
              </div>
              <div className="flex flex-col gap-1 max-h-[60vh] overflow-y-auto">
                <button
                  onClick={() => handleMoveTo(undefined)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-left"
                  style={{ background: "var(--surface-2)" }}
                >
                  <span className="text-[13px] font-medium">팩 보관함 (최상위)</span>
                </button>
                {folderPickerRows.map(({ folder, depth }) => (
                  <button
                    key={folder.id}
                    onClick={() => handleMoveTo(folder.id)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-left"
                    style={{ background: "var(--surface-2)", paddingLeft: 12 + depth * 16 }}
                  >
                    <IconFolder size={15} stroke={1.75} color="var(--text-secondary)" />
                    <span className="text-[13px] font-medium truncate">{folder.name}</span>
                  </button>
                ))}
                {folderPickerRows.length === 0 && (
                  <p className="text-[12px] text-text-muted py-2 px-1">
                    이동할 수 있는 다른 폴더가 없어요.
                  </p>
                )}
              </div>
            </div>
          </div>
        </Portal>
      )}

      {addChooserOpen && (
        <Portal>
          <div
            className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center"
            style={{ background: "rgba(0,0,0,0.45)" }}
            onClick={closeAddChooser}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-t-2xl sm:rounded-2xl bg-surface p-4 flex flex-col gap-2"
              style={{ paddingBottom: "max(16px, calc(env(safe-area-inset-bottom) + 12px))" }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[15px] font-medium">무엇을 추가할까요?</span>
                <button onClick={closeAddChooser} aria-label="닫기">
                  <IconX size={18} stroke={1.75} color="var(--text-secondary)" />
                </button>
              </div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => {
                    onNewPack(addChooserParentId);
                    closeAddChooser();
                  }}
                  className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-left"
                  style={{ background: "var(--surface-2)" }}
                >
                  <IconPlus size={16} stroke={1.75} color="var(--text-secondary)" />
                  <span className="text-[13px] font-medium">팩 (체크리스트)</span>
                </button>
                <button
                  onClick={() => {
                    onNewPack(addChooserParentId, "editor");
                    closeAddChooser();
                  }}
                  className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-left"
                  style={{ background: "var(--surface-2)" }}
                >
                  <IconNotes size={16} stroke={1.75} color="var(--text-secondary)" />
                  <span className="text-[13px] font-medium">메모</span>
                </button>
                <button
                  onClick={() => {
                    onNewFolder(addChooserParentId);
                    closeAddChooser();
                  }}
                  className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-left"
                  style={{ background: "var(--surface-2)" }}
                >
                  <IconFolderPlus size={16} stroke={1.75} color="var(--text-secondary)" />
                  <span className="text-[13px] font-medium">폴더</span>
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {renamingEntry && (
        <Portal>
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.45)" }}
            onClick={() => setRenamingEntry(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm mx-4 rounded-2xl bg-surface p-4 flex flex-col gap-3"
            >
              <span className="text-[15px] font-medium">이름 변경</span>
              <input
                autoFocus
                defaultValue={renamingEntry.name}
                onFocus={(e) => e.currentTarget.select()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const v = e.currentTarget.value.trim();
                    if (v && renamingEntry) onRenameEntry(renamingEntry, v);
                    setRenamingEntry(null);
                    cancelSelectMode();
                  }
                }}
                id="pib-rename-input"
                className="rounded-lg border border-border px-3 py-2 text-[14px] outline-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setRenamingEntry(null)}
                  className="rounded-lg px-4 py-2 text-[13px] text-text-secondary"
                >
                  취소
                </button>
                <button
                  onClick={() => {
                    const el = document.getElementById("pib-rename-input") as HTMLInputElement | null;
                    const v = el?.value.trim();
                    if (v && renamingEntry) onRenameEntry(renamingEntry, v);
                    setRenamingEntry(null);
                    cancelSelectMode();
                  }}
                  className="rounded-lg px-4 py-2 text-[13px] font-medium"
                  style={{ background: "var(--accent)", color: "#fff" }}
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
