import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { BagFolder } from "@/lib/types";

// users/{uid}.bagFolders에서 제대로 된 폴더만 남긴다. 점(.) 경로 쓰기(bagFolders.X.parentId 등)가 이미 지워진 폴더에
// 늦게 도착하면 name 없는 반쪽 항목이 생길 수 있고, 그러면 이름 정렬에서 화면이 터진다(2026-10-03).
// 이름이 문자열인 항목만 남기고, id는 문서 키로 맞춘다(데이터는 지우지 않고 화면에서만 뺀다).
export function validBagFolders(raw: Record<string, BagFolder> | undefined): Record<string, BagFolder> {
  const out: Record<string, BagFolder> = {};
  for (const [key, f] of Object.entries(raw ?? {})) {
    if (f && typeof f.name === "string") out[key] = { ...f, id: key };
  }
  return out;
}

// 리디자인 v2: 홈 상단 가방 폴더 칩 순서.
// UserProfile.bagFolderOrder(폴더 id 배열)에 적힌 순서를 먼저, 거기 없는 폴더(새로 만든 폴더 등)는 뒤에 이름순으로 붙인다.
// 순서를 한 번도 바꾸지 않았으면 예전처럼 전부 이름순이다. 지워진 폴더 id는 그냥 건너뛴다.
export function sortBagFolders(folders: Record<string, BagFolder>, order: string[] | undefined): BagFolder[] {
  const byName = (a: BagFolder, b: BagFolder) => (a.name ?? "").localeCompare(b.name ?? "", "ko");
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

// 계정(users/{uid})에 저장. 가방 문서는 건드리지 않는다(폴더는 개인 정리 정보).
// 쓰기 1회. users/{uid} 실시간 구독이 로컬 쓰기를 바로 반영하므로 칩 순서가 즉시 바뀐다.
export async function saveBagFolderOrder(uid: string, order: string[]): Promise<void> {
  await setDoc(doc(db, "users", uid), { bagFolderOrder: order }, { merge: true });
}
