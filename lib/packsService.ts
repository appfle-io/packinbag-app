import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Pack } from "@/lib/types";
import { stripUndefined } from "@/lib/firestoreSanitize";

// 팩 라이브러리는 공유되지 않는 개인 전용 공간이다.
// 가방은 여러 명이 같이 쓰지만, 그 가방 안에서 누가 불러온 팩이든
// 다른 사람 라이브러리에는 영향을 주지 않는다. 필요하면 북마크로
// 각자 자기 라이브러리에 복사해서 저장한다.
function packsCol(uid: string) {
  return collection(db, "users", uid, "libraryPacks");
}

export function subscribeToLibraryPacks(
  uid: string,
  callback: (packs: Pack[]) => void
) {
  const q = query(packsCol(uid));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Pack)));
  });
}

export async function saveLibraryPackRemote(uid: string, pack: Pack) {
  const ref = doc(packsCol(uid), pack.id);
  const now = new Date().toISOString();
  // createdAt은 최초 저장 시점 값을 계속 유지해야 "생성일자" 정렬이 의미있다.
  // 로컬 상태엔 없을 수 있어서(저장 후 안 돌려받는 구조) 없으면 기존 문서에서 확인한다.
  let createdAt = pack.createdAt;
  if (!createdAt) {
    const snap = await getDoc(ref);
    createdAt = (snap.exists() ? (snap.data().createdAt as string | undefined) : undefined) ?? now;
  }
  await setDoc(ref, stripUndefined({ ...pack, createdAt, updatedAt: now }));
}

export async function deleteLibraryPackRemote(uid: string, packId: string) {
  await deleteDoc(doc(packsCol(uid), packId));
}

// 실시간 구독 없이 한 번만 조회 (회원탈퇴 등 일괄 처리용)
export async function getLibraryPacksOnce(uid: string): Promise<Pack[]> {
  const snap = await getDocs(packsCol(uid));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Pack));
}
