"use client";

import { useMemo, useRef, useState } from "react";
import {
  IconSquareCheck,
  IconSquare,
  IconAlignLeft,
  IconCalendarEvent,
  IconSend,
  IconTrash,
  IconArrowRight,
  IconX,
  IconFolder,
  IconPackage,
  IconSparkles,
  IconSearch,
  IconCheck,
  IconCopy,
  IconGripVertical,
  IconBackpack,
  IconPlus,
} from "@tabler/icons-react";
import { Bag, Item, Pack } from "@/lib/types";
import { QUICK_PACK_ID } from "@/lib/premiumLimits";
import { useToast } from "@/components/Toast";
import Portal from "@/components/Portal";

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function getDDayLabel(dueDateStr: string | undefined): { text: string; isPast: boolean } | null {
  if (!dueDateStr) return null;
  const target = new Date(dueDateStr);
  if (isNaN(target.getTime())) return null;
  const today = new Date();
  target.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return { text: "D-DAY", isPast: false };
  if (diffDays > 0) return { text: `D-${diffDays}`, isPast: false };
  return { text: `D+${Math.abs(diffDays)}`, isPast: true };
}

export default function DesktopQuickPackChatView({
  quickPack,
  bags,
  libraryPacks,
  onSavePack,
  onAddItemsToBagPack,
}: {
  quickPack: Pack | undefined;
  bags: Bag[];
  libraryPacks: Pack[];
  onSavePack: (pack: Pack) => void;
  onAddItemsToBagPack: (bagId: string, packId: string, items: Item[]) => void;
}) {
  const { show } = useToast();
  const [text, setText] = useState("");
  const [type, setType] = useState<"check" | "text">("check");
  const [dueDate, setDueDate] = useState<string>("");
  const [showDatePicker, setShowDatePicker] = useState(false);

  // 다중 선택 모드
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 이동/복사 모달 대상 짐 목록
  const [moveModalItems, setMoveModalItems] = useState<Item[] | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const items = quickPack?.items ?? [];

  const toggleSelectItem = (itemId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const handleToggleCheck = (itemId: string) => {
    if (!quickPack) return;
    const updatedItems = items.map((i) =>
      i.id === itemId ? { ...i, checked: !i.checked } : i
    );
    onSavePack({ ...quickPack, items: updatedItems });
  };

  const handleDeleteItems = (targetIds: Set<string>) => {
    if (!quickPack || targetIds.size === 0) return;
    const updatedItems = items.filter((i) => !targetIds.has(i.id));
    onSavePack({ ...quickPack, items: updatedItems });
    setSelectedIds((prev) => {
      const next = new Set(prev);
      targetIds.forEach((id) => next.delete(id));
      return next;
    });
    show(`${targetIds.size}개 항목을 삭제했어요`);
  };

  const handleClearAll = () => {
    if (!quickPack || items.length === 0) return;
    if (confirm("빠른 팩의 모든 짐을 비우시겠어요?")) {
      onSavePack({ ...quickPack, items: [] });
      setSelectedIds(new Set());
      show("빠른 팩을 비웠어요");
    }
  };

  const handleAddItem = () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const newItem: Item = {
      id: uid(),
      type,
      text: trimmed,
      checked: false,
      ...(dueDate ? { dueDate } : {}),
    };

    const currentQuickPack: Pack = quickPack ?? {
      id: QUICK_PACK_ID,
      name: "빠른 팩",
      items: [],
      isQuickPack: true,
    };

    onSavePack({
      ...currentQuickPack,
      items: [...currentQuickPack.items, newItem],
    });

    setText("");
    setDueDate("");
    setShowDatePicker(false);
    inputRef.current?.focus();
  };

  // --- HTML5 드래그 앤 드롭 시작 (단일 / 다중 선택 짐) ---
  const handleDragStart = (e: React.DragEvent, item: Item) => {
    let itemsToDrag: Item[] = [item];
    if (multiSelectMode && selectedIds.has(item.id) && selectedIds.size > 0) {
      itemsToDrag = items.filter((i) => selectedIds.has(i.id));
    }

    const payload = {
      type: "quick-pack-items",
      items: itemsToDrag,
    };

    e.dataTransfer.setData("application/json", JSON.stringify(payload));
    e.dataTransfer.setData("text/plain", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "copyMove";
  };

  // 롱 프레스 감지 (400ms 후 다중 선택 모드 자동 활성화)
  const handleTouchMouseDown = (itemId: string) => {
    longPressTimerRef.current = setTimeout(() => {
      setMultiSelectMode(true);
      setSelectedIds(new Set([itemId]));
    }, 400);
  };

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      {/* 1. 상단 타이틀 헤더 */}
      <div className="shrink-0 flex items-center justify-between px-6 py-3.5 border-b border-border bg-surface/30 backdrop-blur-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl border border-border/80 bg-surface flex items-center justify-center text-text-secondary">
            <IconPackage size={17} stroke={1.5} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-semibold text-foreground tracking-tight">빠른 팩</h2>
              <span className="rounded-md border border-border/70 bg-surface px-2 py-0.5 text-[11px] font-medium text-text-secondary">
                {items.length}개 보관
              </span>
            </div>
            <p className="text-[12px] text-text-muted mt-0.5">
              사이드바의 가방이나 팩으로 드래그해서 바로 담을 수 있어요
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {items.length > 0 && (
            <button
              onClick={() => {
                if (multiSelectMode) {
                  setMultiSelectMode(false);
                  setSelectedIds(new Set());
                } else {
                  setMultiSelectMode(true);
                }
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
                multiSelectMode
                  ? "bg-accent text-white"
                  : "border border-border/70 bg-surface text-text-secondary hover:text-foreground hover:bg-surface-2"
              }`}
            >
              <IconSquareCheck size={14} stroke={1.75} />
              {multiSelectMode ? "선택 완료" : "다중 선택"}
            </button>
          )}

          {items.length > 0 && (
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
            >
              <IconTrash size={14} stroke={1.75} />
              비우기
            </button>
          )}
        </div>
      </div>

      {/* 2. 타일/그리드 피드 영역 (Grid Tile Flow Layout) */}
      <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 gap-2.5">
            <div className="w-12 h-12 rounded-2xl border border-border/80 bg-surface flex items-center justify-center text-text-muted mb-1">
              <IconPackage size={22} stroke={1.5} />
            </div>
            <h3 className="text-[14.5px] font-medium text-foreground">보관함이 비어있어요</h3>
            <p className="text-[12.5px] text-text-muted max-w-sm leading-relaxed">
              하단 입력창에 생각나는 짐을 적고 <kbd className="px-1.5 py-0.5 rounded bg-surface-2 text-[11px] font-mono border border-border">Enter</kbd>를 누르면 보관됩니다.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {items.map((item) => {
              const dday = getDDayLabel(item.dueDate);
              const isCheckType = item.type === "check";
              const isSelected = selectedIds.has(item.id);

              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item)}
                  onMouseDown={() => handleTouchMouseDown(item.id)}
                  onMouseUp={clearLongPress}
                  onMouseLeave={clearLongPress}
                  onTouchStart={() => handleTouchMouseDown(item.id)}
                  onTouchEnd={clearLongPress}
                  onClick={() => {
                    if (multiSelectMode) {
                      toggleSelectItem(item.id);
                    }
                  }}
                  className={`group relative flex flex-col justify-between rounded-xl p-3 border transition-all cursor-grab active:cursor-grabbing hover:border-border-strong ${
                    isSelected
                      ? "border-accent bg-accent/5 ring-1 ring-accent/40"
                      : "bg-surface border-border/80"
                  }`}
                  style={{ minHeight: "78px" }}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    {/* 선택 체크박스 or 일반 체크 아이콘 */}
                    {multiSelectMode ? (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectItem(item.id)}
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[var(--accent)] cursor-pointer"
                      />
                    ) : isCheckType ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleCheck(item.id);
                        }}
                        className="mt-0.5 text-text-muted hover:text-accent transition-colors shrink-0"
                      >
                        {item.checked ? (
                          <IconSquareCheck size={16} stroke={2} className="text-accent" />
                        ) : (
                          <IconSquare size={16} stroke={1.5} />
                        )}
                      </button>
                    ) : (
                      <div className="mt-0.5 text-text-muted shrink-0">
                        <IconAlignLeft size={15} stroke={1.5} />
                      </div>
                    )}

                    <span
                      className={`text-[13px] leading-relaxed break-words flex-1 min-w-0 transition-opacity ${
                        item.checked ? "line-through text-text-muted opacity-60" : "text-foreground"
                      }`}
                    >
                      {item.text}
                    </span>
                  </div>

                  {/* 하단 D-Day 태그 & 마우스 호버 이동/삭제 버튼 */}
                  <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-border/40">
                    {dday ? (
                      <span
                        className={`inline-flex items-center gap-1 text-[10.5px] font-medium px-1.5 py-0.5 rounded ${
                          dday.isPast
                            ? "bg-danger/10 text-danger"
                            : "bg-accent/10 text-accent"
                        }`}
                      >
                        <IconCalendarEvent size={11} stroke={1.75} />
                        {dday.text}
                      </span>
                    ) : (
                      <span className="text-[10.5px] text-text-muted flex items-center gap-1">
                        <IconGripVertical size={11} stroke={1.5} />
                        드래그 이동
                      </span>
                    )}

                    {!multiSelectMode && (
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMoveModalItems([item]);
                          }}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors"
                          title="가방이나 팩으로 이동"
                        >
                          <IconArrowRight size={12} stroke={1.75} />
                          이동
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteItems(new Set([item.id]));
                          }}
                          className="p-1 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                          title="삭제"
                        >
                          <IconTrash size={12} stroke={1.75} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. 하단 다중 선택 플로팅 액션 바 */}
      {multiSelectMode && selectedIds.size > 0 && (
        <div className="shrink-0 border-t border-border bg-surface-2 p-3 flex items-center justify-between px-6 animate-in slide-in-from-bottom-2">
          <span className="text-[13px] font-medium text-foreground">
            {selectedIds.size}개 항목 선택됨
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const targetItems = items.filter((i) => selectedIds.has(i.id));
                setMoveModalItems(targetItems);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-accent text-white text-[12.5px] font-medium hover:opacity-90 transition-opacity shadow-2xs"
            >
              <IconArrowRight size={14} stroke={2} />
              선택 항목 이동
            </button>
            <button
              onClick={() => handleDeleteItems(selectedIds)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-danger/10 text-danger text-[12.5px] font-medium hover:bg-danger/20 transition-colors"
            >
              <IconTrash size={14} stroke={1.75} />
              삭제
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-2.5 py-1.5 text-[12.5px] text-text-secondary hover:text-foreground"
            >
              선택 해제
            </button>
          </div>
        </div>
      )}

      {/* 4. 하단 입력 바 (Linear / Things 3 Floating Input Bar) */}
      <div className="shrink-0 p-3.5 border-t border-border bg-surface/50">
        <div className="flex flex-col gap-2 max-w-2xl mx-auto">
          {/* 타입 & D-Day 옵션 바 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setType("check")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11.5px] font-medium transition-colors ${
                  type === "check"
                    ? "bg-foreground text-background"
                    : "text-text-muted hover:text-foreground"
                }`}
              >
                <IconSquareCheck size={13} stroke={1.75} />
                체크형
              </button>
              <button
                type="button"
                onClick={() => setType("text")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11.5px] font-medium transition-colors ${
                  type === "text"
                    ? "bg-foreground text-background"
                    : "text-text-muted hover:text-foreground"
                }`}
              >
                <IconAlignLeft size={13} stroke={1.75} />
                메모형
              </button>
            </div>

            {/* D-Day 설정버튼 */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowDatePicker((prev) => !prev)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11.5px] font-medium transition-colors ${
                  dueDate
                    ? "text-accent bg-accent/10 border border-accent/30"
                    : "text-text-muted hover:text-text-secondary"
                }`}
              >
                <IconCalendarEvent size={13} stroke={1.75} />
                {dueDate ? `D-Day: ${dueDate}` : "+ 날짜 지정"}
              </button>

              {showDatePicker && (
                <div className="absolute right-0 bottom-8 z-30 bg-surface border border-border p-2.5 rounded-xl shadow-lg flex flex-col gap-2 min-w-[200px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[11.5px] font-medium text-foreground">마감 날짜 지정</span>
                    <button onClick={() => setShowDatePicker(false)}>
                      <IconX size={13} stroke={1.75} color="var(--text-muted)" />
                    </button>
                  </div>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => {
                      setDueDate(e.target.value);
                      setShowDatePicker(false);
                    }}
                    className="w-full rounded-lg border border-border bg-surface-2 px-2 py-1 text-[12px] outline-none text-foreground"
                  />
                  {dueDate && (
                    <button
                      onClick={() => {
                        setDueDate("");
                        setShowDatePicker(false);
                      }}
                      className="text-[11px] text-danger hover:underline text-left"
                    >
                      날짜 지우기
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 텍스트 입력창 & 전송 버튼 */}
          <div className="flex items-center gap-2 rounded-xl border border-border/80 bg-background focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/20 px-3 py-1.5 transition-all shadow-2xs">
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleAddItem();
                }
              }}
              placeholder={
                type === "check"
                  ? "체크리스트에 추가할 짐 입력... (Enter로 등록)"
                  : "메모할 내용 입력... (Enter로 등록)"
              }
              className="flex-1 bg-transparent text-[13px] outline-none text-foreground placeholder:text-text-muted py-1"
            />
            <button
              onClick={handleAddItem}
              disabled={!text.trim()}
              className="rounded-lg px-3 py-1.5 font-medium text-[12.5px] flex items-center justify-center gap-1 transition-all shrink-0 shadow-2xs disabled:opacity-40"
              style={{
                background: text.trim() ? "var(--accent)" : "var(--surface-2)",
                color: text.trim() ? "#fff" : "var(--text-muted)",
              }}
            >
              <IconSend size={14} stroke={2} />
              추가
            </button>
          </div>
        </div>
      </div>

      {/* 5. 검색 & 다중 대상 선택 이동/복사 모달 (MoveItemsModal) */}
      {moveModalItems && moveModalItems.length > 0 && (
        <MoveItemsModal
          targetItems={moveModalItems}
          bags={bags}
          libraryPacks={libraryPacks}
          onClose={() => setMoveModalItems(null)}
          onCommitMove={(destinations, isCopy) => {
            if (!quickPack) return;
            let totalMovedCount = 0;

            destinations.forEach((dest) => {
              if (dest.kind === "bag-pack") {
                onAddItemsToBagPack(dest.bagId, dest.packId, moveModalItems);
                totalMovedCount++;
              } else if (dest.kind === "library-pack") {
                const targetPack = libraryPacks.find((p) => p.id === dest.packId);
                if (targetPack) {
                  onSavePack({
                    ...targetPack,
                    items: [...targetPack.items, ...moveModalItems],
                  });
                  totalMovedCount++;
                }
              }
            });

            // 이동인 경우 빠른 팩에서 제거 (복사인 경우 원본 보존)
            if (!isCopy) {
              const moveItemIds = new Set(moveModalItems.map((i) => i.id));
              const updatedItems = items.filter((i) => !moveItemIds.has(i.id));
              onSavePack({ ...quickPack, items: updatedItems });
              setSelectedIds((prev) => {
                const next = new Set(prev);
                moveItemIds.forEach((id) => next.delete(id));
                return next;
              });
            }

            show(
              isCopy
                ? `${moveModalItems.length}개 짐을 ${totalMovedCount}개 위치로 복사했어요!`
                : `${moveModalItems.length}개 짐을 ${totalMovedCount}개 위치로 이사했어요!`
            );
            setMoveModalItems(null);
          }}
        />
      )}
    </div>
  );
}

