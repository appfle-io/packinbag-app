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
  const [searchQuery, setSearchQuery] = useState("");
  const ambientLayer = useOverlayLayer();
  const zIndex = ambientLayer + POPOVER_OFFSET;
  useEscapeToClose(onClose);

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

  // 검색어 필터링 (검색어가 없으면 전체 리스트 표시)
  const filteredBags = useMemo(() => {
    if (!q) return activeBags;
    return activeBags.filter((b) => b.name.toLowerCase().includes(q));
  }, [activeBags, q]);

  const filteredPacks = useMemo(() => {
    if (!q) return activePacks;
    return activePacks.filter((p) => p.name.toLowerCase().includes(q));
  }, [activePacks, q]);

  const currentType = currentConfig?.type || "home";
  const currentId = currentConfig?.id;

  const isHomeSelected = currentType === "home";
  const isPacksSelected = currentType === "packs";

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
              className="p-1.5 rounded-lg text-text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
            >
              <IconX size={20} stroke={1.75} />
            </button>
          </div>

          {/* 검색창 */}
          <div className="p-3 border-b border-border/60 bg-surface-2/40 shrink-0">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface border border-border">
              <IconSearch size={16} stroke={1.75} className="text-text-muted shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="가방 또는 팩 이름 검색..."
                className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-text-muted outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="text-text-muted hover:text-foreground"
                >
                  <IconX size={14} stroke={2} />
                </button>
              )}
            </div>
          </div>

          {/* 리스트 영역 */}
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {/* 1. 기본 화면 섹션 */}
            {!q && (
              <div>
                <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider px-1 mb-1.5">
                  기본 화면
                </p>
                <div className="space-y-1">
                  {/* 가방 보관함 (기본) */}
                  <button
                    type="button"
                    onClick={() => {
                      onSelect({ type: "home", title: "가방 보관함 (기본)" });
                      onClose();
                    }}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                      isHomeSelected
                        ? "bg-accent-soft/30 border-accent text-accent font-semibold"
                        : "bg-surface border-border/70 text-foreground hover:bg-surface-2"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-1.5 rounded-lg bg-surface-2 text-text-secondary shrink-0">
                        <IconBackpack size={18} stroke={1.75} />
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

                  {/* 팩 보관함 */}
                  <button
                    type="button"
                    onClick={() => {
                      onSelect({ type: "packs", title: "팩 보관함" });
                      onClose();
                    }}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                      isPacksSelected
                        ? "bg-accent-soft/30 border-accent text-accent font-semibold"
                        : "bg-surface border-border/70 text-foreground hover:bg-surface-2"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-1.5 rounded-lg bg-surface-2 text-text-secondary shrink-0">
                        <IconFolder size={18} stroke={1.75} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-border/80 bg-surface-2 text-text-secondary shrink-0">
                            보관함
                          </span>
                          <span className="text-[13px] truncate">팩 보관함</span>
                        </div>
                        <p className="text-[11px] text-text-muted mt-0.5">전체 팩 및 메모 목록</p>
                      </div>
                    </div>
                    {isPacksSelected && (
                      <IconCheck size={18} stroke={2.5} className="text-accent shrink-0 ml-2" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* 2. 가방 목록 섹션 */}
            <div>
              <div className="flex items-center justify-between px-1 mb-1.5">
                <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                  특정 가방으로 시작
                </p>
                <span className="text-[11px] text-text-muted">{filteredBags.length}개</span>
              </div>
              {filteredBags.length === 0 ? (
                <div className="p-3 text-center rounded-xl border border-dashed border-border text-[12px] text-text-muted">
                  {q ? "일치하는 가방이 없어요." : "생성된 가방이 없어요."}
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredBags.map((bag) => {
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
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                          isSelected
                            ? "bg-accent-soft/30 border-accent text-accent font-semibold"
                            : "bg-surface border-border/70 text-foreground hover:bg-surface-2"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-1.5 rounded-lg bg-surface-2 text-text-secondary shrink-0">
                            <IconBackpack size={18} stroke={1.75} />
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
                </div>
              )}
            </div>

            {/* 3. 팩 목록 섹션 */}
            <div>
              <div className="flex items-center justify-between px-1 mb-1.5">
                <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                  특정 팩으로 시작
                </p>
                <span className="text-[11px] text-text-muted">{filteredPacks.length}개</span>
              </div>
              {filteredPacks.length === 0 ? (
                <div className="p-3 text-center rounded-xl border border-dashed border-border text-[12px] text-text-muted">
                  {q ? "일치하는 팩이 없어요." : "보관함에 등록된 팩이 없어요."}
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredPacks.map((pack) => {
                    const isSelected = currentType === "pack" && currentId === pack.id;
                    const isEditor = pack.kind === "editor";
                    const itemCount = pack.items?.length || 0;
                    return (
                      <button
                        key={pack.id}
                        type="button"
                        onClick={() => {
                          onSelect({ type: "pack", id: pack.id, title: pack.name });
                          onClose();
                        }}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                          isSelected
                            ? "bg-accent-soft/30 border-accent text-accent font-semibold"
                            : "bg-surface border-border/70 text-foreground hover:bg-surface-2"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`p-1.5 rounded-lg shrink-0 ${
                              isEditor
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            }`}
                          >
                            {isEditor ? (
                              <IconNotes size={18} stroke={1.75} />
                            ) : (
                              <IconListCheck size={18} stroke={1.75} />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${
                                  isEditor
                                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                    : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                                }`}
                              >
                                {isEditor ? "메모" : "팩"}
                              </span>
                              <span className="text-[13px] truncate">{pack.name}</span>
                            </div>
                            <p className="text-[11px] text-text-muted mt-0.5">
                              {isEditor ? "자유 메모팩" : `체크리스트 ${itemCount}개`}
                            </p>
                          </div>
                        </div>
                        {isSelected && (
                          <IconCheck size={18} stroke={2.5} className="text-accent shrink-0 ml-2" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
