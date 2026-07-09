"use client";

import { useRef, useState } from "react";
import { Pack } from "@/lib/types";
import { isInSyncWithLibrary } from "@/lib/packSync";
import PackCard from "./PackCard";

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default function PackGrid({
  packs,
  libraryPacks,
  onToggleItem,
  onChangeItemText,
  onDeleteItem,
  onAddItem,
  onRenamePack,
  onToggleAll,
  onSaveToLibrary,
  onDeletePack,
  onRefreshFromLibrary,
  onStartItemDrag,
  dragSourceItemId,
  dragOverItemId,
  dragOverPackId,
  onStartPackDrag,
  dragSourcePackId,
}: {
  packs: Pack[];
  libraryPacks: Pack[];
  onToggleItem: (packId: string, itemId: string) => void;
  onChangeItemText: (
    packId: string,
    itemId: string,
    text: string,
    style?: { bold?: boolean; strike?: boolean; color?: string }
  ) => void;
  onDeleteItem: (packId: string, itemId: string) => void;
  onAddItem: (packId: string, type: "check" | "text") => void;
  onRenamePack: (packId: string, name: string) => void;
  onToggleAll: (packId: string, checked: boolean) => void;
  onSaveToLibrary: (packId: string) => void;
  onDeletePack: (packId: string) => void;
  onRefreshFromLibrary: (packId: string) => void;
  onStartItemDrag?: (packId: string, itemId: string, text: string, clientX: number, clientY: number) => void;
  dragSourceItemId?: string | null;
  dragOverItemId?: string | null;
  dragOverPackId?: string | null;
  onStartPackDrag?: (packId: string, name: string, clientX: number, clientY: number) => void;
  dragSourcePackId?: string | null;
}) {
  const pages = chunk(packs, 4);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activePage, setActivePage] = useState(0);

  const handleScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    setActivePage(Math.round(el.scrollLeft / el.clientWidth));
  };

  const renderCard = (pack: Pack) => (
    <PackCard
      key={pack.id}
      pack={pack}
      isSyncedWithLibrary={isInSyncWithLibrary(pack, libraryPacks)}
      onToggleItem={(itemId) => onToggleItem(pack.id, itemId)}
      onChangeItemText={(itemId, text, style) =>
        onChangeItemText(pack.id, itemId, text, style)
      }
      onDeleteItem={(itemId) => onDeleteItem(pack.id, itemId)}
      onAddCheckItem={() => onAddItem(pack.id, "check")}
      onAddTextItem={() => onAddItem(pack.id, "text")}
      onRenamePack={(name) => onRenamePack(pack.id, name)}
      onToggleAll={(checked) => onToggleAll(pack.id, checked)}
      onSaveToLibrary={() => onSaveToLibrary(pack.id)}
      onDeletePack={() => onDeletePack(pack.id)}
      onRefreshFromLibrary={() => onRefreshFromLibrary(pack.id)}
      onStartItemDrag={
        onStartItemDrag
          ? (itemId, text, x, y) => onStartItemDrag(pack.id, itemId, text, x, y)
          : undefined
      }
      dragSourceItemId={dragSourceItemId}
      dragOverItemId={dragOverItemId}
      isDragOver={dragOverPackId === pack.id}
      onStartPackDrag={
        onStartPackDrag
          ? (x, y) => onStartPackDrag(pack.id, pack.name, x, y)
          : undefined
      }
      isPackDragSource={dragSourcePackId === pack.id}
    />
  );

  return (
    <>
      {/* 데스크톱: 2x2 그리드, 4개 초과시 가로 스크롤 페이지 전환 */}
      <div className="hidden md:block">
        <div
          ref={scrollerRef}
          onScroll={handleScroll}
          className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
        >
          {pages.map((page, i) => (
            <div
              key={i}
              className="grid grid-cols-2 gap-4 shrink-0 w-full snap-start"
              style={{ gridTemplateRows: "1fr 1fr", minHeight: 380 }}
            >
              {page.map(renderCard)}
            </div>
          ))}
        </div>
        {pages.length > 1 && (
          <div className="flex justify-center gap-1.5 mt-3">
            {pages.map((_, i) => (
              <div
                key={i}
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  background:
                    i === activePage ? "var(--text-secondary)" : "var(--border-strong)",
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* 모바일: 세로 스택, 페이지 스크롤 */}
      <div className="flex flex-col gap-3 md:hidden">
        {packs.map((pack) => (
          <div key={pack.id} style={{ minHeight: 0 }}>
            {renderCard(pack)}
          </div>
        ))}
      </div>
    </>
  );
}
