// 리디자인 v2: 가방 폴더를 1단계(홈 칩)로 평평하게 만들 때 생기는 이름 겹침 정리.
// 예) "여행/Archive"와 "업무/Archive"가 둘 다 최상위로 올라오면 칩에 "Archive"가 두 개 보인다.
//
// 규칙
// - 원래부터 최상위였던 폴더는 이름을 그대로 둔다. 그런 폴더가 여러 개면 먼저 만든 것만 그대로.
// - 나머지(하위 폴더였던 것)는 "이름 (원래 부모 이름)"으로 바꾼다. 그래도 겹치면 "이름 2", "이름 3"...
// - 대소문자·앞뒤 공백만 다른 이름도 같은 이름으로 본다.
// 순수 함수라 Firestore를 읽거나 쓰지 않는다. 바뀌는 폴더만 { id: 새 이름 }으로 돌려준다.

import type { BagFolder } from "@/lib/types";

export function normalizeFolderName(name: string): string {
  return name.trim().toLocaleLowerCase("ko");
}

// 평평하게 만든 뒤 기준으로 "원래 부모" id (아직 안 평평해졌으면 parentId, 이미 평평하면 legacyParentId)
function originalParentOf(f: BagFolder): string | undefined {
  return f.parentId ?? f.legacyParentId;
}

export function resolveFolderNameClashes(folders: Record<string, BagFolder>): Record<string, string> {
  // 키(문서 필드 이름)를 id로 쓴다 - 저장할 때 bagFolders.{키}.name 경로로 쓰기 때문
  const list = Object.entries(folders).map(([key, f]) => ({ ...f, id: key }));
  const groups = new Map<string, BagFolder[]>();
  for (const f of list) {
    const key = normalizeFolderName(f.name);
    groups.set(key, [...(groups.get(key) ?? []), f]);
  }

  const taken = new Set(list.map((f) => normalizeFolderName(f.name)));
  const renames: Record<string, string> = {};

  for (const group of groups.values()) {
    if (group.length < 2) continue;
    // 그대로 둘 폴더: 원래 최상위였던 것 우선, 그다음 먼저 만든 것
    const sorted = [...group].sort((a, b) => {
      const aTop = originalParentOf(a) ? 1 : 0;
      const bTop = originalParentOf(b) ? 1 : 0;
      if (aTop !== bTop) return aTop - bTop;
      return (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
    });

    for (const f of sorted.slice(1)) {
      const base = f.name.trim();
      const parent = originalParentOf(f);
      const parentName = parent ? folders[parent]?.name?.trim() : undefined;
      const candidates: string[] = [];
      if (parentName && normalizeFolderName(parentName) !== normalizeFolderName(base)) {
        candidates.push(`${base} (${parentName})`);
      }
      for (let n = 2; n < 100; n++) candidates.push(`${base} ${n}`);

      const next = candidates.find((c) => !taken.has(normalizeFolderName(c)));
      if (!next) continue;
      taken.add(normalizeFolderName(next));
      renames[f.id] = next;
    }
  }
  return renames;
}

export function hasFolderNameClash(folders: Record<string, BagFolder>): boolean {
  const seen = new Set<string>();
  for (const f of Object.values(folders)) {
    const key = normalizeFolderName(f.name);
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}
