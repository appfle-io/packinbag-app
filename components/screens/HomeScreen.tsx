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
} from "@tabler/icons-react";
import { Bag, BagFolder, Pack } from "@/lib/types";
import { useAuth } from "@/contexts/AuthProvider";
import { arrangeList, moveIdInOrder } from "@/lib/listSort";
import { searchBags, BagSearchResult } from "@/lib/librarySearch";
import { daysUntil } from "@/lib/dday";
import BagCard from "@/components/BagCard";
import SortSelect from "@/components/SortSelect";
import QuickPackBar from "@/components/QuickPackBar";
import NotificationBell from "@/components/NotificationBell";
import JoinBagDialog from "@/components/JoinBagDialog";
import NewBagOptionsSheet from "@/components/NewBagOptionsSheet";
import NoteImportModal, { NoteImportResult } from "@/components/NoteImportModal";
import SampleBagSheet from "@/components/SampleBagSheet";
import ConfirmDialog from "@/components/ConfirmDialog";
import Portal from "@/components/Portal";
import { useToast } from "@/components/Toast";

// 길게 누른(롱프레스) 걸로 판정하는 시간. 이보다 짧게 떼면 그냥 탭(가방 열기)으로 처리한다.
const LONG_PRESS_MS = 400;
// 롱프레스 판정 전에 이 픽셀 이상 움직이면 스크롤 의도로 보고 롱프레스를 취소한다.
const MOVE_CANCEL_PX = 10;
// 여행일(D-Day)이 이만큼(일) 지나면 "보관함으로 옮길까요?" 배너로 제안한다.
const ARCHIVE_SUGGEST_DAYS_PAST = 7;

// 폴더 네비게이터(상단 드롭다운)에서 "폴더 없음"을 고를 때 쓰는 키. 실제 폴더 id와
// 겹칠 수 없는 문자열이라 안전하다.
const UNFILED_KEY = "__unfiled__";

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
  const walk = (parentId: string | undefined, depth: number) => {
    Object.values(folders)
      .filter((f) => (f.parentId ?? undefined) === parentId)
      .sort((a, b) => a.name.localeCompare(b.name, "ko"))
      .forEach((f) => {
        rows.push({ folder: f, depth, count: countFor(f.id) });
        walk(f.id, depth + 1);
      });
  };
  walk(undefined, 0);
  return rows;
}

// 검색 결과를 눌렀을 때 어디로 이동할지 알려주는 정보. packId가 있으면 해당 팩까지
// 자동 스크롤 + 하이라이트하고, itemId까지 있으면 짐 자체를 하이라이트한다
// (BagEditorScreen이 focusTarget prop으로 받아서 처리 - AppShell이 중계).
export type BagOpenFocus = { packId?: string; itemId?: string };

