"use client";

import { useState } from "react";
import { IconArchive, IconArchiveOff, IconPin, IconPinnedOff } from "@tabler/icons-react";
import type { Bag, BagFolder } from "@/lib/types";
import { Button, Chip, SectionHeader, Sheet } from "@/components/v2/ui";

// 가방 길게 누르기 메뉴: 폴더 이동 · 고정 · 보관 · 삭제/나가기
export function BagActionSheet({
  bag,
  onClose,
  isOwner,
  pinned,
  archived,
  folders,
  folderId,
  personal,
  onTogglePin,
  onMoveToFolder,
  onToggleArchive,
  onDeleteOrLeave,
}: {
  bag: Bag | null;
  onClose: () => void;
  isOwner: boolean;
  pinned: boolean;
  archived: boolean;
  folders: BagFolder[];
  folderId: string | undefined;
  // 폴더·고정·보관은 계정(users/{uid})에 저장하는 개인 정리 정보라, 오프라인 모드에서는 숨긴다
  personal: boolean;
  onTogglePin: () => void;
  onMoveToFolder: (folderId: string | undefined) => void;
  onToggleArchive: () => void;
  onDeleteOrLeave: () => void;
}) {
  // 닫히는 동안에도 내용을 유지한다
  const [cached, setCached] = useState<Bag | null>(bag);
  if (bag && bag !== cached) setCached(bag);
  const b = bag ?? cached;
  const row = "flex min-h-13 w-full items-center gap-3 border-b border-line bg-transparent text-left text-body active:bg-fill";

  return (
    <Sheet open={!!bag} onClose={onClose} title={b?.name || "가방"}>
      {b && (
        <div className="flex flex-col gap-6">
          {personal && (
            <section className="flex flex-col gap-2">
              <SectionHeader>폴더</SectionHeader>
              <div className="pib-v2-no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
                <Chip label="없음" selected={!folderId} onClick={() => onMoveToFolder(undefined)} />
                {folders.map((f) => (
                  <Chip key={f.id} label={f.name} selected={folderId === f.id} onClick={() => onMoveToFolder(f.id)} />
                ))}
              </div>
              {folders.length === 0 && <p className="m-0 text-caption text-faint">홈 위쪽 + 칩으로 폴더를 만들 수 있어요.</p>}
            </section>
          )}

          {personal && (
            <section className="flex flex-col">
              {!archived && (
                <button type="button" className={row} onClick={() => (onTogglePin(), onClose())}>
                  {pinned ? (
                    <IconPinnedOff size={20} stroke={1.75} className="text-sub" aria-hidden="true" />
                  ) : (
                    <IconPin size={20} stroke={1.75} className="text-sub" aria-hidden="true" />
                  )}
                  {pinned ? "고정 해제" : "맨 위에 고정"}
                </button>
              )}
              <button type="button" className={row} onClick={() => (onToggleArchive(), onClose())}>
                {archived ? (
                  <IconArchiveOff size={20} stroke={1.75} className="text-sub" aria-hidden="true" />
                ) : (
                  <IconArchive size={20} stroke={1.75} className="text-sub" aria-hidden="true" />
                )}
                {archived ? "보관함에서 꺼내기" : "보관함으로 옮기기"}
              </button>
            </section>
          )}

          <Button variant="danger" className="self-start px-0" onClick={() => (onDeleteOrLeave(), onClose())}>
            {isOwner ? "가방 삭제" : "이 가방에서 나가기"}
          </Button>
        </div>
      )}
    </Sheet>
  );
}
