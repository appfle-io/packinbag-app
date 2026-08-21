"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  IconSparkles,
  IconArrowsSort,
  IconPinnedFilled,
  IconPinned,
  IconListCheck,
  IconChevronsLeft,
  IconChevronsRight,
} from "@tabler/icons-react";
import { Bag, BagFolder, Pack, ListSortOption } from "@/lib/types";
import { useAuth } from "@/contexts/AuthProvider";
import { isPremiumUser, getViewablePacks } from "@/lib/premiumLimits";
import { arrangeList, SORT_OPTIONS, SORT_OPTION_LABELS } from "@/lib/listSort";
import { collectDescendantPackIds } from "@/lib/packsService";
import { saveBagRemote } from "@/lib/bagsService";
import { useToast } from "@/components/Toast";
import PackColorDot from "@/components/PackColorDot";
import Portal from "@/components/Portal";
import ConfirmDialog from "@/components/ConfirmDialog";
import NotificationBell from "@/components/NotificationBell";
import PackTemplateGalleryModal from "@/components/PackTemplateGalleryModal";
import { useOverlayLayer, POPOVER_OFFSET } from "@/lib/overlayLayer";
import { useEscapeToClose } from "@/lib/useEscapeToClose";

const MENU_MARGIN = 10;

// 데스크톱 사이드바 폭 범위(px) + 기본값. 오른쪽 가장자리를 드래그해서 조절하면 이 범위로
// 항상 클램프되고, 계정(profile.sidebarWidth)에 저장되어 기기 간에도 그대로 유지된다.
const MIN_SIDEBAR_WIDTH = 220;
const MAX_SIDEBAR_WIDTH = 420;
const DEFAULT_SIDEBAR_WIDTH = 288; // 기존 w-72와 동일
const COLLAPSED_SIDEBAR_WIDTH = 56;

function clampSidebarWidth(width: number): number {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width));
}

