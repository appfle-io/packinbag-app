// 백업 복원 계획 - Firebase를 부르지 않는 순수 함수(2026-10-15). 실제 저장은 lib/backupService.ts.
//
// 복원은 덮어쓰지 않고 새로 만든다. 그래서 모든 가방 · 보관함 항목에 새 id를 주는데,
// - 보관함 항목의 parentId(폴더 안)는 옛 id라 새 id로 따라가게 바꾼다(안 그러면 폴더 안 팩이 어디에도 안 보였다)
// - 가방 속 팩의 linkedLibraryPackId(보관함에서 불러온 팩)도 같이 바꾼다(보관함 잠금 · 동기화가 이어지게)
// - 빠른팩(quick-pack)은 사용자당 하나라 새 id로 만들면 목록에 안 보이는 사본이 된다 → "빠른팩 (백업)"이라는 보통 팩으로
// - 공유 링크 토큰 · 잠김 · 휴지통 표시는 옛 것이라 뺀다
// 중간에 실패하면 이어서 할 수 있게 옛 id → 새 id와 끝낸 것(done)을 이 기기에 남긴다(같은 파일을 다시 고르면 이어서).
import type { Bag, Pack } from "@/lib/types";

// lib/premiumLimits QUICK_PACK_ID와 같은 값(그 파일은 firebase를 불러서 여기서는 따로 둔다)
const QUICK_PACK_DOC_ID = "quick-pack";
export const BACKUP_QUICK_PACK_NAME = "빠른팩 (백업)";

export interface BackupFileContent {
  version: "1.0";
  appName: "PackInBag";
  exportedAt: string;
  bags: Bag[];
  libraryPacks: Pack[];
}

export interface RestoreProgress {
  // 옛 id → 새 id
  bags: Record<string, string>;
  packs: Record<string, string>;
  // 이미 만든 것: "bag:옛id" · "pack:옛id"
  done: string[];
}

export type RestoreIdKind = "bag" | "pack";

/** 이어서 할 기록의 키. 같은 파일(내보낸 시각 · 개수)을 같은 곳(계정 uid / 이 기기)에 복원할 때만 이어서 한다 */
export function restoreProgressKey(scope: string, data: BackupFileContent): string {
  return `pib_restore:${scope}:${data.exportedAt}:${data.bags.length}:${data.libraryPacks.length}`;
}

/** 모든 항목에 새 id를 정한다. 지난번 기록이 있으면 그 id를 그대로 쓴다(이어서 할 때 폴더 연결이 맞게) */
export function buildRestoreProgress(
  data: BackupFileContent,
  makeId: (kind: RestoreIdKind) => string,
  prev?: RestoreProgress | null,
): RestoreProgress {
  const bags: Record<string, string> = { ...(prev?.bags ?? {}) };
  const packs: Record<string, string> = { ...(prev?.packs ?? {}) };
  data.libraryPacks.forEach((p) => {
    if (p?.id && !packs[p.id]) packs[p.id] = makeId("pack");
  });
  data.bags.forEach((b) => {
    if (b?.id && !bags[b.id]) bags[b.id] = makeId("bag");
  });
  return { bags, packs, done: [...(prev?.done ?? [])] };
}

export const isQuickPackEntry = (p: Pick<Pack, "id" | "isQuickPack">) => p.id === QUICK_PACK_DOC_ID || !!p.isQuickPack;

/** 복원할 보관함 항목(새 id · 새 parentId). 폴더가 백업에 없으면 맨 위로 */
export function restoredLibraryPack(pack: Pack, progress: RestoreProgress, now: string): Pack {
  const quick = isQuickPackEntry(pack);
  const out: Pack = { ...pack, id: progress.packs[pack.id], updatedAt: now };
  delete out.publicShareToken;
  delete out.locked;
  delete out.trashedAt;
  delete out.isQuickPack;
  const parent = !quick && pack.parentId ? progress.packs[pack.parentId] : undefined;
  if (parent) out.parentId = parent;
  else delete out.parentId;
  if (quick) out.name = BACKUP_QUICK_PACK_NAME;
  return out;
}

/** 복원할 가방 속 팩: 보관함에서 불러온 팩이면 새 보관함 id로 */
export function restoredBagPacks(bag: Bag, progress: RestoreProgress): Pack[] {
  return (bag.packs ?? []).map((p) => {
    const linked = p.linkedLibraryPackId ? progress.packs[p.linkedLibraryPackId] : undefined;
    return linked ? { ...p, linkedLibraryPackId: linked } : p;
  });
}

/** 보관함 항목 복원 순서: 폴더 먼저(바깥 폴더부터), 그다음 팩 · 메모. 백업 안 순서는 그대로 */
export function libraryRestoreOrder(packs: Pack[]): Pack[] {
  const byId = new Map(packs.map((p) => [p.id, p]));
  const depth = (p: Pack) => {
    let d = 0;
    let cur = p.parentId ? byId.get(p.parentId) : undefined;
    while (cur && d < 20) {
      d++;
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return d;
  };
  const folders = packs.filter((p) => p.type === "folder").map((p, i) => ({ p, i, d: depth(p) }));
  folders.sort((a, b) => a.d - b.d || a.i - b.i);
  return [...folders.map((f) => f.p), ...packs.filter((p) => p.type !== "folder")];
}
