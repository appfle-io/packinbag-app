"use client";

import { useState } from "react";
import { IconFolder, IconHome } from "@tabler/icons-react";
import type { Pack } from "@/lib/types";
import { ListRow, Sheet } from "@/components/v2/ui";

// 다른 폴더로 옮기기. 자기 자신과 그 하위 폴더는 목록에서 빠진 채로 들어온다(targets).
export function MoveSheet({
  entry,
  onClose,
  targets,
  onMove,
}: {
  entry: Pack | null;
  onClose: () => void;
  targets: { folder: Pack; label: string }[];
  onMove: (parentId: string | undefined) => void;
}) {
  const [cached, setCached] = useState<Pack | null>(entry);
  if (entry && entry !== cached) setCached(entry);
  const e = entry ?? cached;
  const current = e?.parentId;
  const pick = (parentId: string | undefined) => {
    if (parentId !== current) onMove(parentId);
    onClose();
  };

  return (
    <Sheet open={!!entry} onClose={onClose} title={e ? `'${e.name}' 옮기기` : "옮기기"}>
      <div className="flex flex-col">
        <ListRow
          title={<span className="font-semibold">맨 위 (팩)</span>}
          leading={<IconHome size={22} stroke={1.6} className="shrink-0 text-sub" aria-hidden="true" />}
          trailing={!current ? "지금 위치" : undefined}
          disabled={!current}
          onClick={() => pick(undefined)}
        />
        {targets.map(({ folder, label }, i) => (
          <ListRow
            key={folder.id}
            title={<span className="font-semibold">{label}</span>}
            leading={<IconFolder size={22} stroke={1.6} className="shrink-0 text-brand" aria-hidden="true" />}
            trailing={current === folder.id ? "지금 위치" : undefined}
            disabled={current === folder.id}
            divider={i < targets.length - 1}
            onClick={() => pick(folder.id)}
          />
        ))}
        {targets.length === 0 && <p className="m-0 py-4 text-caption text-faint">옮길 수 있는 다른 폴더가 없어요.</p>}
      </div>
    </Sheet>
  );
}
