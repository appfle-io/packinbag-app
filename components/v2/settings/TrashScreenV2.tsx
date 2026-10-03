"use client";

import { useState } from "react";
import { IconTrash } from "@tabler/icons-react";
import type { Bag, Pack } from "@/lib/types";
import { daysUntilPurge, TRASH_RETENTION_DAYS } from "@/lib/premiumLimits";
import { Button, IconButton, SectionHeader, cx } from "@/components/v2/ui";
import { ConfirmSheet } from "@/components/v2/bag/sheets/ConfirmSheet";
import { SubScreen } from "./SubScreen";

type Row = { key: string; name: string; meta: string; onRestore: () => void; onDelete: () => void };

function TrashRows({ rows }: { rows: Row[] }) {
  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {rows.map((r, i) => (
        <li key={r.key} className={cx("flex min-h-15 items-center gap-2 py-2", i < rows.length - 1 && "border-b border-line")}>
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate text-body font-semibold text-ink">{r.name || "이름 없음"}</span>
            <span className="truncate text-caption text-sub">{r.meta}</span>
          </span>
          <Button variant="secondary" size="sm" className="shrink-0 px-4" onClick={r.onRestore}>
            되살리기
          </Button>
          <IconButton label={`'${r.name}' 완전히 삭제`} className="text-alert" onClick={r.onDelete}>
            <IconTrash size={20} stroke={1.75} />
          </IconButton>
        </li>
      ))}
    </ul>
  );
}

// 설정 > 휴지통. 구 TrashScreen 대체(같은 props·같은 처리). 되살리기 · 완전 삭제(확인 시트)
export function TrashScreenV2({
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
  const [confirm, setConfirm] = useState<{ kind: "bag"; bag: Bag } | { kind: "pack"; packId: string } | null>(null);
  // 닫히는 동안 문구 유지
  const [shown, setShown] = useState(confirm);
  if (confirm && confirm !== shown) setShown(confirm);

  const bagRows: Row[] = [...bags]
    .sort((a, b) => (b.trashedByOwnerAt ?? "").localeCompare(a.trashedByOwnerAt ?? ""))
    .map((bag) => ({
      key: bag.id,
      name: bag.name,
      meta: `${daysUntilPurge(bag.trashedByOwnerAt)}일 뒤 자동 삭제`,
      onRestore: () => onRestoreBag(bag.id),
      onDelete: () => setConfirm({ kind: "bag", bag }),
    }));
  const packRows: Row[] = [...packs]
    .sort((a, b) => (b.trashedAt ?? "").localeCompare(a.trashedAt ?? ""))
    .map((pack) => ({
      key: pack.id,
      name: pack.name,
      meta: `${pack.trashSourceBagName ? `'${pack.trashSourceBagName}' 가방에서 · ` : ""}${daysUntilPurge(pack.trashedAt)}일 뒤 자동 삭제`,
      onRestore: () => onRestorePack(pack.id),
      onDelete: () => setConfirm({ kind: "pack", packId: pack.id }),
    }));

  return (
    <SubScreen title="휴지통" onBack={onBack} bodyClassName="gap-8">
      <p className="m-0 text-caption text-sub">지운 가방과 팩은 {TRASH_RETENTION_DAYS}일 동안 여기 있어요. 그 뒤에는 자동으로 완전히 지워져요.</p>

      {bagRows.length === 0 && packRows.length === 0 ? (
        <p className="m-0 py-16 text-center text-body text-sub">휴지통이 비어 있어요</p>
      ) : (
        <>
          {bagRows.length > 0 && (
            <section className="flex flex-col">
              <SectionHeader>가방 {bagRows.length}</SectionHeader>
              <TrashRows rows={bagRows} />
            </section>
          )}
          {packRows.length > 0 && (
            <section className="flex flex-col">
              <SectionHeader>팩 {packRows.length}</SectionHeader>
              <TrashRows rows={packRows} />
            </section>
          )}
        </>
      )}

      <ConfirmSheet
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={shown?.kind === "bag" ? "이 가방을 완전히 지울까요?" : "이 팩을 완전히 지울까요?"}
        message={
          shown?.kind === "bag"
            ? "되돌릴 수 없어요. 가방에 담긴 팩·아이템·사진이 모두 사라져요."
            : "되돌릴 수 없어요."
        }
        confirmLabel="완전히 삭제"
        danger
        onConfirm={() => {
          if (!confirm) return;
          if (confirm.kind === "bag") onPermanentDeleteBag(confirm.bag);
          else onPermanentDeletePack(confirm.packId);
        }}
      />
    </SubScreen>
  );
}
