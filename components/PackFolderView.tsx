"use client";

import { useMemo, useState } from "react";
import {
  IconFolder,
  IconFolderPlus,
  IconPlus,
  IconChevronRight,
  IconTrash,
  IconNotes,
  IconExternalLink,
} from "@tabler/icons-react";
import { Bag, Item, Pack } from "@/lib/types";
import ConfirmDialog from "@/components/ConfirmDialog";
import ProgressRing from "@/components/ProgressRing";
import { getProgressRatio } from "@/lib/itemStats";

interface PackFolderViewProps {
  folder: Pack;
  allLibraryPacks: Pack[];
  bags?: Bag[];
  onSelectFolder: (folderId: string) => void;
  onSelectPack: (packId: string) => void;
  onNewPack: (parentId?: string, kind?: "checklist" | "editor") => void;
  onNewFolder: (parentId?: string) => void;
  onRenameEntry: (pack: Pack, name: string) => void;
  onSavePack: (pack: Pack) => void;
  onDeletePack: (packId: string) => void;
  onBack: () => void;
  premium?: boolean;
  lockedBagIds?: Set<string>;
  onAddItemsToBagPack?: (bagId: string, packId: string, items: Item[]) => void;
  onRemoveItemsFromBagPack?: (bagId: string, packId: string, itemIds: Set<string>) => void;
}

