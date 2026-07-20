"use client";

import { useState } from "react";
import { IconArrowLeft, IconRefresh, IconTrash, IconBackpack, IconPackage } from "@tabler/icons-react";
import { Bag, Pack } from "@/lib/types";
import { daysUntilPurge, TRASH_RETENTION_DAYS } from "@/lib/premiumLimits";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useSwipeBack } from "@/lib/useSwipeBack";

// 설정 > 휴지통. 소유한 가방 중 내가 휴지통으로 보낸 것과, 보관함에서 휴지통으로 보낸
// 팩을 여기서만 볼 수 있다(정상 목록에서는 숨겨져 있음). 항목마다 복구/완전삭제 버튼이
// 있고, 아무 조치도 하지 않으면 TRASH_RETENTION_DAYS(30일)이 지난 뒤 다음 접속 시점에
// AppShell이 자동으로 완전삭제한다(components/AppShell.tsx의 자동정리 effect 참고).
export default function TrashScreen({
  bags,
  packs,
  onBack,
  onRestoreBag,
  onPermanentDeleteBag,
  onRestorePack,
  onPermanentDeletePack,
}: {
  bags: Bag[];
  packs: Pack[];
  onBack: () => void;
  onRestoreBag: (bagId: string) => void;
  onPermanentDeleteBag: (bag: Bag) => void;
  onRestorePack: (packId: string) => void;
  onPermanentDeletePack: (packId: string) => void;
}) {
  const swipeBackRef = useSwipeBack<HTMLDivElement>(onBack);
  const [confirmDeleteBag, setConfirmDeleteBag] = useState<Bag | null>(null);
  const [confirmDeletePackId, setConfirmDeletePackId] = useState<string | null>(null);

  const sortedBags = [...bags].sort(
    (a, b) => (b.trashedByOwnerAt ?? "").localeCompare(a.trashedByOwnerAt ?? "")
  );
  const sortedPacks = [...packs].sort(
    (a, b) => (b.trashedAt ?? "").localeCompare(a.trashedAt ?? "")
  );
  const isEmpty = sortedBags.length === 0 && sortedPacks.length === 0;

  return (
    <div ref={swipeBackRef} className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 p-4 pb-2 shrink-0">
        <button onClick={onBack} className="-m-2.5 p-2.5" aria-label="뒤로가기">
          <IconArrowLeft size={20} stroke={1.75} />
        </button>
        <p className="text-[15px] font-medium">휴지통</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <p className="text-[11px] text-text-muted mb-4">
          삭제한 가방/팩이 여기 {TRASH_RETENTION_DAYS}일간 보관돼요. 그 안에 복구하지 않으면
          자동으로 완전히 사라져요.
        </p>

        {isEmpty ? (
          <p className="text-[13px] text-text-muted py-16 text-center">
            휴지통이 비어있어요
          </p>
        ) : (
          <>
            {sortedBags.length > 0 && (
              <div className="mb-6">
                <p className="text-[12px] text-text-secondary mb-2 flex items-center gap-1.5">
                  <IconBackpack size={14} stroke={1.75} />
                  가방 ({sortedBags.length})
                </p>
                <div className="rounded-lg border border-border overflow-hidden">
                  {sortedBags.map((bag, idx) => (
                    <div
                      key={bag.id}
                      className="flex items-center gap-2 p-3"
                      style={{
                        borderBottom: idx < sortedBags.length - 1 ? "1px solid var(--border)" : undefined,
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium truncate">{bag.name}</p>
                        <p className="text-[11px] text-text-muted">
                          {daysUntilPurge(bag.trashedByOwnerAt)}일 후 자동삭제
                        </p>
                      </div>
                      <button
                        onClick={() => onRestoreBag(bag.id)}
                        aria-label="가방 복구"
                        className="shrink-0 flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[12px]"
                      >
                        <IconRefresh size={13} stroke={1.75} />
                        복구
                      </button>
                      <button
                        onClick={() => setConfirmDeleteBag(bag)}
                        aria-label="가방 완전삭제"
                        className="shrink-0 -m-2 p-2"
                      >
                        <IconTrash size={16} stroke={1.75} color="var(--danger)" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sortedPacks.length > 0 && (
              <div>
                <p className="text-[12px] text-text-secondary mb-2 flex items-center gap-1.5">
                  <IconPackage size={14} stroke={1.75} />
                  팩 ({sortedPacks.length})
                </p>
                <div className="rounded-lg border border-border overflow-hidden">
                  {sortedPacks.map((pack, idx) => (
                    <div
                      key={pack.id}
                      className="flex items-center gap-2 p-3"
                      style={{
                        borderBottom: idx < sortedPacks.length - 1 ? "1px solid var(--border)" : undefined,
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium truncate">{pack.name}</p>
                        <p className="text-[11px] text-text-muted">
                          {pack.trashSourceBagName
                            ? `"${pack.trashSourceBagName}" 가방에서 삭제됨 · `
                            : ""}
                          {daysUntilPurge(pack.trashedAt)}일 후 자동삭제
                        </p>
                      </div>
                      <button
                        onClick={() => onRestorePack(pack.id)}
                        aria-label="팩 복구"
                        className="shrink-0 flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[12px]"
                      >
                        <IconRefresh size={13} stroke={1.75} />
                        복구
                      </button>
                      <button
                        onClick={() => setConfirmDeletePackId(pack.id)}
                        aria-label="팩 완전삭제"
                        className="shrink-0 -m-2 p-2"
                      >
                        <IconTrash size={16} stroke={1.75} color="var(--danger)" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {confirmDeleteBag && (
        <ConfirmDialog
          title="이 가방을 완전히 삭제할까요?"
          message="휴지통에서 완전삭제하면 되돌릴 수 없어요. 가방에 담긴 모든 팩과 짐, 사진이 함께 사라져요."
          confirmLabel="완전삭제"
          onCancel={() => setConfirmDeleteBag(null)}
          onConfirm={() => {
            const bag = confirmDeleteBag;
            setConfirmDeleteBag(null);
            onPermanentDeleteBag(bag);
          }}
        />
      )}

      {confirmDeletePackId && (
        <ConfirmDialog
          title="이 팩을 완전히 삭제할까요?"
          message="휴지통에서 완전삭제하면 되돌릴 수 없어요."
          confirmLabel="완전삭제"
          onCancel={() => setConfirmDeletePackId(null)}
          onConfirm={() => {
            const packId = confirmDeletePackId;
            setConfirmDeletePackId(null);
            onPermanentDeletePack(packId);
          }}
        />
      )}
    </div>
  );
}
