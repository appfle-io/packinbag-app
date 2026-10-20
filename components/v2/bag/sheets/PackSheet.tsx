"use client";

import { useEffect, useRef, useState } from "react";
import { IconArrowRight, IconCloudCheck, IconCloudUpload, IconLock, IconLockOpen, IconRefreshAlert } from "@tabler/icons-react";
import type { Pack } from "@/lib/types";
import { Button, Sheet, Toggle, cx } from "@/components/v2/ui";

// 팩 보관함 줄: 상태에 따라 문구가 바뀐다(BagScreenV2가 useBagLibrary.statusOf로 만든다)
export interface PackLibraryRow {
  label: string;
  // 보관함과 같음 / 달라짐 / 아직 없음
  tone: "same" | "changed" | "unsaved";
  onClick: () => void;
}

// 개인 잠금 줄(2026-10-12). inherited = 보관함에서 잠근 팩을 불러와 같이 잠긴 것(여기서는 못 풀고 안내만)
export interface PackPrivacyRow {
  locked: boolean;
  inherited: boolean;
  onToggle: () => void;
}

// 팩 머리줄 길게 누르기: 이름 바꾸기 · 모두 체크/해제 · (메모) 보관함 자동 동기화 · 팩 보관함 · 다른 가방으로 옮기기 · 삭제
// 이름 칸을 고쳤으면 시트를 어떻게 닫든(완료 · 다른 줄 · 바깥 · 끌어내리기 · Esc) 이름을 같이 저장한다. 삭제만 예외(2026-10-14)
export function PackSheet({
  pack,
  onClose,
  nameLocked = false,
  onRename,
  onSetAllChecked,
  onToggleAutoSync,
  onDelete,
  library,
  onMoveToBag,
  privacyLock,
}: {
  pack: Pack | null;
  onClose: () => void;
  // AI 추천 팩(날씨 추천 · 가볼 곳)은 이름을 바꿀 수 없다(2026-10-20)
  nameLocked?: boolean;
  onRename: (name: string) => void;
  onSetAllChecked: (checked: boolean) => void;
  onToggleAutoSync: () => void;
  onDelete: () => void;
  // 없으면 줄을 숨긴다(자동 동기화 중인 메모 등)
  library?: PackLibraryRow | null;
  // 없으면(옮길 가방이 없음) 줄을 숨긴다
  onMoveToBag?: () => void;
  // 없으면(오프라인 모드 · 게스트) 줄을 숨긴다
  privacyLock?: PackPrivacyRow;
}) {
  // 본문이 지금 이름 칸 값을 저장하는 함수를 여기 걸어 둔다(바깥 · 끌어내리기로 닫을 때도 저장하려고)
  const commitRef = useRef<(() => void) | null>(null);
  const closeWithName = () => {
    commitRef.current?.();
    onClose();
  };
  return (
    <Sheet open={!!pack} onClose={closeWithName} showClose={false}>
      {pack && (
        <PackSheetBody
          key={pack.id}
          pack={pack}
          nameLocked={nameLocked}
          commitRef={commitRef}
          onClose={onClose}
          onRename={onRename}
          onSetAllChecked={onSetAllChecked}
          onToggleAutoSync={onToggleAutoSync}
          onDelete={onDelete}
          library={library}
          onMoveToBag={onMoveToBag}
          privacyLock={privacyLock}
        />
      )}
    </Sheet>
  );
}

function PackSheetBody({
  pack,
  nameLocked,
  commitRef,
  onClose,
  onRename,
  onSetAllChecked,
  onToggleAutoSync,
  onDelete,
  library,
  onMoveToBag,
  privacyLock,
}: {
  pack: Pack;
  nameLocked: boolean;
  commitRef: React.RefObject<(() => void) | null>;
  onClose: () => void;
  onRename: (name: string) => void;
  onSetAllChecked: (checked: boolean) => void;
  onToggleAutoSync: () => void;
  onDelete: () => void;
  library?: PackLibraryRow | null;
  onMoveToBag?: () => void;
  privacyLock?: PackPrivacyRow;
}) {
  const [name, setName] = useState(pack.name);
  const isMemo = pack.kind === "editor";
  const rowCls = "flex min-h-13 items-center gap-3 border-b border-line bg-transparent text-left text-body";
  // 이름을 고친 채로 다른 줄을 누르거나 닫으면 이름도 같이 저장한다. 마지막으로 저장한 이름과 같으면 다시 쓰지 않는다
  const savedNameRef = useRef(pack.name);
  const deletingRef = useRef(false);
  const commitName = () => {
    const trimmed = name.trim();
    if (nameLocked || deletingRef.current || !trimmed || trimmed === savedNameRef.current) return;
    savedNameRef.current = trimmed;
    onRename(trimmed);
  };
  useEffect(() => {
    commitRef.current = commitName;
    return () => {
      commitRef.current = null;
    };
  });
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
          readOnly={nameLocked}
          aria-readonly={nameLocked || undefined}
          onChange={(e) => setName(e.target.value)}
          className={cx(
            "h-12 rounded-field border border-line px-4 text-body-lg font-semibold outline-none",
            nameLocked ? "bg-fill text-sub" : "bg-card focus:border-ink",
          )}
        />
        {nameLocked && <span className="text-caption text-faint">AI 추천으로 만든 팩이라 이름을 바꿀 수 없어요</span>}
      </label>
      <div className="flex flex-col rounded-card border border-line bg-card px-4">
        {!isMemo && (
          <>
            <button
              type="button"
              className={rowCls}
              onClick={() => {
                commitName();
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
                commitName();
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
              onChange={() => {
                commitName();
                onToggleAutoSync();
              }}
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
        {privacyLock &&
          (privacyLock.inherited ? (
            <div className="flex min-h-13 items-center gap-3 border-b border-line text-caption text-sub">
              <IconLock size={20} stroke={1.75} className="shrink-0" aria-hidden="true" />
              보관함에서 잠근 팩이라 같이 잠겨 있어요. 풀려면 팩 탭에서 풀어 주세요
            </div>
          ) : (
            <button
              type="button"
              className={rowCls}
              onClick={() => {
                commitName();
                onClose();
                privacyLock.onToggle();
              }}
            >
              {privacyLock.locked ? (
                <IconLockOpen size={20} stroke={1.75} className="text-sub" aria-hidden="true" />
              ) : (
                <IconLock size={20} stroke={1.75} className="text-sub" aria-hidden="true" />
              )}
              <span className="flex min-w-0 flex-1 flex-col">
                <span>{privacyLock.locked ? "잠금 풀기" : isMemo ? "이 메모 잠그기" : "이 팩 잠그기"}</span>
                {!privacyLock.locked && <span className="text-micro text-sub">나만 잠기고, 함께 쓰는 사람에게는 그대로 보여요</span>}
              </span>
            </button>
          ))}
        <button
          type="button"
          className="flex min-h-13 items-center bg-transparent text-left text-body text-alert"
          onClick={() => {
            // 지우는 팩의 이름은 저장하지 않는다
            deletingRef.current = true;
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
