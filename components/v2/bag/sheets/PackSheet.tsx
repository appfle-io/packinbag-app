"use client";

import { useState } from "react";
import { IconArrowRight, IconCloudCheck, IconCloudUpload, IconRefreshAlert } from "@tabler/icons-react";
import type { Pack } from "@/lib/types";
import { Button, Sheet, Toggle, cx } from "@/components/v2/ui";

// 팩 보관함 줄: 상태에 따라 문구가 바뀐다(BagScreenV2가 useBagLibrary.statusOf로 만든다)
export interface PackLibraryRow {
  label: string;
  // 보관함과 같음 / 달라짐 / 아직 없음
  tone: "same" | "changed" | "unsaved";
  onClick: () => void;
}

// 팩 머리줄 길게 누르기: 이름 바꾸기 · 모두 체크/해제 · (메모) 보관함 자동 동기화 · 팩 보관함 · 다른 가방으로 옮기기 · 삭제
export function PackSheet({
  pack,
  onClose,
  onRename,
  onSetAllChecked,
  onToggleAutoSync,
  onDelete,
  library,
  onMoveToBag,
}: {
  pack: Pack | null;
  onClose: () => void;
  onRename: (name: string) => void;
  onSetAllChecked: (checked: boolean) => void;
  onToggleAutoSync: () => void;
  onDelete: () => void;
  // 없으면 줄을 숨긴다(자동 동기화 중인 메모 등)
  library?: PackLibraryRow | null;
  // 없으면(옮길 가방이 없음) 줄을 숨긴다
  onMoveToBag?: () => void;
}) {
  return (
    <Sheet open={!!pack} onClose={onClose} showClose={false}>
      {pack && (
        <PackSheetBody
          key={pack.id}
          pack={pack}
          onClose={onClose}
          onRename={onRename}
          onSetAllChecked={onSetAllChecked}
          onToggleAutoSync={onToggleAutoSync}
          onDelete={onDelete}
          library={library}
          onMoveToBag={onMoveToBag}
        />
      )}
    </Sheet>
  );
}

function PackSheetBody({
  pack,
  onClose,
  onRename,
  onSetAllChecked,
  onToggleAutoSync,
  onDelete,
  library,
  onMoveToBag,
}: {
  pack: Pack;
  onClose: () => void;
  onRename: (name: string) => void;
  onSetAllChecked: (checked: boolean) => void;
  onToggleAutoSync: () => void;
  onDelete: () => void;
  library?: PackLibraryRow | null;
  onMoveToBag?: () => void;
}) {
  const [name, setName] = useState(pack.name);
  const isMemo = pack.kind === "editor";
  const rowCls = "flex min-h-13 items-center gap-3 border-b border-line bg-transparent text-left text-body";
  // 이름을 고친 채로 다른 줄을 누르면 이름도 같이 저장한다
  const commitName = () => {
    if (name.trim() && name.trim() !== pack.name) onRename(name);
  };
  const LibraryIcon = library?.tone === "same" ? IconCloudCheck : library?.tone === "changed" ? IconRefreshAlert : IconCloudUpload;
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        commitName();
        onClose();
      }}
    >
      <label className="flex flex-col gap-2">
        <span className="text-caption font-semibold text-sub">{isMemo ? "메모 이름" : "팩 이름"}</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-12 rounded-field border border-line bg-card px-4 text-body-lg font-semibold outline-none focus:border-ink"
        />
      </label>
      <div className="flex flex-col rounded-card border border-line bg-card px-4">
        {!isMemo && (
          <>
            <button
              type="button"
              className={rowCls}
              onClick={() => {
                onSetAllChecked(true);
                onClose();
              }}
            >
              모두 체크
            </button>
            <button
              type="button"
              className={rowCls}
              onClick={() => {
                onSetAllChecked(false);
                onClose();
              }}
            >
              모두 해제
            </button>
          </>
        )}
        {isMemo && pack.linkedLibraryPackId && (
          <div className="border-b border-line">
            <Toggle
              checked={!!pack.autoSyncEnabled}
              onChange={onToggleAutoSync}
              label="보관함 팩과 자동 동기화"
              description="이 가방을 열어 둔 동안 더 최신 내용으로 맞춰요"
            />
          </div>
        )}
        {library && (
          <button
            type="button"
            className={rowCls}
            onClick={() => {
              commitName();
              onClose();
              library.onClick();
            }}
          >
            <LibraryIcon
              size={20}
              stroke={1.75}
              aria-hidden="true"
              className={cx(library.tone === "changed" ? "text-brand" : "text-sub")}
            />
            <span className={cx("min-w-0 flex-1 truncate", library.tone === "same" && "text-sub")}>{library.label}</span>
          </button>
        )}
        {onMoveToBag && (
          <button
            type="button"
            className={rowCls}
            onClick={() => {
              commitName();
              onClose();
              onMoveToBag();
            }}
          >
            <IconArrowRight size={20} stroke={1.75} className="text-sub" aria-hidden="true" />
            다른 가방으로 옮기기
          </button>
        )}
        <button
          type="button"
          className="flex min-h-13 items-center bg-transparent text-left text-body text-alert"
          onClick={() => {
            onDelete();
            onClose();
          }}
        >
          {isMemo ? "메모 삭제" : "팩 삭제"}
        </button>
      </div>
      <Button type="submit" block>
        완료
      </Button>
    </form>
  );
}
