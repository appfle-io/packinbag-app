"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  IconPlus,
  IconTicket,
  IconTrash,
  IconCheck,
  IconSearch,
  IconX,
  IconArchive,
  IconFolder,
  IconChevronDown,
  IconArrowRight,
  IconEdit,
  IconLayoutGrid,
  IconLayoutList,
} from "@tabler/icons-react";
import { Bag, BagFolder, Pack } from "@/lib/types";
import { useAuth } from "@/contexts/AuthProvider";
import { arrangeList, moveIdInOrder } from "@/lib/listSort";
import { searchBags, BagSearchResult } from "@/lib/librarySearch";
import { isPremiumUser, getViewablePacks } from "@/lib/premiumLimits";
import { daysUntil } from "@/lib/dday";
import BagCard from "@/components/BagCard";
import SortSelect from "@/components/SortSelect";
import QuickPackBar from "@/components/QuickPackBar";
import NotificationBell from "@/components/NotificationBell";
import JoinBagDialog from "@/components/JoinBagDialog";
import NewBagOptionsSheet from "@/components/NewBagOptionsSheet";
import NoteImportModal, { NoteImportResult } from "@/components/NoteImportModal";
import SampleBagSheet from "@/components/SampleBagSheet";
import SpreadsheetImportModal from "@/components/SpreadsheetImportModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import Portal from "@/components/Portal";
import { useToast } from "@/components/Toast";
import { useCanUse3Cols } from "@/lib/useCanUse3Cols";

// 길게 누른(롱프레스) 걸로 판정하는 시간. 이보다 짧게 떼면 그냥 탭(가방 열기)으로 처리한다.
const LONG_PRESS_MS = 400;
// 롱프레스 판정 전에 이 픽셀 이상 움직이면 스크롤 의도로 보고 롱프레스를 취소한다.
const MOVE_CANCEL_PX = 10;
// 여행일(D-Day)이 이만큼(일) 지나면 "보관함으로 옮길까요?" 배너로 제안한다.
const ARCHIVE_SUGGEST_DAYS_PAST = 7;

// 폴더 네비게이터(상단 드롭다운)에서 "폴더 없음"을 고를 때 쓰는 키. 실제 폴더 id와
// 겹칠 수 없는 문자열이라 안전하다.
const UNFILED_KEY = "__unfiled__";

// 가방보관함 필터(진행중/보관) - 앱을 마지막으로 봤던 것을 기억해둘 용도의 localStorage 키.
// 홈스크린(모바일 전용 화면)에서만 쓰이므로 이 기능도 자연스럽게 모바일에만 적용된다.
const BAG_FILTER_STORAGE_KEY = "packinbag:homeBagFilter";

// 가방보관함 폴더 트리 선택(전체/폴더 없음/특정 폴더) 기억용 localStorage 키. 위 필터와 같이
// HomeScreen(모바일 전용)에서만 쓰이므로 자연스럽게 모바일에만 적용된다.
const SELECTED_FOLDER_STORAGE_KEY = "packinbag:homeSelectedFolder";

interface FolderNavRow {
  folder: BagFolder;
  depth: number;
  count: number;
}

// 가방보관함 폴더 네비게이터용 트리(평평하게 들여쓰기 뒤, 탐색 목적이라 모든 단계를 항상 펼친 채로 보여준다).
function buildFolderNavRows(
  folders: Record<string, BagFolder>,
  assignments: Record<string, string>,
  bags: Bag[]
): FolderNavRow[] {
  const countFor = (id: string) => bags.filter((b) => assignments[b.id] === id).length;
  const rows: FolderNavRow[] = [];
  const visited = new Set<string>();
  const walk = (parentId: string | undefined, depth: number) => {
    if (depth > 20) return;
    Object.values(folders)
      .filter((f) => (f.parentId ?? undefined) === parentId && !visited.has(f.id))
      .sort((a, b) => a.name.localeCompare(b.name, "ko"))
      .forEach((f) => {
        visited.add(f.id);
        rows.push({ folder: f, depth, count: countFor(f.id) });
        walk(f.id, depth + 1);
      });
  };
  walk(undefined, 0);
  return rows;
}

// 검색 결과를 눌렀을 때 어디로 이동할지 알려주는 정보. packId가 있으면 해당 팩까지
// 자동 스크롤 + 하이라이트하고, itemId까지 있으면 짐 자체를 하이라이트한다.
// 메모팩의 경우 searchQuery가 있으면 에디터 내 해당 텍스트로 스크롤 및 하이라이트한다.
export type BagOpenFocus = { packId?: string; itemId?: string; searchQuery?: string };