// 메뉴(가방/폴더 "..." 메뉴, 팩/폴더 "..." 메뉴) 위치 + 최대높이 계산.
// 예전에는 top을 "창 높이 - 대략 이 정도 높이일 것이다(280 등 하드코딩 guess)"로만
// 클램프하고, 팝업 자체의 maxHeight는 70vh로 고정해뒀다. 그런데 "이동할 곳" 하위
// 폴더 목록은 폴더가 많아지면 실제 높이가 그 guess보다 훨씬 커질 수 있어서, 사이드바
// 목록이 길어진 상태에서 아래쪽 항목의 "..."를 누르면(버튼 위치가 이미 화면 아래쪽이라
// 남은 공간이 얼마 없는데) 메뉴 아래쪽(하위 폴더 목록)이 화면 밖으로 밀려나가 짤리는
// 문제가 있었다. 이제는 클릭 시점에 실제 남은 공간(아래/위)을 계산해서, 공간이 되는
// 방향으로 열고 그 공간에 맞춰 maxHeight를 잡아준다(모자라면 팝업 자체 스크롤로 처리).
function calcMenuPosition(
  rect: { top: number; bottom: number; left: number },
  opts: { width?: number; preferredMaxHeight?: number } = {}
): { top: number; left: number; maxHeight: number } {
  const width = opts.width ?? 200;
  const preferred = opts.preferredMaxHeight ?? 320;
  const spaceBelow = window.innerHeight - rect.bottom - MENU_MARGIN;
  const spaceAbove = rect.top - MENU_MARGIN;

  let top: number;
  let maxHeight: number;
  if (spaceBelow >= Math.min(preferred, 160) || spaceBelow >= spaceAbove) {
    // 아래로 펼침
    top = rect.bottom + 4;
    maxHeight = Math.max(120, Math.min(preferred, spaceBelow));
  } else {
    // 아래 공간이 모자라면 버튼 위쪽으로 펼친다
    maxHeight = Math.max(120, Math.min(preferred, spaceAbove));
    top = Math.max(MENU_MARGIN, rect.top - 4 - maxHeight);
  }

  const left = Math.min(Math.max(MENU_MARGIN, rect.left), window.innerWidth - width - MENU_MARGIN);
  return { top, left, maxHeight };
}

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
  onDeleteBag,
  onRenameBag,
  onNewPack,
  onNewFolder,
  onChangeColor,
  onRenamePackEntry,
  onMovePackEntries,
  onDeletePackEntry,
  onDropQuickPackItems,
  settingsActive,
}: {
  uid: string;
  bags: Bag[];
  libraryPacks: Pack[];
  selection: DesktopSelection | null;
  onSelect: (selection: DesktopSelection) => void;
  onNewBag: (folderId?: string) => void;
  onDeleteBag: (bag: Bag) => void;
  onRenameBag: (bag: Bag, name: string) => void;
  onNewPack: (parentId?: string, kind?: "checklist" | "editor") => void;
  onNewFolder: (parentId?: string) => void;
  onChangeColor: (pack: Pack, colorId: string | undefined) => void;
  onRenamePackEntry: (pack: Pack, name: string) => void;
  onMovePackEntries: (packIds: string[], parentId: string | undefined) => void;
  onDeletePackEntry: (packId: string) => void;
  onDropQuickPackItems?: (targetType: "bag" | "pack", targetId: string, items: any[]) => void;
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
    updateBagOrderByParent,
    updatePackOrderByParent,
    updateBagSortBy,
    updatePackSortBy,
    toggleBagPinned,
    togglePackPinned,
    updateSidebarWidth,
    updateSidebarCollapsed,
  } = useAuth();

  // 지금 이 사이드바를 보는 사람(로그인한 본인) 기준 프리미엄 여부. 다른 멤버가 만든 AI추천
  // 팩(Pack.aiRecommendSource)을 이 사람이 무료회원이면 트리 미리보기에서 숨긴다.
  const premium = isPremiumUser(profile?.email, profile ?? null);

  // 사이드바 폭/접힌 상태 - 계정(profile)에서 초기값을 가져오고, 드래그 중에는 네트워크
  // 왕복 없이 로컬 state만 바꾸다가 놓았을 때만 계정에 저장한다.
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    clampSidebarWidth(profile?.sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH)
  );
  useEffect(() => {
    if (profile?.sidebarWidth != null) {
      setSidebarWidth(clampSidebarWidth(profile.sidebarWidth));
    }
  }, [profile?.sidebarWidth]);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    () => profile?.sidebarCollapsed ?? false
  );
  useEffect(() => {
    setIsSidebarCollapsed(profile?.sidebarCollapsed ?? false);
  }, [profile?.sidebarCollapsed]);

  const handleSidebarResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    const handleMouseMove = (moveEvent: MouseEvent) => {
      setSidebarWidth(clampSidebarWidth(startWidth + (moveEvent.clientX - startX)));
    };
    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      setSidebarWidth((current) => {
        updateSidebarWidth(current).catch(() => {});
        return current;
      });
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const toggleSidebarCollapsed = () => {
    const next = !isSidebarCollapsed;
    setIsSidebarCollapsed(next);
    updateSidebarCollapsed(next).catch(() => {});
  };
  const [expandedBagIds, setExpandedBagIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Cmd+K / Ctrl+K 단축키로 검색창 포커스
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isSidebarCollapsed) {
          setIsSidebarCollapsed(false);
          updateSidebarCollapsed(false).catch(() => {});
        }
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSidebarCollapsed, updateSidebarCollapsed]);

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

  const { show } = useToast();
  const [showTemplateGallery, setShowTemplateGallery] = useState(false);
  const [activeDragData, setActiveDragData] = useState<{
    type: "bag" | "bag-folder" | "pack" | "pack-folder" | "bag-pack";
    id: string;
    // "bag-pack"(가방 안에 들어있는 팩)을 드래그할 때만 쓰인다 - 어느 가방에서 꺼내온 건지를
    // 알아야 그 가방에서만 지우고 대상 가방에 넣을 수 있다.
    sourceBagId?: string;
  } | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);
  const [dropZone, setDropZone] = useState<"before" | "after" | null>(null);
  // 2026-07-30: 드래그로는 into(폴더 안으로 넣기)를 지원하지 않고 항상 before/after로만 판단한다.
  // 폴더 안으로 넣는 건 "..." 맩니의 "이동" 목록으로만 한다.
  const computeDropZone = (e: React.DragEvent): "before" | "after" => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relY = (e.clientY - rect.top) / rect.height;
    return relY < 0.5 ? "before" : "after";
  };

  const handleDragStart = (
    e: React.DragEvent,
    type: "bag" | "bag-folder" | "pack" | "pack-folder" | "bag-pack",
    id: string,
    sourceBagId?: string
  ) => {
    e.dataTransfer.setData("application/json", JSON.stringify({ type, id }));
    e.dataTransfer.effectAllowed = "move";
    setActiveDragData({ type, id, sourceBagId });
  };

  const handleDragEnd = () => {
    setActiveDragData(null);
    setDropTargetKey(null);
    setDropZone(null);
  };

  const canDropOnTarget = (
    targetType: "bag" | "bag-folder" | "bag-root" | "pack-folder" | "pack-root" | "pack",
    targetId?: string,
    e?: React.DragEvent
  ): boolean => {
    // 중요: 이 체크는 우리 자체 라이브러리 드래그(activeDragData가 있는 경우)가 아닌,
    // 외부에서 들어오는 드래그(빠른팩 아이템처럼 activeDragData로 추적하지 않는 것)만
    // 허용해야 한다. 예전엔 activeDragData 유무와 무관하게 이 검사가 항상 먼저 통과되어버려서,
    // 우리 자체의 드래그(팩/가방 등)도 아무 곳에나 놓을 수 있는 것처럼 보이는(그리고 실제로 엉뚱한
    // 곳으로 이동/삭제되는) 심각한 버그가 있었다(팩이 사라지는 것처럼 보이던 버그의 원인).
    if (!activeDragData) {
      if (e && e.dataTransfer && e.dataTransfer.types) {
        if (
          e.dataTransfer.types.includes("application/json") ||
          e.dataTransfer.types.includes("text/plain")
        ) {
          return true;
        }
      }
      return false;
    }

    // 1) 가방 / 가방폴더 드래그 중
    if (activeDragData.type === "bag" || activeDragData.type === "bag-folder") {
      // 팩보관함(pack-folder, pack-root)으로는 절대 이동 불가능! (가방 ➡️ 팩보관함 이동 금지)
      if (targetType === "pack-folder" || targetType === "pack-root" || targetType === "pack") return false;
      if (targetType === "bag") {
        // 가방 위에 드롭하는 건 "가방 안에 가방 넣기"가 아니라, 그 가방 옆으로 순서를
        // 재배치(또는 그 가방과 같은 폴더로 이동+재배치)하겠다는 뜻이다 - 실제 재배치
        // 로직은 이 아래 handleDropOnTarget에 이미 있었는데, 여기서 항상 false를
        // 돌려버려서 한 번도 실행되지 못했다(폴더 안 순서변경이 안 되던 원인).
        if (activeDragData.type === "bag" && activeDragData.id === targetId) return false;
        return true;
      }
      if (targetType === "bag-folder") {
        if (activeDragData.type === "bag-folder") {
          if (activeDragData.id === targetId) return false;
          const descendants = collectDescendantBagFolderIds(bagFolders, activeDragData.id);
          if (descendants.includes(targetId!)) return false;
        }
        return true;
      }
      if (targetType === "bag-root") return true;
    }

    // 1-b) 가방 안에 들어있는 팩(bag-pack) 드래그 중 - 다른 가방 위에만 놓을 수 있다
    // (A가방의 a팩을 B가방으로 옮기는 기능 - 폴더/최상위로는 못 옮긴다, 가방 안 팩은
    // 항상 어느 가방 소속인지가 의미가 있어서 "독립된 팩"으로 띄울 수 없기 때문).
    if (activeDragData.type === "bag-pack") {
      return targetType === "bag" && targetId !== activeDragData.sourceBagId;
    }

    // 2) 팩 드래그 중
    if (activeDragData.type === "pack") {
      if (targetType === "bag") return true; // ★ 팩 ➡️ 가방 이동 가능 (가방에 팩 담기)
      if (targetType === "bag-folder") return false; // ★ 폴더 하위로는 안 됨 (가방속이 아니니까)
      if (targetType === "bag-root") return false;
      if (targetType === "pack") {
        // 다른 팩 위에 드롭하는 건 팩 안에 팩 넣기가 아니라, 그 팩 옆으로 순서를 재배치하겠다는
        // 뜻이다 - 가방 케이스와 동일한 이유로 이 케이스가 빠져있어서 폴더 안 팩 순서변경이
        // 안 되던 원인이었다.
        if (activeDragData.id === targetId) return false;
        return true;
      }
      if (targetType === "pack-folder") {
        if (activeDragData.id === targetId) return false;
        return true;
      }
      if (targetType === "pack-root") return true;
    }

    // 3) 팩 폴더 드래그 중
    if (activeDragData.type === "pack-folder") {
      if (targetType === "bag" || targetType === "bag-folder" || targetType === "bag-root") return false;
      if (targetType === "pack") {
        // 위와 동일한 이유 - 폴더를 일반 팩(체크팩/메모팩) 옆으로 드롭해서 순서를 바꿀 수 있어야 한다.
        if (activeDragData.id === targetId) return false;
        return true;
      }
      if (targetType === "pack-folder") {
        if (activeDragData.id === targetId) return false;
        const descendants = collectDescendantPackIds(treePacks, activeDragData.id);
        if (descendants.includes(targetId!)) return false;
        return true;
      }
      if (targetType === "pack-root") return true;
    }

    return false;
  };

  const handleDropOnTarget = async (
    targetType: "bag" | "bag-folder" | "bag-root" | "pack-folder" | "pack-root" | "pack",
    targetId?: string,
    e?: React.DragEvent,
    zone?: "before" | "after"
  ) => {
    setDropTargetKey(null);
    setDropZone(null);

    // ★ 빠른 팩 외부 아이템 드롭 처리
    if (e && e.dataTransfer) {
      const jsonStr = e.dataTransfer.getData("application/json") || e.dataTransfer.getData("text/plain");
      if (jsonStr) {
        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed && parsed.type === "quick-pack-items" && Array.isArray(parsed.items) && parsed.items.length > 0) {
            if (onDropQuickPackItems && targetId) {
              const typeKey = targetType.startsWith("bag") ? "bag" : "pack";
              onDropQuickPackItems(typeKey, targetId, parsed.items);
              setActiveDragData(null);
              return;
            }
          }
        } catch (err) {}
      }
    }
    if (!activeDragData) return;

    // 팩 보관함 팩(activeDragData.type==="pack") ➡️ 가방 위 드롭 - 보관함 팩을 복사해서 가방에 담는다(기존).
    // 이와는 다른 "가방 안에 이미 들어있는 팩"(bag-pack)을 다른 가방으로 통채로 옮기는 기능은
    // 바로 아래에 따로 처리한다.
    if (activeDragData.type === "bag-pack" && targetType === "bag" && targetId) {
      const sourceBagId = activeDragData.sourceBagId;
      const sourceBag = bags.find((b) => b.id === sourceBagId);
      const targetBag = bags.find((b) => b.id === targetId);
      const movingPack = sourceBag?.packs.find((p) => p.id === activeDragData.id);
      if (!sourceBag || !targetBag || !movingPack) {
        setActiveDragData(null);
        return;
      }
      if (targetBag.packs.length >= 10) {
        show("가방 하나에는 팩을 최대 10개까지만 넣을 수 있어요");
        setActiveDragData(null);
        return;
      }
      const now = new Date().toISOString();
      const updatedSourceBag: Bag = {
        ...sourceBag,
        packs: sourceBag.packs.filter((p) => p.id !== movingPack.id),
        updatedAt: now,
      };
      const updatedTargetBag: Bag = {
        ...targetBag,
        packs: [...targetBag.packs, movingPack],
        updatedAt: now,
      };
      try {
        await Promise.all([saveBagRemote(updatedSourceBag), saveBagRemote(updatedTargetBag)]);
        show(`'${movingPack.name}' 팩을 '${targetBag.name}' 가방으로 옮겼어요`);
      } catch (err) {
        console.error("[팩인백] 가방 간 팩 이동 실패:", err);
        show("팩을 옮기지 못했어요.");
      }
      setActiveDragData(null);
      return;
    }

    // ★ 팩 ➡️ 가방 위 드롭 (가방에 팩 추가 - 팩보관함과 링크 연동)
    if (activeDragData.type === "pack" && targetType === "bag" && targetId) {
      const pack = treePacks.find((p) => p.id === activeDragData.id);
      const targetBag = bags.find((b) => b.id === targetId);
      if (pack && targetBag) {
        if (targetBag.packs.length >= 10) {
          show("가방 하나에는 팩을 최대 10개까지 넣을 수 있어요");
          setActiveDragData(null);
          return;
        }

        const newPack: Pack = {
          ...pack,
          id: `pack-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          savedAsLibraryPack: true,
          linkedLibraryPackId: pack.id,
          linkedLibraryUpdatedAt: pack.updatedAt,
          items: pack.items.map((i) => ({
            ...i,
            id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          })),
        };
        const updatedBag: Bag = {
          ...targetBag,
          packs: [...targetBag.packs, newPack],
          updatedAt: new Date().toISOString(),
        };
        try {
          await saveBagRemote(updatedBag);
          show(`'${pack.name}' 팩을 '${targetBag.name}' 가방에 연동하여 담았어요`);
        } catch (err) {
          console.error("[팩인백] 팩 가방 추가 실패:", err);
          show("팩을 가방에 담지 못했어요.");
        }
      }
      setActiveDragData(null);
      return;
    }

    // 가방 ➡️ 가방 폴더 / 최상위 / 다른 가방 (순서 재배치 포함)
    if (activeDragData.type === "bag" || activeDragData.type === "bag-folder") {
      const isBag = activeDragData.type === "bag";
      let targetParentId: string | undefined = undefined;
      if (targetType === "bag-folder" && targetId) {
        targetParentId = bagFolders[targetId]?.parentId;
      } else if (targetType === "bag" && targetId) {
        targetParentId = bagFolderAssignments[targetId];
      }

      if (isBag) {
        await moveBagToFolder(activeDragData.id, targetParentId);
      } else {
        await moveBagFolder(activeDragData.id, targetParentId);
      }

      if (targetId && activeDragData.id !== targetId) {
        const parentKey = targetParentId ?? "root";
        const childFolders = Object.values(bagFolders).filter(
          (f) => (f.parentId ?? undefined) === targetParentId && f.id !== activeDragData!.id
        );
        const childBags = bags.filter(
          (b) => (bagFolderAssignments[b.id] ?? undefined) === targetParentId && b.id !== activeDragData!.id
        );
        const combined = [
          ...childFolders.map((f) => ({ id: f.id, name: f.name, createdAt: f.createdAt })),
          ...childBags.map((b) => ({ id: b.id, name: b.name, createdAt: b.createdAt, updatedAt: b.updatedAt })),
        ];
        const currentOrder = profile?.bagOrderByParent?.[parentKey] ?? [];
        const arranged = arrangeList(combined, {
          sortBy: profile?.bagSortBy ?? "createdAt",
          pinnedIds: profile?.pinnedBagIds ?? [],
          order: currentOrder,
          maxPinned: 3,
        });
        const currentIds = arranged.map((it) => it.id);
        let insertAt = currentIds.indexOf(targetId);
        if (insertAt === -1) insertAt = currentIds.length;
        else if (zone === "after") insertAt += 1;
        const newOrder = [...currentIds];
        newOrder.splice(insertAt, 0, activeDragData.id);
        await updateBagOrderByParent(parentKey, newOrder);
      }

      setActiveDragData(null);
      return;
    }

    // 팩 / 팩 폴더 ➡️ 팩 폴더 / 최상위 / 다른 팩 (순서 재배치 포함)
    if (activeDragData.type === "pack" || activeDragData.type === "pack-folder") {
      let targetParentId: string | undefined = undefined;
      if (targetType === "pack-folder" && targetId) {
        const targetFolder = treePacks.find((p) => p.id === targetId);
        targetParentId = targetFolder?.parentId;
      } else if (targetType === "pack" && targetId) {
        const targetPack = treePacks.find((p) => p.id === targetId);
        targetParentId = targetPack?.parentId;
      }

      onMovePackEntries([activeDragData.id], targetParentId);

      if (targetId && activeDragData.id !== targetId) {
        const parentKey = targetParentId ?? "root";
        const siblings = treePacks.filter(
          (p) => (p.parentId ?? undefined) === targetParentId && p.id !== activeDragData!.id
        );
        const currentOrder = profile?.packOrderByParent?.[parentKey] ?? [];
        const arranged = arrangeList(siblings, {
          sortBy: profile?.packSortBy ?? "createdAt",
          pinnedIds: profile?.pinnedPackIds ?? [],
          order: currentOrder,
          maxPinned: Infinity,
        });
        const currentIds = arranged.map((it) => it.id);
        let insertAt = currentIds.indexOf(targetId);
        if (insertAt === -1) insertAt = currentIds.length;
        else if (zone === "after") insertAt += 1;
        const newOrder = [...currentIds];
        newOrder.splice(insertAt, 0, activeDragData.id);
        await updatePackOrderByParent(parentKey, newOrder);
      }

      setActiveDragData(null);
      return;
    }
  };

  const treePacks = useMemo(() => libraryPacks.filter((p) => !p.isQuickPack), [libraryPacks]);
  const bagFolders = profile?.bagFolders ?? {};
  const bagFolderAssignments = profile?.bagFolderAssignments ?? {};
  // 고정핀(★)된 가방/팩은 정렬 기준과 무관하게 항상 제일 위에 띄있다 - 데스크톱에서는 이 상태를
  // 보여줄 별도 표시가 없어서 "이거 고정된 거예요?" 헷갈릴 수 있었다 - 이름 옆에 작은 핀 아이콘으로 보여준다.
  const pinnedBagIds = profile?.pinnedBagIds ?? [];
  const pinnedPackIds = profile?.pinnedPackIds ?? [];

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

  // --- 정렬 기준 메뉴(아이콘 버튼 -> "..." 메뉴처럼 작은 팝업) --------------------
  // 사이드바 폭이 좁아서 항상 펼쳐지는 SortSelect(select 태그)를 두면 다른 헤더 버튼들과
  // 종종 줄바꿈이 생기는 문제가 있어서, 아이콘 하나만 두고 누르면 헤더 아래에 드롭다운으로
  // 정렬 옵션을 고르는 방식으로 바꿨다(2026-07). 지금 무엇이 선택되어있는지는 따로 표시하지
  // 않는다(자주 바뀌는 설정이 아니라고 판단) - 클릭해서 고르기만 하면 된다.
  const [sortMenuFor, setSortMenuFor] = useState<{
    kind: "bag" | "pack";
    position: { top: number; left: number };
  } | null>(null);

  // 폴더 행의 + 버튼을 누르면 "가방/팩 추가" vs "폴더 추가" 둘 중 고르는 작은 팝업.
  const [addMenuFor, setAddMenuFor] = useState<{
    kind: "bag" | "pack";
    parentId?: string;
    position: { top: number; left: number };
  } | null>(null);
  useEscapeToClose(() => setAddMenuFor(null), !!addMenuFor);

  // --- 가방/폴더 "..." 메뉴(이동/이름바꾸기/삭제) --------------------------------
  const [menuFor, setMenuFor] = useState<{
    kind: "bag" | "folder";
    id: string;
    position?: { top: number; left: number; maxHeight: number };
  } | null>(null);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [confirmDeleteFolderId, setConfirmDeleteFolderId] = useState<string | null>(null);
  // 가방 자체 이름바꾸기/삭제 - 폴더와 동일한 인라인 패턴 사용
  const [renamingBagId, setRenamingBagId] = useState<string | null>(null);
  const [bagRenameDraft, setBagRenameDraft] = useState("");
  const [confirmDeleteBagId, setConfirmDeleteBagId] = useState<string | null>(null);

  const startRenameBag = (bag: Bag) => {
    setRenamingBagId(bag.id);
    setBagRenameDraft(bag.name);
    setMenuFor(null);
  };

  const commitRenameBag = () => {
    if (renamingBagId && bagRenameDraft.trim()) {
      const bag = bags.find((b) => b.id === renamingBagId);
      if (bag) onRenameBag(bag, bagRenameDraft.trim());
    }
    setRenamingBagId(null);
  };

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
  const [packMenuFor, setPackMenuFor] = useState<{
    id: string;
    isFolder: boolean;
    position?: { top: number; left: number; maxHeight: number };
  } | null>(null);
  const [renamingPackId, setRenamingPackId] = useState<string | null>(null);
  const [packRenameDraft, setPackRenameDraft] = useState("");
  const [confirmDeletePackId, setConfirmDeletePackId] = useState<string | null>(null);

  const ambientLayer = useOverlayLayer();
  useEscapeToClose(() => setMenuFor(null), !!menuFor);
  useEscapeToClose(() => setSortMenuFor(null), !!sortMenuFor);
  useEscapeToClose(() => setPackMenuFor(null), !!packMenuFor);

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

  // 접힌 상태일 때는 아이콘만 남은 좁은 레일로 교체해서 보여준다. 이 위에서 모든 hook이 이미 호출된 뒤이라
  // 조건부 return으로 빠져나가도 안전하다.
  if (isSidebarCollapsed) {
    return (
      <div
        className="flex h-full shrink-0 flex-col items-center border-r border-border py-3 gap-2"
        style={{ width: COLLAPSED_SIDEBAR_WIDTH }}
      >
        <button
          onClick={toggleSidebarCollapsed}
          aria-label="사이드바 펼치기"
          title="사이드바 펼치기"
          className="p-1.5 rounded-md hover:bg-black/5"
        >
          <IconChevronsRight size={17} stroke={1.75} color="var(--text-muted)" />
        </button>
        <button
          onClick={toggleSidebarCollapsed}
          aria-label="가방 보관함 (펼쳐서 보기)"
          title="가방 보관함"
          className="p-1.5 rounded-md hover:bg-black/5"
        >
          <IconBackpack size={18} stroke={1.75} color="var(--text-secondary)" />
        </button>
        <button
          onClick={toggleSidebarCollapsed}
          aria-label="팩 보관함 (펼쳐서 보기)"
          title="팩 보관함"
          className="p-1.5 rounded-md hover:bg-black/5"
        >
          <IconFolder size={18} stroke={1.75} color="var(--text-secondary)" />
        </button>
        <div className="flex-1" />
        <button
          onClick={() => onSelect({ kind: "settings" })}
          aria-label="설정 · 휴지통"
          title="설정 · 휴지통"
          className="p-1.5 rounded-md hover:bg-black/5"
          style={{ background: settingsActive ? "var(--accent-soft)" : undefined }}
        >
          <IconSettings size={18} stroke={1.75} color="var(--text-secondary)" />
        </button>
      </div>
    );
  }

  return (
    <div
      className="relative flex h-full shrink-0 flex-col border-r border-border"
      style={{ width: sidebarWidth }}
    >
      <div className="shrink-0 p-3 pb-2 flex items-center gap-1.5">
        <div className="flex items-center gap-2 min-w-0 flex-1 rounded-xl border border-border/80 bg-surface-2/60 focus-within:bg-background focus-within:border-accent/60 focus-within:ring-1 focus-within:ring-accent/20 px-2.5 py-1.5 transition-all">
          <IconSearch size={14} stroke={1.75} color="var(--text-muted)" className="shrink-0" />
          <input
            ref={searchInputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="빠른 이동..."
            className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none text-foreground placeholder:text-text-muted"
          />
          {query ? (
            <button onClick={() => setQuery("")} aria-label="검색어 지우기" className="shrink-0 text-text-muted hover:text-foreground">
              <IconX size={13} stroke={1.75} />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-mono text-text-muted bg-surface border border-border/70 rounded shadow-2xs shrink-0 select-none">
              ⌘K
            </kbd>
          )}
        </div>
        <button
          onClick={toggleSidebarCollapsed}
          aria-label="사이드바 접기"
          title="사이드바 접기"
          className="shrink-0 p-1.5 rounded-lg text-text-muted hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          <IconChevronsLeft size={15} stroke={1.75} />
        </button>
        <NotificationBell uid={uid} />
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {/* 가방 보관함 -------------------------------------------------------- */}
        <div className="flex items-center justify-between px-2 pt-2 pb-1 gap-1.5">
          <span className="text-[11px] font-semibold text-text-muted shrink-0">가방 보관함</span>
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setSortMenuFor({
                  kind: "bag",
                  position: { top: rect.bottom + 4, left: Math.min(rect.left, window.innerWidth - 170) },
                });
              }}
              aria-label="정렬 기준"
              title="정렬 기준"
              className="p-1 rounded-md hover:bg-black/5"
            >
              <IconArrowsSort size={14} stroke={1.75} color="var(--text-muted)" />
            </button>
            <button
              onClick={() => createBagFolder("새 폴더", undefined).catch(() => {})}
              aria-label="새 폴더"
              title="새 폴더"
              className="p-1 rounded-md hover:bg-black/5"
            >
              <IconFolderPlus size={14} stroke={1.75} color="var(--text-muted)" />
            </button>
            <button
              onClick={() => onNewBag()}
              aria-label="새 가방"
              title="새 가방"
              className="p-1 rounded-md hover:bg-black/5"
            >
              <IconPlus size={14} stroke={1.75} color="var(--text-muted)" />
            </button>
          </div>
        </div>
        <div
          className="flex flex-col gap-0.5 mb-3 rounded-lg transition-colors p-1"
          style={{
            border: dropTargetKey === "bag-root" ? "2px dashed var(--accent)" : "2px solid transparent",
            background: dropTargetKey === "bag-root" ? "var(--accent-soft)" : undefined,
          }}
          onDragOver={(e) => {
            if (canDropOnTarget("bag-root")) {
              e.preventDefault();
              setDropTargetKey("bag-root");
            }
          }}
          onDragLeave={(e) => {
            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
            if (dropTargetKey === "bag-root") setDropTargetKey(null);
          }}
          onDrop={(e) => {
            e.preventDefault();
            handleDropOnTarget("bag-root");
          }}
        >
          {q ? (
            // 검색 중에는 폴더 구조를 무시하고 이름이 맞는 가방만 평평하게 보여준다.
            filteredBags.length === 0 ? (
              <p className="px-2 py-2 text-[12px] text-text-muted">검색 결과가 없어요.</p>
            ) : (
              filteredBags.map((bag) => {
                const isSelected = selection?.kind === "bag" && selection.bagId === bag.id && !selection.focusPackId;
                const isDropTarget = dropTargetKey === `bag:${bag.id}`;
                return (
                  <div
                    key={bag.id}
                    data-bag-drop-id={bag.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, "bag", bag.id)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => {
                      if (canDropOnTarget("bag", bag.id)) {
                        e.preventDefault();
                        e.stopPropagation();
                        setDropTargetKey(`bag:${bag.id}`);
                      }
                    }}
                    onDragLeave={(e) => {
                      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                      if (dropTargetKey === `bag:${bag.id}`) setDropTargetKey(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDropOnTarget("bag", bag.id);
                    }}
                    onClick={() => onSelect({ kind: "bag", bagId: bag.id })}
                    className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 cursor-pointer transition-all hover:bg-surface-2/70"
                    style={{
                      border: isDropTarget ? "2px dashed var(--accent)" : "2px solid transparent",
                      background: isDropTarget ? "var(--accent-soft)" : isSelected ? "var(--accent-soft)" : undefined,
                      color: isSelected ? "var(--accent)" : undefined,
                      fontWeight: isSelected ? 600 : undefined,
                    }}
                  >
                    <span className="w-[14px] shrink-0" />
                    <IconBackpack size={16} stroke={1.75} color="var(--text-secondary)" className="shrink-0" />
                    <span className="text-[13px] font-medium truncate min-w-0 flex-1">{bag.name}</span>
                    {pinnedBagIds.includes(bag.id) && (
                      <IconPinnedFilled size={13} stroke={1.75} color="var(--accent)" className="shrink-0" aria-label="고정됨" />
                    )}
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
                const isDropTarget = dropTargetKey === `bag-folder:${folder.id}`;
                return (
                  <div
                    key={folder.id}
                    draggable={!isRenaming}
                    onDragStart={(e) => handleDragStart(e, "bag-folder", folder.id)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => {
                      if (canDropOnTarget("bag-folder", folder.id)) {
                        e.preventDefault();
                        e.stopPropagation();
                        setDropTargetKey(`bag-folder:${folder.id}`);
                        setDropZone(computeDropZone(e));
                      }
                    }}
                    onDragLeave={(e) => {
                      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                      if (dropTargetKey === `bag-folder:${folder.id}`) {
                        setDropTargetKey(null);
                        setDropZone(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDropOnTarget("bag-folder", folder.id, e, computeDropZone(e));
                    }}
                    className="group flex items-center gap-1.5 rounded-lg px-2 py-1 cursor-pointer transition-all"
                    style={{
                      paddingLeft: 8 + row.depth * 18,
                      borderTop: isDropTarget && dropZone === "before" ? "2px solid var(--accent)" : "2px solid transparent",
                      borderBottom: isDropTarget && dropZone === "after" ? "2px solid var(--accent)" : "2px solid transparent",
                      borderLeft: "2px solid transparent",
                      borderRight: "2px solid transparent",
                    }}
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
                          const rect = e.currentTarget.getBoundingClientRect();
                          const top = Math.min(rect.bottom + 4, window.innerHeight - 120);
                          const left = Math.min(rect.left, window.innerWidth - 170);
                          setAddMenuFor({ kind: "bag", parentId: folder.id, position: { top: Math.max(10, top), left: Math.max(10, left) } });
                        }}
                        aria-label="이 폴더에 추가"
                        title="이 폴더에 추가"
                        className="shrink-0 -m-1 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-black/5"
                      >
                        <IconPlus size={13} stroke={1.75} color="var(--text-muted)" />
                      </button>
                    )}
                    {!isRenaming && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          setMenuFor({
                            kind: "folder",
                            id: folder.id,
                            position: calcMenuPosition(rect, { width: 220 }),
                          });
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
              // 다른 멤버가 만든 AI추천 팩(aiRecommendSource)은 무료회원에게는 트리에서 숨긴다.
              const viewableBagPacks = getViewablePacks(bag.packs, premium);
              const isSelected = selection?.kind === "bag" && selection.bagId === bag.id && !selection.focusPackId;
              const isExpanded = expandedBagIds.has(bag.id);
              const isDropTarget = dropTargetKey === `bag:${bag.id}`;
              return (
                <div key={bag.id}>
                  <div
                    data-bag-drop-id={bag.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, "bag", bag.id)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => {
                      if (canDropOnTarget("bag", bag.id, e)) {
                        e.preventDefault();
                        e.stopPropagation();
                        setDropTargetKey(`bag:${bag.id}`);
                        setDropZone(computeDropZone(e));
                      }
                    }}
                    onDragLeave={(e) => {
                      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                      if (dropTargetKey === `bag:${bag.id}`) {
                        setDropTargetKey(null);
                        setDropZone(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDropOnTarget("bag", bag.id, e, computeDropZone(e));
                    }}
                    className="group flex items-center gap-1.5 rounded-xl px-2 py-1.5 cursor-pointer transition-all hover:bg-surface-2/70"
                    style={{
                      paddingLeft: 8 + row.depth * 18,
                      borderTop: isDropTarget && dropZone === "before" ? "2px solid var(--accent)" : "2px solid transparent",
                      borderBottom: isDropTarget && dropZone === "after" ? "2px solid var(--accent)" : "2px solid transparent",
                      borderLeft: "2px solid transparent",
                      borderRight: "2px solid transparent",
                      background: isSelected ? "var(--accent-soft)" : undefined,
                      color: isSelected ? "var(--accent)" : undefined,
                      fontWeight: isSelected ? 600 : undefined,
                    }}
                    onClick={() => onSelect({ kind: "bag", bagId: bag.id })}
                  >
                    {viewableBagPacks.length > 0 ? (
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
                    {renamingBagId === bag.id ? (
                      <input
                        autoFocus
                        value={bagRenameDraft}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setBagRenameDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRenameBag();
                          if (e.key === "Escape") setRenamingBagId(null);
                        }}
                        onBlur={commitRenameBag}
                        className="min-w-0 flex-1 rounded border border-border bg-surface px-1 py-0.5 text-[13px] outline-none"
                      />
                    ) : (
                      <span className="text-[13px] font-medium truncate min-w-0 flex-1">{bag.name}</span>
                    )}
                    {renamingBagId !== bag.id && pinnedBagIds.includes(bag.id) && (
                      <IconPinnedFilled size={13} stroke={1.75} color="var(--accent)" className="shrink-0" aria-label="고정됨" />
                    )}
                    {renamingBagId !== bag.id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          setMenuFor({
                            kind: "bag",
                            id: bag.id,
                            position: calcMenuPosition(rect, { width: 220 }),
                          });
                        }}
                        aria-label="가방 메뉴"
                        className="shrink-0 -m-1 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-black/5"
                      >
                        <IconDotsVertical size={13} stroke={1.75} color="var(--text-muted)" />
                      </button>
                    )}
                  </div>
                  {isExpanded &&
                    viewableBagPacks.map((pack) => {
                      const packSelected =
                        selection?.kind === "bag" && selection.bagId === bag.id && selection.focusPackId === pack.id;
                      const isBagPackDropSource =
                        activeDragData?.type === "bag-pack" && activeDragData.id === pack.id;
                      return (
                        <div
                          key={pack.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, "bag-pack", pack.id, bag.id)}
                          onDragEnd={handleDragEnd}
                          onClick={() => onSelect({ kind: "bag", bagId: bag.id, focusPackId: pack.id })}
                          className="flex items-center gap-1.5 rounded-lg py-1 cursor-grab"
                          style={{
                            paddingLeft: 34 + row.depth * 18,
                            background: packSelected ? "var(--accent-soft)" : undefined,
                            opacity: isBagPackDropSource ? 0.4 : 1,
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
        <div className="flex items-center justify-between px-2 pt-2 pb-1 gap-1.5">
          <span className="text-[11px] font-semibold text-text-muted shrink-0">팩 보관함</span>
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setSortMenuFor({
                  kind: "pack",
                  position: { top: rect.bottom + 4, left: Math.min(rect.left, window.innerWidth - 170) },
                });
              }}
              aria-label="정렬 기준"
              title="정렬 기준"
              className="p-1 rounded-md hover:bg-black/5"
            >
              <IconArrowsSort size={14} stroke={1.75} color="var(--text-muted)" />
            </button>
            <button
              onClick={() => setShowTemplateGallery(true)}
              aria-label="추천 템플릿 둘러보기"
              title="추천 템플릿 둘러보기"
              className="p-1 rounded-md hover:bg-black/5 flex items-center text-[11.5px] font-medium text-text-secondary hover:text-foreground transition-colors"
            >
              <span>템플릿</span>
            </button>
            <button
              onClick={() => onNewFolder(undefined)}
              aria-label="새 폴더"
              title="새 폴더"
              className="p-1 rounded-md hover:bg-black/5"
            >
              <IconFolderPlus size={14} stroke={1.75} color="var(--text-muted)" />
            </button>
            <button
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const top = Math.min(rect.bottom + 4, window.innerHeight - 150);
                const left = Math.min(rect.left, window.innerWidth - 170);
                setAddMenuFor({ kind: "pack", parentId: undefined, position: { top: Math.max(10, top), left: Math.max(10, left) } });
              }}
              aria-label="새 팩"
              title="새 팩"
              className="p-1 rounded-md hover:bg-black/5"
            >
              <IconPlus size={14} stroke={1.75} color="var(--text-muted)" />
            </button>
          </div>
        </div>
        <div
          className="flex flex-col gap-0.5 rounded-lg transition-colors p-1"
          style={{
            border: dropTargetKey === "pack-root" ? "2px dashed var(--accent)" : "2px solid transparent",
            background: dropTargetKey === "pack-root" ? "var(--accent-soft)" : undefined,
          }}
          onDragOver={(e) => {
            if (canDropOnTarget("pack-root")) {
              e.preventDefault();
              setDropTargetKey("pack-root");
            }
          }}
          onDragLeave={(e) => {
            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
            if (dropTargetKey === "pack-root") setDropTargetKey(null);
          }}
          onDrop={(e) => {
            e.preventDefault();
            handleDropOnTarget("pack-root");
          }}
        >
          {packRows.length === 0 ? (
            <p className="px-2 py-2 text-[12px] text-text-muted">아직 만든 팩이 없어요.</p>
          ) : (
            packRows.map(({ entry, depth }) => {
              const isFolder = entry.type === "folder";
              const isSelected = selection?.kind === "pack" && selection.packId === entry.id;
              const isRenaming = renamingPackId === entry.id;
              const isDropTarget = dropTargetKey === `pack:${entry.id}`;
              const rowDropZone = isDropTarget ? dropZone : null;
              return (
                <div
                  key={entry.id}
                  draggable={!isRenaming}
                  onDragStart={(e) => handleDragStart(e, isFolder ? "pack-folder" : "pack", entry.id)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => {
                    const targetType = isFolder ? "pack-folder" : "pack";
                    if (canDropOnTarget(targetType, entry.id, e)) {
                      e.preventDefault();
                      e.stopPropagation();
                      setDropTargetKey(`pack:${entry.id}`);
                      setDropZone(computeDropZone(e));
                    }
                  }}
                  onDragLeave={(e) => {
                    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                    if (dropTargetKey === `pack:${entry.id}`) {
                      setDropTargetKey(null);
                      setDropZone(null);
                    }
                  }}
                  onDrop={(e) => {
                    const targetType = isFolder ? "pack-folder" : "pack";
                    e.preventDefault();
                    e.stopPropagation();
                    handleDropOnTarget(targetType, entry.id, e, computeDropZone(e));
                  }}
                  onClick={() =>
                    isRenaming ? undefined : isFolder ? togglePackExpanded(entry.id) : onSelect({ kind: "pack", packId: entry.id })
                  }
                  className="group flex items-center gap-1.5 rounded-lg py-1 cursor-pointer transition-all"
                  style={{
                    paddingLeft: 8 + depth * 18,
                    paddingRight: 8,
                    borderTop: isDropTarget && rowDropZone === "before" ? "2px solid var(--accent)" : "2px solid transparent",
                    borderBottom: isDropTarget && rowDropZone === "after" ? "2px solid var(--accent)" : "2px solid transparent",
                    borderLeft: "2px solid transparent",
                    borderRight: "2px solid transparent",
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
                  {!isFolder && pinnedPackIds.includes(entry.id) && (
                    <IconPinnedFilled size={12} stroke={1.75} color="var(--accent)" className="shrink-0" aria-label="고정됨" />
                  )}
                  {!isFolder && entry.kind === "editor" && (
                    <IconNotes size={12} stroke={1.75} color="var(--text-muted)" className="shrink-0" />
                  )}
                  {isFolder && !isRenaming && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        const top = Math.min(rect.bottom + 4, window.innerHeight - 120);
                        const left = Math.min(rect.left, window.innerWidth - 170);
                        setAddMenuFor({ kind: "pack", parentId: entry.id, position: { top: Math.max(10, top), left: Math.max(10, left) } });
                      }}
                      aria-label="이 폴더에 추가"
                      className="shrink-0 -m-1 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-black/5"
                    >
                      <IconPlus size={12} stroke={1.75} color="var(--text-muted)" />
                    </button>
                  )}
                  {!isRenaming && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        setPackMenuFor({
                          id: entry.id,
                          isFolder,
                          position: calcMenuPosition(rect, { width: 220 }),
                        });
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
            className="fixed inset-0"
            style={{ zIndex: ambientLayer + POPOVER_OFFSET }}
            onClick={() => setMenuFor(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute rounded-xl border border-border shadow-lg overflow-hidden"
              style={{
                background: "var(--surface)",
                minWidth: 200,
                maxHeight: menuFor.position?.maxHeight ?? "70vh",
                overflowY: "auto",
                left: menuFor.position?.left ?? 16,
                top: menuFor.position?.top ?? 220,
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

              {menuFor.kind === "bag" && (
                <>
                  <button
                    onClick={() => {
                      const bag = bags.find((b) => b.id === menuFor.id);
                      if (bag) startRenameBag(bag);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-[13px] text-left hover:bg-black/5"
                  >
                    <IconEdit size={15} stroke={1.75} />
                    이름 바꾸기
                  </button>
                  <button
                    onClick={() => {
                      toggleBagPinned(menuFor.id).catch(() => {});
                      setMenuFor(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-[13px] text-left hover:bg-black/5"
                  >
                    {pinnedBagIds.includes(menuFor.id) ? (
                      <IconPinnedFilled size={15} stroke={1.75} color="var(--accent)" />
                    ) : (
                      <IconPinned size={15} stroke={1.75} />
                    )}
                    {pinnedBagIds.includes(menuFor.id) ? "고정 해제" : "고정하기"}
                  </button>
                  <div className="border-t border-border" />
                </>
              )}

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

              {menuFor.kind === "bag" && (
                <>
                  <div className="border-t border-border" />
                  <button
                    onClick={() => {
                      setConfirmDeleteBagId(menuFor.id);
                      setMenuFor(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-[13px] text-left hover:bg-black/5"
                    style={{ color: "var(--danger)" }}
                  >
                    <IconTrash size={15} stroke={1.75} />
                    가방 삭제
                  </button>
                </>
              )}
            </div>
          </div>
        </Portal>
      )}

      {/* 폴더 + 버튼 팝업 - 가방/팩 추가 vs 폴더 추가 */}
      {addMenuFor && (
        <Portal>
          <div className="fixed inset-0" style={{ zIndex: ambientLayer + POPOVER_OFFSET }} onClick={() => setAddMenuFor(null)}>
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute rounded-xl border border-border shadow-lg overflow-hidden"
              style={{
                background: "var(--surface)",
                minWidth: 150,
                left: addMenuFor.position.left,
                top: addMenuFor.position.top,
              }}
            >
              {addMenuFor.kind === "bag" ? (
                <>
                  <button
                    onClick={() => {
                      onNewBag(addMenuFor.parentId);
                      setAddMenuFor(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left hover:bg-black/5"
                  >
                    <IconBackpack size={14} stroke={1.75} color="var(--text-secondary)" />
                    가방 추가
                  </button>
                  <button
                    onClick={() => {
                      createBagFolder("새 폴더", addMenuFor.parentId).catch(() => {});
                      setAddMenuFor(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left hover:bg-black/5"
                  >
                    <IconFolder size={14} stroke={1.75} color="var(--text-secondary)" />
                    폴더 추가
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      onNewPack(addMenuFor.parentId, "checklist");
                      setAddMenuFor(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left hover:bg-black/5"
                  >
                    <IconListCheck size={14} stroke={1.75} color="var(--text-secondary)" />
                    체크팩 추가
                  </button>
                  <button
                    onClick={() => {
                      onNewPack(addMenuFor.parentId, "editor");
                      setAddMenuFor(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left hover:bg-black/5"
                  >
                    <IconNotes size={14} stroke={1.75} color="var(--text-secondary)" />
                    메모팩 추가
                  </button>
                  <button
                    onClick={() => {
                      onNewFolder(addMenuFor.parentId);
                      setAddMenuFor(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left hover:bg-black/5"
                  >
                    <IconFolder size={14} stroke={1.75} color="var(--text-secondary)" />
                    폴더 추가
                  </button>
                </>
              )}
            </div>
          </div>
        </Portal>
      )}

      {/* 정렬 기준 선택 팝업 - 아이콘 버튼을 누르면 헤더 바로 아래에 드롭다운으로 난다. 지금 값(profile.bagSortBy/packSortBy)은
          따로 표시하지 않고, 고르면 바로 적용되고 메뉴가 닫힌다. */}
      {sortMenuFor && (
        <Portal>
          <div className="fixed inset-0" style={{ zIndex: ambientLayer + POPOVER_OFFSET }} onClick={() => setSortMenuFor(null)}>
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute rounded-xl border border-border shadow-lg overflow-hidden"
              style={{
                background: "var(--surface)",
                minWidth: 150,
                left: sortMenuFor.position.left,
                top: sortMenuFor.position.top,
              }}
            >
              {SORT_OPTIONS.map((opt) => {
                const currentValue =
                  sortMenuFor.kind === "bag"
                    ? profile?.bagSortBy ?? "createdAt"
                    : profile?.packSortBy ?? "createdAt";
                const isCurrent = currentValue === opt;
                return (
                  <button
                    key={opt}
                    onClick={() => {
                      if (sortMenuFor.kind === "bag") {
                        updateBagSortBy(opt).catch(() => {});
                      } else {
                        updatePackSortBy(opt).catch(() => {});
                      }
                      setSortMenuFor(null);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left hover:bg-black/5 ${
                      isCurrent ? "font-bold" : ""
                    }`}
                  >
                    {SORT_OPTION_LABELS[opt]}
                  </button>
                );
              })}
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

      {confirmDeleteBagId && (
        <ConfirmDialog
          title="이 가방을 삭제할까요?"
          message="휴지통으로 옮겨져서 설정 > 휴지통에서 복구할 수 있어요."
          confirmLabel="삭제"
          tone="danger"
          onCancel={() => setConfirmDeleteBagId(null)}
          onConfirm={() => {
            const bag = bags.find((b) => b.id === confirmDeleteBagId);
            if (bag) onDeleteBag(bag);
            setConfirmDeleteBagId(null);
          }}
        />
      )}

      {/* 팩/폴더 "..." 메뉴 - 이름바꾸기 + 이동(폴더 목록) + 삭제 */}
      {packMenuFor && (
        <Portal>
          <div className="fixed inset-0" style={{ zIndex: ambientLayer + POPOVER_OFFSET }} onClick={() => setPackMenuFor(null)}>
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute rounded-xl border border-border shadow-lg overflow-hidden"
              style={{
                background: "var(--surface)",
                minWidth: 200,
                maxHeight: packMenuFor.position?.maxHeight ?? "70vh",
                overflowY: "auto",
                left: packMenuFor.position?.left ?? 16,
                top: packMenuFor.position?.top ?? 420,
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
              {!packMenuFor.isFolder && (
                <button
                  onClick={() => {
                    togglePackPinned(packMenuFor.id).catch(() => {});
                    setPackMenuFor(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-[13px] text-left hover:bg-black/5"
                >
                  {pinnedPackIds.includes(packMenuFor.id) ? (
                    <IconPinnedFilled size={15} stroke={1.75} color="var(--accent)" />
                  ) : (
                    <IconPinned size={15} stroke={1.75} />
                  )}
                  {pinnedPackIds.includes(packMenuFor.id) ? "고정 해제" : "고정하기"}
                </button>
              )}
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

      {showTemplateGallery && (
        <PackTemplateGalleryModal
          userPacks={treePacks}
          onClose={() => setShowTemplateGallery(false)}
          onImportToLibrary={(newPack) => {
            onNewPack(undefined);
            // 팩 보관함 추가
            onRenamePackEntry(newPack, newPack.name);
          }}
        />
      )}
    </div>
  );
}