export default function HomeScreen({
  uid,
  bags,
  initialInviteCode,
  lockedBagIds,
  quickPack,
  currentUid,
  onOpenBag,
  onNewBag,
  onImportNote,
  onJoinBag,
  onOpenQuickPack,
  onBulkDeleteBags,
}: {
  // 알림종 배지/패널에 쓰임(NotificationBell). currentUid와 동일한 값이지만,
  // 이 프롭은 순수하게 NotificationBell에만 쓰이도록 이름을 따로 두었다.
  uid: string;
  bags: Bag[];
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
  onNewBag: () => void;
  onImportNote: (result: NoteImportResult) => void;
  onJoinBag: (code: string) => Promise<void>;
  onOpenQuickPack: () => void;
  // 길게 눌러 다중선택한 가방들을 한꺼번에 처리 (AppShell이 소유한 가방은 완전 삭제,
  // 공유받은(내 소유가 아닌) 가방은 나가기로 나눠서 처리한다).
  onBulkDeleteBags: (bagIds: string[]) => void;
}) {
  const [showJoin, setShowJoin] = useState(!!initialInviteCode);
  const [showNewBagOptions, setShowNewBagOptions] = useState(false);
  const [showNoteImport, setShowNoteImport] = useState(false);
  const [showSampleSheet, setShowSampleSheet] = useState(false);
  const {
    profile,
    updateBagSortBy,
    toggleBagPinned,
    toggleBagArchived,
    archiveBags,
    dismissArchiveSuggestions,
    updateBagOrder,
    createBagFolder,
    renameBagFolder,
    deleteBagFolder,
    moveBagsToFolder,
  } = useAuth();
  const { show } = useToast();
  const sortBy = profile?.bagSortBy ?? "createdAt";
  const pinnedIds = profile?.pinnedBagIds ?? [];
  // "보관" 처리된 가방은 삭제가 아니라 그냥 메인 목록("진행중" 탭)에서 숨기고 "보관" 탭으로
  // 옮긴다 - 다 쓴 가방이 계속 홈 화면에 쌓이는 걸 정리하기 위한 용도.
  const archivedSet = new Set(profile?.archivedBagIds ?? []);

  // 가방보관함 폴더(개인 메타데이터, 가방 문서 자체와는 무관 - BagFolder 주석 참고).
  const bagFolders = profile?.bagFolders ?? {};
  const bagFolderAssignments = profile?.bagFolderAssignments ?? {};
  const [folderNavOpen, setFolderNavOpen] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(undefined);
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

  const folderNavRows = useMemo(
    () => buildFolderNavRows(bagFolders, bagFolderAssignments, bags),
    [bagFolders, bagFolderAssignments, bags]
  );

  const selectedFolderLabel = !selectedFolderId
    ? "전체"
    : selectedFolderId === UNFILED_KEY
    ? "폴더 없음"
    : bagFolders[selectedFolderId]?.name ?? "전체";

  const [bagFilter, setBagFilter] = useState<"active" | "archived">("active");
  const activeBagsAll = bags.filter((b) => !archivedSet.has(b.id));
  const archivedBagsAll = bags.filter((b) => archivedSet.has(b.id));
  const baseBags = bagFilter === "archived" ? archivedBagsAll : activeBagsAll;
  const visibleBags = !selectedFolderId
    ? baseBags
    : selectedFolderId === UNFILED_KEY
    ? baseBags.filter((b) => !bagFolderAssignments[b.id])
    : baseBags.filter((b) => bagFolderAssignments[b.id] === selectedFolderId);
  const arrangedBags = arrangeList(visibleBags, { sortBy, pinnedIds, order: profile?.bagOrder });
  // 설정 > 화면설정 > 가방 > 카드 크기. "작게"를 고르면 한 화면에 더 많은 가방이 보이도록
  // 그리드 열이 늘어나고, "크게"를 고르면 열이 줄어 카드 하나하나가 커진다.
  const bagCardSize = profile?.bagCardSize ?? "medium";
  const bagGridColsClass =
    bagCardSize === "small"
      ? "grid-cols-3 sm:grid-cols-4"
      : bagCardSize === "large"
      ? "grid-cols-1 sm:grid-cols-2"
      : "grid-cols-2 sm:grid-cols-3";
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
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { results: searchResults, truncated: searchTruncated } = useMemo(
    () => searchBags(bags, searchQuery),
    [bags, searchQuery]
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
    closeSearch();
    onOpenBag(result.bag, { packId: result.packId, itemId: result.itemId });
  };

  // --- 길게 눌러서 순서 바꾸기 / 다중선택 ------------------------------------
  // 고정된 가방은 드래그 대상에서 제외한다(항상 맨 앞에 고정). 놓는 순간 지금 화면에
  // 보이던 순서를 그대로 bagOrder로 저장하고 정렬기준을 "custom"으로 전환한다
  // (updateBagOrder가 이 둘을 한 번에 처리).
  //
  // 길게 누르고 "그대로 뗀" 경우(실제로 다른 카드 위로 옮기지 않은 경우)는 다중선택
  // 모드 진입으로 취급한다. 즉 같은 롱프레스 제스처가 "움직이면 순서변경", "가만히
  // 있다 떼면 다중선택 시작"으로 나뉜다 - 그래서 두 기능이 서로 충돌하지 않는다.
  const [reorderDrag, setReorderDrag] = useState<{ id: string; x: number; y: number; overId: string | null } | null>(
    null
  );
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
      if (pinnedSet.has(bagId)) {
        // 고정된 카드는 순서를 바꿀 수 없지만, 길게 눌러 다중선택 모드로 들어가는 건 허용한다.
        enterSelectMode(bagId);
        justDraggedRef.current = true;
      } else {
        setReorderDrag({ id: bagId, x, y, overId: null });
      }
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
      const cardEl = el?.closest("[data-bag-drop-id]") as HTMLElement | null;
      const overId = cardEl?.getAttribute("data-bag-drop-id") ?? null;
      setReorderDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY, overId } : d));
    };

    const handleUp = () => {
      setReorderDrag((d) => {
        if (d) {
          if (d.overId && d.overId !== d.id && !pinnedSet.has(d.overId)) {
            // 실제로 다른 카드 위로 옮겨서 놓은 경우 -> 순서 변경
            const currentIds = arrangedBags.filter((b) => !pinnedSet.has(b.id)).map((b) => b.id);
            const nextOrder = moveIdInOrder(currentIds, d.id, d.overId);
            updateBagOrder(nextOrder).catch(() => show("순서를 저장하지 못했어요"));
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
        <div className="flex items-center justify-between mb-4 gap-2">
          {searchOpen ? (
            <>
              <div className="flex items-center gap-2 flex-1 min-w-0 rounded-lg border border-border bg-surface-2 px-2.5 py-1.5">
                <IconSearch size={16} stroke={1.75} color="var(--text-muted)" className="shrink-0" />
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="가방, 팩, 짐 검색"
                  className="min-w-0 flex-1 bg-transparent text-[14px] outline-none"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} aria-label="검색어 지우기" className="shrink-0">
                    <IconX size={15} stroke={1.75} color="var(--text-muted)" />
                  </button>
                )}
              </div>
              <button
                onClick={closeSearch}
                className="shrink-0 text-[13px] text-text-secondary px-1"
              >
                취소
              </button>
            </>
          ) : (
            <>
              <div className="flex items-baseline gap-2 min-w-0">
                <h1 className="text-[22px] font-bold shrink-0">가방</h1>
                <span className="text-[12px] text-text-muted truncate">
                  팩을 모아 자유롭게 정리하는 공간이에요
                </span>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <button
                  onClick={openSearch}
                  aria-label="검색"
                  className="-m-2 p-2"
                >
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
              <button
                onClick={cancelSelectMode}
                className="text-[13px] text-text-secondary px-1 py-1.5"
              >
                취소
              </button>
              <span className="text-[13px] font-medium">{selectedIds.size}개 선택됨</span>
            </div>
          ) : (
            <div className="flex items-center justify-between mb-3 gap-2">
              <button
                onClick={() => setShowJoin(true)}
                className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[12px] shrink-0"
              >
                <IconTicket size={14} stroke={1.75} />
                코드로 참여
              </button>
              <div className="flex items-center gap-1.5 shrink-0">
                {(archivedBagsAll.length > 0 || bagFilter === "archived") && (
                  <div
                    className="flex items-center gap-1 rounded-lg border border-border px-2 py-1.5"
                    style={{ background: "var(--surface-2)" }}
                  >
                    <IconArchive size={13} stroke={1.75} color="var(--text-secondary)" />
                    <select
                      value={bagFilter}
                      onChange={(e) => setBagFilter(e.target.value as "active" | "archived")}
                      aria-label="진행중/보관"
                      className="bg-transparent text-[12px] pr-1 outline-none"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      <option value="active">진행중 ({activeBagsAll.length})</option>
                      <option value="archived">보관 ({archivedBagsAll.length})</option>
                    </select>
                  </div>
                )}
                {bags.length > 0 && (
                  <SortSelect value={sortBy} onChange={(v) => updateBagSortBy(v).catch(() => show("변경사항을 저장하지 못했어요"))} />
                )}
              </div>
            </div>
          ))}

        {!searchOpen && !selectMode && (
          <div className="mb-3">
            <button
              onClick={() => setFolderNavOpen((v) => !v)}
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
            {folderNavOpen && (
              <div
                className="mt-1.5 rounded-lg border border-border overflow-hidden"
                style={{ background: "var(--surface)", maxHeight: 260, overflowY: "auto" }}
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
                    onClick={() => (selectMode ? toggleSelected(bag.id) : onOpenBag(bag))}
                  />
                  {selectMode && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div
                        className="h-9 w-9 rounded-full flex items-center justify-center"
                        style={{
                          background: selectedIds.has(bag.id) ? "var(--accent)" : "rgba(255,255,255,0.9)",
                          border: selectedIds.has(bag.id) ? "none" : "1.5px solid var(--border-strong)",
                          boxShadow: "0 1px 6px rgba(0,0,0,0.2)",
                        }}
                      >
                        {selectedIds.has(bag.id) && <IconCheck size={18} stroke={3} color="#fff" />}
                      </div>
                    </div>
                  )}
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

      <QuickPackBar pack={quickPack} onClick={onOpenQuickPack} />

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
          {bags.find((b) => b.id === reorderDrag.id)?.name || "가방"}
        </div>
      )}

      {/* 다중선택 모드일 때 화면 가운데 하단에 떠 있는 삭제 버튼.
          이 화면(HomeScreen) 루트가 relative라서 앱 컬럼 폭 기준으로 가운데 정렬된다.
          bottom-24(96px)만큼 충분히 띄운 이유: 하단탭바 중앙에는 "+"(빠른입력) FAB가
          nav 위로 44px 튀어나와 있는데(BottomTabBar.tsx), 이 화면 컨테이너 바닥이 곧
          그 nav의 윗변과 같은 자리라서 bottom-4처럼 너무 가깝게 두면 삭제 버튼이 그
          "+" 버튼과 겹쳐 보인다. 그 FAB 위로 확실히 떨어지도록 여유를 뒀다.
      */}
      {selectMode && (
        <div className="absolute inset-x-0 bottom-24 z-[96] flex justify-center gap-3 pointer-events-none">
          <button
            onClick={() => selectedIds.size > 0 && setShowMoveSheet(true)}
            disabled={selectedIds.size === 0}
            aria-label="선택한 가방 폴더로 이동"
            className="pointer-events-auto h-14 w-14 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-90 disabled:opacity-40"
            style={{ background: "var(--accent)" }}
          >
            <IconArrowRight size={22} stroke={1.75} color="#fff" />
          </button>
          <button
            onClick={() => selectedIds.size > 0 && setShowBulkDeleteConfirm(true)}
            disabled={selectedIds.size === 0}
            aria-label="선택한 가방 삭제"
            className="pointer-events-auto h-14 w-14 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-90 disabled:opacity-40"
            style={{ background: "var(--danger)" }}
          >
            <IconTrash size={24} stroke={1.75} color="#fff" />
          </button>
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
