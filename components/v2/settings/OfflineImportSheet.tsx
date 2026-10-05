"use client";

import { useState } from "react";
import { IconBackpack, IconChecklist, IconFolder, IconNotes } from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/components/Toast";
import { getImportedOfflineIds, getOfflineDataSummary, importOfflineDataToOnline } from "@/lib/offlineImportService";
import { FREE_MAX_ACTIVE_BAGS, FREE_MAX_LIBRARY_PACKS, isPremiumUser } from "@/lib/premiumLimits";
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

// 오프라인 모드로 만든 가방·팩을 계정으로 복사한다(이 기기의 오프라인 데이터는 그대로 남음).
// - mode "merge": 오프라인 모드에서 로그인한 직후 AppShell이 한 번 띄운다(연결 흐름 E). "옮길게요" 문구 + 나중에
// - mode "settings": 설정 > 데이터 > 오프라인 데이터 가져오기
// 아직 안 가져온 항목이 처음부터 골라져 있다. 무료 개수를 넘으면 넘는 것만 이 기기에 남기고 onLimit로 프리미엄 안내를 넘긴다
export function OfflineImportSheet({
  open,
  onClose,
  mode = "settings",
  onLimit,
}: {
  open: boolean;
  onClose: () => void;
  mode?: "merge" | "settings";
  onLimit?: (message: string) => void;
}) {
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
  const merge = mode === "merge";
  const premium = !!user && isPremiumUser(user.email, profile);
  const verb = merge ? "옮기기" : "가져오기";

  const run = async () => {
    if (!user || !profile || count === 0) return;
    setBusy(true);
    try {
      const result = await importOfflineDataToOnline({ user, profile, selectedBagIds: [...bagIds], selectedPackIds: [...packIds] });
      const done = result.importedBagsCount + result.importedPacksCount;
      onClose();
      if (result.blockedMessage) {
        show(
          done > 0
            ? `${done}개를 계정에 옮겼어요. ${result.skippedCount}개는 무료 개수를 넘어 이 기기에 남겨 두었어요`
            : "무료 개수를 넘어 옮기지 못했어요. 이 기기에 그대로 있어요",
        );
        onLimit?.(result.blockedMessage);
        return;
      }
      show(`가방 ${result.importedBagsCount}개, 팩 ${result.importedPacksCount}개를 내 계정으로 ${merge ? "옮겼어요" : "가져왔어요"}`);
    } catch (err) {
      console.error("[OfflineImportSheet] 가져오기 실패:", err);
      show(merge ? "옮기지 못했어요. 설정 > 데이터에서 다시 해 주세요" : "가져오지 못했어요. 잠시 뒤 다시 해 주세요");
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

  // 합치기 안내에 쓸 개수: 아직 안 옮긴 것만
  const leftBags = bagRows.filter((r) => !r.imported).length;
  const leftPacks = packRows.filter((r) => !r.imported).length;
  const leadText = merge
    ? `오프라인으로 쓰던 ${[leftBags ? `가방 ${leftBags}개` : null, leftPacks ? `팩 ${leftPacks}개` : null].filter(Boolean).join(" · ")}를 계정으로 옮길게요. 다른 기기에서도 보이고, 이 기기의 사본은 그대로 남아요.`
    : "오프라인에서 만든 가방과 팩을 내 계정으로 복사해요. 이 기기의 오프라인 데이터는 그대로 남아요.";

  return (
    <Sheet
      open={open}
      onClose={busy ? () => {} : onClose}
      title={merge ? "이 기기의 가방·팩 옮기기" : "오프라인 데이터 가져오기"}
      size="tall"
      showClose={!busy}
      footer={
        <div className="flex flex-col gap-2">
          <Button block disabled={busy || count === 0} onClick={run}>
            {busy ? (merge ? "옮기는 중" : "가져오는 중") : count > 0 ? `${count}개 내 계정으로 ${verb}` : "고르면 계정으로 옮길 수 있어요"}
          </Button>
          {merge && !busy && (
            <Button block variant="text" onClick={onClose}>
              나중에 하기
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <p className="m-0 text-caption text-sub">{leadText}</p>
          {!premium && (
            <p className="m-0 text-caption text-sub">
              {`무료는 내가 만든 가방 ${FREE_MAX_ACTIVE_BAGS}개 · 팩 ${FREE_MAX_LIBRARY_PACKS}개까지예요. 넘는 것은 이 기기에 남겨 두고, 프리미엄을 안내해 드려요.`}
            </p>
          )}
          {merge && <p className="m-0 text-caption text-faint">나중에 하려면 설정 &gt; 데이터 &gt; 오프라인 데이터 가져오기에서 언제든 할 수 있어요.</p>}
        </div>
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
