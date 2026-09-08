"use client";

import { useMemo, useState } from "react";
import {
  IconX,
  IconCheck,
  IconSearch,
  IconBackpack,
  IconNotes,
  IconListCheck,
  IconFolder,
  IconChevronDown,
  IconChevronUp,
  IconLayersLinked,
  IconHistory,
} from "@tabler/icons-react";
import Portal from "@/components/Portal";
import { Bag, Pack, StartPageConfig } from "@/lib/types";
import { useEscapeToClose } from "@/lib/useEscapeToClose";
import { useOverlayLayer, POPOVER_OFFSET } from "@/lib/overlayLayer";

interface StartPageSelectModalProps {
  currentConfig?: StartPageConfig;
  bags: Bag[];
  libraryPacks: Pack[];
  onSelect: (config: StartPageConfig) => void;
  onClose: () => void;
}

export default function StartPageSelectModal({
  currentConfig,
  bags,
  libraryPacks,
  onSelect,
  onClose,
}: StartPageSelectModalProps) {
  const ambientLayer = useOverlayLayer();
  const zIndex = ambientLayer + POPOVER_OFFSET;
  useEscapeToClose(onClose);

  const currentType = currentConfig?.type || "home";
  const currentId = currentConfig?.id;
  const isCustomSelected = currentType === "bag" || currentType === "pack";

  // "특정 가방/팩으로 시작하기" 펼침 상태 (기존에 특정 가방/팩이 선택되어 있으면 기본으로 열림)
  const [showCustomPicker, setShowCustomPicker] = useState(isCustomSelected);
  const [searchQuery, setSearchQuery] = useState("");
  const [customTab, setCustomTab] = useState<"all" | "bag" | "checklist" | "memo">("all");

  const q = searchQuery.trim().toLowerCase();

  // 활성 가방만 필터링 (휴지통 제외)
  const activeBags = useMemo(
    () => bags.filter((b) => !b.trashedByOwnerAt),
    [bags]
  );

  // 활성 팩만 필터링 (폴더 제외, 휴지통 제외)
  const activePacks = useMemo(
    () => libraryPacks.filter((p) => p.type !== "folder" && !p.trashedAt),
    [libraryPacks]
  );

  // 체크팩 리스트 (editor형 제외)
  const checklistPacks = useMemo(
    () => activePacks.filter((p) => p.kind !== "editor"),
    [activePacks]
  );

  // 메모팩 리스트 (editor형)
  const memoPacks = useMemo(
    () => activePacks.filter((p) => p.kind === "editor"),
    [activePacks]
  );

  // 검색어 필터링
  const filteredBags = useMemo(() => {
    if (!q) return activeBags;
    return activeBags.filter((b) => b.name.toLowerCase().includes(q));
  }, [activeBags, q]);

  const filteredChecklistPacks = useMemo(() => {
    if (!q) return checklistPacks;
    return checklistPacks.filter((p) => p.name.toLowerCase().includes(q));
  }, [checklistPacks, q]);

  const filteredMemoPacks = useMemo(() => {
    if (!q) return memoPacks;
    return memoPacks.filter((p) => p.name.toLowerCase().includes(q));
  }, [memoPacks, q]);

  // 현재 선택된 특정 항목 라벨
  const selectedCustomLabel = useMemo(() => {
    if (currentType === "bag" && currentId) {
      const b = activeBags.find((bag) => bag.id === currentId);
      return b ? `[가방] ${b.name}` : currentConfig?.title || "선택된 가방";
    }
    if (currentType === "pack" && currentId) {
      const p = activePacks.find((pack) => pack.id === currentId);
      if (p) return `${p.kind === "editor" ? "[메모]" : "[체크팩]"} ${p.name}`;
      return currentConfig?.title || "선택된 팩";
    }
    return null;
  }, [currentType, currentId, activeBags, activePacks, currentConfig]);

  const isHomeSelected = currentType === "home";
  const isPacksSelected = currentType === "packs";
  const isLastUsedSelected = currentType === "last_used";

  const totalResultsCount = filteredBags.length + filteredChecklistPacks.length + filteredMemoPacks.length;

  return (
    <Portal>
      <div
        className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/45 backdrop-blur-[2px] transition-opacity"
        style={{ zIndex }}
        onClick={onClose}
      >
        <div
          className="w-full sm:max-w-md bg-surface border border-border rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[85vh] sm:max-h-[80vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
            <div>
              <h2 className="text-[16px] font-bold text-foreground">시작페이지 설정</h2>
              <p className="text-[12px] text-text-muted mt-0.5">
                앱을 열었을 때 가장 먼저 보여줄 화면을 선택해요.
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="닫기"
              className="p-1.5 rounded-lg text-text-muted hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer"
            >
              <IconX size={20} stroke={1.75} />
            </button>
          </div>

          {/* 메인 선택 영역 */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* 기본 화면 선택 목록 */}
            <div className="space-y-1.5">
              {/* 1. 가방 보관함 버튼 */}
              <button
                type="button"
                onClick={() => {
                  onSelect({ type: "home", title: "가방 보관함 (기본)" });
                  onClose();
                }}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  isHomeSelected
                    ? "bg-accent-soft/30 border-accent text-accent font-semibold"
                    : "bg-surface border-border/70 text-foreground hover:bg-surface-2"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-surface-2 text-text-secondary shrink-0">
                    <IconBackpack size={20} stroke={1.75} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-border/80 bg-surface-2 text-text-secondary shrink-0">
                        기본
                      </span>
                      <span className="text-[13px] truncate">가방 보관함</span>
                    </div>
                    <p className="text-[11px] text-text-muted mt-0.5">전체 가방 목록 화면</p>
                  </div>
                </div>
                {isHomeSelected && (
                  <IconCheck size={18} stroke={2.5} className="text-accent shrink-0 ml-2" />
                )}
              </button>

              {/* 2. 팩 보관함 버튼 */}
              <button
                type="button"
                onClick={() => {
                  onSelect({ type: "packs", title: "팩 보관함" });
                  onClose();
                }}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  isPacksSelected
                    ? "bg-accent-soft/30 border-accent text-accent font-semibold"
                    : "bg-surface border-border/70 text-foreground hover:bg-surface-2"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-surface-2 text-text-secondary shrink-0">
                    <IconFolder size={20} stroke={1.75} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-border/80 bg-surface-2 text-text-secondary shrink-0">
                        보관함
                      </span>
                      <span className="text-[13px] truncate">팩 보관함</span>
                    </div>
                    <p className="text-[11px] text-text-muted mt-0.5">전체 팩 및 메모 목록 화면</p>
                  </div>
                </div>
                {isPacksSelected && (
                  <IconCheck size={18} stroke={2.5} className="text-accent shrink-0 ml-2" />
                )}
              </button>

              {/* 3. 마지막으로 사용한 가방/팩 버튼 (신규) */}
              <button
                type="button"
                onClick={() => {
                  onSelect({ type: "last_used", title: "마지막으로 사용한 가방/팩" });
                  onClose();
                }}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  isLastUsedSelected
                    ? "bg-accent-soft/30 border-accent text-accent font-semibold"
                    : "bg-surface border-border/70 text-foreground hover:bg-surface-2"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-surface-2 text-text-secondary shrink-0">
                    <IconHistory size={20} stroke={1.75} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-border/80 bg-surface-2 text-text-secondary shrink-0">
                        기억
                      </span>
                      <span className="text-[13px] truncate">마지막으로 사용한 가방/팩</span>
                    </div>
                    <p className="text-[11px] text-text-muted mt-0.5">앱을 다시 열었을 때 직전에 작업하던 화면을 그대로 복원해요</p>
                  </div>
                </div>
                {isLastUsedSelected && (
                  <IconCheck size={18} stroke={2.5} className="text-accent shrink-0 ml-2" />
                )}
              </button>

              {/* 4. 특정 가방/팩으로 시작하기 버튼 */}
              <button
                type="button"
                onClick={() => setShowCustomPicker((prev) => !prev)}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  isCustomSelected
                    ? "bg-accent-soft/20 border-accent/70 text-foreground"
                    : showCustomPicker
                    ? "bg-surface-2 border-border text-foreground font-medium"
                    : "bg-surface border-border/70 text-foreground hover:bg-surface-2"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`p-2 rounded-lg shrink-0 ${
                      isCustomSelected
                        ? "bg-accent-soft text-accent"
                        : "bg-surface-2 text-text-secondary"
                    }`}
                  >
                    <IconLayersLinked size={20} stroke={1.75} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-border/80 bg-surface-2 text-text-secondary shrink-0">
                        지정
                      </span>
                      <span className="text-[13px] font-medium truncate">
                        특정 가방/팩으로 시작하기
                      </span>
                    </div>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      {selectedCustomLabel
                        ? `선택됨: ${selectedCustomLabel}`
                        : "검색해서 원하는 가방이나 팩을 직접 골라요"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2 text-text-muted">
                  {isCustomSelected && (
                    <span className="text-[11px] font-semibold text-accent px-1.5 py-0.5 rounded bg-accent-soft/40">
                      적용중
                    </span>
                  )}
                  {showCustomPicker ? (
                    <IconChevronUp size={18} stroke={2} />
                  ) : (
                    <IconChevronDown size={18} stroke={2} />
                  )}
                </div>
              </button>
            </div>

            {/* "특정 가방/팩으로 시작하기" 검색 중심 선택 영역 */}
            {showCustomPicker && (
              <div className="pt-2.5 space-y-3 border-t border-border/70 animate-in fade-in slide-in-from-top-2 duration-150">
                {/* 검색창 */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-2/70 border border-border focus-within:border-accent transition-colors">
                  <IconSearch size={16} stroke={1.75} className="text-text-muted shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="가방 또는 팩 이름 검색..."
                    className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-text-muted outline-none"
                    autoFocus
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="text-text-muted hover:text-foreground cursor-pointer"
                    >
                      <IconX size={14} stroke={2} />
                    </button>
                  )}
                </div>

                {/* 카테고리 필터 탭 */}
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5 text-[11.5px]">
                  <button
                    type="button"
                    onClick={() => setCustomTab("all")}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer shrink-0 ${
                      customTab === "all"
                        ? "bg-accent text-accent-contrast font-semibold shadow-xs"
                        : "bg-surface-2 text-text-secondary hover:text-foreground"
                    }`}
                  >
                    전체 ({totalResultsCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomTab("bag")}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer shrink-0 ${
                      customTab === "bag"
                        ? "bg-accent text-accent-contrast font-semibold shadow-xs"
                        : "bg-surface-2 text-text-secondary hover:text-foreground"
                    }`}
                  >
                    가방 ({filteredBags.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomTab("checklist")}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer shrink-0 ${
                      customTab === "checklist"
                        ? "bg-accent text-accent-contrast font-semibold shadow-xs"
                        : "bg-surface-2 text-text-secondary hover:text-foreground"
                    }`}
                  >
                    체크팩 ({filteredChecklistPacks.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomTab("memo")}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer shrink-0 ${
                      customTab === "memo"
                        ? "bg-accent text-accent-contrast font-semibold shadow-xs"
                        : "bg-surface-2 text-text-secondary hover:text-foreground"
                    }`}
                  >
                    메모팩 ({filteredMemoPacks.length})
                  </button>
                </div>

                {/* 검색 결과 리스트 (고정 높이 스크롤 영역) */}
                <div className="max-h-56 overflow-y-auto pr-0.5 space-y-1">
                  {totalResultsCount === 0 ? (
                    <div className="p-4 text-center rounded-xl border border-dashed border-border text-[12px] text-text-muted">
                      {q ? "일치하는 가방이나 팩이 없어요." : "등록된 항목이 없어요."}
                    </div>
                  ) : (
                    <>
                      {/* 가방 항목 */}
                      {(customTab === "all" || customTab === "bag") &&
                        filteredBags.map((bag) => {
                          const isSelected = currentType === "bag" && currentId === bag.id;
                          const packCount = bag.packs?.length || 0;
                          return (
                            <button
                              key={bag.id}
                              type="button"
                              onClick={() => {
                                onSelect({ type: "bag", id: bag.id, title: bag.name });
                                onClose();
                              }}
                              className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-accent-soft/30 border-accent text-accent font-semibold"
                                  : "bg-surface border-border/70 text-foreground hover:bg-surface-2"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="p-1.5 rounded-lg bg-surface-2 text-text-secondary shrink-0">
                                  <IconBackpack size={17} stroke={1.75} />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-border/80 bg-surface-2 text-text-secondary shrink-0">
                                      가방
                                    </span>
                                    <span className="text-[13px] truncate">{bag.name}</span>
                                  </div>
                                  <p className="text-[11px] text-text-muted mt-0.5">
                                    팩 {packCount}개 포함
                                  </p>
                                </div>
                              </div>
                              {isSelected && (
                                <IconCheck size={18} stroke={2.5} className="text-accent shrink-0 ml-2" />
                              )}
                            </button>
                          );
                        })}

                      {/* 체크팩 항목 */}
                      {(customTab === "all" || customTab === "checklist") &&
                        filteredChecklistPacks.map((pack) => {
                          const isSelected = currentType === "pack" && currentId === pack.id;
                          const itemCount = pack.items?.length || 0;
                          return (
                            <button
                              key={pack.id}
                              type="button"
                              onClick={() => {
                                onSelect({ type: "pack", id: pack.id, title: pack.name });
                                onClose();
                              }}
                              className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-accent-soft/30 border-accent text-accent font-semibold"
                                  : "bg-surface border-border/70 text-foreground hover:bg-surface-2"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                                  <IconListCheck size={17} stroke={1.75} />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                                      체크팩
                                    </span>
                                    <span className="text-[13px] truncate">{pack.name}</span>
                                  </div>
                                  <p className="text-[11px] text-text-muted mt-0.5">
                                    체크리스트 {itemCount}개
                                  </p>
                                </div>
                              </div>
                              {isSelected && (
                                <IconCheck size={18} stroke={2.5} className="text-accent shrink-0 ml-2" />
                              )}
                            </button>
                          );
                        })}

                      {/* 메모팩 항목 */}
                      {(customTab === "all" || customTab === "memo") &&
                        filteredMemoPacks.map((pack) => {
                          const isSelected = currentType === "pack" && currentId === pack.id;
                          return (
                            <button
                              key={pack.id}
                              type="button"
                              onClick={() => {
                                onSelect({ type: "pack", id: pack.id, title: pack.name });
                                onClose();
                              }}
                              className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-accent-soft/30 border-accent text-accent font-semibold"
                                  : "bg-surface border-border/70 text-foreground hover:bg-surface-2"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                                  <IconNotes size={17} stroke={1.75} />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                                      메모팩
                                    </span>
                                    <span className="text-[13px] truncate">{pack.name}</span>
                                  </div>
                                  <p className="text-[11px] text-text-muted mt-0.5">
                                    자유 메모
                                  </p>
                                </div>
                              </div>
                              {isSelected && (
                                <IconCheck size={18} stroke={2.5} className="text-accent shrink-0 ml-2" />
                              )}
                            </button>
                          );
                        })}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}
