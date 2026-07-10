"use client";

import { IconPlus } from "@tabler/icons-react";
import { Pack } from "@/lib/types";
import { useAuth } from "@/contexts/AuthProvider";
import { sortByOption } from "@/lib/listSort";
import PackTile from "@/components/PackTile";
import SortSelect from "@/components/SortSelect";
import { useToast } from "@/components/Toast";

export default function PacksScreen({
  packs,
  lockedPackIds,
  onOpenPack,
  onNewPack,
}: {
  packs: Pack[];
  // 무료 전환으로 잠긴 팩 id 목록. 타일에 자물쇠 표시만 하고, 탭하면 여전히 열린다 -
  // 실제 읽기 전용 처리는 PackLibraryEditorScreen(AppShell이 계산해서 넘긴 readOnly)이 한다.
  lockedPackIds?: Set<string>;
  onOpenPack: (pack: Pack) => void;
  onNewPack: () => void;
}) {
  const { profile, updatePackSortBy } = useAuth();
  const { show } = useToast();
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
          <SortSelect value={sortBy} onChange={(v) => updatePackSortBy(v).catch(() => show("변경사항을 저장하지 못했어요"))} />
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
        {sortedPacks.map((pack) => (
          <PackTile
            key={pack.id}
            pack={pack}
            locked={lockedPackIds?.has(pack.id)}
            onClick={() => onOpenPack(pack)}
          />
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
