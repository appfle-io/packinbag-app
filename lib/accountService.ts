import { doc, deleteDoc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  getUserBagsOnce,
  leaveBagRemote,
  deleteBagWithInviteCodeRemote,
} from "@/lib/bagsService";
import { getLibraryPacksOnce, deleteLibraryPackRemote } from "@/lib/packsService";
import { deleteBagImage } from "@/lib/storageService";

// 회원탈퇴 시 Firestore/Storage에 남아있는 이 사용자의 데이터를 정리한다.
// - 나만 있는 가방(memberIds가 1명, 곧 나 자신)은 이미지까지 포함해서 완전히 삭제
// - 다른 사람과 함께 쓰는 가방은 나만 빠져나오기 (다른 멤버는 계속 사용 가능)
// - 팩 보관함(개인 전용 공간)은 전부 삭제
// - users/{uid} 프로필 문서 삭제
// Firebase Auth 계정 자체 삭제는 이 함수를 호출한 쪽(AuthProvider)에서 이어서 처리한다.
export async function deleteAllUserData(uid: string) {
  // 다른 그룹원이 옛 댓글 작성자를 "그룹만 나갔다/강퇴됐다"와 "진짜로 회원탈퇴했다"를
  // 구별할 수 있게, 계정이 아직 살아있는(=본인 인증 상태) 지금 가벼운 마커를 남겨둔다.
  // 단순히 그룹을 나가거나 강퇴된 것만으로는 계정이 여전히 존재하므로 익명화하면 안 되고,
  // 이 마커가 있어야만(=실제로 계정을 삭제) 익명화 대상이 된다. 이후 어떤 경로로도
  // 수정/삭제가 안 되게 firestore.rules에서 막아둔다(deletedAccounts/{uid} 참고).
  await setDoc(doc(db, "deletedAccounts", uid), { deletedAt: new Date().toISOString() });

  const bags = await getUserBagsOnce(uid);

  for (const bag of bags) {
    if (bag.memberIds.length <= 1) {
      await Promise.all(bag.images.map((url) => deleteBagImage(url)));
      await deleteBagWithInviteCodeRemote(bag);
    } else {
      await leaveBagRemote(uid, bag.id);
    }
  }

  const packs = await getLibraryPacksOnce(uid);
  await Promise.all(packs.map((p) => deleteLibraryPackRemote(uid, p.id)));

  await deleteDoc(doc(db, "users", uid));
}

// 댓글 작성자 표시용 - 이 uid들 중 실제로 회원탈퇴(계정 완전 삭제)한 사람이 누구인지
// 확인한다(deletedAccounts 컬렉션 참고). 단순히 그룹을 나간(나가기/강퇴) 사람은 건드리지
// 않는다 - 그룹은 나갔더라도 계정이 여전히 있으면 익명화하면 안 된다. 이미 결과가 결정된
// uid는 다시 조회하지 않도록 호출하는 쪽(BagEditorScreen)에서 캐시를 잡아둔다.
export async function fetchDeletedAccountIds(uids: string[]): Promise<Set<string>> {
  const unique = Array.from(new Set(uids));
  if (unique.length === 0) return new Set();
  const results = await Promise.all(
    unique.map(async (uid) => {
      try {
        const snap = await getDoc(doc(db, "deletedAccounts", uid));
        return snap.exists() ? uid : null;
      } catch {
        return null;
      }
    })
  );
  return new Set(results.filter((v): v is string => v !== null));
}
