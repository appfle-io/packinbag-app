"use client";

import { useState } from "react";
import { IconArrowRight, IconEdit, IconMenu2, IconPin, IconPinnedOff, IconShare } from "@tabler/icons-react";
import type { Pack } from "@/lib/types";
import { Button, Sheet } from "@/components/v2/ui";

// 팩·메모·폴더 길게 누르기(PC 우클릭): 이름 바꾸기 · 고정 · 순서 바꾸기 · 옮기기 · (폴더) 공유 · 삭제
export function EntrySheet({
  entry,
  onClose,
  pinned,
  canPin,
  canShare,
  onRename,
  onTogglePin,
  onMove,
  onShare,
  onDelete,
  onReorder,
}: {
  entry: Pack | null;
  onClose: () => void;
  pinned: boolean;
  // 고정은 계정(users/{uid})에 저장해서 오프라인 모드에서는 숨긴다
  canPin: boolean;
  canShare: boolean;
  onRename: () => void;
  onTogglePin: () => void;
  onMove: () => void;
  onShare: () => void;
  onDelete: () => void;
  // 이 폴더(또는 맨 위) 항목 순서 바꾸기. 없으면 숨김(오프라인)
  onReorder?: () => void;
}) {
  // 닫히는 동안 내용 유지
  const [cached, setCached] = useState<Pack | null>(entry);
  if (entry && entry !== cached) setCached(entry);
  const e = entry ?? cached;
  const isFolder = e?.type === "folder";
  const row = "flex min-h-13 w-full items-center gap-3 border-b border-line bg-transparent text-left text-body active:bg-fill";
  const act = (fn: () => void) => () => {
    onClose();
    fn();
  };

  return (
    <Sheet open={!!entry} onClose={onClose} title={e?.name || (isFolder ? "폴더" : "팩")}>
      {e && (
        <div className="flex flex-col gap-6">
          <section className="flex flex-col">
            <button type="button" className={row} onClick={act(onRename)}>
              <IconEdit size={20} stroke={1.75} className="text-sub" aria-hidden="true" />
              이름 바꾸기
            </button>
            {canPin && (
              <button type="button" className={row} onClick={act(onTogglePin)}>
                {pinned ? (
                  <IconPinnedOff size={20} stroke={1.75} className="text-sub" aria-hidden="true" />
                ) : (
                  <IconPin size={20} stroke={1.75} className="text-sub" aria-hidden="true" />
                )}
                {pinned ? "고정 해제" : "맨 위에 고정"}
              </button>
            )}
            <button type="button" className={row} onClick={act(onMove)}>
              <IconArrowRight size={20} stroke={1.75} className="text-sub" aria-hidden="true" />
              다른 폴더로 옮기기
            </button>
            {onReorder && (
              <button type="button" className={row} onClick={act(onReorder)}>
                <IconMenu2 size={20} stroke={1.75} className="text-sub" aria-hidden="true" />
                순서 바꾸기
              </button>
            )}
            {isFolder && canShare && (
              <button type="button" className={row} onClick={act(onShare)}>
                <IconShare size={20} stroke={1.75} className="text-sub" aria-hidden="true" />
                폴더 공유
              </button>
            )}
          </section>
          <Button variant="danger" className="self-start px-0" onClick={act(onDelete)}>
            {isFolder ? "폴더 삭제" : e.kind === "editor" ? "메모 삭제" : "팩 삭제"}
          </Button>
        </div>
      )}
    </Sheet>
  );
}
