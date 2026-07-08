"use client";

import { IconPlus } from "@tabler/icons-react";
import { Pack } from "@/lib/types";
import { useAuth } from "@/contexts/AuthProvider";
import { sortByOption } from "@/lib/listSort";
import PackTile from "@/components/PackTile";
import SortSelect from "@/components/SortSelect";

export default function PacksScreen({
  packs,
  onOpenPack,
  onNewPack,
}: {
  packs: Pack[];
  onOpenPack: (pack: Pack) => void;
  onNewPack: () => void;
}) {
  const { profile, updatePackSortBy } = useAuth();
  const sortBy = profile?.packSortBy ?? "createdAt";
  const sortedPacks = sortByOption(packs, sortBy);

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="flex items-baseline gap-2 mb-4">
        <h1 className="text-[22px] font-bold">팩</h1>
        <span className="text-[12px] text-text-muted">
          한 번 만들어두면 여러 가방에서 두고두고 써요
        </span>
      </div>

      {packs.length > 0 && (
        <div className="flex justify-end mb-3">
          <SortSelect value={sortBy} onChange={(v) => updatePackSortBy(v).catch(() => {})} />
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
        {sortedPacks.map((pack) => (
          <PackTile key={pack.id} pack={pack} onClick={() => onOpenPack(pack)} />
        ))}
        <button
          onClick={onNewPack}
          className="aspect-square rounded-xl border border-dashed border-border-strong flex items-center justify-center text-text-muted"
        >
          <IconPlus size={22} stroke={1.75} />
        </button>
      </div>
    </div>
  );
}