export default function PackFolderView({
  folder,
  allLibraryPacks,
  onSelectFolder,
  onSelectPack,
  onNewPack,
  onNewFolder,
  onSavePack,
  onDeletePack,
  onBack,
}: PackFolderViewProps) {
  // 1. 브레드크럼 (Breadcrumb) 경로 계산
  const breadcrumbs = useMemo(() => {
    const trail: Pack[] = [];
    let cur: Pack | undefined = folder;
    const visited = new Set<string>();
    while (cur && !visited.has(cur.id)) {
      visited.add(cur.id);
      trail.unshift(cur);
      cur = cur.parentId ? allLibraryPacks.find((p) => p.id === cur!.parentId) : undefined;
    }
    return trail;
  }, [folder, allLibraryPacks]);

  // 2. 직속 하위 폴더 목록
  const childFolders = useMemo(() => {
    return allLibraryPacks
      .filter((p) => (p.parentId ?? undefined) === folder.id && p.type === "folder")
      .map((f) => {
        const itemsCount = allLibraryPacks.filter((p) => (p.parentId ?? undefined) === f.id).length;
        return { ...f, itemsCount };
      });
  }, [allLibraryPacks, folder.id]);

  // 3. 직속 하위 팩 목록
  const childPacks = useMemo(() => {
    return allLibraryPacks.filter(
      (p) => (p.parentId ?? undefined) === folder.id && p.type !== "folder" && !p.isQuickPack
    );
  }, [allLibraryPacks, folder.id]);

  // 새 팩 생성 팝오버 메뉴
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [deleteConfirmPackId, setDeleteConfirmPackId] = useState<string | null>(null);

  // 인라인 아이템 추가 인풋 상태 관리 (packId -> text)
  const [quickAddTexts, setQuickAddTexts] = useState<Record<string, string>>({});

  // 아이템 체크/체크해제 토글
  const handleToggleItem = (pack: Pack, itemId: string) => {
    const updatedItems = pack.items.map((it) =>
      it.id === itemId ? { ...it, checked: !it.checked } : it
    );
    onSavePack({ ...pack, items: updatedItems });
  };

  // 인라인 새 아이템 추가
  const handleAddQuickItem = (pack: Pack) => {
    const text = (quickAddTexts[pack.id] || "").trim();
    if (!text) return;
    const newItem: Item = {
      id: "item-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      type: "check",
      text,
      checked: false,
    };
    onSavePack({
      ...pack,
      items: [...pack.items, newItem],
    });
    setQuickAddTexts((prev) => ({ ...prev, [pack.id]: "" }));
  };

  // 아이템 삭제
  const handleDeleteItem = (pack: Pack, itemId: string) => {
    const updatedItems = pack.items.filter((it) => it.id !== itemId);
    onSavePack({ ...pack, items: updatedItems });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* 상단 브레드크럼 및 툴바 */}
      <header className="shrink-0 border-b border-border bg-surface px-6 py-3.5 flex items-center justify-between gap-4">
        {/* 브레드크럼 경로 */}
        <div className="flex items-center gap-1.5 text-[13px] text-text-muted min-w-0 flex-1 overflow-x-auto no-scrollbar">
          <button
            onClick={onBack}
            className="hover:text-foreground hover:underline transition-colors shrink-0 font-medium"
          >
            팩 보관함
          </button>
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <div key={crumb.id} className="flex items-center gap-1.5 shrink-0">
                <IconChevronRight size={13} stroke={2} className="text-border shrink-0" />
                {isLast ? (
                  <span className="font-bold text-foreground flex items-center gap-1">
                    <IconFolder size={15} stroke={2} className="text-amber-500 shrink-0" />
                    <span className="truncate max-w-[200px]">{crumb.name}</span>
                  </span>
                ) : (
                  <button
                    onClick={() => onSelectFolder(crumb.id)}
                    className="hover:text-foreground hover:underline transition-colors truncate max-w-[150px]"
                  >
                    {crumb.name}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* 우측 액션 버튼들 */}
        <div className="flex items-center gap-2 shrink-0 relative">
          <button
            onClick={() => onNewFolder(folder.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-medium rounded-xl border border-border bg-surface-2 text-text-secondary hover:bg-surface-2/80 hover:text-foreground transition-all"
            title="현재 폴더 안에 새 하위 폴더를 만듭니다"
          >
            <IconFolderPlus size={15} stroke={1.75} />
            <span>하위 폴더</span>
          </button>

          <div className="relative">
            <button
              onClick={() => setShowAddMenu((prev) => !prev)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-[12.5px] font-semibold rounded-xl bg-accent text-accent-foreground hover:opacity-90 shadow-xs transition-all"
            >
              <IconPlus size={15} stroke={2.5} />
              <span>새 팩</span>
            </button>

            {showAddMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowAddMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1.5 w-44 rounded-xl border border-border bg-surface shadow-xl py-1.5 z-50 flex flex-col text-[13px]">
                  <button
                    onClick={() => {
                      setShowAddMenu(false);
                      onNewPack(folder.id, "checklist");
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-2 transition-colors font-medium text-foreground"
                  >
                    <IconPlus size={15} stroke={2} />
                    <span>체크리스트 팩</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowAddMenu(false);
                      onNewPack(folder.id, "editor");
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-2 transition-colors font-medium text-foreground"
                  >
                    <IconNotes size={15} stroke={2} />
                    <span>자유 메모 팩</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 본문 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6">
        {/* 1. 하위 폴더 타일 섹션 */}
        {childFolders.length > 0 && (
          <section className="flex flex-col gap-2.5">
            <h3 className="text-[12.5px] font-semibold text-text-muted flex items-center gap-1.5">
              <IconFolder size={14} stroke={2} />
              <span>하위 폴더 ({childFolders.length})</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {childFolders.map((subFolder) => (
                <div
                  key={subFolder.id}
                  onClick={() => onSelectFolder(subFolder.id)}
                  className="group flex items-center gap-2.5 p-3 rounded-xl border border-border bg-surface hover:bg-surface-2 hover:border-accent/40 cursor-pointer shadow-2xs transition-all"
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <IconFolder size={18} stroke={1.75} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-foreground truncate group-hover:text-accent transition-colors">
                      {subFolder.name}
                    </p>
                    <p className="text-[11px] text-text-muted truncate">
                      {subFolder.itemsCount}개 항목
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 2. 팩 카드 그리드 섹션 */}
        {childPacks.length > 0 ? (
          <section className="flex flex-col gap-2.5">
            <h3 className="text-[12.5px] font-semibold text-text-muted flex items-center gap-1.5">
              <span>팩 목록 ({childPacks.length})</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4.5">
              {childPacks.map((pack) => {
                const isEditor = pack.kind === "editor";
                const ratio = !isEditor ? getProgressRatio(pack.items) : null;
                const checkedCount = pack.items.filter((i) => i.checked).length;
                const totalCount = pack.items.length;

                return (
                  <div
                    key={pack.id}
                    className="flex flex-col rounded-2xl border border-border bg-surface shadow-xs overflow-hidden transition-all hover:border-border/80 hover:shadow-sm"
                  >
                    {/* 카드 헤더 */}
                    <div className="px-4 py-3 border-b border-border/60 bg-surface-2/40 flex items-center justify-between gap-2">
                      <div
                        onClick={() => onSelectPack(pack.id)}
                        className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer group"
                      >
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border shrink-0 ${
                            isEditor
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                              : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                          }`}
                        >
                          {isEditor ? "메모" : "체크"}
                        </span>
                        <h4 className="text-[14px] font-bold text-foreground truncate group-hover:text-accent transition-colors">
                          {pack.name}
                        </h4>
                        <IconExternalLink
                          size={13}
                          stroke={2}
                          className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        />
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {!isEditor && totalCount > 0 && (
                          <div className="flex items-center gap-1.5 text-[11px] font-medium text-text-muted">
                            <span>
                              {checkedCount}/{totalCount}
                            </span>
                            <ProgressRing ratio={ratio ?? 0} size={15} />
                          </div>
                        )}
                        <button
                          onClick={() => setDeleteConfirmPackId(pack.id)}
                          className="p-1 rounded-lg text-text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
                          title="팩 삭제"
                        >
                          <IconTrash size={14} stroke={1.75} />
                        </button>
                      </div>
                    </div>

                    {/* 카드 본문: 에디터팩 vs 체크리스트팩 */}
                    {isEditor ? (
                      <div
                        onClick={() => onSelectPack(pack.id)}
                        className="p-4 flex-1 flex flex-col justify-between gap-3 cursor-pointer group min-h-[120px]"
                      >
                        <p className="text-[12.5px] text-text-secondary line-clamp-4 leading-relaxed font-sans whitespace-pre-wrap">
                          {pack.editorPreviewText || "메모가 비어있어요. 클릭해서 작성해보세요."}
                        </p>
                        <div className="flex items-center justify-between text-[11px] text-accent font-medium pt-2 border-t border-border/40">
                          <span>자유 메모 열기</span>
                          <IconChevronRight size={13} stroke={2} className="group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col flex-1">
                        {/* 아이템 목록 */}
                        <div className="p-3 flex-1 flex flex-col gap-1.5 max-h-[300px] overflow-y-auto">
                          {pack.items.length === 0 ? (
                            <p className="text-[12px] text-text-muted py-4 text-center">
                              아직 아이템이 없어요.
                            </p>
                          ) : (
                            pack.items.map((item) => (
                              <div
                                key={item.id}
                                className="group flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-2 transition-colors text-[13px]"
                              >
                                <label className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={!!item.checked}
                                    onChange={() => handleToggleItem(pack, item.id)}
                                    className="w-4 h-4 rounded border-border text-accent focus:ring-accent accent-accent shrink-0 cursor-pointer"
                                  />
                                  <span
                                    className={`truncate leading-normal transition-all ${
                                      item.checked
                                        ? "line-through text-text-muted opacity-60"
                                        : "text-foreground font-normal"
                                    }`}
                                  >
                                    {item.text}
                                  </span>
                                </label>
                                <button
                                  onClick={() => handleDeleteItem(pack, item.id)}
                                  className="opacity-0 group-hover:opacity-100 p-0.5 text-text-muted hover:text-red-500 rounded transition-opacity"
                                  title="아이템 삭제"
                                >
                                  <IconTrash size={13} stroke={1.75} />
                                </button>
                              </div>
                            ))
                          )}
                        </div>

                        {/* 인라인 아이템 빠른 추가 입력줄 */}
                        <div className="px-3 py-2.5 border-t border-border/60 bg-surface-2/20 flex items-center gap-1.5">
                          <input
                            type="text"
                            value={quickAddTexts[pack.id] || ""}
                            onChange={(e) =>
                              setQuickAddTexts((prev) => ({
                                ...prev,
                                [pack.id]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                                handleAddQuickItem(pack);
                              }
                            }}
                            placeholder="+ 새 아이템 입력 (Enter)"
                            className="flex-1 bg-transparent text-[12.5px] text-foreground placeholder:text-text-muted outline-none px-1"
                          />
                          {(quickAddTexts[pack.id] || "").trim() && (
                            <button
                              onClick={() => handleAddQuickItem(pack)}
                              className="px-2 py-1 text-[11px] font-semibold rounded-md bg-accent text-accent-foreground shrink-0 hover:opacity-90"
                            >
                              추가
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ) : childFolders.length === 0 ? (
          /* 하위 폴더도 없고 팩도 없는 빈 상태 */
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-center text-text-muted gap-3">
            <div className="w-14 h-14 rounded-2xl bg-surface-2 flex items-center justify-center text-text-muted mb-1">
              <IconFolder size={28} stroke={1.5} />
            </div>
            <p className="text-[14px] font-medium text-foreground">
              이 폴더에 담긴 팩이 아직 없어요
            </p>
            <p className="text-[12.5px] text-text-secondary max-w-sm">
              상단 버튼을 눌러 새 체크리스트 팩이나 자유 메모 팩을 만들거나, 하위 폴더를 추가해보세요.
            </p>
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => onNewPack(folder.id, "checklist")}
                className="flex items-center gap-1 px-3.5 py-1.5 text-[12.5px] font-semibold rounded-xl bg-accent text-accent-foreground hover:opacity-90 transition-all"
              >
                <IconPlus size={14} stroke={2.5} />
                <span>팩 만들기</span>
              </button>
              <button
                onClick={() => onNewFolder(folder.id)}
                className="flex items-center gap-1 px-3 py-1.5 text-[12.5px] font-medium rounded-xl border border-border bg-surface hover:bg-surface-2 transition-all text-text-secondary hover:text-foreground"
              >
                <IconFolderPlus size={14} stroke={1.75} />
                <span>하위 폴더 만들기</span>
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* 팩 삭제 확인 모달 */}
      {deleteConfirmPackId && (
        <ConfirmDialog
          title="팩을 삭제하시겠어요?"
          message="삭제한 팩은 설정 > 휴지통으로 이동하며, 30일 동안 보관된 후 완전히 삭제돼요."
          confirmLabel="삭제"
          tone="danger"
          onConfirm={() => {
            onDeletePack(deleteConfirmPackId);
            setDeleteConfirmPackId(null);
          }}
          onCancel={() => setDeleteConfirmPackId(null)}
        />
      )}
    </div>
  );
}
