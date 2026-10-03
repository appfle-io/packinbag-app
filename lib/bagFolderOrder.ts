import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { BagFolder } from "@/lib/types";

// 리디자인 v2: 홈 상단 가방 폴더 칩 순서.
// UserProfile.bagFolderOrder(폴더 id 배열)에 적힌 순서를 먼저, 거기 없는 폴더(새로 만든 폴더 등)는 뒤에 이름순으로 붙인다.
// 순서를 한 번도 바꾸지 않았으면 예전처럼 전부 이름순이다. 지워진 폴더 id는 그냥 건너뛴다.
export function sortBagFolders(folders: Record<string, BagFolder>, order: string[] | undefined): BagFolder[] {
  const byName = (a: BagFolder, b: BagFolder) => a.name.localeCompare(b.name, "ko");
  const listed: BagFolder[] = [];
  const seen = new Set<string>();
  for (const id of order ?? []) {
    const f = folders[id];
    if (f && !seen.has(id)) {
      listed.push(f);
      seen.add(id);
    }
  }
  const rest = Object.values(folders)
    .filter((f) => !seen.has(f.id))
    .sort(byName);
  return [...listed, ...rest];
}

// 지금 보이는 순서(ids)에서 id를 delta칸(-1 앞으로 / +1 뒤로) 옮긴 새 순서. 더 못 가면 null
export function moveFolderInOrder(ids: string[], id: string, delta: -1 | 1): string[] | null {
  const from = ids.indexOf(id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= ids.length) return null;
  const next = [...ids];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

// 계정(users/{uid})에 저장. 가방 문서는 건드리지 않는다(폴더는 개인 정리 정보).
// 쓰기 1회. users/{uid} 실시간 구독이 로컬 쓰기를 바로 반영하므로 칩 순서가 즉시 바뀐다.
export async function saveBagFolderOrder(uid: string, order: string[]): Promise<void> {
  await setDoc(doc(db, "users", uid), { bagFolderOrder: order }, { merge: true });
}