// --- 짐 검색 및 다중 대상(가방/팩) 선택 이동 모달 ---
function MoveItemsModal({
  targetItems,
  bags,
  libraryPacks,
  onClose,
  onCommitMove,
}: {
  targetItems: Item[];
  bags: Bag[];
  libraryPacks: Pack[];
  onClose: () => void;
  onCommitMove: (
    destinations: (
      | { kind: "bag-pack"; bagId: string; packId: string }
      | { kind: "library-pack"; packId: string }
    )[],
    isCopy: boolean
  ) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDestKeys, setSelectedDestKeys] = useState<Set<string>>(new Set());

  const toggleDestKey = (key: string) => {
    setSelectedDestKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const q = searchQuery.trim().toLowerCase();

  // 검색 필터링된 가방속 팩 & 팩 보관함
  const filteredBagPacks = useMemo(() => {
    const results: { bag: Bag; pack: Pack; key: string }[] = [];
    bags.forEach((bag) => {
      bag.packs
        .filter((p) => p.kind !== "editor")
        .forEach((pack) => {
          const matchName =
            bag.name.toLowerCase().includes(q) || pack.name.toLowerCase().includes(q);
          if (!q || matchName) {
            results.push({ bag, pack, key: `bag:${bag.id}:${pack.id}` });
          }
        });
    });
    return results;
  }, [bags, q]);

  const filteredLibraryPacks = useMemo(() => {
    return libraryPacks
      .filter((p) => p.type !== "folder" && p.kind !== "editor")
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .map((pack) => ({ pack, key: `lib:${pack.id}` }));
  }, [libraryPacks, q]);

  const handleApply = (isCopy: boolean) => {
    const destinations: (
      | { kind: "bag-pack"; bagId: string; packId: string }
      | { kind: "library-pack"; packId: string }
    )[] = [];

    selectedDestKeys.forEach((key) => {
      if (key.startsWith("bag:")) {
        const [, bagId, packId] = key.split(":");
        destinations.push({ kind: "bag-pack", bagId, packId });
      } else if (key.startsWith("lib:")) {
        const [, packId] = key.split(":");
        destinations.push({ kind: "library-pack", packId });
      }
    });

    onCommitMove(destinations, isCopy);
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[160] flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.45)" }}
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-2xl bg-surface p-4 flex flex-col gap-3 shadow-2xl max-h-[85vh]"
        >
          <div className="flex items-center justify-between shrink-0">
            <div>
              <h3 className="text-[16px] font-bold text-text-primary">짐 이동 / 복사</h3>
              <p className="text-[12px] text-text-muted mt-0.5">
                '{targetItems[0]?.text}' {targetItems.length > 1 ? `외 ${targetItems.length - 1}개` : ""}를 어디로 보낼까요?
              </p>
            </div>
            <button onClick={onClose} aria-label="닫기">
              <IconX size={18} stroke={1.75} color="var(--text-secondary)" />
            </button>
          </div>

          {/* 검색창 */}
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2 shrink-0">
            <IconSearch size={16} stroke={1.75} color="var(--text-muted)" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="가방 또는 팩 이름 검색..."
              className="flex-1 bg-transparent text-[13px] outline-none"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")}>
                <IconX size={14} stroke={1.75} color="var(--text-muted)" />
              </button>
            )}
          </div>

          {/* 대상 가방 / 팩 다중 선택 목록 */}
          <div className="flex flex-col gap-3 overflow-y-auto scrollbar-thin flex-1 min-h-[220px] max-h-[400px] pr-1">
            {/* 가방 속 팩 */}
            <div className="flex flex-col gap-1">
              <span className="text-[11.5px] font-bold text-text-muted px-1">내 가방</span>
              {filteredBagPacks.map(({ bag, pack, key }) => {
                const isChecked = selectedDestKeys.has(key);
                return (
                  <label
                    key={key}
                    className="flex items-center gap-2.5 rounded-xl bg-surface-2 p-2.5 cursor-pointer hover:bg-black/5 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleDestKey(key)}
                      className="h-4 w-4 shrink-0 accent-[var(--accent)]"
                    />
                    <IconFolder size={16} stroke={1.75} className="text-accent shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold truncate text-text-primary">
                        {bag.name} &gt; {pack.name}
                      </div>
                    </div>
                  </label>
                );
              })}
              {filteredBagPacks.length === 0 && (
                <p className="text-[12px] text-text-muted px-2 py-1">검색된 가방 팩이 없어요.</p>
              )}
            </div>

            {/* 팩 보관함 */}
            <div className="flex flex-col gap-1 pt-2 border-t border-border">
              <span className="text-[11.5px] font-bold text-text-muted px-1">팩 보관함</span>
              {filteredLibraryPacks.map(({ pack, key }) => {
                const isChecked = selectedDestKeys.has(key);
                return (
                  <label
                    key={key}
                    className="flex items-center gap-2.5 rounded-xl bg-surface-2 p-2.5 cursor-pointer hover:bg-black/5 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleDestKey(key)}
                      className="h-4 w-4 shrink-0 accent-[var(--accent)]"
                    />
                    <IconPackage size={16} stroke={1.75} className="text-text-secondary shrink-0" />
                    <span className="text-[13px] font-medium truncate text-text-primary flex-1">
                      {pack.name}
                    </span>
                  </label>
                );
              })}
              {filteredLibraryPacks.length === 0 && (
                <p className="text-[12px] text-text-muted px-2 py-1">검색된 보관함 팩이 없어요.</p>
              )}
            </div>
          </div>

          {/* 액션 버튼 바: 이동하기 vs 복사하기 */}
          <div className="flex items-center gap-2 pt-2 border-t border-border shrink-0">
            <button
              onClick={() => handleApply(true)}
              disabled={selectedDestKeys.size === 0}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-semibold border border-border hover:bg-surface-2 transition-all disabled:opacity-50"
            >
              <IconCopy size={15} stroke={1.75} />
              복사하기{selectedDestKeys.size > 0 ? ` (${selectedDestKeys.size})` : ""}
            </button>
            <button
              onClick={() => handleApply(false)}
              disabled={selectedDestKeys.size === 0}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-semibold transition-all disabled:opacity-50"
              style={{
                background: selectedDestKeys.size > 0 ? "var(--accent)" : "var(--surface-2)",
                color: selectedDestKeys.size > 0 ? "#fff" : "var(--text-muted)",
              }}
            >
              <IconArrowRight size={15} stroke={2} />
              이동하기{selectedDestKeys.size > 0 ? ` (${selectedDestKeys.size})` : ""}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
