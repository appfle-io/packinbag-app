"use client";

import { useState } from "react";
import {
  IconLayoutGrid,
  IconFileText,
  IconFocus2,
  IconUser,
  IconCheck,
  IconDotsVertical,
  IconSquareCheck,
  IconAlignLeft,
  IconDeviceFloppy,
  IconDeviceFloppyFilled,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import PackingModeModal from "@/components/PackingModeModal";
import { Bag, Item, Pack } from "@/lib/types";

interface SampleItem {
  id: number;
  packId: string;
  name: string;
  checked: boolean;
  assignee: "나" | "친구" | null;
}

interface SamplePack {
  id: string;
  name: string;
  isSaved?: boolean;
}

export default function GuideBagButtonsDemo() {
  const [viewMode, setViewMode] = useState<"pack" | "notebook">("pack");
  const [onlyMine, setOnlyMine] = useState<boolean>(false);
  const [showPackingMode, setShowPackingMode] = useState<boolean>(false);

  const [packs, setPacks] = useState<SamplePack[]>([
    { id: "p-1", name: "전자기기 & 충전", isSaved: false },
    { id: "p-2", name: "세면 & 화장품", isSaved: true },
  ]);

  const [items, setItems] = useState<SampleItem[]>([
    { id: 1, packId: "p-1", name: "110V 돼지코 어댑터", checked: true, assignee: "나" },
    { id: 2, packId: "p-1", name: "보조배터리 20000mAh", checked: false, assignee: "나" },
    { id: 3, packId: "p-2", name: "칫솔 & 치약 세트", checked: false, assignee: "친구" },
    { id: 4, packId: "p-2", name: "선크림 SPF50+", checked: true, assignee: null },
  ]);

  const [quickAddPackId, setQuickAddPackId] = useState<string | null>(null);
  const [quickAddText, setQuickAddText] = useState("");
  const [activeMenuPackId, setActiveMenuPackId] = useState<string | null>(null);

  // 항목 체크 토글
  const handleToggleItem = (id: number) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i))
    );
  };

  // 항목 추가
  const handleAddItem = (packId: string) => {
    if (!quickAddText.trim()) {
      setQuickAddPackId(null);
      return;
    }
    const newItem: SampleItem = {
      id: Date.now(),
      packId,
      name: quickAddText.trim(),
      checked: false,
      assignee: null,
    };
    setItems((prev) => [...prev, newItem]);
    setQuickAddText("");
    setQuickAddPackId(null);
  };

  // 팩 저장 토글
  const handleToggleSavePack = (packId: string) => {
    setPacks((prev) =>
      prev.map((p) => (p.id === packId ? { ...p, isSaved: !p.isSaved } : p))
    );
    setActiveMenuPackId(null);
  };

  // 팩 삭제
  const handleDeletePack = (packId: string) => {
    setPacks((prev) => prev.filter((p) => p.id !== packId));
    setItems((prev) => prev.filter((i) => i.packId !== packId));
    setActiveMenuPackId(null);
  };

  // 집중 모드용 Bag 객체 생성
  const packingModeBag: Bag = {
    id: "guide-demo-bag",
    name: "도쿄 3박4일 여행",
    images: [],
    ownerId: "sample-user",
    memberIds: ["sample-user", "friend-1"],
    memberProfiles: {
      "sample-user": { nickname: "나", avatarId: "dog", joinedAt: new Date().toISOString() },
      "friend-1": { nickname: "친구", avatarId: "cat", joinedAt: new Date().toISOString() },
    },
    inviteCode: "DEMO123",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    packs: packs.map((p) => ({
      id: p.id,
      name: p.name,
      type: "pack",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: items
        .filter((i) => i.packId === p.id)
        .map((i) => ({
          id: String(i.id),
          type: "check",
          text: i.name,
          checked: i.checked,
          assigneeUid: i.assignee === "나" ? "sample-user" : i.assignee === "친구" ? "friend-1" : undefined,
        })),
    })),
  };

  // 필터링
  const filteredItems = items.filter((item) => {
    if (onlyMine && item.assignee !== "나") return false;
    return true;
  });

  return (
    <div className="w-full flex flex-col gap-3 select-none">
      {/* 실제 가방 상단 툴바 미니 시뮬레이션 */}
      <div className="rounded-xl border border-border/50 bg-surface-2/30 p-2 flex flex-wrap items-center justify-between gap-2">
        {/* 팩뷰 vs 심플뷰 전환 버튼 */}
        <div className="flex items-center gap-1 bg-surface/60 p-1 rounded-lg border border-border/50">
          <button
            type="button"
            onClick={() => setViewMode("pack")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11.5px] font-medium transition-colors ${
              viewMode === "pack"
                ? "bg-accent text-white"
                : "text-text-secondary hover:text-foreground"
            }`}
          >
            <IconLayoutGrid size={14} stroke={2} />
            <span>팩뷰</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("notebook")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11.5px] font-medium transition-colors ${
              viewMode === "notebook"
                ? "bg-accent text-white"
                : "text-text-secondary hover:text-foreground"
            }`}
          >
            <IconFileText size={14} stroke={2} />
            <span>심플뷰</span>
          </button>
        </div>

        {/* 집중모드(모달 열기) & 나만보기 필터 토글 */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowPackingMode(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-accent/40 bg-accent-soft text-accent text-[11.5px] font-semibold hover:bg-accent hover:text-white transition-all shadow-xs"
          >
            <IconFocus2 size={14} stroke={2.5} />
            <span>집중 모드 켜기</span>
          </button>

          <button
            type="button"
            onClick={() => setOnlyMine(!onlyMine)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11.5px] font-medium transition-colors ${
              onlyMine
                ? "bg-accent-soft text-accent border-accent/40"
                : "bg-surface/50 text-text-secondary border-border/60 hover:border-border"
            }`}
          >
            <IconUser size={14} stroke={2} />
            <span>나만 보기</span>
          </button>
        </div>
      </div>

      {/* 상태 안내 뱃지 */}
      <div className="flex items-center gap-2 text-[11px] text-text-muted px-1">
        <span>모든 버튼/체크박스를 직접 눌러보세요:</span>
        <span className="font-medium text-foreground">
          {viewMode === "pack" ? "팩뷰 (카드형)" : "심플뷰 (문서형)"}
        </span>
        {onlyMine && (
          <span className="px-1.5 py-0.2 rounded bg-accent-soft text-accent font-medium">
            내 짐만 보는 중
          </span>
        )}
      </div>

      {/* 실시간 렌더링 */}
      {viewMode === "pack" ? (
        // 1) 팩뷰 (PackCard 카드 바둑판 형태)
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {packs.length === 0 ? (
            <div className="col-span-2 text-center py-6 text-[12px] text-text-muted">
              모든 팩이 삭제되었습니다.
            </div>
          ) : (
            packs.map((p) => {
              const packItems = filteredItems.filter((i) => i.packId === p.id);
              const doneCount = packItems.filter((i) => i.checked).length;
              return (
                <div key={p.id} className="rounded-xl border border-border/50 bg-surface/20 p-3.5 flex flex-col gap-2 shadow-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-border/50">
                    <span className="font-semibold text-[13px] text-foreground">{p.name}</span>
                    <span className="text-[11px] text-text-muted">{doneCount}/{packItems.length}</span>
                  </div>

                  <div className="flex flex-col gap-1.5 min-h-[64px]">
                    {packItems.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleToggleItem(item.id)}
                        className="flex items-center justify-between text-[12px] p-1 rounded hover:bg-surface/40 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={`h-3.5 w-3.5 rounded flex items-center justify-center shrink-0 ${
                              item.checked ? "bg-accent text-white" : "border border-border-strong bg-surface/60"
                            }`}
                          >
                            {item.checked && <IconCheck size={10} stroke={3} />}
                          </div>
                          <span className={item.checked ? "line-through text-text-muted truncate" : "truncate text-foreground font-medium"}>
                            {item.name}
                          </span>
                        </div>
                        {item.assignee && (
                          <span
                            className={`text-[9.5px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
                              item.assignee === "나" ? "bg-accent-soft text-accent" : "bg-surface-2 text-text-muted"
                            }`}
                          >
                            {item.assignee}
                          </span>
                        )}
                      </div>
                    ))}

                    {/* 빠른 추가 인라인 입력창 */}
                    {quickAddPackId === p.id ? (
                      <div className="flex items-center gap-1.5 mt-1">
                        <input
                          type="text"
                          autoFocus
                          placeholder="새 짐 입력..."
                          value={quickAddText}
                          onChange={(e) => setQuickAddText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddItem(p.id);
                            if (e.key === "Escape") setQuickAddPackId(null);
                          }}
                          className="flex-1 rounded-md border border-border bg-surface/80 px-2 py-1 text-[12px] outline-none text-foreground"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddItem(p.id)}
                          className="px-2 py-1 rounded bg-accent text-white text-[11px] font-medium"
                        >
                          추가
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuickAddPackId(null)}
                          className="p-1 text-text-muted hover:text-foreground"
                        >
                          <IconX size={14} />
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {/* PackCard 하단 툴바 */}
                  <div className="pt-2 border-t border-border/50 flex items-center justify-between text-text-muted">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setQuickAddPackId(p.id);
                          setQuickAddText("");
                        }}
                        className="p-1 hover:text-foreground transition-colors"
                        title="짐 추가"
                      >
                        <IconSquareCheck size={16} />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleToggleSavePack(p.id)}
                        className="p-1 hover:text-accent transition-colors"
                        title="보관함 저장"
                      >
                        {p.isSaved ? (
                          <IconDeviceFloppyFilled size={16} className="text-accent" />
                        ) : (
                          <IconDeviceFloppy size={16} />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePack(p.id)}
                        className="p-1 hover:text-red-500 transition-colors"
                        title="팩 삭제"
                      >
                        <IconTrash size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        // 2) 실제 심플뷰 (NotebookPackSection - 헤더 + 둥근체크박스 + 우측 ⋯ 메뉴 드롭다운)
        <div className="rounded-xl border border-border/50 bg-surface/20 divide-y divide-border/50 overflow-hidden">
          {packs.length === 0 ? (
            <div className="text-center py-6 text-[12px] text-text-muted">모든 팩이 삭제되었습니다.</div>
          ) : (
            packs.map((p) => {
              const packItems = filteredItems.filter((i) => i.packId === p.id);
              const isMenuOpen = activeMenuPackId === p.id;
              return (
                <div key={p.id} className="p-3.5 flex flex-col gap-2.5 bg-surface/10 relative">
                  {/* 심플뷰 팩 헤더 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[13.5px] text-foreground">{p.name}</span>
                      <span className="text-[11px] text-text-muted">({packItems.length})</span>
                      {p.isSaved && (
                        <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-accent-soft text-accent font-medium">
                          보관함 저장됨
                        </span>
                      )}
                    </div>

                    {/* 우측 ⋯ 메뉴 버튼 */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setActiveMenuPackId(isMenuOpen ? null : p.id)}
                        className="text-text-muted hover:text-foreground p-1 rounded hover:bg-surface/50"
                      >
                        <IconDotsVertical size={16} />
                      </button>

                      {/* 드롭다운 팝업 메뉴 */}
                      {isMenuOpen && (
                        <div className="absolute right-0 top-7 z-20 w-32 rounded-xl bg-surface border border-border shadow-lg p-1 flex flex-col text-[12px]">
                          <button
                            type="button"
                            onClick={() => handleToggleSavePack(p.id)}
                            className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-2 text-left text-foreground"
                          >
                            <IconDeviceFloppy size={14} className="text-accent" />
                            <span>{p.isSaved ? "저장 해제" : "보관함 저장"}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePack(p.id)}
                            className="flex items-center gap-2 p-2 rounded-lg hover:bg-red-500/10 text-left text-red-500"
                          >
                            <IconTrash size={14} />
                            <span>팩 삭제</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 심플뷰 짐 목록 (둥근 체크박스) */}
                  <div className="flex flex-col gap-2 pl-1">
                    {packItems.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleToggleItem(item.id)}
                        className="flex items-center justify-between text-[12.5px] p-1 rounded hover:bg-surface/30 cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`h-4 w-4 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                              item.checked ? "bg-accent text-white" : "border-1.5 border-border-strong bg-surface/60"
                            }`}
                          >
                            {item.checked && <IconCheck size={11} stroke={3} />}
                          </div>
                          <span className={item.checked ? "line-through text-text-muted truncate" : "text-foreground truncate"}>
                            {item.name}
                          </span>
                        </div>
                        {item.assignee && (
                          <span className="text-[10px] text-accent font-medium shrink-0">
                            {item.assignee}
                          </span>
                        )}
                      </div>
                    ))}

                    {/* 빠른 추가 인라인 입력창 */}
                    {quickAddPackId === p.id && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <input
                          type="text"
                          autoFocus
                          placeholder="새 항목 입력..."
                          value={quickAddText}
                          onChange={(e) => setQuickAddText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddItem(p.id);
                            if (e.key === "Escape") setQuickAddPackId(null);
                          }}
                          className="flex-1 rounded-md border border-border bg-surface/80 px-2 py-1 text-[12px] outline-none text-foreground"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddItem(p.id)}
                          className="px-2 py-1 rounded bg-accent text-white text-[11px] font-medium"
                        >
                          추가
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 심플뷰 하단 "+ 항목 추가" 라인 */}
                  <button
                    type="button"
                    onClick={() => {
                      setQuickAddPackId(p.id);
                      setQuickAddText("");
                    }}
                    className="pt-1.5 text-[11.5px] text-text-muted flex items-center gap-1 border-t border-border/40 hover:text-foreground text-left"
                  >
                    <span className="text-accent font-bold">+</span>
                    <span>항목 추가</span>
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 실제 앱의 집중 모드(패킹 모드) 풀스크린 모달 연동 */}
      {showPackingMode && (
        <PackingModeModal
          bag={packingModeBag}
          currentUid="sample-user"
          onClose={() => setShowPackingMode(false)}
          onToggleItem={(_packId, itemId) => {
            handleToggleItem(Number(itemId));
          }}
        />
      )}
    </div>
  );
}
