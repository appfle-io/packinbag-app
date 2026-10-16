"use client";

import { useState } from "react";
import { IconFolder, IconHome } from "@tabler/icons-react";
import type { Pack } from "@/lib/types";
import { ListRow, Sheet } from "@/components/v2/ui";

// 다른 폴더로 옮기기. 자기 자신과 그 하위 폴더는 목록에서 빠진 채로 들어온다(targets).
// 옮길 곳에 같은 이름이 이미 있으면(폴더는 폴더끼리, 팩 · 메모는 팩 · 메모끼리) 그 줄을 흐리게 하고 이유를 보인다(2026-10-17, packs.md 확인 필요 10)
export function MoveSheet({
  entry,
  onClose,
  targets,
  onMove,
  isTakenAt,
}: {
  entry: Pack | null;
  onClose: () => void;
  targets: { folder: Pack; label: string }[];
  onMove: (parentId: string | undefined) => void;
  // 그 위치(undefined = 맨 위)에 같은 이름이 있으면 true
  isTakenAt?: (parentId: string | undefined) => boolean;
}) {
  const [cached, setCached] = useState<Pack | null>(entry);
  if (entry && entry !== cached) setCached(entry);
  const e = entry ?? cached;
  const current = e?.parentId;
  const takenMessage = e?.type === "folder" ? "같은 이름의 폴더가 있어요" : "같은 이름의 팩이 있어요";
  const taken = (parentId: string | undefined) => parentId !== current && !!isTakenAt?.(parentId);
  const pick = (parentId: string | undefined) => {
    if (taken(parentId)) return;
    if (parentId !== current) onMove(parentId);
    onClose();
  };
  const rootTaken = taken(undefined);

  return (
    <Sheet open={!!entry} onClose={onClose} title={e ? `'${e.name}' 옮기기` : "옮기기"}>
      <div className="flex flex-col">
        <ListRow
          title={<span className="font-semibold">맨 위 (팩)</span>}
          subtitle={rootTaken ? takenMessage : undefined}
          leading={<IconHome size={22} stroke={1.6} className="shrink-0 text-sub" aria-hidden="true" />}
          trailing={!current ? "지금 위치" : undefined}
          disabled={!current || rootTaken}
          onClick={() => pick(undefined)}
        />
        {targets.map(({ folder, label }, i) => {
          const blocked = taken(folder.id);
          return (
            <ListRow
              key={folder.id}
              title={<span className="font-semibold">{label}</span>}
              subtitle={blocked ? takenMessage : undefined}
              leading={<IconFolder size={22} stroke={1.6} className="shrink-0 text-brand" aria-hidden="true" />}
              trailing={current === folder.id ? "지금 위치" : undefined}
              disabled={current === folder.id || blocked}
              divider={i < targets.length - 1}
              onClick={() => pick(folder.id)}
            />
          );
        })}
        {targets.length === 0 && <p className="m-0 py-4 text-caption text-faint">옮길 수 있는 다른 폴더가 없어요.</p>}
      </div>
    </Sheet>
  );
}
