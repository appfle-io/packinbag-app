"use client";

import { useState } from "react";
import type { Pack } from "@/lib/types";
import { Button, Sheet, Toggle } from "@/components/v2/ui";

// 팩(카테고리) 머리줄 길게 누르기: 이름 바꾸기 · 모두 체크/해제 · (메모) 보관함 자동 동기화 · 삭제
export function PackSheet({
  pack,
  onClose,
  onRename,
  onSetAllChecked,
  onToggleAutoSync,
  onDelete,
}: {
  pack: Pack | null;
  onClose: () => void;
  onRename: (name: string) => void;
  onSetAllChecked: (checked: boolean) => void;
  onToggleAutoSync: () => void;
  onDelete: () => void;
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
}: {
  pack: Pack;
  onClose: () => void;
  onRename: (name: string) => void;
  onSetAllChecked: (checked: boolean) => void;
  onToggleAutoSync: () => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(pack.name);
  const isMemo = pack.kind === "editor";
  const rowCls = "flex min-h-13 items-center border-b border-line bg-transparent text-left text-body";
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim() && name.trim() !== pack.name) onRename(name);
        onClose();
      }}
    >
      <label className="flex flex-col gap-2">
        <span className="text-caption font-semibold text-sub">{isMemo ? "메모 이름" : "카테고리 이름"}</span>
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
        <button
          type="button"
          className="flex min-h-13 items-center bg-transparent text-left text-body text-alert"
          onClick={() => {
            onDelete();
            onClose();
          }}
        >
          {isMemo ? "메모 삭제" : "카테고리 삭제"}
        </button>
      </div>
      <Button type="submit" block>
        완료
      </Button>
    </form>
  );
}