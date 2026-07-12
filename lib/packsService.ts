import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "@/lib/firebase";
import { Pack } from "@/lib/types";
import { stripUndefined } from "@/lib/firestoreSanitize";
import { PremiumLimitError } from "@/lib/premiumLimits";

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

// 팩을 라이브러리에 저장한다. 그 팩 id가 라이브러리에 아직 없으면(=새로 만드는 것) 무료
// 개수 제한(FREE_MAX_LIBRARY_PACKS)을 서버에서 검증해야 해서 app/api/create-library-pack을
// 호출하고, 이미 있는 팩이면(=수정) 기존처럼 클라이언트가 직접 저장한다 - 0.5초 디바운스
// 자동저장이라 매번 서버를 거치면 타이핑마다 왕복이 생기기 때문. firestore.rules에서도
// libraryPacks의 client-side create는 막아둬서, 새 팩은 이 경로 말고는 생성이 안 된다.
export async function saveLibraryPackRemote(user: User, pack: Pack) {
  const ref = doc(packsCol(user.uid), pack.id);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const idToken = await user.getIdToken();
    const res = await fetch("/api/create-library-pack", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ pack }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = (data?.error as string | undefined) ?? "팩 저장에 실패했어요";
      if (data?.code === "PACK_LIMIT_REACHED") {
        throw new PremiumLimitError(message);
      }
      throw new Error(message);
    }
    return data.pack as Pack;
  }

  // updatedAt은 호출하는 쪽(BagEditorScreen)에서 미리 만들어서 넘겨준 값을 그대로 쓴다.
  // 그래야 그쪽에서 같은 타임스탬프를 pack.linkedLibraryUpdatedAt으로도 저장해서
  // "그 이후로 라이브러리가 또 바뀌었는지" 정확히 비교할 수 있다.
  const now = pack.updatedAt ?? new Date().toISOString();
  // createdAt은 최초 저장 시점 값을 계속 유지해야 "생성일자" 정렬이 의미있다.
  const createdAt =
    pack.createdAt ?? (snap.data().createdAt as string | undefined) ?? now;
  await setDoc(ref, stripUndefined({ ...pack, createdAt, updatedAt: now }));
}

export async function deleteLibraryPackRemote(uid: string, packId: string) {
  await deleteDoc(doc(packsCol(uid), packId));
}

// 완전삭제 대신 휴지통으로 보낸다. trashedAt만 채우고 문서 자체는 그대로 둔다 - 30일 뒤
// 자동 영구삭제되거나, 그 전에 복구/영구삭제할 수 있다.
export async function trashLibraryPackRemote(uid: string, packId: string) {
  await updateDoc(doc(packsCol(uid), packId), { trashedAt: new Date().toISOString() });
}

// 휴지통에서 복구. 무료 라이브러리 개수 제한(FREE_MAX_LIBRARY_PACKS)을 서버에서 다시 검증해야
// 해서(firestore.rules가 클라이언트의 직접 복구를 막아둔) app/api/restore-library-pack을 거친다.
export async function restoreLibraryPackRemote(user: User, packId: string) {
  const idToken = await user.getIdToken();
  const res = await fetch("/api/restore-library-pack", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ packId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data?.error as string | undefined) ?? "팩을 복구하지 못했어요";
    if (data?.code === "PACK_LIMIT_REACHED") {
      throw new PremiumLimitError(message);
    }
    throw new Error(message);
  }
}

// 실시간 구독 없이 한 번만 조회 (회원탈퇴 등 일괄 처리용)
export async function getLibraryPacksOnce(uid: string): Promise<Pack[]> {
  const snap = await getDocs(packsCol(uid));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Pack));
}