export default function HomeScreen({
  uid,
  bags,
  packs = [],
  initialInviteCode,
  lockedBagIds,
  quickPack,
  currentUid,
  onOpenBag,
  onOpenPack,
  onNewBag,
  onImportNote,
  onJoinBag,
  onOpenQuickPack,
  onBulkDeleteBags,
  onSelectModeChange,
}: {
  // 알림종 배지/패널에 쓰임(NotificationBell). currentUid와 동일한 값이지만,
  // 이 프롭은 순수하게 NotificationBell에만 쓰이도록 이름을 따로 두었다.
  uid: string;
  bags: Bag[];
  packs?: Pack[];
  initialInviteCode?: string;
  // 무료 전환으로 잠긴(내가 소유한) 가방 id 목록. 카드에 자물쇠 표시만 하고, 탭하면
  // 여전히 열린다 - 실제 읽기 전용 처리는 BagEditorScreen(AppShell이 계산해서 넘긴 readOnly)이 한다.
  lockedBagIds?: Set<string>;
  quickPack?: Pack;
  // 다중선택 삭제 확인창에서 "내가 소유한 가방"과 "공유받은 가방"을 구분해서 문구를
  // 다르게 보여주기 위해 필요하다 (소유하지 않은 가방은 삭제가 아니라 나가기 처리됨).
  currentUid: string;
  // focus가 있으면 가방을 연 뒤 그 팩(또는 짐)까지 자동 스크롤 + 하이라이트한다
  // (상단 검색 결과를 눌렀을 때만 넘어옴 - 평소 카드 탭은 focus 없이 호출).
  onOpenBag: (bag: Bag, focus?: BagOpenFocus) => void;
  onOpenPack?: (pack: Pack, focusItemId?: string, searchQuery?: string) => void;
  onNewBag: () => void;
  onImportNote: (result: NoteImportResult) => void;
  onJoinBag: (code: string) => Promise<void>;
  onOpenQuickPack: () => void;
  // 길게 눌러 다중선택한 가방들을 한꺼번에 처리 (AppShell이 소유한 가방은 완전 삭제,
  // 공유받은(내 소유가 아닌) 가방은 나가기로 나눠서 처리한다).
  onBulkDeleteBags: (bagIds: string[]) => void;
  // 선택 모드 상태 변경 시 상위(AppShell)에 알려 하단 탭바 및 힌트 플로팅을 숨긴다.
  onSelectModeChange?: (active: boolean) => void;
}) {
  const [showJoin, setShowJoin] = useState(!!initialInviteCode);
  const [showNewBagOptions, setShowNewBagOptions] = useState(false);
  const [showNoteImport, setShowNoteImport] = useState(false);
  const [showSampleSheet, setShowSampleSheet] = useState(false);
  const [showSpreadsheetImport, setShowSpreadsheetImport] = useState(false);
  const {
    user,
    profile,
    updateBagSortBy,
    updateBagCardSize,
    toggleBagPinned,
    toggleBagArchived,
    archiveBags,
    dismissArchiveSuggestions,
    updateBagOrderByParent,
    createBagFolder,
    renameBagFolder,
    deleteBagFolder,
    moveBagsToFolder,
  } = useAuth();
  const { show } = useToast();
  // 지금 이 화면을 보는 사람(로그인한 본인) 기준 프리미엄 여부. 다른 멤버가 만든 AI추천
  // 팩(Pack.aiRecommendSource)을 이 사람이 무료회원이면 카드 미리보기/검색 결과에서 숨긴다.
  const premium = isPremiumUser(profile?.email, profile ?? null);
  const sortBy = profile?.bagSortBy ?? "createdAt";
  const pinnedIds = profile?.pinnedBagIds ?? [];
  // "보관" 처리된 가방은 삭제가 아니라 그냥 메인 목록("진행중" 탭)에서 숨기고 "보관" 탭으로
  // 옮긴다 - 다 쓴 가방이 계속 홈 화면에 쌓이는 걸 정리하기 위한 용도.
  const archivedSet = new Set(profile?.archivedBagIds ?? []);

  // 가방보관함 폴더(개인 메타데이터, 가방 문서 자체와는 무관 - BagFolder 주석 참고).
  const bagFolders = profile?.bagFolders ?? {};
  const bagFolderAssignments = profile?.bagFolderAssignments ?? {};
  const [folderNavOpen, setFolderNavOpen] = useState(false);
  // 2026-07: 이 드롭다운은 예전엔 그냥 토글 버튼 아래에 일반 흐름으로 그려졌는데, 화면
  // 전환(스와이프 탭)을 위한 바깥 컨테이너가 별도의 CSS 쌓임 맥락(stacking context)을
  // 만들어서, 그 안에서 z-index를 아무리 올려도 그 바깥에 있는 PackTreeSwipeHint
  // 힌트버블 위로 절대 올라갈 수 없는 문제가 있었다(z-index는 같은 쌓임 맥락 안에서만
  // 비교된다). 그래서 이 드롭다운도 다른 오버레이(showMoveSheet 등)처럼 Portal로
  // document.body 최상단에 직접 그려서 그 문제를 원천적으로 피한다 - 열리는 순간
  // 토글 버튼의 실제 화면 좌표를 재서 그 아래에 고정 위치로 띄운다.
  const folderNavBtnRef = useRef<HTMLButtonElement>(null);
  const [folderNavRect, setFolderNavRect] = useState<{ top: number; left: number; width: number } | null>(
    null
  );
  const toggleFolderNav = () => {
    if (!folderNavOpen && folderNavBtnRef.current) {
      const r = folderNavBtnRef.current.getBoundingClientRect();
      setFolderNavRect({ top: r.bottom + 6, left: r.left, width: r.width });
    }
    setFolderNavOpen((v) => !v);
  };
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(() => {
    // 폴더 트리 선택도 위 필터와 같은 이유로 이 기기에만 남는 localStorage로 기억한다.
    if (typeof window === "undefined") return undefined;
    return window.localStorage.getItem(SELECTED_FOLDER_STORAGE_KEY) || undefined;
  });
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [showMoveSheet, setShowMoveSheet] = useState(false);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameFolderDraft, setRenameFolderDraft] = useState("");
  const [confirmDeleteFolderId, setConfirmDeleteFolderId] = useState<string | null>(null);

  // 선택된 폴더가 삭제되는 등으로 사라지면 자동으로 "전체"로 되돌아간다.
  useEffect(() => {
    if (
      selectedFolderId &&
      selectedFolderId !== UNFILED_KEY &&
      !bagFolders[selectedFolderId]
    ) {
      setSelectedFolderId(undefined);
    }
  }, [selectedFolderId, bagFolders]);

  // 다음 진입 시에도 마지막으로 본 폴더를 그대로 이어볼 수 있게 저장한다.
  useEffect(() => {
    if (selectedFolderId) {
      window.localStorage.setItem(SELECTED_FOLDER_STORAGE_KEY, selectedFolderId);
    } else {
      window.localStorage.removeItem(SELECTED_FOLDER_STORAGE_KEY);
    }
  }, [selectedFolderId]);

  const folderNavRows = useMemo(
    () => buildFolderNavRows(bagFolders, bagFolderAssignments, bags),
    [bagFolders, bagFolderAssignments, bags]
  );

  const selectedFolderLabel = !selectedFolderId
    ? "전체"
    : selectedFolderId === UNFILED_KEY
    ? "폴더 없음"
    : bagFolders[selectedFolderId]?.name ?? "전체";

  const [bagFilter, setBagFilter] = useState<"active" | "archived">(() => {
    // 모바일에서만 쓰는 화면(HomeScreen)이라 이 저장은 자연스럽게 모바일 전용이다.
    // 계정에 동기화하지 않고 이 기기(브라우저)에만 남는 값이라 localStorage를 쓴다.
    if (typeof window === "undefined") return "active";
    return window.localStorage.getItem(BAG_FILTER_STORAGE_KEY) === "archived" ? "archived" : "active";
  });
  useEffect(() => {
    window.localStorage.setItem(BAG_FILTER_STORAGE_KEY, bagFilter);
  }, [bagFilter]);
  const activeBagsAll = bags.filter((b) => !archivedSet.has(b.id));
  const archivedBagsAll = bags.filter((b) => archivedSet.has(b.id));
  const baseBags = bagFilter === "archived" ? archivedBagsAll : activeBagsAll;
  const visibleBags = !selectedFolderId
    ? baseBags
    : selectedFolderId === UNFILED_KEY
    ? baseBags.filter((b) => !bagFolderAssignments[b.id])
    : baseBags.filter((b) => bagFolderAssignments[b.id] === selectedFolderId);
  // 폴더별 순서 저장 키. "전체"(selectedFolderId 없음, 여러 폴더 가방이 한꺼번에 보이는 뷰)에서는
  // 어느 폴더의 순서를 바꿔야 할지 모호해서 undefined로 두고(드래그 순서변경 자체를 막는다 -
  // 아래 handleCardPointerDown 참고), "폴더 없음"/특정 폴더를 보고 있을 때만 그 폴더 범위의
  // bagOrderByParent를 읽고 쓴다(데스크톱 DesktopSidebar와 동일한 저장 방식 - 2026-07).
  const folderScopeKey =
    selectedFolderId === undefined ? undefined : selectedFolderId === UNFILED_KEY ? "root" : selectedFolderId;
  const arrangedBags = arrangeList(visibleBags, {
    sortBy,
    pinnedIds,
    order: folderScopeKey !== undefined ? profile?.bagOrderByParent?.[folderScopeKey] ?? [] : profile?.bagOrder,
  });
  // 설정 > 화면설정 > 가방 > 카드 크기. 550px 미만의 일반 모바일 화면에서는 3열이 너무 좁아지므로 1/2열만 적용한다.
  const canUse3Cols = useCanUse3Cols();
  const bagCardSize = profile?.bagCardSize ?? "medium";
  const effectiveCardSize = !canUse3Cols && bagCardSize === "small" ? "medium" : bagCardSize;
  const bagGridColsClass =
    effectiveCardSize === "small"
      ? "grid-cols-3"
      : effectiveCardSize === "large"
      ? "grid-cols-1"
      : "grid-cols-2";
  const pinnedSet = new Set(pinnedIds);

  const commitCreateFolder = () => {
    const name = newFolderName.trim();
    if (name) createBagFolder(name).catch(() => show("폴더를 만들지 못했어요"));
    setNewFolderName("");
    setCreatingFolder(false);
  };

  const commitRenameFolder = () => {
    const name = renameFolderDraft.trim();
    if (renamingFolderId && name) {
      renameBagFolder(renamingFolderId, name).catch(() => show("이름을 바꾸지 못했어요"));
    }
    setRenamingFolderId(null);
  };

  // 여행일이 오래 지났는데 아직 "진행중"에 남아있는(=보관 안 한) 가방들 - 한 번 닫기(dismiss)
  // 처리한 가방은 다시 물어보지 않는다.
  const dismissedSuggestionSet = new Set(profile?.archiveSuggestionDismissedIds ?? []);
  const archiveSuggestions = activeBagsAll.filter(
    (b) =>
      !!b.travelDate &&
      daysUntil(b.travelDate) <= -ARCHIVE_SUGGEST_DAYS_PAST &&
      !dismissedSuggestionSet.has(b.id)
  );

  // --- 검색 --------------------------------------------------------------
  // 검색 아이콘을 누르면 헤더의 제목/설명 자리가 입력창으로 바뀌고 자동 포커스된다.
  // 입력할 때마다(디바운스 없이) 가방 이름/가방 속 팩 이름/짐 텍스트를 즉시 검색해서
  // 보여주고, 결과를 누르면 onOpenBag으로 그 가방을 열면서 팩까지 이동시킨다.
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedPreviewIds, setExpandedPreviewIds] = useState<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);

  const togglePreview = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedPreviewIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const searchableBags = useMemo(
    () => (premium ? bags : bags.map((b) => ({ ...b, packs: getViewablePacks(b.packs, premium) }))),
    [bags, premium]
  );
  const { results: searchResults, truncated: searchTruncated } = useMemo(
    () => searchBags(searchableBags, searchQuery, packs),
    [searchableBags, searchQuery, packs]
  );

  const openSearch = () => {
    setSearchOpen(true);
    // 다음 페인트 이후 포커스해야 방금 렌더된 input에 확실히 포커스가 간다.
    requestAnimationFrame(() => searchInputRef.current?.focus());
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");
  };

  const handleResultClick = (result: BagSearchResult) => {
    const currentQuery = searchQuery.trim();
    closeSearch();
    if (result.type === "bag" && result.bag) {
      const originalBag = bags.find((b) => b.id === result.bag?.id) ?? result.bag;
      onOpenBag(originalBag);
      return;
    }
    if (result.bag) {
      const originalBag = bags.find((b) => b.id === result.bag?.id) ?? result.bag;
      onOpenBag(originalBag, {
        packId: result.packId,
        itemId: result.itemId,
        searchQuery: result.isEditorPack ? currentQuery : undefined,
      });
      return;
    }
    if (result.pack) {
      if (onOpenPack) {
        onOpenPack(result.pack, result.itemId, result.isEditorPack ? currentQuery : undefined);
      } else {
        onOpenQuickPack();
      }
    }
  };

  // --- 길게 눌러서 순서 바꾸기 / 폴더로 이동 / 다중선택 --------------------------
  // 롱프레스로 집어든 뒤 다른 가방 카드 위에 놓으면 순서변경(같은 폴더 범위 안에서만),
  // 화면 상단에 뜨는 폴더 칩 위에 놓으면 그 폴더로 이동(어느 뷰에서든, 고정 여부와 무관하게
  // 가능) - 데스크톱/모바일 팩보관함(PacksScreen)과 동일하게 "순서변경"과 "폴더 이동"을
  // 하나의 드래그 제스처로 처리한다(2026-07). 놓는 순간 지금 보고 있는 폴더 범위(folderScopeKey)의
  // 순서를 bagOrderByParent에 저장하고 정렬기준을 "custom"으로 전환한다.
  //
  // 길게 누르고 "그대로 뗀" 경우(실제로 다른 카드/폴더 위로 옮기지 않은 경우)는 다중선택
  // 모드 진입으로 취급한다. 즉 같은 롱프레스 제스처가 "움직이면 순서변경/이동", "가만히
  // 있다 떼면 다중선택 시작"으로 나뉜다 - 그래서 두 기능이 서로 충돌하지 않는다.
  const [reorderDrag, setReorderDrag] = useState<{
    id: string;
    x: number;
    y: number;
    overId: string | null;
    overFolderId: string | null; // "root" | 폴더id | null. 폴더 칩 위에 있을 때만 값이 있다.
  } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStartRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const justDraggedRef = useRef(false);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // 선택된 항목이 하나도 없으면(마지막 선택을 해제했을 때) 다중선택 모드도 자동으로 빠져나간다.
  useEffect(() => {
    if (selectMode && selectedIds.size === 0) setSelectMode(false);
  }, [selectMode, selectedIds]);

  useEffect(() => {
    onSelectModeChange?.(selectMode);
  }, [selectMode, onSelectModeChange]);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const enterSelectMode = (bagId: string) => {
    setSelectMode(true);
    setSelectedIds(new Set([bagId]));
  };

  const toggleSelected = (bagId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(bagId)) next.delete(bagId);
      else next.add(bagId);
      return next;
    });
  };

  const cancelSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const handleCardPointerDown = (bagId: string, e: React.PointerEvent) => {
    if (selectMode) return; // 선택 모드에서는 탭만으로 토글하므로 롱프레스가 필요 없음
    const x = e.clientX;
    const y = e.clientY;
    longPressStartRef.current = { id: bagId, x, y };
    clearLongPressTimer();
    longPressTimerRef.current = setTimeout(() => {
      // 고정 카드나 "전체" 뷰라도 폴더로 이동은 항상 허용한다(순서변경만 막힌다) - 그래서
      // 일단 항상 드래그를 시작하고, 실제로 무엇이 되는지는 놓는 순간(handleUp)에 결정한다.
      setReorderDrag({ id: bagId, x, y, overId: null, overFolderId: null });
    }, LONG_PRESS_MS);
  };

  const handleCardPointerMove = (e: React.PointerEvent) => {
    const start = longPressStartRef.current;
    if (!start || reorderDrag) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) clearLongPressTimer();
  };

  const handleCardPointerUp = () => {
    clearLongPressTimer();
  };

  useEffect(() => {
    if (!reorderDrag) return;

    const handleMove = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const folderChipEl = el?.closest("[data-bag-folder-drop-id]") as HTMLElement | null;
      const overFolderId = folderChipEl?.getAttribute("data-bag-folder-drop-id") ?? null;
      // 폴더 칩 위에 있는 동안은 카드 재정렬 타겟은 무시한다(둘이 동시에 유효할 일은 없지만
      // 명확성을 위해).
      const cardEl = overFolderId
        ? null
        : (el?.closest("[data-bag-drop-id]") as HTMLElement | null);
      const overId = cardEl?.getAttribute("data-bag-drop-id") ?? null;
      setReorderDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY, overId, overFolderId } : d));
    };

    const handleUp = () => {
      setReorderDrag((d) => {
        if (d) {
          if (d.overFolderId) {
            // 폴더 칩 위에 놓은 경우 -> 그 폴더로 이동(순서는 건드리지 않음).
            const targetFolderId = d.overFolderId === "root" ? undefined : d.overFolderId;
            moveBagsToFolder([d.id], targetFolderId).catch(() => show("이동하지 못했어요"));
          } else if (
            d.overId &&
            d.overId !== d.id &&
            !pinnedSet.has(d.id) &&
            !pinnedSet.has(d.overId) &&
            folderScopeKey !== undefined
          ) {
            // 실제로 다른 카드 위로 옮겨서 놓은 경우 -> 지금 보고 있는 폴더 범위(folderScopeKey)의
            // 순서만 저장한다 - 예전엔 이 폴더에 보이는 가방만 담긴 배열로 전체 bagOrder를
            // 덮어써서, 다른 폴더에 있던 가방들의 순서가 사라지는 버그가 있었다(2026-07 수정).
            const currentIds = arrangedBags.filter((b) => !pinnedSet.has(b.id)).map((b) => b.id);
            const nextOrder = moveIdInOrder(currentIds, d.id, d.overId);
            updateBagOrderByParent(folderScopeKey, nextOrder).catch(() => show("순서를 저장하지 못했어요"));
          } else {
            // 움직이지 않고 그대로 뗀 경우 -> 다중선택 모드로 진입
            enterSelectMode(d.id);
          }
          justDraggedRef.current = true;
        }
        return null;
      });
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
  }, [reorderDrag !== null]);


  // 선택된 가방 중 내가 소유한 것과 공유받은(소유하지 않은) 것을 나눈다. 삭제 확인창
  // 문구를 여기에 맞춰 다르게 보여준다 - 공유받은 가방은 실제로는 "나가기"로 처리되기
  // 때문에, 사용자가 헷갈리지 않도록 미리 알려준다.
  const selectedBags = bags.filter((b) => selectedIds.has(b.id));
  const ownedSelectedCount = selectedBags.filter((b) => b.ownerId === currentUid).length;
  const sharedSelectedCount = selectedBags.length - ownedSelectedCount;

  const bulkDeleteTitle =
    sharedSelectedCount === 0
      ? `가방 ${selectedIds.size}개를 삭제할까요?`
      : ownedSelectedCount === 0
      ? `가방 ${selectedIds.size}개에서 나갈까요?`
      : `가방 ${selectedIds.size}개를 정리할까요?`;

  const bulkDeleteMessage =
    sharedSelectedCount === 0
      ? "삭제된 가방은 되돌릴 수 없어요. 가방에 담긴 모든 팩과 짐이 함께 사라져요."
      : ownedSelectedCount === 0
      ? "그룹 가방에서 나가면 더 이상 이 가방을 볼 수 없어요. 가방 자체와 다른 그룹원들의 내용은 그대로 유지돼요."
      : `내가 만든 가방 ${ownedSelectedCount}개는 완전히 삭제되고, 공유받은 가방 ${sharedSelectedCount}개는 그룹에서 나가기 처리돼요.`;

  return (
    <div className="relative flex-1 flex flex-col overflow-hidden">
      <div className="shrink-0 p-4 pb-0">
        <div className="flex items-center justify-between mb-3.5 gap-2">
          {searchOpen ? (
            <>
              <div className="flex items-center gap-2 flex-1 min-w-0 rounded-xl border border-border/80 bg-surface-2/60 focus-within:bg-background focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/20 px-2.5 py-1.5 transition-all">
                <IconSearch size={15} stroke={1.75} color="var(--text-muted)" className="shrink-0" />
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="가방, 팩, 짐 검색..."
                  className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none text-foreground placeholder:text-text-muted"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} aria-label="검색어 지우기" className="shrink-0 text-text-muted hover:text-foreground">
                    <IconX size={14} stroke={1.75} />
                  </button>
                )}
              </div>
              <button
                onClick={closeSearch}
                className="shrink-0 text-[13px] font-medium text-text-secondary hover:text-foreground px-1.5 py-1"
              >
                취소
              </button>
            </>
          ) : (
            <>
              <div className="flex items-baseline gap-2 min-w-0">
                <h1 className="text-[20px] font-bold tracking-tight shrink-0 text-foreground">가방</h1>
                <span className="text-[11.5px] text-text-muted truncate">
                  짐을 챙기고 관리하는 공간
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={openSearch}
                  aria-label="검색"
                  className="p-1.5 rounded-lg text-text-secondary hover:text-foreground hover:bg-surface-2 transition-colors"
                >
                  <IconSearch size={18} stroke={1.75} />
                </button>
                <NotificationBell uid={uid} />
              </div>
            </>
          )}
        </div>

        {!searchOpen &&
          (selectMode ? (
            <div className="flex items-center justify-between mb-3 gap-2">
              <button
                onClick={cancelSelectMode}
                className="text-[12.5px] text-text-secondary hover:text-foreground px-1 py-1.5 font-medium"
              >
                취소
              </button>
              <span className="text-[12.5px] font-semibold text-foreground">
                {selectedIds.size}개 선택됨
              </span>
              <button
                onClick={() => {
                  if (arrangedBags.length > 0 && arrangedBags.every((b) => selectedIds.has(b.id))) {
                    setSelectedIds(new Set());
                  } else {
                    setSelectedIds(new Set(arrangedBags.map((b) => b.id)));
                  }
                }}
                className="text-[12.5px] text-accent hover:opacity-80 px-1 py-1.5 font-medium"
              >
                {arrangedBags.length > 0 && arrangedBags.every((b) => selectedIds.has(b.id))
                  ? "선택 해제"
                  : "전체 선택"}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between mb-3 gap-2">
              <button
                onClick={() => setShowJoin(true)}
                className="flex items-center gap-1.5 rounded-lg border border-border/80 bg-surface px-2.5 py-1.5 text-[12px] font-medium text-text-secondary hover:text-foreground hover:bg-surface-2 shrink-0 transition-colors shadow-2xs"
              >
                <IconTicket size={13} stroke={1.75} />
                코드로 참여
              </button>
              <div className="flex items-center gap-1.5 shrink-0">
                {(archivedBagsAll.length > 0 || bagFilter === "archived") && (
                  <div
                    className="flex items-center gap-1 rounded-lg border border-border/80 px-2 py-1.5 bg-surface"
                  >
                    <IconArchive size={13} stroke={1.75} color="var(--text-secondary)" />
                    <select
                      value={bagFilter}
                      onChange={(e) => setBagFilter(e.target.value as "active" | "archived")}
                      aria-label="진행중/보관"
                      className="bg-transparent text-[11.5px] pr-1 outline-none text-text-secondary"
                    >
                      <option value="active">진행중 ({activeBagsAll.length})</option>
                      <option value="archived">보관 ({archivedBagsAll.length})</option>
                    </select>
                  </div>
                )}
                {bags.length > 0 && (
                  <>
                    <SortSelect value={sortBy} onChange={(v) => updateBagSortBy(v).catch(() => show("변경사항을 저장하지 못했어요"))} />
                    {/* 모바일 뷰 밀도 빠른 전환 버튼: 550px 미만은 2열 <-> 1열, 550px 이상은 2열 <-> 1열 <-> 3열 */}
                    <button
                      type="button"
                      onClick={() => {
                        let nextSize: "small" | "medium" | "large";
                        if (!canUse3Cols) {
                          nextSize = effectiveCardSize === "large" ? "medium" : "large";
                        } else {
                          nextSize =
                            bagCardSize === "large"
                              ? "medium"
                              : bagCardSize === "medium"
                              ? "small"
                              : "large";
                        }
                        updateBagCardSize(nextSize).catch(() => {});
                      }}
                      title={
                        effectiveCardSize === "large"
                          ? "1열 크게 보기 (탭하여 2열로 변경)"
                          : effectiveCardSize === "small"
                          ? "3열 작게 보기 (탭하여 1열로 변경)"
                          : "2열 보통 보기"
                      }
                      className="flex items-center gap-1 rounded-lg border border-border/80 px-2.5 py-1.5 bg-surface text-text-secondary hover:text-foreground hover:bg-surface-2 transition-colors shrink-0 cursor-pointer shadow-2xs"
                    >
                      {effectiveCardSize === "large" ? (
                        <IconLayoutList size={14} stroke={1.75} />
                      ) : effectiveCardSize === "small" ? (
                        <IconLayoutGrid size={14} stroke={2.4} />
                      ) : (
                        <IconLayoutGrid size={14} stroke={1.75} />
                      )}
                      <span className="text-[11.5px] font-medium">
                        {effectiveCardSize === "large" ? "1열" : effectiveCardSize === "small" ? "3열" : "2열"}
                      </span>
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}

        {!searchOpen && !selectMode && (
          <div className="mb-3">
            <button
              ref={folderNavBtnRef}
              onClick={toggleFolderNav}
              className="w-full flex items-center justify-between rounded-lg border border-border px-3 py-2"
              style={{ background: "var(--surface-2)" }}
            >
              <span className="flex items-center gap-1.5 text-[13px] font-medium min-w-0">
                <IconFolder size={15} stroke={1.75} color="var(--text-secondary)" className="shrink-0" />
                <span className="truncate">{selectedFolderLabel}</span>
              </span>
              <IconChevronDown
                size={16}
                stroke={1.75}
                color="var(--text-muted)"
                className="shrink-0"
                style={{
                  transform: folderNavOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 150ms ease",
                }}
              />
            </button>
            {folderNavOpen && folderNavRect && (
              <Portal>
                <div className="fixed inset-0 z-[90]" onClick={() => setFolderNavOpen(false)}>
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="fixed rounded-lg border border-border overflow-hidden shadow-lg"
                    style={{
                      top: folderNavRect.top,
                      left: folderNavRect.left,
                      width: folderNavRect.width,
                      background: "var(--surface)",
                      maxHeight: 260,
                      overflowY: "auto",
                    }}
                  >
                <button
                  onClick={() => {
                    setSelectedFolderId(undefined);
                    setFolderNavOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-[13px] border-b border-border"
                  style={{ background: !selectedFolderId ? "var(--accent-soft)" : undefined }}
                >
                  <span>전체</span>
                  <span className="text-[11px] text-text-muted">{baseBags.length}개</span>
                </button>
                {folderNavRows.map(({ folder, depth, count }) => {
                  const isRenaming = renamingFolderId === folder.id;
                  return (
                    <div
                      key={folder.id}
                      className="group w-full flex items-center justify-between px-3 py-2.5 text-[13px] border-b border-border"
                      style={{
                        paddingLeft: 12 + depth * 16,
                        background: selectedFolderId === folder.id ? "var(--accent-soft)" : undefined,
                      }}
                    >
                      {isRenaming ? (
                        <input
                          autoFocus
                          value={renameFolderDraft}
                          onChange={(e) => setRenameFolderDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitRenameFolder();
                            if (e.key === "Escape") setRenamingFolderId(null);
                          }}
                          onBlur={commitRenameFolder}
                          className="min-w-0 flex-1 rounded border border-border bg-surface px-1.5 py-0.5 text-[13px] outline-none"
                        />
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedFolderId(folder.id);
                            setFolderNavOpen(false);
                          }}
                          className="flex items-center gap-1.5 truncate min-w-0 flex-1 text-left"
                        >
                          <IconFolder size={13} stroke={1.75} color="var(--text-secondary)" className="shrink-0" />
                          <span className="truncate">{folder.name}</span>
                        </button>
                      )}
                      {!isRenaming && (
                        <span className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] text-text-muted">{count}개</span>
                          <button
                            onClick={() => {
                              setRenamingFolderId(folder.id);
                              setRenameFolderDraft(folder.name);
                            }}
                            aria-label="폴더 이름 바꾸기"
                            className="-m-1 p-1"
                          >
                            <IconEdit size={13} stroke={1.75} color="var(--text-muted)" />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteFolderId(folder.id)}
                            aria-label="폴더 삭제"
                            className="-m-1 p-1"
                          >
                            <IconTrash size={13} stroke={1.75} color="var(--danger)" />
                          </button>
                        </span>
                      )}
                    </div>
                  );
                })}
                <button
                  onClick={() => {
                    setSelectedFolderId(UNFILED_KEY);
                    setFolderNavOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-[13px] border-b border-border"
                  style={{ background: selectedFolderId === UNFILED_KEY ? "var(--accent-soft)" : undefined }}
                >
                  <span>폴더 없음</span>
                  <span className="text-[11px] text-text-muted">
                    {baseBags.filter((b) => !bagFolderAssignments[b.id]).length}개
                  </span>
                </button>
                {creatingFolder ? (
                  <div className="flex items-center gap-1.5 px-3 py-2">
                    <input
                      autoFocus
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitCreateFolder();
                        if (e.key === "Escape") {
                          setCreatingFolder(false);
                          setNewFolderName("");
                        }
                      }}
                      onBlur={commitCreateFolder}
                      placeholder="폴더 이름"
                      className="min-w-0 flex-1 rounded-lg border border-border px-2.5 py-1.5 text-[13px] outline-none"
                      style={{ background: "var(--surface-2)" }}
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => setCreatingFolder(true)}
                    className="w-full flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-medium"
                    style={{ color: "var(--accent)" }}
                  >
                    <IconPlus size={14} stroke={1.75} />
                    새 폴더
                  </button>
                )}
                  </div>
                </div>
              </Portal>
            )}
          </div>
        )}
      </div>

      {searchOpen ? (
        <div className="flex-1 overflow-y-auto px-4 pb-3">
          {searchQuery.trim() === "" ? (
            <p className="text-[13px] text-text-muted py-16 text-center">
              가방 이름, 팩 이름, 짐을 검색해보세요.
            </p>
          ) : searchResults.length === 0 ? (
            <p className="text-[13px] text-text-muted py-16 text-center">
              검색 결과가 없어요.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {searchResults.map((result) => {
                const isExpanded = expandedPreviewIds.has(result.id);
                const isEditor = result.isEditorPack;
                const badgeLabel =
                  result.type === "bag"
                    ? "가방"
                    : result.type === "pack"
                    ? isEditor
                      ? "메모"
                      : "팩"
                    : "짐";

                const badgeStyle =
                  result.type === "bag"
                    ? "bg-surface-2 text-text-secondary border-border/80"
                    : result.type === "pack"
                    ? isEditor
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                      : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                    : "bg-surface-2 text-text-muted border-border/60";

                return (
                  <div
                    key={result.id}
                    onClick={() => handleResultClick(result)}
                    className="flex flex-col gap-1.5 rounded-xl bg-surface border border-border/80 p-3 hover:bg-surface-2 cursor-pointer transition-colors text-left shadow-2xs group"
                  >
                    {/* 상단: 타입 칩 + 항목 이름 + 미리보기 토글 */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border shrink-0 ${badgeStyle}`}>
                          {badgeLabel}
                        </span>
                        <span className="text-[13px] font-semibold text-foreground truncate group-hover:text-accent transition-colors">
                          {result.label}
                        </span>
                      </div>

                      {result.fullSnippet && (
                        <button
                          type="button"
                          onClick={(e) => togglePreview(result.id, e)}
                          className="flex items-center gap-0.5 text-[11px] font-semibold text-accent hover:opacity-80 px-2 py-0.5 rounded-md bg-accent-soft shrink-0 cursor-pointer transition-colors"
                        >
                          <span>{isExpanded ? "접기" : "미리보기"}</span>
                          <IconChevronDown
                            size={13}
                            stroke={2.2}
                            className={`transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                          />
                        </button>
                      )}
                    </div>

                    {/* 소속 경로 (가방명 또는 가방명 > 팩명) */}
                    {result.subtitle && (
                      <div className="text-[11px] text-text-muted truncate pl-0.5">
                        {result.subtitle}
                      </div>
                    )}

                    {/* 1줄 짧은 스니펫 (접혀있을 때) */}
                    {result.snippet && !isExpanded && (
                      <div className="text-[11px] text-text-secondary bg-surface-2/60 rounded-md p-1.5 px-2 font-mono line-clamp-1 border border-border/40">
                        {result.snippet}
                      </div>
                    )}

                    {/* 상세 문맥 스니펫 (펼쳤을 때) */}
                    {result.fullSnippet && isExpanded && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="text-[11.5px] text-text-secondary bg-surface-2/80 rounded-lg p-2.5 whitespace-pre-wrap leading-relaxed border border-border/60 animate-in fade-in duration-150"
                      >
                        <div className="text-[10.5px] font-semibold text-text-muted mb-1 pb-1 border-b border-border/40">
                          메모 내용
                        </div>
                        {result.fullSnippet}
                      </div>
                    )}
                  </div>
                );
              })}
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
          {!selectMode && bagFilter === "active" && archiveSuggestions.length > 0 && (
            <div className="mb-3 rounded-lg border border-border bg-surface-2 p-3 flex items-start gap-2.5">
              <IconArchive size={18} stroke={1.75} color="var(--text-secondary)" className="shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium">
                  지난 여행 {archiveSuggestions.length}개, 보관함으로 옮길까요?
                </p>
                <p className="text-[11px] text-text-muted mt-0.5">
                  여행일이 한참 지난 가방들이에요. 보관해도 삭제되는 건 아니라 언제든 되돌릴 수 있어요
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() =>
                      archiveBags(archiveSuggestions.map((b) => b.id)).catch(() =>
                        show("보관 처리하지 못했어요")
                      )
                    }
                    className="rounded-lg px-2.5 py-1.5 text-[12px] font-medium"
                    style={{ background: "var(--accent)", color: "#fff" }}
                  >
                    보관하기
                  </button>
                  <button
                    onClick={() =>
                      dismissArchiveSuggestions(archiveSuggestions.map((b) => b.id)).catch(() => {})
                    }
                    className="rounded-lg px-2.5 py-1.5 text-[12px] text-text-secondary"
                  >
                    닫기
                  </button>
                </div>
              </div>
            </div>
          )}

          {visibleBags.length === 0 ? (
            bagFilter === "archived" ? (
              <p className="text-[13px] text-text-muted py-24 text-center">
                보관한 가방이 없어요.
              </p>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 py-24">
                <button
                  onClick={() => setShowNewBagOptions(true)}
                  className="h-14 w-14 rounded-full flex items-center justify-center"
                  style={{ background: "var(--accent)" }}
                >
                  <IconPlus size={26} stroke={1.75} color="#fff" />
                </button>
                <span className="text-[13px] text-text-muted">
                  새 가방 만들기
                </span>
              </div>
            )
          ) : (
            <div className={`grid ${bagGridColsClass} gap-3 md:gap-4`}>
              {arrangedBags.map((bag) => (
                <div
                  key={bag.id}
                  data-bag-drop-id={bag.id}
                  className="relative"
                  onPointerDown={(e) => handleCardPointerDown(bag.id, e)}
                  onPointerMove={handleCardPointerMove}
                  onPointerUp={handleCardPointerUp}
                  onPointerCancel={handleCardPointerUp}
                  onClickCapture={(e) => {
                    if (justDraggedRef.current) {
                      justDraggedRef.current = false;
                      e.stopPropagation();
                      e.preventDefault();
                    }
                  }}
                >
                  <BagCard
                    bag={bag}
                    premium={premium}
                    locked={lockedBagIds?.has(bag.id)}
                    pinned={pinnedSet.has(bag.id)}
                    onTogglePin={
                      selectMode || bagFilter === "archived"
                        ? undefined
                        : () => toggleBagPinned(bag.id).catch(() => show("고정 상태를 저장하지 못했어요"))
                    }
                    archived={bagFilter === "archived"}
                    onToggleArchive={
                      selectMode
                        ? undefined
                        : () => toggleBagArchived(bag.id).catch(() => show("보관 상태를 저장하지 못했어요"))
                    }
                    isDragSource={reorderDrag?.id === bag.id}
                    isDragOver={reorderDrag?.overId === bag.id}
                    selectMode={selectMode}
                    selected={selectedIds.has(bag.id)}
                    compact={effectiveCardSize === "small"}
                    onClick={() => (selectMode ? toggleSelected(bag.id) : onOpenBag(bag))}
                  />
                </div>
              ))}
              {!selectMode && bagFilter === "active" && (
                <button
                  onClick={() => setShowNewBagOptions(true)}
                  className="aspect-square rounded-xl border border-dashed border-border-strong flex items-center justify-center text-text-muted"
                >
                  <IconPlus size={22} stroke={1.75} />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {reorderDrag && (
        <Portal>
          <div
            className="fixed left-0 right-0 top-0 z-[96] pib-safe-top flex gap-1.5 overflow-x-auto no-scrollbar px-3 py-2"
            style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
          >
            <span
              data-bag-folder-drop-id="root"
              className="shrink-0 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium"
              style={{
                borderColor: reorderDrag.overFolderId === "root" ? "var(--accent)" : "var(--border)",
                background: reorderDrag.overFolderId === "root" ? "var(--accent-soft)" : "var(--surface-2)",
              }}
            >
              <IconFolder size={13} stroke={1.75} />
              가방보관함(최상위)
            </span>
            {folderNavRows.map(({ folder }) => (
              <span
                key={folder.id}
                data-bag-folder-drop-id={folder.id}
                className="shrink-0 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium"
                style={{
                  borderColor: reorderDrag.overFolderId === folder.id ? "var(--accent)" : "var(--border)",
                  background: reorderDrag.overFolderId === folder.id ? "var(--accent-soft)" : "var(--surface-2)",
                }}
              >
                <IconFolder size={13} stroke={1.75} />
                {folder.name}
              </span>
            ))}
          </div>
        </Portal>
      )}

      {!selectMode && <QuickPackBar pack={quickPack} onClick={onOpenQuickPack} />}

      {reorderDrag && (
        <div
          className="fixed z-[95] pointer-events-none rounded-lg px-3 py-2 text-[13px] shadow-lg"
          style={{
            left: reorderDrag.x,
            top: reorderDrag.y,
            transform: "translate(-50%, -120%)",
            background: "var(--accent)",
            color: "#fff",
          }}
        >
          {reorderDrag.overFolderId ? "여기로 이동" : bags.find((b) => b.id === reorderDrag.id)?.name || "가방"}
        </div>
      )}

      {/* 다중선택 모드일 때 하단 탭바를 대체하여 화면 하단에 고정되는 바텀 액션 바 */}
      {selectMode && (
        <div
          className="shrink-0 flex items-center justify-between px-4 py-2.5 backdrop-blur-md transition-all duration-200"
          style={{
            background: "color-mix(in srgb, var(--surface-2) 90%, transparent)",
            borderTop: "1px solid var(--border)",
            paddingBottom: "max(10px, env(safe-area-inset-bottom))",
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-foreground">
              {selectedIds.size}개 선택됨
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => selectedIds.size > 0 && setShowMoveSheet(true)}
              disabled={selectedIds.size === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12.5px] font-medium transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none shadow-2xs border border-accent/30 bg-accent/10 text-accent hover:bg-accent/20"
            >
              <IconFolder size={15} stroke={1.75} />
              <span>폴더 이동</span>
            </button>
            <button
              onClick={() => selectedIds.size > 0 && setShowBulkDeleteConfirm(true)}
              disabled={selectedIds.size === 0}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[12.5px] font-medium text-white transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none shadow-2xs"
              style={{ background: "var(--danger)" }}
            >
              <IconTrash size={15} stroke={1.75} />
              <span>{sharedSelectedCount > 0 && ownedSelectedCount === 0 ? "나가기" : "삭제"}</span>
            </button>
          </div>
        </div>
      )}

      {showJoin && (
        <JoinBagDialog
          initialCode={initialInviteCode}
          onCancel={() => setShowJoin(false)}
          onConfirm={async (code) => {
            await onJoinBag(code);
            setShowJoin(false);
          }}
        />
      )}

      {showNewBagOptions && (
        <NewBagOptionsSheet
          onClose={() => setShowNewBagOptions(false)}
          onBlank={() => {
            setShowNewBagOptions(false);
            onNewBag();
          }}
          onFromSample={() => {
            setShowNewBagOptions(false);
            setShowSampleSheet(true);
          }}
          onFromNote={() => {
            setShowNewBagOptions(false);
            setShowNoteImport(true);
          }}
          onFromSpreadsheet={() => {
            setShowNewBagOptions(false);
            setShowSpreadsheetImport(true);
          }}
        />
      )}

      {showSpreadsheetImport && (
        <SpreadsheetImportModal
          onClose={() => setShowSpreadsheetImport(false)}
          onResult={(result) => {
            setShowSpreadsheetImport(false);
            onImportNote(result);
          }}
        />
      )}

      {showSampleSheet && (
        <SampleBagSheet
          onClose={() => setShowSampleSheet(false)}
          onSelect={(result) => {
            setShowSampleSheet(false);
            onImportNote(result);
          }}
        />
      )}

      {showNoteImport && (
        <NoteImportModal
          onClose={() => setShowNoteImport(false)}
          onResult={(result) => {
            setShowNoteImport(false);
            onImportNote(result);
          }}
        />
      )}

      {showBulkDeleteConfirm && (
        <ConfirmDialog
          title={bulkDeleteTitle}
          message={bulkDeleteMessage}
          confirmLabel={ownedSelectedCount === 0 && sharedSelectedCount > 0 ? "나가기" : "삭제"}
          tone={ownedSelectedCount === 0 && sharedSelectedCount > 0 ? "accent" : "danger"}
          onCancel={() => setShowBulkDeleteConfirm(false)}
          onConfirm={() => {
            const ids = Array.from(selectedIds);
            setShowBulkDeleteConfirm(false);
            cancelSelectMode();
            onBulkDeleteBags(ids);
          }}
        />
      )}

      {showMoveSheet && (
        <Portal>
          <div
            className="fixed inset-0 z-[97] flex items-end justify-center"
            style={{ background: "rgba(0,0,0,0.45)" }}
            onClick={() => setShowMoveSheet(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-t-2xl bg-surface p-4 flex flex-col gap-2"
              style={{ paddingBottom: "max(16px, calc(env(safe-area-inset-bottom) + 12px))", maxHeight: "70vh", overflowY: "auto" }}
            >
              <span className="text-[15px] font-medium mb-1">이동할 곳</span>
              <button
                onClick={() => {
                  moveBagsToFolder(Array.from(selectedIds), undefined).catch(() => show("이동하지 못했어요"));
                  setShowMoveSheet(false);
                  cancelSelectMode();
                }}
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-left"
                style={{ background: "var(--surface-2)" }}
              >
                <span className="text-[13px] font-medium">가방보관함 (최상위)</span>
              </button>
              {folderNavRows.map(({ folder, depth }) => (
                <button
                  key={folder.id}
                  onClick={() => {
                    moveBagsToFolder(Array.from(selectedIds), folder.id).catch(() => show("이동하지 못했어요"));
                    setShowMoveSheet(false);
                    cancelSelectMode();
                  }}
                  className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-left"
                  style={{ background: "var(--surface-2)", paddingLeft: 12 + depth * 16 }}
                >
                  <IconFolder size={15} stroke={1.75} color="var(--text-secondary)" />
                  <span className="text-[13px] font-medium truncate">{folder.name}</span>
                </button>
              ))}
              {folderNavRows.length === 0 && (
                <p className="text-[12px] text-text-muted py-2 px-1">만든 폴더가 없어요. 위 드롭다운에서 먼저 만들어보세요.</p>
              )}
            </div>
          </div>
        </Portal>
      )}

      {confirmDeleteFolderId && (
        <ConfirmDialog
          title="이 폴더를 삭제할까요?"
          message="폴더 안 가방은 삭제되지 않고 한 단계 위(최상위 또는 상위 폴더)로 이동해요."
          confirmLabel="삭제"
          tone="danger"
          onCancel={() => setConfirmDeleteFolderId(null)}
          onConfirm={() => {
            const id = confirmDeleteFolderId;
            setConfirmDeleteFolderId(null);
            if (selectedFolderId === id) setSelectedFolderId(undefined);
            deleteBagFolder(id).catch(() => show("폴더를 삭제하지 못했어요"));
          }}
        />
      )}
    </div>
  );
}
