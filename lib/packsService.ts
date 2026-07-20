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

// 팩 보관함은 공유되지 않는 개인 전용 공간이다.
// 가방은 여러 명이 같이 쓰지만, 그 가방 안에서 누가 불러온 팩이든
// 다른 사람 보관함에는 영향을 주지 않는다. 필요하면 북마크로
// 각자 자기 보관함에 복사해서 저장한다.
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

// 팩을 보관함에 저장한다. 그 팩 id가 보관함에 아직 없으면(=새로 만드는 것) 무료
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
  // "그 이후로 보관함이 또 바뀌었는지" 정확히 비교할 수 있다.
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

// 휴지통에서 복구. firestore.rules가 클라이언트의 직접 복구를 막아둬서 app/api/restore-library-pack을 거친다.
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
    throw new Error(message);
  }
}

// 가방 "안"에서 팩을 삭제했을 때, 완전히 없애는 대신 팩 보관함의 휴지통으로 복사해
// 넣는다(원본 가방 배열에서 지우는 것은 호출하는 쪽이 별도로 처리). libraryPacks의
// client-side create가 막혀있어(firestore.rules) app/api/trash-bag-pack(Admin SDK)을 거친다.
export async function trashBagPackRemote(
  user: User,
  pack: Pack,
  sourceBagId: string,
  sourceBagName: string
) {
  const idToken = await user.getIdToken();
  const res = await fetch("/api/trash-bag-pack", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ pack, sourceBagId, sourceBagName }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data?.error as string | undefined) ?? "휴지통으로 옮기지 못했어요";
    throw new Error(message);
  }
}

// 실시간 구독 없이 한 번만 조회 (회원탈퇴 등 일괄 처리용)
export async function getLibraryPacksOnce(uid: string): Promise<Pack[]> {
  const snap = await getDocs(packsCol(uid));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Pack));
}

// --- v68 폴더(그룹) 기능 -----------------------------------------------------
// 폴더도 그냥 Pack 문서다(type: "folder", items: []). 아이폰 메모처럼 폴더 안에
// 폴더를 계속 만들 수 있어(깊이 제한 없음) 트리를 순회해서 하위 id를 모으는 유틸이 필요하다.

// rootId의 모든 하위(직접 자식 + 손자...) id를 재귀로 모은다. allPacks에는 폴더 구조를
// 다 잡아둬야 하니, 휴지통 예외 없이 항상 전체(필요시 휴지통 포함) 배열을 넘겨야 한다.
export function collectDescendantPackIds(allPacks: Pack[], rootId: string): string[] {
  const children = allPacks.filter((p) => p.parentId === rootId);
  return children.flatMap((c) => [c.id, ...collectDescendantPackIds(allPacks, c.id)]);
}

// 폴더를 휴지통으로 보내면(아이폰 메모처럼) 하위 팩/폴더까지 함께 보낸다. 일반 팩을 보낼
// 때도(하위 없음) 똑같이 동작한다(collectDescendantPackIds가 빈 배열을 반환할 뿐).
export async function trashLibraryEntryRecursive(uid: string, allPacks: Pack[], rootId: string) {
  const ids = [rootId, ...collectDescendantPackIds(allPacks, rootId)];
  await Promise.all(ids.map((id) => trashLibraryPackRemote(uid, id)));
}

// 휴지통에서 폴더를 복구하면 하위 팩/폴더도 함께 복구된다. allPacks에는 트리 순회를 위해
// 휴지통에 있는 항목까지 포함된 전체(활성+휴지통) 목록을 넘겨야 한다.
//
// 주의할 점: 폴더 없이 그 안의 팩 하나만 따로 복구하는 경우(부모 폴더는 휴지통에 그대로
// 남겨둔 채로) - 그러면 그 팩의 parentId가 여전히 휴지통에 있는 폴더를 가리키게 되어,
// 트리(활성 폴더만 순회)에서는 어디에도 나타나지 않는 "보이지 않는 팩"이 되어버린다.
// 그래서 복구 후에는 부모 폴더가 아직 휴지통에 있는지 확인하고, 그렇다면 이 팩을
// 최상위(parentId undefined)로 옮겨서 다시 눈에 보이게 만든다.
export async function restoreLibraryEntryRecursive(user: User, allPacks: Pack[], rootId: string) {
  const ids = [rootId, ...collectDescendantPackIds(allPacks, rootId)];
  await Promise.all(ids.map((id) => restoreLibraryPackRemote(user, id)));

  const root = allPacks.find((p) => p.id === rootId);
  if (root?.parentId) {
    const parent = allPacks.find((p) => p.id === root.parentId);
    if (parent?.trashedAt) {
      await saveLibraryPackRemote(user, { ...root, parentId: undefined, trashedAt: undefined });
    }
  }
}

// 휴지통에서 완전삭제(되돌릴 수 없음)도 동일하게 재귀로 처리한다.
export async function deleteLibraryEntryRecursive(uid: string, allPacks: Pack[], rootId: string) {
  const ids = [rootId, ...collectDescendantPackIds(allPacks, rootId)];
  await Promise.all(ids.map((id) => deleteLibraryPackRemote(uid, id)));
}
