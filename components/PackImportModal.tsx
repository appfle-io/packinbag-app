"use client";

import Portal from "@/components/Portal";

import { useMemo, useState } from "react";
import { IconX, IconPlus } from "@tabler/icons-react";
import { Pack } from "@/lib/types";

function cloneAsNewPack(pack: Pack): Pack {
  return {
    ...pack,
    id: `pack-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    savedAsLibraryPack: true,
    linkedLibraryPackId: pack.id,
    linkedLibraryUpdatedAt: pack.updatedAt,
    items: pack.items.map((item) => ({
      ...item,
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    })),
  };
}

export default function PackImportModal({
  libraryPacks,
  onClose,
  onImport,
  onCreateNew,
}: {
  libraryPacks: Pack[];
  onClose: () => void;
  onImport: (packs: Pack[]) => void;
  onCreateNew: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(
    () =>
      libraryPacks.filter((p) =>
        p.name.toLowerCase().includes(query.toLowerCase())
      ),
    [libraryPacks, query]
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleImport = () => {
    const packsToImport = libraryPacks
      .filter((p) => selected.has(p.id))
      .map(cloneAsNewPack);
    onImport(packsToImport);
    onClose();
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.45)" }}
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm rounded-2xl bg-surface p-4 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-[16px] font-medium">팩 불러오기</span>
            <button onClick={onClose}>
              <IconX size={18} stroke={1.75} color="var(--text-secondary)" />
            </button>
          </div>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="팩 이름 검색"
            className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none"
          />

          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto scrollbar-thin">
            {filtered.map((pack) => (
              <label
                key={pack.id}
                className="flex items-start gap-2.5 rounded-lg bg-surface-2 p-2.5 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.has(pack.id)}
                  onChange={() => toggle(pack.id)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium mb-0.5">
                    {pack.name}
                  </div>
                  <div className="text-[12px] text-text-secondary truncate">
                    {pack.items.map((i) => i.text).join(", ")}
                  </div>
                </div>
              </label>
            ))}
            {filtered.length === 0 && (
              <p className="text-[12px] text-text-muted py-4 text-center">
                검색 결과가 없어요.
              </p>
            )}
          </div>

          <button
            onClick={() => {
              onCreateNew();
              onClose();
            }}
            className="flex items-center justify-center gap-1.5 text-[13px] text-text-secondary py-1"
          >
            <IconPlus size={14} stroke={1.75} />새 팩 만들기
          </button>

          <button
            onClick={handleImport}
            disabled={selected.size === 0}
            className="rounded-lg py-2.5 text-[14px] font-medium"
            style={{
              background:
                selected.size > 0 ? "var(--accent)" : "var(--surface-2)",
              color: selected.size > 0 ? "#fff" : "var(--text-muted)",
            }}
          >
            불러오기{selected.size > 0 ? ` (${selected.size})` : ""}
          </button>
        </div>
      </div>
    </Portal>
  );
}
