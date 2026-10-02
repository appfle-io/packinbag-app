"use client";

import type { Bag, Pack } from "@/lib/types";
import { ListRow, Sheet } from "@/components/v2/ui";

// 팩을 다른 가방으로 옮기기. 목록은 useBagLibrary.moveTargets(내가 멤버·잠기지 않음·팩 10개 미만)를 받는다.
export function MoveToBagSheet({
  pack,
  bags,
  onPick,
  onClose,
}: {
  pack: Pack | null;
  bags: Bag[];
  onPick: (bagId: string) => void;
  onClose: () => void;
}) {
  return (
    <Sheet open={!!pack} onClose={onClose} title={pack ? `'${pack.name}' 옮기기` : "옮기기"} size="tall">
      {bags.length === 0 ? (
        <p className="m-0 py-8 text-center text-caption text-faint">옮길 수 있는 다른 가방이 없어요</p>
      ) : (
        <div className="flex flex-col">
          <p className="m-0 pb-2 text-caption text-sub">팩이 통째로 옮겨지고, 이 가방에서는 빠져요.</p>
          {bags.map((b, i) => (
            <ListRow
              key={b.id}
              divider={i < bags.length - 1}
              title={b.name}
              subtitle={`팩 ${b.packs.length}개${b.memberIds.length > 1 ? ` · ${b.memberIds.length}명` : ""}`}
              onClick={() => {
                onPick(b.id);
                onClose();
              }}
            />
          ))}
        </div>
      )}
    </Sheet>
  );
}
