"use client";

import { useState } from "react";
import { IconBackpack, IconChecklist, IconFolder, IconNotes } from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/components/Toast";
import { getImportedOfflineIds, getOfflineDataSummary, importOfflineDataToOnline } from "@/lib/offlineImportService";
import { Badge, Button, CheckMark, SectionHeader, Sheet, cx } from "@/components/v2/ui";

type Summary = ReturnType<typeof getOfflineDataSummary>;

interface Row {
  id: string;
  name: string;
  meta: string;
  icon: React.ReactNode;
  imported: boolean;
}

function SelectRows({ rows, selected, onToggle }: { rows: Row[]; selected: Set<string>; onToggle: (id: string) => void }) {
  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {rows.map((r, i) => {
        const on = selected.has(r.id);
        return (
          <li key={r.id}>
            <button
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => onToggle(r.id)}
              className={cx("flex min-h-13 w-full items-center gap-3 bg-transparent py-2 text-left active:bg-fill", i < rows.length - 1 && "border-b border-line")}
            >
              <CheckMark checked={on} shape="square" />
              <span className="flex size-6 shrink-0 items-center justify-center text-sub">{r.icon}</span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-body text-ink">{r.name || "이름 없음"}</span>
                  {r.imported && <Badge>가져옴</Badge>}
                </span>
                <span className="truncate text-caption text-sub">{r.meta}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// 설정 > 오프라인 데이터 가져오기. 구 OfflineDataImportModal 대체(같은 서비스).
// 아직 안 가져온 항목이 처음부터 골라져 있다. 이 기기의 오프라인 데이터는 그대로 남는다(복사)
export function OfflineImportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, profile } = useAuth();
  const { show } = useToast();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [imported, setImported] = useState<Set<string>>(new Set());
  const [bagIds, setBagIds] = useState<Set<string>>(new Set());
  const [packIds, setPackIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  // 열 때 이 기기의 오프라인 데이터를 다시 읽는다
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      const s = getOfflineDataSummary();
      const done = getImportedOfflineIds();
      setSummary(s);
      setImported(done);
      setBagIds(new Set(s.bags.filter((b) => !done.has(b.id)).map((b) => b.id)));
      setPackIds(new Set(s.packs.filter((p) => !done.has(p.id)).map((p) => p.id)));
    }
  }

  const toggle = (setter: React.Dispatch<React.SetStateAction<Set<string>>>) => (id: string) =>
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const count = bagIds.size + packIds.size;

  const run = async () => {
    if (!user || !profile || count === 0) return;
    setBusy(true);
    try {
      const result = await importOfflineDataToOnline({ user, profile, selectedBagIds: [...bagIds], selectedPackIds: [...packIds] });
      show(`가방 ${result.importedBagsCount}개, 팩 ${result.importedPacksCount}개를 내 계정으로 가져왔어요`);
      onClose();
    } catch (err) {
      console.error("[OfflineImportSheet] 가져오기 실패:", err);
      show("가져오지 못했어요. 잠시 뒤 다시 해 주세요");
    } finally {
      setBusy(false);
    }
  };

  const bagRows: Row[] = (summary?.bags ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    meta: `팩 ${b.packs?.length ?? 0}개`,
    icon: <IconBackpack size={20} stroke={1.6} aria-hidden="true" />,
    imported: imported.has(b.id),
  }));
  const packRows: Row[] = (summary?.packs ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    meta: p.type === "folder" ? "폴더" : p.kind === "editor" ? "메모" : `아이템 ${p.items?.length ?? 0}개`,
    icon:
      p.type === "folder" ? (
        <IconFolder size={20} stroke={1.6} aria-hidden="true" />
      ) : p.kind === "editor" ? (
        <IconNotes size={20} stroke={1.6} aria-hidden="true" />
      ) : (
        <IconChecklist size={20} stroke={1.6} aria-hidden="true" />
      ),
    imported: imported.has(p.id),
  }));

  return (
    <Sheet
      open={open}
      onClose={busy ? () => {} : onClose}
      title="오프라인 데이터 가져오기"
      size="tall"
      showClose={!busy}
      footer={
        <Button block disabled={busy || count === 0} onClick={run}>
          {busy ? "가져오는 중" : count > 0 ? `${count}개 내 계정으로 가져오기` : "가져올 것을 골라 주세요"}
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <p className="m-0 text-caption text-sub">오프라인에서 만든 가방과 팩을 내 계정으로 복사해요. 이 기기의 오프라인 데이터는 그대로 남아요.</p>
        {bagRows.length === 0 && packRows.length === 0 ? (
          <p className="m-0 py-16 text-center text-body text-sub">가져올 오프라인 데이터가 없어요</p>
        ) : (
          <>
            {bagRows.length > 0 && (
              <section className="flex flex-col">
                <SectionHeader>가방 {bagRows.length}</SectionHeader>
                <SelectRows rows={bagRows} selected={bagIds} onToggle={toggle(setBagIds)} />
              </section>
            )}
            {packRows.length > 0 && (
              <section className="flex flex-col">
                <SectionHeader>팩 보관함 {packRows.length}</SectionHeader>
                <SelectRows rows={packRows} selected={packIds} onToggle={toggle(setPackIds)} />
              </section>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}
